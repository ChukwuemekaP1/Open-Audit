/**
 * Decoupled Next.js Server with Redis Pub/Sub WebSocket Broadcasting
 *
 * This server is completely decoupled from the indexing logic:
 * 1. Subscribes to Redis Pub/Sub channel for events
 * 2. Broadcasts received events to WebSocket clients
 * 3. Does NOT perform any blockchain polling or indexing
 *
 * The indexing is handled by a separate worker process (src/worker/indexer.ts)
 *
 * Run with: npx ts-node --project tsconfig.server.json server-decoupled.ts
 * (or via the `dev:ws` npm script)
 */
import { createServer, IncomingMessage } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import Redis from "ioredis";

// ============================================================================
// Configuration
// ============================================================================

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_CHANNEL = process.env.REDIS_CHANNEL || "stellar:events";

// WebSocket connection limits
const MAX_WS_CONNECTIONS_PER_IP = parseInt(
  process.env.MAX_WS_CONNECTIONS_PER_IP ?? "5",
  10
);
const connectionsByIp = new Map<string, number>();

// Health check
const HEALTH_CHECK_INTERVAL_MS = parseInt(
  process.env.HEALTH_CHECK_INTERVAL_MS || "30000",
  10
);

// ============================================================================
// Helper Functions
// ============================================================================

function getClientIp(req: IncomingMessage): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket.remoteAddress ?? "unknown";
}

// ============================================================================
// Redis Subscriber Manager
// ============================================================================

class RedisSubscriber {
  private client: Redis | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelayMs = 1000;
  private isConnected = false;
  private messageCount = 0;
  private lastMessageTime: number | null = null;

  constructor(
    private url: string,
    private channel: string,
    private onMessage: (channel: string, message: string) => void
  ) {}

  /**
   * Connect to Redis and subscribe to channel
   */
  async connect(): Promise<void> {
    try {
      console.log(`[server] Connecting to Redis at ${this.url}...`);

      this.client = new Redis(this.url, {
        retryStrategy: (times) => {
          if (times > this.maxReconnectAttempts) {
            console.error("[server] Max Redis reconnection attempts reached. Giving up.");
            return null;
          }

          const delay = Math.min(times * this.reconnectDelayMs, 10000);
          console.log(`[server] Redis reconnecting in ${delay}ms (attempt ${times})...`);
          return delay;
        },
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      });

      // Connection event handlers
      this.client.on("connect", () => {
        console.log("[server] Redis connected");
      });

      this.client.on("ready", async () => {
        console.log("[server] Redis ready");
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Subscribe to channel
        try {
          await this.client!.subscribe(this.channel);
          console.log(`[server] ✅ Subscribed to Redis channel: ${this.channel}`);
        } catch (error) {
          console.error("[server] Failed to subscribe to channel:", error);
        }
      });

      this.client.on("error", (error) => {
        console.error("[server] Redis error:", error.message);
        this.isConnected = false;
      });

      this.client.on("close", () => {
        console.warn("[server] Redis connection closed");
        this.isConnected = false;
      });

      this.client.on("reconnecting", () => {
        this.reconnectAttempts++;
        console.log(`[server] Redis reconnecting (attempt ${this.reconnectAttempts})...`);
      });

      // Handle incoming messages
      this.client.on("message", (channel, message) => {
        this.messageCount++;
        this.lastMessageTime = Date.now();

        if (this.messageCount % 100 === 0) {
          console.log(`[server] Received ${this.messageCount} messages from Redis so far`);
        }

        try {
          this.onMessage(channel, message);
        } catch (error) {
          console.error("[server] Error handling Redis message:", error);
        }
      });

      // Wait for ready state
      await new Promise<void>((resolve, reject) => {
        if (!this.client) return reject(new Error("Redis client not initialized"));

        this.client.once("ready", () => resolve());
        this.client.once("error", reject);

        setTimeout(() => reject(new Error("Redis connection timeout")), 10000);
      });

      console.log("[server] Redis subscriber ready");
    } catch (error) {
      console.error("[server] Failed to connect to Redis:", error);
      throw error;
    }
  }

  /**
   * Graceful disconnect
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      console.log("[server] Disconnecting Redis subscriber...");
      
      try {
        await this.client.unsubscribe(this.channel);
        await this.client.quit();
      } catch (error) {
        console.error("[server] Error during Redis disconnect:", error);
      }

      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Get subscriber status
   */
  getStatus(): {
    connected: boolean;
    messageCount: number;
    lastMessageTime: number | null;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      messageCount: this.messageCount,
      lastMessageTime: this.lastMessageTime,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// ============================================================================
// WebSocket Broadcast Manager
// ============================================================================

class WebSocketBroadcaster {
  private wss: WebSocketServer;
  private broadcastCount = 0;
  private connectedClients = 0;

  constructor(wss: WebSocketServer) {
    this.wss = wss;

    // Track client count
    wss.on("connection", () => {
      this.connectedClients++;
    });
  }

  /**
   * Broadcast a message to all connected WebSocket clients
   */
  broadcast(data: unknown): void {
    const message = typeof data === "string" ? data : JSON.stringify(data);
    let sentCount = 0;

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          sentCount++;
        } catch (error) {
          console.error("[server] Error sending message to WebSocket client:", error);
        }
      }
    });

    this.broadcastCount++;

    if (this.broadcastCount % 100 === 0) {
      console.log(
        `[server] Broadcasted ${this.broadcastCount} messages to clients (${sentCount} clients reached)`
      );
    }
  }

  /**
   * Get broadcaster status
   */
  getStatus(): {
    broadcastCount: number;
    connectedClients: number;
    activeClients: number;
  } {
    const activeClients = Array.from(this.wss.clients).filter(
      (client) => client.readyState === WebSocket.OPEN
    ).length;

    return {
      broadcastCount: this.broadcastCount,
      connectedClients: this.connectedClients,
      activeClients,
    };
  }
}

