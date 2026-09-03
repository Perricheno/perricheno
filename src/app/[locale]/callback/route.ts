import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { addPurchasedTokens, isPaymentProcessed } from '@/lib/db';
import { prisma } from '@/lib/prisma';

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

        // --- SIGNATURE FIRST (prevents timing oracle on order IDs) ---
        // CryptoCloud v2 Signature Verification: MD5(status_invoice + order_id + amount_crypto + currency_crypto + secret)
        if (!CRYPTOCLOUD_SECRET) {
            console.error('🚨 CRITICAL: CRYPTOCLOUD_SECRET is not set - /callback webhook disabled for safety');
            return new NextResponse('Server misconfiguration', { status: 500 });
        }
        if (!receivedSign) {
            console.error(`🚨 SECURITY: /callback webhook received without signature`);
            return new NextResponse('Missing signature', { status: 403 });
        }
        const hashString = `${parsedData.status_invoice || parsedData.status}${orderId}${parsedData.amount_crypto || ''}${parsedData.currency_crypto || ''}${CRYPTOCLOUD_SECRET}`;
        const expectedSign = crypto.createHash('md5').update(hashString).digest('hex');
        if (expectedSign !== receivedSign) {
            console.error(`🚨 SECURITY: /callback webhook signature mismatch`);
            return new NextResponse('Invalid signature', { status: 403 });
        }

        // --- IDEMPOTENCY CHECK (after signature) ---
        if (orderId && await isPaymentProcessed(orderId)) {
            console.log(`ℹ️ /callback: Skipping already processed order ${orderId}`);
            return new NextResponse('Already processed', { status: 200 });
        }

        if (!orderId || !orderId.startsWith("UID_")) {
            return new NextResponse('Invalid order ID', { status: 400 });
        }

        const parts = orderId.split('_');
        const userIdStr = parts[1];
        // Package IDs themselves may contain underscores (e.g. "starter_chars",
        // "data_scientist"), so a naive split('_')[3] truncates them at the
        // first inner underscore. Extract the substring between "PACK_" and
        // "_TS_" instead, matching /api/billing/webhook's parsing.
        const packStartIndex = orderId.indexOf("PACK_") + 5;
        const tsIndex = orderId.indexOf("_TS_");
        const packId = orderId.substring(packStartIndex, tsIndex);

        const userId = parseInt(userIdStr, 10);
        const pack = PACKAGES[packId];

        if (isNaN(userId) || !pack) {
            return new NextResponse('Bad package data', { status: 400 });
        }

        console.log(`✅ /callback: Received payment from UID ${userId} for pack ${packId}`);

        try {
            await prisma.$transaction(async (tx) => {
                // Mark as processed to prevent double-crediting (ATOMICALLY).
                // If it already exists, this throws P2002.
                await tx.processedPayment.create({ data: { order_id: orderId } });

                if (pack.chars > 0) await addPurchasedTokens(userId, 'chars', pack.chars, tx);
                if (pack.reports > 0) await addPurchasedTokens(userId, 'reports', pack.reports, tx);
            });
        } catch (txErr: any) {
            if (txErr.code === 'P2002') {
                console.log(`ℹ️ /callback: Skipping already processed order ${orderId} (caught by unique constraint)`);
                return new NextResponse('Already processed', { status: 200 });
            }
            throw txErr;
        }

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error("Webhook processing error:", err);
        return new NextResponse('Internal error', { status: 500 });
    }
}
