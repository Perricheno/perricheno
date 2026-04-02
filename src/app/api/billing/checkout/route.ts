import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SHOP_ID = process.env.CRYPTOCLOUD_SHOP_ID;

// Packages configuration
const PACKAGES = {
    'data_scientist': {
        amount: 5.00, // $5
        chars: 2000000,
        visuals: 50,
        name: 'Data Scientist Pack'
    },
    'researcher': {
        amount: 15.00, // $15
        chars: 5000000,
        visuals: 150,
        name: 'Researcher Bundle'
    }
};

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    try {
        const { packId } = await req.json();
        const selectedPack = PACKAGES[packId as keyof typeof PACKAGES];

        if (!selectedPack) {
            return NextResponse.json({ error: "Invalid package selected" }, { status: 400 });
        }

        if (!CRYPTOCLOUD_API_KEY || !CRYPTOCLOUD_SHOP_ID) {
            // Фолбэк для локального тестирования, если ключи еще не настроены
            return NextResponse.json({ 
                error: "Payments not fully configured yet. Missing SHOP_ID or API_KEY.", 
                fallback_url: "https://donate.cryptocloud.plus/5T8V5K0P" 
            }, { status: 501 });
        }

        // We bind the Perricheno User ID and Pack ID to this unique order
        const uniqueOrderId = `UID_${userId}_PACK_${packId}_TS_${Date.now()}`;

        // Create Invoice via CryptoCloud API v2
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
                // email: "maybe_user_email" // Optional
            })
        });

        const data = await res.json();

        if (data.status === "success" || data.result?.link) {
            // Return checkout link
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
