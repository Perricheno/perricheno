import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET_KEY = new TextEncoder().encode("super-secret-key-change-this-in-env-938210");
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(userId: number) {
    const expires = new Date(Date.now() + SESSION_DURATION);
    
    const session = await new SignJWT({ userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(SECRET_KEY);

    const cookieStore = await cookies();
    
    // In a real prod environment with HTTPS, this should be true.
    // But for development/testing where SSL might be missing or self-signed,
    // we relax this to ensure the cookie is actually set.
    const isProd = process.env.NODE_ENV === 'production';
    
    cookieStore.set('perricheno_session', session, {
        httpOnly: true,
        secure: isProd, // Simplified for now to fix syntax errors
        expires: expires,
        sameSite: 'lax',
        path: '/',
    });
}

export async function verifySession() {
    const cookieStore = await cookies();
    const session = cookieStore.get('perricheno_session')?.value;
    
    if (!session) return null;

    try {
        const { payload } = await jwtVerify(session, SECRET_KEY, {
            algorithms: ['HS256'],
        });
        return payload.userId as number;
    } catch (error) {
        console.error("Session Verify Error:", error);
        return null;
    }
}

export async function deleteSession() {
    const cookieStore = await cookies();
    cookieStore.delete('perricheno_session');
}
