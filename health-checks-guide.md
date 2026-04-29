# Health Checks Guide for Perricheno Microservices

This guide outlines how to implement and monitor health checks across all your services to ensure maximum uptime and automated recovery.

## 1. Docker-Level Healthchecks
Adding a `healthcheck` to `docker-compose.yml` allows Docker to automatically restart containers if they become unresponsive.

### Example for `postgres-db`
```yaml
  postgres-db:
    image: postgres:16-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U perricheno -d perricheno_db"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### Example for `redis`
```yaml
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

---

## 2. Application-Level Endpoints
Your apps should expose a simple `/api/health` endpoint that returns a `200 OK` status.

### Next.js (`perricheno-site`)
Create a file at `src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'UP', database: 'CONNECTED' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ status: 'DOWN', error: 'DB_CONNECTION_FAILED' }, { status: 503 });
  }
}
```

### Node.js (`telegram-bot`)
Add this route to your Express/Fastify server:
```javascript
app.get('/health', async (req, res) => {
  res.status(200).send('OK');
});
```

### Python (`python-compiler` / `research-api`)
If using FastAPI:
```python
@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

---

## 3. Monitoring with Uptime Kuma
Since you have **Uptime Kuma** running, follow these steps to monitor internal services:

### Step A: Connect Kuma to the Network
To allow Uptime Kuma to see the microservices by their container names, add it to the `cloudflare` network:
```bash
docker network connect cloudflare uptime-kuma
```

### Step B: Add Monitors in UI
In the Uptime Kuma dashboard, add new monitors with these URLs:

| Service | Type | URL (Internal) |
| :--- | :--- | :--- |
| **Frontend** | HTTP(s) | `http://perricheno-site:3000/api/health` |
| **Bot API** | HTTP(s) | `http://telegram-bot:3001/health` |
| **Postgres** | TCP Port | `postgres-db:5432` |
| **MinIO** | HTTP(s) | `http://minio-server:9000/minio/health/live` |
| **Compiler** | HTTP(s) | `http://python-compiler:8000/health` |

---

## 4. Verification
After applying the changes, you can check the status of your containers:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```
You should see `(healthy)` next to each container status.
