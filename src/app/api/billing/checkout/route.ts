import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SHOP_ID = process.env.CRYPTOCLOUD_SHOP_ID;

// Full packages catalog
export const PACKAGES: Record<string, {
    amount: number;
    chars: number;
    reports: number;
    name: string;
    description: string;
    tag?: string;
}> = {
    // ── Character Packs ──
    'starter_chars': {
        amount: 1.00,
        chars: 100000,
        reports: 0,
        name: 'Starter Pack',
        description: '100K Characters',
        tag: 'Budget'
    },
    'writer': {
        amount: 3.00,
        chars: 500000,
        reports: 0,
        name: 'Writer Pack',
        description: '500K Characters',
    },
    'data_scientist': {
        amount: 5.00,
        chars: 2000000,
        reports: 0,
        name: 'Data Scientist',
        description: '2M Characters',
        tag: 'Popular'
    },
    'researcher': {
        amount: 12.00,
        chars: 5000000,
        reports: 0,
        name: 'Researcher',
        description: '5M Characters',
    },
    // ── Report Packs ──
    'report_single': {
        amount: 2.00,
        chars: 0,
        reports: 3,
        name: '3 Reports',
        description: '3 Full Research Reports',
    },
    'report_bulk': {
        amount: 8.00,
        chars: 0,
        reports: 15,
        name: '15 Reports',
        description: '15 Full Research Reports',
        tag: 'Best Value'
    },
    // ── Combo Bundles ──
    'combo_lite': {
        amount: 7.00,
        chars: 1000000,
        reports: 5,
        name: 'Lite Bundle',
        description: '1M Chars + 5 Reports',
    },
    'combo_pro': {
        amount: 20.00,
        chars: 10000000,
        reports: 30,
        name: 'Pro Bundle',
        description: '10M Chars + 30 Reports',
        tag: 'Ultimate'
    },
};

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    try {
        const { packId } = await req.json();
        const selectedPack = PACKAGES[packId];

        if (!selectedPack) {
            return NextResponse.json({ error: "Invalid package selected" }, { status: 400 });
        }

        if (!CRYPTOCLOUD_API_KEY || !CRYPTOCLOUD_SHOP_ID) {
            return NextResponse.json({ 
                error: "Payments not fully configured yet.", 
                fallback_url: "https://donate.cryptocloud.plus/5T8V5K0P" 
            }, { status: 501 });
        }

        const uniqueOrderId = `UID_${userId}_PACK_${packId}_TS_${Date.now()}`;

        const res = await fetch("https://api.cryptocloud.plus/v2/invoice/create", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${CRYPTOCLOUD_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                shop_id: CRYPTOCLOUD_SHOP_ID,
                amount: selectedPack.amount,
                order_id: uniqueOrderId,
                currency: "USD",
            })
        });

        const data = await res.json();

        if (data.status === "success" || data.result?.link) {
            return NextResponse.json({ url: data.result?.link || data.pay_url });
        } else {
            console.error("CryptoCloud Error:", data);
            throw new Error(data.message || "Failed to generate invoice");
        }

    } catch (err: any) {
        console.error("Checkout route error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
