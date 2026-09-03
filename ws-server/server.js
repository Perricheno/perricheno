const http = require('http');
const { WebSocketServer } = require('ws');
const { parse } = require('url');
const jwt = require('jsonwebtoken');
const { setupWSConnection, setPersistence, docs } = require('y-websocket/bin/utils');
const Y = require('yjs');

if (!process.env.WS_JWT_SECRET) {
    throw new Error('WS_JWT_SECRET env var is not set - refusing to start with a predictable JWT key');
}
const JWT_SECRET = process.env.WS_JWT_SECRET;
const PORT = parseInt(process.env.WS_PORT || '1234', 10);

// In-memory persistence - docs survive reconnects within the same process.
// Wave 2 will add LevelDB/Supabase persistence for cross-restart durability.
setPersistence({
    bindState: async (docName, ydoc) => {
        // No-op for now - doc starts empty on first connection after restart.
        // The clients will re-sync their local state via Yjs provider awareness.
    },
    writeState: async (docName, ydoc) => {
        // No-op - persistence added in Wave 2
    },
});

const httpServer = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }
    res.writeHead(404);
    res.end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
    const { query, pathname } = parse(req.url || '/', true);
    const token = String(query.token || '');

    if (!token) {
        ws.close(4001, 'Missing token');
        return;
    }

    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        ws.close(4001, 'Invalid or expired token');
        return;
    }

    // pathname is /space/<spaceId>
    const spaceId = (pathname || '').replace(/^\/+/, '').split('/').pop() || '';

    if (payload.spaceId !== spaceId) {
        ws.close(4003, 'Forbidden');
        return;
    }

    // Attach user info - used by presence layer (Wave 4)
    ws.userId = payload.userId;
    ws.role   = payload.role;

    // Viewers can still receive awareness updates but their writes are blocked
    // by the read-only flag in the frontend Yjs binding (Wave 3).
    setupWSConnection(ws, req, {
        docName: `space-${spaceId}`,
        gc: true,
    });

    console.log(`[ws] user=${payload.userId} role=${payload.role} joined space=${spaceId}`);
});

wss.on('error', (err) => {
    console.error('[ws] server error:', err);
});

httpServer.listen(PORT, () => {
    console.log(`[ws-server] Listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
    console.log('[ws-server] SIGTERM - shutting down');
    wss.close(() => httpServer.close(() => process.exit(0)));
});
