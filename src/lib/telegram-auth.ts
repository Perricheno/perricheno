import { createHmac, createHash } from 'crypto';

interface TelegramUser {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}

const BOT_TOKEN = "8270333686:AAEaQLlEmewJeVQ2FSZXDHrOFx_0eN4JQfI";

export function verifyTelegramAuth(data: any): boolean {
    if (!data || !data.hash) return false;

    const { hash, ...userData } = data;

    // Create data check string
    // Keys must be sorted alphabetically
    const checkString = Object.keys(userData)
        .filter(key => userData[key] !== undefined && userData[key] !== null)
        .sort()
        .map(key => `${key}=${userData[key]}`)
        .join('\n');

    // Create secret key: SHA256(botToken)
    const secretKey = createHash('sha256').update(BOT_TOKEN).digest();

    // Calculate hmac
    const hmac = createHmac('sha256', secretKey).update(checkString).digest('hex');

    return hmac === hash;
}
