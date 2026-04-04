FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN \
  --mount=type=cache,target=/root/.npm \
  npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Health check - just verify the process is alive
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD pgrep -f "node dist/bot.js" || exit 1

CMD ["node", "dist/bot.js"]
