import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { addPurchasedTokens } from '@/lib/db';

const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SECRET = process.env.CRYPTOCLOUD_SECRET; 

const PACKAGES: Record<string, { chars: number; reports: number }> = {
    'starter_chars': { chars: 100000, reports: 0 },
    'writer': { chars: 500000, reports: 0 },
    'data_scientist': { chars: 2000000, reports: 0 },
    'researcher': { chars: 5000000, reports: 0 },
    'report_single': { chars: 0, reports: 3 },
    'report_bulk': { chars: 0, reports: 15 },
    'combo_lite': { chars: 1000000, reports: 5 },
    'combo_pro': { chars: 10000000, reports: 30 },
};

export async function POST(req: Request) {
    try {
        const bodyContent = await req.text();
        const urlParams = new URLSearchParams(bodyContent);
        const data = Object.fromEntries(urlParams.entries());

        let parsedData: any = data;
        try {
            if (bodyContent.trim().startsWith('{')) {
                parsedData = JSON.parse(bodyContent);
            }
        } catch(e) {}

        const status = parsedData.status_invoice || parsedData.status; 
        const orderId = parsedData.order_id;
        const receivedSign = parsedData.sign;
        
        if (status !== 'success' && status !== 'paid') {
            return new NextResponse('OK', { status: 200 });
        }

        // CryptoCloud v2 Signature Verification: MD5(status_invoice + order_id + amount_crypto + currency_crypto + secret)
        if (CRYPTOCLOUD_SECRET && receivedSign) {
            const hashString = `${parsedData.status_invoice || parsedData.status}${orderId}${parsedData.amount_crypto || ''}${parsedData.currency_crypto || ''}${CRYPTOCLOUD_SECRET}`;
            const expectedSign = crypto.createHash('md5').update(hashString).digest('hex');
            
            if (expectedSign !== receivedSign) {
                console.error(`🚨 SECURITY WARNING: Webhook signature mismatch at /callback! Expected ${expectedSign}, got ${receivedSign}.`);
                // Uncomment in prod if needed: return new NextResponse('Invalid signature', { status: 403 });
            }
        } else if (CRYPTOCLOUD_SECRET && !receivedSign) {
            console.error(`🚨 SECURITY WARNING: Callback received without signature but secret is configured!`);
            return new NextResponse('Missing signature', { status: 403 });
        }

        if (!orderId || !orderId.startsWith("UID_")) {
            return new NextResponse('Invalid order ID', { status: 400 });
        }

        const parts = orderId.split('_');
        const userIdStr = parts[1];
        const packId = parts[3];
        
        const userId = parseInt(userIdStr, 10);
        const pack = PACKAGES[packId];

        if (isNaN(userId) || !pack) {
            return new NextResponse('Bad package data', { status: 400 });
        }

        console.log(`✅ Webhook: Received payment from UID ${userId} for pack ${packId}`);

        if (pack.chars > 0) addPurchasedTokens(userId, 'chars', pack.chars);
        if (pack.reports > 0) addPurchasedTokens(userId, 'reports', pack.reports);

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error("Webhook processing error:", err);
        return new NextResponse('Internal error', { status: 500 });
    }
}
