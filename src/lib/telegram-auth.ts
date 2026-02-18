import { createHmac, createHash } from 'crypto';

const BOT_TOKEN = "8270333686:AAEaQLlEmewJeVQ2FSZXDHrOFx_0eN4JQfI";

export function verifyTelegramAuth(data: Record<string, any>): boolean {
    if (!data || !data.hash) {
        console.error("Auth Error: Missing hash or data");
        return false;
    }

    const { hash, ...userData } = data;

    // Filter only valid Telegram fields to avoid pollution
    const validKeys = [
        'auth_date', 
        'first_name', 
        'id', 
        'last_name', 
        'photo_url', 
        'username'
    ];

    // Construct the data-check-string
    const checkString = Object.keys(userData)
        .filter(key => validKeys.includes(key) && userData[key] != null) // Filter valid keys and non-null values
        .sort()
        .map(key => `${key}=${userData[key]}`)
        .join('\n');

    // Create the secret key
    const secretKey = createHash('sha256')
        .update(BOT_TOKEN)
        .digest();

    // Calculate the HMAC
    const hmac = createHmac('sha256', secretKey)
        .update(checkString)
        .digest('hex');

    const isValid = hmac === hash;

    if (!isValid) {
        console.error("Auth Fail: Hash Mismatch");
        console.log("Received Hash:", hash);
        console.log("Calculated HMAC:", hmac);
        console.log("Check String:", checkString);
    }

    // Check for expiration (optional but recommended, 24h)
    const now = Math.floor(Date.now() / 1000);
    const authDate = parseInt(userData.auth_date);
    if (now - authDate > 86400) {
        console.error("Auth Fail: Data Expired");
        return false;
    }

    return isValid;
}
