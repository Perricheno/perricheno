import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { addPurchasedTokens } from '@/lib/db';

const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SECRET = process.env.CRYPTOCLOUD_SECRET; 

const PACKAGES = {
    'data_scientist': { chars: 2000000, visuals: 50 },
    'researcher': { chars: 5000000, visuals: 150 }
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
        
        if (status !== 'success' && status !== 'paid') {
            return new NextResponse('OK', { status: 200 });
        }

        if (!orderId || !orderId.startsWith("UID_")) {
            return new NextResponse('Invalid order ID', { status: 400 });
        }

        const parts = orderId.split('_');
        const userIdStr = parts[1];
        const packId = parts[3];
        
        const userId = parseInt(userIdStr, 10);
        const pack = PACKAGES[packId as keyof typeof PACKAGES];

        if (isNaN(userId) || !pack) {
            return new NextResponse('Bad package data', { status: 400 });
        }

        console.log(`✅ Webhook: Received payment from UID ${userId} for pack ${packId}`);

        addPurchasedTokens(userId, 'chars', pack.chars);
        addPurchasedTokens(userId, 'visuals', pack.visuals);

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error("Webhook processing error:", err);
        return new NextResponse('Internal error', { status: 500 });
    }
}
