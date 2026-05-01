# 1. Install dependencies only when needed
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN \
  --mount=type=cache,target=/root/.npm \
  npm ci

# 2. Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Skip TypeScript type checking in Docker build (CI already checks it)
ENV NEXT_SKIP_TYPE_CHECK=true
# Skip ESLint in Docker build (CI already checks it)
ENV NEXT_SKIP_LINT=true

# Use all available CPU cores for faster build
ENV UV_THREADPOOL_SIZE=128
# Disable source maps in production for faster build
ENV GENERATE_SOURCEMAP=false

RUN \
  --mount=type=cache,target=/app/.next/cache \
  npm run build -- --experimental-build-mode=compile

# 3. Production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public

# Standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Settings and DB data (writeable by nextjs user)
COPY --from=builder --chown=nextjs:nodejs /app/src/data ./src/data
RUN mkdir -p /app/db && chown nextjs:nodejs /app/db

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
