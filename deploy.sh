#!/bin/bash
set -euo pipefail

# ─── Reliable, zero-downtime-ish deploy ───────────────────────────────────────
# Key design decisions:
#  - PREV_SHA comes from .last-deployed-sha (state file), not git HEAD.
#    The workflow already does `git reset --hard origin/main` before calling
#    this script, so HEAD is always NEW_SHA by the time we run.
#  - Build runs while the old container is still live (no downtime during build).
#  - Rollback: old image tagged as perricheno-site:rollback before each build.
#  - prisma db push without --accept-data-loss: fails loudly on destructive changes.
# ─────────────────────────────────────────────────────────────────────────────

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
export BUILDKIT_PROGRESS=plain

STATE_FILE="$REPO_DIR/.last-deployed-sha"

# ── 1. Determine what changed ─────────────────────────────────────────────────
# HEAD is already at the new commit (workflow called git reset --hard before us).
NEW_SHA=$(git rev-parse HEAD)
PREV_SHA=$(cat "$STATE_FILE" 2>/dev/null || echo "")

FULL_REBUILD="no"
if [ -z "$PREV_SHA" ] || [ "$PREV_SHA" = "$NEW_SHA" ]; then
    CHANGED_FILES=""
    FULL_REBUILD="yes"
else
    CHANGED_FILES=$(git diff --name-only "$PREV_SHA" "$NEW_SHA" 2>/dev/null || echo "")
fi

PREV_DISPLAY=$([ -z "$PREV_SHA" ] && echo "none" || echo "${PREV_SHA:0:7}")
echo "📌  PREV: $PREV_DISPLAY → NEW: ${NEW_SHA:0:7}"
if [ "$FULL_REBUILD" = "no" ] && [ -n "$CHANGED_FILES" ]; then
    echo "📝  Changed files:"
    echo "$CHANGED_FILES" | head -20 | sed 's/^/     /'
fi

# ── 2. Map changed paths → compose services ───────────────────────────────────
ALL_SERVICES="perricheno-site worker research-api r-compiler python-compiler telegram-bot pdf-extractor minio minio-init redis"

if [ "$FULL_REBUILD" = "yes" ] || echo "$CHANGED_FILES" | grep -qE '^(docker-compose\.yml|\.env|deploy\.sh)$'; then
    SERVICES="$ALL_SERVICES"
    echo "🔄  Full rebuild (topology / env / first deploy)."
else
    SERVICES=""
    matches() { echo "$CHANGED_FILES" | grep -qE "$1"; }

    # worker shares the same src/ tree and Dockerfile as perricheno-site
    # (see Dockerfile's `worker` stage) - rebuild both together so they never
    # drift on the shared job-processor code in src/lib/jobs, src/lib/queue.ts.
    if matches '^(src/|public/|messages/|package(-lock)?\.json$|next\.config|tsconfig\.json|tailwind\.config|postcss\.config|middleware\.ts$|Dockerfile$|\.dockerignore$)'; then
        SERVICES="$SERVICES perricheno-site worker"
    fi
    matches '^research-api/'    && SERVICES="$SERVICES research-api"
    matches '^r-compiler/'      && SERVICES="$SERVICES r-compiler"
    matches '^python-compiler/' && SERVICES="$SERVICES python-compiler"
    matches '^telegram-bot/'    && SERVICES="$SERVICES telegram-bot"
    matches '^pdf-extractor/'   && SERVICES="$SERVICES pdf-extractor"

    SERVICES=$(echo "$SERVICES" | xargs)
fi

if [ -z "$SERVICES" ]; then
    echo "✅  No service-relevant changes. Reconciling running containers..."
    docker compose up -d --no-build --remove-orphans
    echo "$NEW_SHA" > "$STATE_FILE"
    exit 0
fi

echo "🔧  Services to rebuild: $SERVICES"

# ── 3. Save rollback snapshot before overwriting the image ────────────────────
if echo "$SERVICES" | grep -q "perricheno-site"; then
    ROLLBACK_IMG=$(docker images perricheno-site:latest -q 2>/dev/null | head -1 || echo "")
    if [ -n "$ROLLBACK_IMG" ]; then
        docker tag "$ROLLBACK_IMG" perricheno-site:rollback 2>/dev/null || true
        echo "💾  Saved rollback snapshot: ${ROLLBACK_IMG:0:12}"
    fi
fi

# ── 4. Build new images (old containers still running - no downtime here) ─────
# Docker Compose v2 already builds services in parallel by default.
# shellcheck disable=SC2086
docker compose build $SERVICES

# ── 5. Swap containers ────────────────────────────────────────────────────────
echo "🚀  Swapping containers: $SERVICES"
# shellcheck disable=SC2086
docker compose up -d --force-recreate --no-build --remove-orphans $SERVICES

# ── 6. DB schema sync (runs inside the new container) ─────────────────────────
if echo "$SERVICES" | grep -qE "(perricheno-site|postgres)"; then
    echo "🔄  Waiting for container to be running before schema sync..."
    for i in $(seq 1 10); do
        RUNNING=$(docker inspect --format='{{.State.Running}}' perricheno-site 2>/dev/null || echo "false")
        [ "$RUNNING" = "true" ] && break
        sleep 2
    done

    echo "🔄  Syncing database schema..."
    # No --accept-data-loss: fail loudly if a migration would destroy data.
    docker exec perricheno-site npx prisma db push 2>&1 || {
        echo "⚠️   prisma db push failed - check schema for destructive changes."
        echo "     If this is a first-time deploy, this may be expected."
    }
fi

# ── 7. Health check (120 s window, 5 s polls) ─────────────────────────────────
if echo "$SERVICES" | grep -q "perricheno-site"; then
    echo "⏳  Health check (up to 120 s)..."
    HEALTHY="no"
    for i in $(seq 1 24); do
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' perricheno-site 2>/dev/null || echo "unknown")
        if [ "$STATUS" = "healthy" ]; then
            HEALTHY="yes"
            break
        fi
        echo "    [${i}/24] $STATUS"
        sleep 5
    done

    if [ "$HEALTHY" = "yes" ]; then
        echo "✅  Deploy successful! Container is healthy."
        echo "$NEW_SHA" > "$STATE_FILE"
        docker image prune -f --filter "until=2h" 2>/dev/null || true
        exit 0
    fi

    echo "❌  Container did not become healthy within 120 s."
    docker logs --tail 40 perricheno-site

    # ── Rollback ─────────────────────────────────────────────────────────────
    ROLLBACK_IMG=$(docker images perricheno-site:rollback -q 2>/dev/null | head -1 || echo "")
    if [ -n "$ROLLBACK_IMG" ]; then
        echo "🔁  Rolling back to previous image (${ROLLBACK_IMG:0:12})..."
        docker compose stop perricheno-site 2>/dev/null || true
        docker tag "$ROLLBACK_IMG" perricheno-site:latest
        docker compose up -d --no-build perricheno-site
        echo "⚠️   Rolled back to PREV: ${PREV_SHA:0:7}. State file NOT updated."
    else
        echo "⚠️   No rollback image available. Manual intervention required."
    fi
    exit 1
fi

echo "✅  Deploy complete (site not in changed set)."
echo "$NEW_SHA" > "$STATE_FILE"
docker image prune -f --filter "until=2h" 2>/dev/null || true
