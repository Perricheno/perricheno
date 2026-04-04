import "dotenv/config";
// Shared Session Store — Persistence Layer
// Communicates with Perricheno Site API to store/retrieve sessions in SQLite.

const SITE_INTERNAL_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

if (typeof fetch === "undefined") {
    console.error("FATAL: 'fetch' is not defined. Please use Node.js v18 or higher.");
    process.exit(1);
}

// In-memory cache to prevent race conditions during concurrent requests
const localCache = new Map<number, any>();

const DEFAULT_SESSION = { 
    step: 'idle', 
    isProcessing: false, 
    visual: { text: [], images: [], files: [], title: '', lang: 'python' } 
};

export async function getSession(userId: number): Promise<any> {
    if (localCache.has(userId)) return localCache.get(userId);

    try {
        const res = await fetch(`${SITE_INTERNAL_URL}/api/internal/bot/session?userId=${userId}`, {
            headers: { "X-Bot-Secret": WEBHOOK_SECRET }
        });
        
        let sessionData: any;
        if (!res.ok) {
            sessionData = JSON.parse(JSON.stringify(DEFAULT_SESSION));
        } else {
            const data = await res.json();
            const session = data.session || {};
            // Ensure all nested fields exist by merging with DEFAULT_SESSION
            sessionData = {
                ...JSON.parse(JSON.stringify(DEFAULT_SESSION)),
                ...session,
                visual: {
                    ...JSON.parse(JSON.stringify(DEFAULT_SESSION.visual)),
                    ...(session.visual || {})
                }
            };
        }
        
        localCache.set(userId, sessionData);
        return sessionData;
    } catch (e) {
        console.error("Failed to fetch session from API:", e);
        const fallback = JSON.parse(JSON.stringify(DEFAULT_SESSION));
        localCache.set(userId, fallback);
        return fallback;
    }
}

export async function saveSession(userId: number, session: any): Promise<void> {
    // Update cache immediately
    localCache.set(userId, session);

    try {
        // Deep copy to avoid circular references and ensure clean JSON for API
        const cleanSession = JSON.parse(JSON.stringify(session));
        
        await fetch(`${SITE_INTERNAL_URL}/api/internal/bot/session`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "X-Bot-Secret": WEBHOOK_SECRET 
            },
            body: JSON.stringify({ userId, session: cleanSession })
        });
    } catch (e) {
        console.error("Failed to save session to API:", e);
    }
}
