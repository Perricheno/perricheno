import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { createSessionRecord, getSessionById, deleteSessionRecord } from './db';

const rawSecret = process.env.SESSION_SECRET;
if (!rawSecret) {
    throw new Error("SESSION_SECRET env var is not set - refusing to start with a predictable JWT key");
}
const SECRET_KEY = new TextEncoder().encode(rawSecret);
const SESSION_DURATION = 3650 * 24 * 60 * 60 * 1000; // 10 years (immortal)

async function getIpLocation(ip: string) {
    if (!ip || ip === '127.0.0.1' || ip === '::1') return "Localhost";
    try {
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`);
        const data = await res.json();
        if (data.status === 'success') return `${data.city}, ${data.country}`;
        return "Unknown Location";
    } catch {
        return "Unknown Location";
    }
}

export async function createSession(userId: number) {
    const head = await headers();
    const ua = head.get('user-agent') || 'Unknown Device';
    const ip = head.get('x-forwarded-for')?.split(',')[0] || head.get('x-real-ip') || '0.0.0.0';
    const location = await getIpLocation(ip);

    const sessionId = crypto.randomUUID();
    const expires = new Date(Date.now() + SESSION_DURATION);
    
    // 1. Store in DB
    await createSessionRecord({
        id: sessionId,
        user_id: userId,
        user_agent: ua,
        ip: ip,
        location: location
    });

    // 2. Wrap sessionId in a simple JWT (to keep it secure in cookies)
    const token = await new SignJWT({ sessionId, userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('3650d')
        .sign(SECRET_KEY);

    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === 'production';
    
    cookieStore.set('perricheno_session', token, {
        httpOnly: true,
        secure: isProd,
        expires: expires,
        sameSite: 'lax',
        path: '/',
    });

    return { sessionId, userId, location, ua, ip };
}

export async function verifySession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('perricheno_session')?.value;
    
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, SECRET_KEY, {
            algorithms: ['HS256'],
        });
        
        const sessionId = payload.sessionId as string;
        
        // 3. Verify sessionId exists in DB
        const session = await getSessionById(sessionId);
        if (!session) return null;

        return session.user_id as number;
    } catch {
        try { cookieStore.delete('perricheno_session'); } catch {}
    }

    return null;
}

export async function deleteSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('perricheno_session')?.value;
    
    if (token) {
        try {
            const { payload } = await jwtVerify(token, SECRET_KEY);
            await deleteSessionRecord(payload.sessionId as string);
        } catch {}
    }

    cookieStore.delete('perricheno_session');
}
