/**
 * PM2 Ecosystem Configuration for Multi-Process Architecture
 *
 * This configuration runs the decoupled microservices architecture using PM2:
 * - Web Server (Next.js + WebSocket)
 * - Indexer Worker (Stellar blockchain polling)
 * - Redis (managed separately or via Docker)
 *
 * Start all services:
 *   pm2 start ecosystem.config.js
 *
 * Monitor:
 *   pm2 monit
 *   pm2 logs
 *
 * Stop all:
 *   pm2 stop ecosystem.config.js
 *   pm2 delete ecosystem.config.js
 *
 * Production deployment:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    // ========================================================================
    // Next.js Web Server with WebSocket
    // ========================================================================
    {
      name: "web-server",
      script: "ts-node",
      args: "--project tsconfig.server.json server-decoupled.ts",
      instances: 1, // Single instance for WebSocket state
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        REDIS_URL: "redis://localhost:6379",
        REDIS_CHANNEL: "stellar:events",
        MAX_WS_CONNECTIONS_PER_IP: 5,
        HEALTH_CHECK_INTERVAL_MS: 30000,
        NEXT_PUBLIC_NETWORK: "testnet",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        REDIS_CHANNEL: "stellar:events",
        MAX_WS_CONNECTIONS_PER_IP: 10,
        HEALTH_CHECK_INTERVAL_MS: 30000,
        NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK || "mainnet",
      },
      error_file: "./logs/web-server-error.log",
      out_file: "./logs/web-server-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,
      kill_timeout: 10000,
    },

    // ========================================================================
    // Stellar Indexer Worker (Primary)
    // ========================================================================
    {
      name: "indexer-worker",
      script: "ts-node",
      args: "--project tsconfig.server.json src/worker/indexer.ts",
      instances: 1, // Single instance to avoid duplicate event processing
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "development",
        REDIS_URL: "redis://localhost:6379",
        REDIS_CHANNEL: "stellar:events",
        WORKER_ID: "indexer-worker-1",
        INDEXER_MODE: "stream",
        INDEXER_WORKER_COUNT: 4,
        INDEXER_MAX_QUEUE_SIZE: 1000,
        POLL_INTERVAL_MS: 5000,
        HEALTH_CHECK_INTERVAL_MS: 30000,
        ENABLE_RESILIENCE: "true",
        NEXT_PUBLIC_NETWORK: "testnet",
      },
      env_production: {
        NODE_ENV: "production",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        REDIS_CHANNEL: "stellar:events",
        WORKER_ID: "indexer-worker-1",
        INDEXER_MODE: "stream",
        INDEXER_WORKER_COUNT: 8,
        INDEXER_MAX_QUEUE_SIZE: 2000,
        POLL_INTERVAL_MS: 5000,
        HEALTH_CHECK_INTERVAL_MS: 30000,
        ENABLE_RESILIENCE: "true",
        NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK || "mainnet",
        NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL,
        NEXT_PUBLIC_SOROBAN_RPC_URL: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL,
      },
      error_file: "./logs/indexer-error.log",
      out_file: "./logs/indexer-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 5000,
      kill_timeout: 15000,
    },

    // ========================================================================
    // Backup Indexer Worker (Optional - for redundancy)
    // ========================================================================
    // Uncomment to run a second indexer worker for high availability
    // {
    //   name: "indexer-worker-backup",
    //   script: "ts-node",
    //   args: "--project tsconfig.server.json src/worker/indexer.ts",
    //   instances: 1,
    //   exec_mode: "fork",
    //   watch: false,
    //   env: {
    //     NODE_ENV: "development",
    //     REDIS_URL: "redis://localhost:6379",
    //     REDIS_CHANNEL: "stellar:events",
    //     WORKER_ID: "indexer-worker-2",
    //     INDEXER_MODE: "stream",
    //     INDEXER_WORKER_COUNT: 4,
    //     HEALTH_CHECK_INTERVAL_MS: 30000,
    //     NEXT_PUBLIC_NETWORK: "testnet",
    //   },
    //   error_file: "./logs/indexer-backup-error.log",
    //   out_file: "./logs/indexer-backup-out.log",
    //   autorestart: true,
    // },
  ],

  // ==========================================================================
  // PM2 Deploy Configuration (Optional)
  // ==========================================================================
  deploy: {
    production: {
      user: "deploy",
      host: ["your-production-server.com"],
      ref: "origin/main",
      repo: "git@github.com:your-org/open-audit.git",
      path: "/var/www/open-audit",
      "post-deploy":
        "npm install && npm run build && pm2 reload ecosystem.config.js --env production",
    },
    staging: {
      user: "deploy",
      host: ["your-staging-server.com"],
      ref: "origin/develop",
      repo: "git@github.com:your-org/open-audit.git",
      path: "/var/www/open-audit-staging",
      "post-deploy":
        "npm install && npm run build && pm2 reload ecosystem.config.js --env production",
    },
  },
};
