# Microservices Architecture Testing Guide

This guide walks you through testing the complete decoupled architecture to verify that events flow correctly from the indexer worker → Redis → web server → WebSocket clients.

## 🎯 Testing Objectives

Verify that:
1. ✅ Redis Pub/Sub pipeline works correctly
2. ✅ Indexer worker processes and publishes events
3. ✅ Web server receives and broadcasts events to WebSocket clients
4. ✅ Services auto-reconnect on failure
5. ✅ Graceful shutdown works properly
6. ✅ Health checks function correctly

---

## 📋 Prerequisites

Before testing, ensure you have:

- **Node.js** v18+ installed
- **Redis** installed (or Docker for Redis container)
- **Git** repository cloned
- Dependencies installed: `npm install`

---

## 🧪 Test Option 1: Manual Testing (Development)

### Step 1: Start Redis

**Option A - Native Redis:**
```bash
# Install Redis (if not already installed)
# macOS:
brew install redis

# Ubuntu/Debian:
sudo apt-get install redis-server

# Windows:
# Download from https://github.com/microsoftarchive/redis/releases

# Start Redis server
redis-server
```

**Option B - Docker Redis:**
```bash
docker run -d --name redis-test -p 6379:6379 redis:7-alpine
```

**Verify Redis is running:**
```bash
redis-cli ping
# Expected output: PONG
```

---

### Step 2: Configure Environment

Create `.env.local` from the template:
```bash
cp .env.microservices.example .env.local
```

Edit `.env.local` for local development:
```bash
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

REDIS_URL=redis://localhost:6379
REDIS_CHANNEL=stellar:events
PORT=3000

INDEXER_MODE=stream
INDEXER_WORKER_COUNT=4
ENABLE_RESILIENCE=true
```

---

### Step 3: Start Web Server

Open **Terminal 1**:
```bash
npm run dev:decoupled
```

**Expected output:**
```
[server] Connecting to Redis at redis://localhost:6379...
[server] Redis connected
[server] Redis ready
[server] ✅ Subscribed to Redis channel: stellar:events
[server] Redis subscriber ready
================================================================================
🚀 Open-Audit Decoupled Server Started
================================================================================
> Next.js ready on http://localhost:3000
> WebSocket endpoint: ws://localhost:3000/ws/events
> Redis channel: stellar:events
> Environment: development
================================================================================
```

---

### Step 4: Start Indexer Worker

Open **Terminal 2**:
```bash
npm run worker:indexer
```

**Expected output:**
```
[indexer-worker-1] Starting Stellar Indexer Worker...
[indexer-worker-1] Mode: stream
[indexer-worker-1] Network: testnet
[indexer-worker-1] Redis Channel: stellar:events
[indexer-worker-1] Resilience: enabled
[indexer-worker-1] Connecting to Redis at redis://localhost:6379...
[indexer-worker-1] Redis connected
[indexer-worker-1] Redis ready
[indexer-worker-1] Redis publisher ready
[indexer-worker-1] Starting real-time streaming indexer...
[indexer-worker-1] ✅ Worker started successfully
[indexer-worker-1] 🚀 Stellar Indexer Worker is running
```

---

### Step 5: Connect WebSocket Client

Open **Terminal 3** and run this Node.js script:

```javascript
// test-websocket-client.js
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws/events');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📨 Received message:', {
    type: message.type,
    timestamp: new Date(message.timestamp).toISOString(),
    workerId: message.workerId,
    eventId: message.raw?.id,
    translated: message.data?.english_string,
  });
});

ws.on('close', () => {
  console.log('❌ Disconnected from WebSocket server');
});

ws.on('error', (error) => {
  console.error('⚠️ WebSocket error:', error.message);
});
```

Run the client:
```bash
node test-websocket-client.js
```

**Expected output:**
```
✅ Connected to WebSocket server
📨 Received message: {
  type: 'connected',
  timestamp: '2026-06-22T10:30:00.000Z',
  workerId: undefined,
  eventId: undefined,
  translated: undefined
}
```

When events are processed, you'll see:
```
📨 Received message: {
  type: 'event',
  timestamp: '2026-06-22T10:30:15.123Z',
  workerId: 'indexer-worker-1',
  eventId: '0001234567890-0000000001',
  translated: 'Transferred 100 USDC from Alice to Bob'
}
```

---

### Step 6: Verify Health Checks

In **Terminal 4**:
```bash
curl http://localhost:3000/api/health
```

**Expected output:**
```json
{
  "status": "healthy",
  "service": "open-audit-web-server",
  "timestamp": "2026-06-22T10:30:00.000Z",
  "uptime": 45.678,
  "environment": "development",
  "version": "0.1.0",
  "redis": {
    "connected": true
  }
}
```

---

### Step 7: Test Event Flow

Monitor all terminals:

1. **Terminal 2 (Indexer Worker)** - Watch for event processing:
   ```
   [indexer-worker-1] Published to stellar:events (1 subscribers)
   [indexer-worker-1] Processed 100 events so far
   ```