// ============================================================================
// Main Server Setup
// ============================================================================

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    // Security headers
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://* https://horizon-testnet.stellar.org https://soroban-testnet.stellar.org https://horizon.stellar.org https://mainnet.stellar.validationcloud.io; img-src 'self' data:; font-src 'self' data:;"
    );

    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  // ============================================================================
  // WebSocket Server Setup
  // ============================================================================

  const wss = new WebSocketServer({ server: httpServer, path: "/ws/events" });

  wss.on("connection", (socket, request) => {
    const clientIp = request ? getClientIp(request) : "unknown";
    const activeConnections = (connectionsByIp.get(clientIp) ?? 0) + 1;

    // Rate limiting per IP
    if (activeConnections > MAX_WS_CONNECTIONS_PER_IP) {
      console.warn(
        `[server] Rejecting connection from ${clientIp}: too many connections (${activeConnections})`
      );
      socket.close(1008, "Too many connections from this IP");
      return;
    }

    connectionsByIp.set(clientIp, activeConnections);
    console.log(`[server] Client connected from ${clientIp} (${activeConnections} active)`);

    // Send welcome message
    socket.send(
      JSON.stringify({
        type: "connected",
        message: "Connected to Open-Audit event stream",
        timestamp: Date.now(),
      })
    );

    socket.on("close", () => {
      const remaining = (connectionsByIp.get(clientIp) ?? 1) - 1;
      if (remaining <= 0) {
        connectionsByIp.delete(clientIp);
      } else {
        connectionsByIp.set(clientIp, remaining);
      }
      console.log(`[server] Client disconnected from ${clientIp} (${Math.max(remaining, 0)} remaining)`);
    });

    socket.on("error", (error) => {
      console.error(`[server] WebSocket error from ${clientIp}:`, error.message);
    });
  });

  // ============================================================================
  // Redis Subscription & Broadcasting Pipeline
  // ============================================================================

  const broadcaster = new WebSocketBroadcaster(wss);

  const subscriber = new RedisSubscriber(REDIS_URL, REDIS_CHANNEL, (channel, message) => {
    try {
      // Parse the message from worker
      const parsedMessage = JSON.parse(message);

      // Broadcast the translated event to all WebSocket clients
      broadcaster.broadcast({
        type: "event",
        data: parsedMessage.translated,
        raw: parsedMessage.raw,
        timestamp: parsedMessage.timestamp,
        workerId: parsedMessage.workerId,
      });
    } catch (error) {
      console.error("[server] Error processing Redis message:", error);
    }
  });

  // Connect to Redis
  try {
    await subscriber.connect();
    console.log("[server] ✅ Redis subscription active");
  } catch (error) {
    console.error("[server] ❌ Failed to connect to Redis:", error);
    console.error("[server] Server will continue without Redis subscription");
  }

  // ============================================================================
  // Health Check & Status Reporting
  // ============================================================================

  setInterval(() => {
    const status = {
      server: "Next.js WebSocket Server",
      timestamp: new Date().toISOString(),
      redis: subscriber.getStatus(),
      websocket: broadcaster.getStatus(),
      connections: {
        byIp: Object.fromEntries(connectionsByIp),
        total: connectionsByIp.size,
      },
    };

    console.log("[server] Health Check:", JSON.stringify(status, null, 2));
  }, HEALTH_CHECK_INTERVAL_MS);

  // ============================================================================
  // Graceful Shutdown
  // ============================================================================

  async function gracefulShutdown(signal: string) {
    console.log(`[server] Received ${signal}, shutting down gracefully...`);

    // Close WebSocket server
    wss.close(() => {
      console.log("[server] WebSocket server closed");
    });

    // Disconnect Redis
    await subscriber.disconnect();

    // Close HTTP server
    httpServer.close(() => {
      console.log("[server] HTTP server closed");
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error("[server] Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // ============================================================================
  // Start Server
  // ============================================================================

  httpServer.listen(port, () => {
    console.log("=".repeat(80));
    console.log("🚀 Open-Audit Decoupled Server Started");
    console.log("=".repeat(80));
    console.log(`> Next.js ready on http://localhost:${port}`);
    console.log(`> WebSocket endpoint: ws://localhost:${port}/ws/events`);
    console.log(`> Redis channel: ${REDIS_CHANNEL}`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
    console.log("=".repeat(80));
  });
});
