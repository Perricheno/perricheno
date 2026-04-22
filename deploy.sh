#!/bin/bash
set -e

# ─── Zero-downtime, selective-build deploy ───
# Called by GitHub Actions (or manually via SSH).
# Builds ONLY the compose services whose sources changed since the previous
# deploy, instead of re-evaluating the build graph for every image.

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# ── 1. Capture HEAD before we move it, so we can diff later ──
PREV_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")

echo "⬇️  Pulling latest changes..."
git fetch origin main
git reset --hard origin/main
NEW_SHA=$(git rev-parse HEAD)

# ── 2. Work out which files actually changed ──
FULL_REBUILD="no"
if [ -z "$PREV_SHA" ] || [ "$PREV_SHA" = "$NEW_SHA" ]; then
    CHANGED_FILES=""
    FULL_REBUILD="yes"   # cold start or no-op push → play it safe
else
    CHANGED_FILES=$(git diff --name-only "$PREV_SHA" "$NEW_SHA" || echo "")
fi

# ── 3. Map changed paths → compose services ──
# Changes to the compose file, .env, or deploy.sh itself affect the whole stack.
ALL_SERVICES="perricheno-site research-api r-compiler python-compiler telegram-bot"

if [ "$FULL_REBUILD" = "yes" ] || echo "$CHANGED_FILES" | grep -qE '^(docker-compose\.yml|\.env|deploy\.sh)$'; then
    SERVICES="$ALL_SERVICES"
    echo "🔄 Full rebuild (topology / env / first deploy)."
else
    SERVICES=""
    matches() { echo "$CHANGED_FILES" | grep -qE "$1"; }

    # perricheno-site owns the whole Next.js tree + root Dockerfile
    if matches '^(src/|public/|package(-lock)?\.json$|next\.config|tsconfig\.json|tailwind\.config|postcss\.config|middleware\.ts$|Dockerfile$|\.dockerignore$)'; then
        SERVICES="$SERVICES perricheno-site"
    fi
    matches '^research-api/'    && SERVICES="$SERVICES research-api"
    matches '^r-compiler/'      && SERVICES="$SERVICES r-compiler"
    matches '^python-compiler/' && SERVICES="$SERVICES python-compiler"
    matches '^telegram-bot/'    && SERVICES="$SERVICES telegram-bot"

    SERVICES=$(echo "$SERVICES" | xargs)
fi

# ── 4. Build + restart only what's needed ──
if [ -z "$SERVICES" ]; then
    echo "✅ No service-relevant changes (${PREV_SHA:0:7}..${NEW_SHA:0:7}). Skipping build."
    # Still reconcile in case env values changed without compose edits.
    docker compose up -d --no-build --remove-orphans
    exit 0
fi

echo "🔧 Building services: $SERVICES"
# shellcheck disable=SC2086
docker compose build $SERVICES

echo "🚀 Starting / replacing: $SERVICES"
# shellcheck disable=SC2086
docker compose up -d --force-recreate --remove-orphans $SERVICES

# ── 5. Health check (only the user-facing site container) ──
if echo "$SERVICES" | grep -q "perricheno-site"; then
    echo "⏳ Waiting for health check..."
    for i in $(seq 1 12); do
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' perricheno-site 2>/dev/null || echo "unknown")
        if [ "$STATUS" = "healthy" ]; then
            echo "✅ Deploy successful! Container is healthy."
            docker image prune -f --filter "until=1h" 2>/dev/null || true
            exit 0
        fi
        echo "   Status: $STATUS (attempt $i/12)"
        sleep 5
    done

    echo "⚠️  Container did not become healthy in 60s. Check logs:"
    docker logs --tail 20 perricheno-site
    exit 1
fi

echo "✅ Deploy complete (site container unchanged — skipping health wait)."
docker image prune -f --filter "until=1h" 2>/dev/null || true