2. **Terminal 1 (Web Server)** - Watch for Redis messages:
   ```
   [server] Received 100 messages from Redis so far
   [server] Broadcasted 100 messages to clients (1 clients reached)
   ```

3. **Terminal 3 (WebSocket Client)** - Watch for events:
   ```
   📨 Received message: { type: 'event', ... }
   📨 Received message: { type: 'event', ... }
   ```

---

### Step 8: Test Resilience

**Test 8A: Redis Disconnection**

Stop Redis:
```bash
# Native Redis:
redis-cli shutdown

# Docker Redis:
docker stop redis-test
```

Observe logs:
- **Worker**: Should queue messages and log "Redis disconnected. Queued message (1/1000)"
- **Server**: Should log "Redis connection closed"

Restart Redis:
```bash
# Native:
redis-server

# Docker:
docker start redis-test
```

Observe logs:
- **Worker**: Should reconnect and flush queued messages
- **Server**: Should reconnect automatically

**Test 8B: Worker Restart**

Kill the worker with Ctrl+C in Terminal 2.

Observe:
- Worker logs "Received SIGINT signal" and shuts down gracefully
- Server continues running without interruption
- WebSocket clients remain connected

Restart worker:
```bash
npm run worker:indexer
```

Observe: Events flow resumes automatically.

**Test 8C: Server Restart**

Kill the server with Ctrl+C in Terminal 1.

Observe:
- Server logs "Received SIGINT signal" and shuts down gracefully
- WebSocket client disconnects
- Worker continues processing and queuing events

Restart server:
```bash
npm run dev:decoupled
```

Reconnect WebSocket client. Observe: Events flow resumes.

---

## 🐳 Test Option 2: Docker Compose Testing

### Step 1: Configure Environment

Create `.env` file:
```bash
cp .env.microservices.example .env
```

Update Redis URL for Docker:
```bash
REDIS_URL=redis://redis:6379
```

---

### Step 2: Build and Start Services

```bash
npm run docker:build
npm run docker:up
```

**Expected output:**
```
Creating open-audit-redis ... done
Creating open-audit-indexer ... done
Creating open-audit-web ... done
```

---

### Step 3: View Logs

```bash
npm run docker:logs
```

Or view logs for specific services:
```bash
docker logs -f open-audit-web
docker logs -f open-audit-indexer
docker logs -f open-audit-redis
```

---

### Step 4: Verify Services

Check all services are healthy:
```bash
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE                  STATUS                    PORTS
abc123         open-audit-web         Up 30s (healthy)         0.0.0.0:3000->3000/tcp
def456         open-audit-indexer     Up 30s (healthy)
ghi789         redis:7-alpine         Up 30s (healthy)         0.0.0.0:6379->6379/tcp
```

---

### Step 5: Test WebSocket Connection

From your host machine:
```bash
node test-websocket-client.js
```

Or use browser console:
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/events');
ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

---

### Step 6: Test Health Checks

```bash
curl http://localhost:3000/api/health
```

---

### Step 7: Test Container Resilience

**Stop and restart indexer:**
```bash
docker stop open-audit-indexer
# Wait 10 seconds
docker start open-audit-indexer
```

Observe: Web server continues running, events resume after indexer restarts.

**Stop and restart web server:**
```bash
docker stop open-audit-web
# Wait 10 seconds
docker start open-audit-web
```

Observe: Indexer continues processing, server picks up where it left off.

---

### Step 8: Cleanup

```bash
npm run docker:down
```

Or keep data volumes:
```bash
docker-compose -f docker-compose.microservices.yml down
```

---

## 📊 Test Option 3: PM2 Testing

### Step 1: Start Redis

```bash
redis-server
```

---

### Step 2: Configure Environment

```bash
cp .env.microservices.example .env.local
```

---

### Step 3: Start All Services with PM2

```bash
npm run start:pm2
```

**Expected output:**
```
[PM2] Spawning PM2 daemon with pm2_home=/Users/you/.pm2
[PM2] PM2 Successfully daemonized
[PM2] Starting /path/to/server-decoupled.ts in fork_mode (1 instance)
[PM2] Starting /path/to/src/worker/indexer.ts in fork_mode (1 instance)
[PM2] Done.
┌────┬────────────────────┬─────────────┬─────────┐
│ id │ name               │ mode        │ status  │
├────┼────────────────────┼─────────────┼─────────┤
│ 0  │ web-server         │ fork        │ online  │
│ 1  │ indexer-worker     │ fork        │ online  │
└────┴────────────────────┴─────────────┴─────────┘
```

---

### Step 4: Monitor Services

Real-time monitoring:
```bash
npm run monit:pm2
```

View logs:
```bash
npm run logs:pm2
```

View specific service logs:
```bash
pm2 logs web-server
pm2 logs indexer-worker
```

---

### Step 5: Test Process Management

**Restart a service:**
```bash
pm2 restart web-server
pm2 restart indexer-worker
```

