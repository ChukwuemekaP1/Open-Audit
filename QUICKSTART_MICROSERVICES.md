# 🚀 Quick Start: Microservices Architecture

Get your decoupled Open-Audit system running in 5 minutes!

---

## 📋 Prerequisites

- **Node.js** v18+ installed
- **Redis** installed (or Docker)
- Git repository cloned
- Dependencies: `npm install`

---

## ⚡ 3-Step Quick Start (Recommended)

### Option 1: Docker Compose (Easiest)

```bash
# 1. Create environment file
cp .env.microservices.example .env

# 2. Start everything
npm run docker:up

# 3. View logs
npm run docker:logs
```

**✅ Done!** Visit http://localhost:3000

**To test WebSocket:**
```bash
# In another terminal
npm run test:websocket
```

**To stop:**
```bash
npm run docker:down
```

---

### Option 2: PM2 Process Manager

```bash
# 1. Install Redis and start it
brew install redis  # macOS
redis-server

# 2. Create environment file
cp .env.microservices.example .env.local

# 3. Start all services
npm run start:pm2

# 4. Monitor
npm run monit:pm2
```

**✅ Done!** Visit http://localhost:3000

**To test WebSocket:**
```bash
npm run test:websocket
```

**To stop:**
```bash
npm run stop:pm2
```

---

### Option 3: Manual (For Development)

**Terminal 1 - Redis:**
```bash
redis-server
```

**Terminal 2 - Web Server:**
```bash
cp .env.microservices.example .env.local
npm run dev:decoupled
```

**Terminal 3 - Indexer Worker:**
```bash
npm run worker:indexer
```

**Terminal 4 - Test WebSocket:**
```bash
npm run test:websocket
```

**✅ Done!** Visit http://localhost:3000

---

## 🧪 Verify Everything Works

### 1. Check Health Endpoint
```bash
curl http://localhost:3000/api/health
```

**Expected output:**
```json
{
  "status": "healthy",
  "service": "open-audit-web-server",
  "uptime": 45.678,
  "redis": { "connected": true }
}
```

### 2. Test WebSocket Connection

**Option A - Using test script:**
```bash
npm run test:websocket
```

**Expected output:**
```
✅ Connected to WebSocket server
📨 Received: Connected confirmation
📊 Event #1
   Translated: Transferred 100 USDC from Alice to Bob
```

**Option B - Using browser console:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/events');
ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));
```

### 3. Verify Services are Running

**Docker:**
```bash
docker ps
```

**PM2:**
```bash
pm2 status
```

---

## 🎯 What's Running?

After starting the system, you'll have:

1. **Redis** - Message broker on port 6379
2. **Web Server** - Next.js + WebSocket on port 3000
3. **Indexer Worker** - Background process polling Stellar blockchain

```
┌─────────────────┐      ┌─────────┐      ┌────────────┐      ┌──────────┐
│ Stellar Network │─────▶│ Indexer │─────▶│   Redis    │─────▶│   Web    │
│   (Horizon)     │      │ Worker  │      │  Pub/Sub   │      │  Server  │
└─────────────────┘      └─────────┘      └─────────────┘      └────┬─────┘
                                                                      │
                                                                      ▼
                                                              ┌────────────────┐
                                                              │   WebSocket    │
                                                              │    Clients     │
                                                              └────────────────┘
```

---

## 🔧 Common Commands

### Docker Compose

```bash
# Start services
npm run docker:up

# Start in foreground (see logs)
npm run docker:up && npm run docker:logs

# Stop services
npm run docker:down

# Rebuild images
npm run docker:build

# View logs
npm run docker:logs

# View specific service logs
docker logs -f open-audit-web
docker logs -f open-audit-indexer
docker logs -f open-audit-redis

# Restart a service
docker restart open-audit-web

# Check service health
docker ps
```

### PM2

```bash
# Start all services
npm run start:pm2

# Monitor in real-time
npm run monit:pm2

# View logs
npm run logs:pm2

# View specific service logs
pm2 logs web-server
pm2 logs indexer-worker

# Restart a service
pm2 restart web-server
pm2 restart indexer-worker

# Stop all services
npm run stop:pm2

# Check service status
pm2 status
```

### Manual

```bash
# Start web server
npm run dev:decoupled

# Start indexer worker
npm run worker:indexer

# Test WebSocket
npm run test:websocket
```

---

## 🐛 Troubleshooting

### Redis not running?
```bash
# Check if Redis is running
redis-cli ping
# Expected: PONG

# If not running, start it
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### Port 3000 already in use?
```bash
# Change port in .env.local
PORT=3001

# Or kill the process
lsof -ti:3000 | xargs kill -9
```

### No events appearing?
- Verify Stellar testnet is active
- Check indexer worker logs for errors
- Ensure `REDIS_CHANNEL` matches in both worker and server
- Wait a few minutes for blockchain events to occur

### WebSocket connection refused?
```bash
# Check if web server is running
curl http://localhost:3000/api/health

# Check WebSocket endpoint
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:3000/ws/events
```

### Docker containers unhealthy?
```bash
# Check logs
docker logs open-audit-web
docker logs open-audit-indexer

# Restart containers
docker restart open-audit-web open-audit-indexer
```

---

## 📚 Next Steps

Once your system is running:

1. **Explore the Dashboard** - Visit http://localhost:3000
2. **Read the Architecture** - See `MICROSERVICES_ARCHITECTURE.md`
3. **Run Full Tests** - See `MICROSERVICES_TESTING_GUIDE.md`
4. **Configure for Production** - Update `.env` with production settings
5. **Monitor Performance** - Use PM2 monitoring or Docker stats

---

## 🎉 Success Checklist

Your system is working correctly when:

- ✅ Health check returns `"status": "healthy"`
- ✅ WebSocket test client connects and receives messages
- ✅ All Docker containers show "healthy" status (or all PM2 processes "online")
- ✅ No error messages in logs
- ✅ Events flow from Horizon → Worker → Redis → Server → WebSocket clients

**Congratulations! Your microservices architecture is running! 🎊**

---

## 🆘 Need Help?

- **Architecture Details**: `MICROSERVICES_ARCHITECTURE.md`
- **Detailed Testing**: `MICROSERVICES_TESTING_GUIDE.md`
- **Environment Config**: `.env.microservices.example`
- **Docker Config**: `docker-compose.microservices.yml`
- **PM2 Config**: `ecosystem.config.js`

**Still stuck?** Check the logs:
- Docker: `npm run docker:logs`
- PM2: `npm run logs:pm2`
- Manual: Check each terminal window
