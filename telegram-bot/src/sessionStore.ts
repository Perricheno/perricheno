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
    try {
        const res = await fetch(`${SITE_INTERNAL_URL}/api/internal/bot/session?userId=${userId}`, {
            headers: { "X-Bot-Secret": WEBHOOK_SECRET }
        });
        
        if (res.ok) {
            const data = await res.json() as any;
            if (data.session) return data.session;
        }
    } catch (err) {
        console.error(`⚠️ Session Load Error [User ${userId}]: Site unreachable. Using default session.`);
    }
    
    // Return a safe default session if site is down or not found
    return {
        step: 'idle',
        visual: { title: "", text: [], images: [], files: [], type: 'auto' },
        compile: { title: "", file: null }
    };
}

export async function saveSession(userId: number, session: any): Promise<void> {
    if (!session) return;
    
    try {
        await fetch(`${SITE_INTERNAL_URL}/api/internal/bot/session`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "X-Bot-Secret": WEBHOOK_SECRET 
            },
            body: JSON.stringify({ userId, session })
        });
    } catch (err) {
        console.error(`⚠️ Session Save Error [User ${userId}]: Site unreachable. Data might be lost.`);
    }
}
