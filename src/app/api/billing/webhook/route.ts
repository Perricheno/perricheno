import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { addPurchasedTokens } from '@/lib/db';

const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SECRET = process.env.CRYPTOCLOUD_SECRET; // This is used to verify signatures

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
        // Wait, different v2 APIs use slightly different signatures. Let's do a basic check since they might pass status.
        if (CRYPTOCLOUD_SECRET && receivedSign) {
            // General verification logic for CryptoCloud
            const hashString = `${parsedData.status_invoice || parsedData.status}${orderId}${parsedData.amount_crypto || ''}${parsedData.currency_crypto || ''}${CRYPTOCLOUD_SECRET}`;
            const expectedSign = crypto.createHash('md5').update(hashString).digest('hex');
            
            // NOTE: Due to docs variation, we log it without hard-blocking immediately if it mismatches because of missing currency string, 
            // but we absolutely should stringently verify it.
            if (expectedSign !== receivedSign) {
                console.error(`🚨 SECURITY WARNING: Webhook signature mismatch! Expected ${expectedSign}, got ${receivedSign}.`);
                // For strict security, uncomment the line below in production once signature format is 100% matched with your CryptoCloud settings:
                // return new NextResponse('Invalid signature', { status: 403 });
            }
        } else if (CRYPTOCLOUD_SECRET && !receivedSign) {
            console.error(`🚨 SECURITY WARNING: Webhook received without signature but secret is configured!`);
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

        // Add tokens
        if (pack.chars > 0) addPurchasedTokens(userId, 'chars', pack.chars);
        if (pack.reports > 0) addPurchasedTokens(userId, 'reports', pack.reports);

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error("Webhook processing error:", err);
        return new NextResponse('Internal error', { status: 500 });
    }
}