**Stop a service:**
```bash
pm2 stop indexer-worker
# Verify web server continues running
pm2 start indexer-worker
```

**Reload with zero-downtime:**
```bash
pm2 reload web-server
```

---

### Step 6: Cleanup

```bash
npm run stop:pm2
pm2 delete ecosystem.config.js
```

---

## 🔍 Monitoring & Debugging

### Check Redis Activity

Monitor Redis Pub/Sub:
```bash
redis-cli
> SUBSCRIBE stellar:events
```

Check Redis info:
```bash
redis-cli INFO stats
redis-cli INFO clients
```

### Check System Resources

**Docker:**
```bash
docker stats
```

**PM2:**
```bash
pm2 monit
```

### Debug WebSocket Issues

Use browser developer tools:
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3000/ws/events');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.onerror = (e) => console.error('Error:', e);
ws.onclose = (e) => console.log('Closed:', e.code, e.reason);
```

### Check Network Connectivity

```bash
# Test web server
curl http://localhost:3000/api/health

# Test Redis
redis-cli ping

# Check open ports
netstat -an | grep 3000
netstat -an | grep 6379
```

---

## ✅ Acceptance Criteria Verification

Use this checklist to verify all requirements are met:

### ✅ Complete Process Decoupling
- [ ] Indexer worker runs in separate process/container
- [ ] Web server runs in separate process/container
- [ ] No shared in-memory state between processes

### ✅ Redis Pub/Sub Pipeline
- [ ] Worker publishes events to Redis channel
- [ ] Server subscribes to Redis channel
- [ ] Events flow from worker → Redis → server → WebSocket clients

### ✅ Resilient Connection Management
- [ ] Worker auto-reconnects to Redis on disconnection
- [ ] Server auto-reconnects to Redis on disconnection
- [ ] Messages queued during disconnection
- [ ] Queued messages flushed on reconnection

### ✅ Graceful Shutdown
- [ ] Worker responds to SIGTERM/SIGINT
- [ ] Server responds to SIGTERM/SIGINT
- [ ] All connections closed cleanly
- [ ] No memory leaks or dangling connections

### ✅ Process Orchestration
- [ ] Docker Compose starts all services correctly
- [ ] PM2 starts all services correctly
- [ ] Health checks pass for all services
- [ ] Services restart independently

### ✅ Performance & Scalability
- [ ] WebSocket server not blocked by indexing
- [ ] CPU cycles not starved under heavy load
- [ ] Can scale services independently
- [ ] No dropped connections during high activity

---

## 🐛 Common Issues & Solutions

### Issue: "Redis connection refused"
**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# Start Redis if not running
redis-server

# Check Redis port
netstat -an | grep 6379
```

### Issue: "WebSocket connection failed"
**Solution:**
- Check web server is running: `curl http://localhost:3000/api/health`
- Verify WebSocket endpoint: `ws://localhost:3000/ws/events`
- Check firewall rules for port 3000
- Review browser console for CORS issues

### Issue: "No events received"
**Solution:**
- Verify indexer worker is running and connected to Horizon
- Check `NEXT_PUBLIC_NETWORK` matches Horizon endpoint
- Verify `REDIS_CHANNEL` matches on both worker and server
- Check if contracts are actively emitting events on testnet

### Issue: "Too many WebSocket connections"
**Solution:**
- Increase `MAX_WS_CONNECTIONS_PER_IP` in `.env.local`
- Use different IP addresses for testing
- Clear existing connections: restart web server

### Issue: "PM2 process not starting"
**Solution:**
```bash
# Check PM2 logs
pm2 logs --err

# Delete and restart
pm2 delete all
npm run start:pm2

# Check PM2 status
pm2 status
```

### Issue: "Docker containers unhealthy"
**Solution:**
```bash
# Check container logs
docker logs open-audit-web
docker logs open-audit-indexer

# Check health status
docker inspect open-audit-web | grep Health

# Restart unhealthy containers
docker restart open-audit-web
```

---

## 📚 Additional Resources

- **Architecture Documentation**: `MICROSERVICES_ARCHITECTURE.md`
- **Environment Configuration**: `.env.microservices.example`
- **Docker Compose Config**: `docker-compose.microservices.yml`
- **PM2 Config**: `ecosystem.config.js`
- **Worker Implementation**: `src/worker/indexer.ts`
- **Server Implementation**: `server-decoupled.ts`

---

## 🎉 Success Criteria

Your testing is successful when:

1. ✅ All three services start without errors (Redis, Worker, Web Server)
2. ✅ WebSocket client connects and receives welcome message
3. ✅ Events flow from Horizon → Worker → Redis → Server → WebSocket clients
4. ✅ Health check endpoint returns HTTP 200
5. ✅ Services auto-reconnect after Redis restart
6. ✅ Services shut down gracefully with Ctrl+C
7. ✅ WebSocket connections remain stable under load
8. ✅ No error messages in any terminal/log

**Congratulations! Your microservices architecture is working correctly! 🎊**
