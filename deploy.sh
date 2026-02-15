#!/bin/bash
set -e

# ─── Zero-downtime deploy script ───
# Called by GitHub Actions (or manually via SSH)

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

echo "⬇️  Pulling latest changes..."
git pull origin main

echo "🔨 Building new image..."
docker compose build

echo "🚀 Deploying with zero-downtime..."
# Recreate only changed services, detached
docker compose up -d --force-recreate --remove-orphans

echo "⏳ Waiting for health check..."
# Wait up to 60s for container to be healthy
for i in $(seq 1 12); do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' perricheno-site 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "healthy" ]; then
        echo "✅ Deploy successful! Container is healthy."
        # Clean up old images
        docker image prune -f --filter "until=1h" 2>/dev/null || true
        exit 0
    fi
    echo "   Status: $STATUS (attempt $i/12)"
    sleep 5
done

echo "⚠️  Container did not become healthy in 60s. Check logs:"
docker logs --tail 20 perricheno-site
exit 1
