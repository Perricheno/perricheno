import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import db from '@/lib/db';

const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SHOP_ID = process.env.CRYPTOCLOUD_SHOP_ID;

export const PLANS: Record<string, {
    amount: number;
    name: string;
    description: string;
}> = {
    'plus_month': {
        amount: 3.99,
        name: 'Plus (1 Month)',
        description: 'Standard plan for 1 month',
    },
    'plus_year': {
        amount: 39.00,
        name: 'Plus (1 Year)',
        description: 'Standard plan for 1 year — save ~$9',
    },
    'pro_month': {
        amount: 7.99,
        name: 'Pro (1 Month)',
        description: 'Researcher plan for 1 month',
    },
    'pro_year': {
        amount: 79.00,
        name: 'Pro (1 Year)',
        description: 'Researcher plan for 1 year — save ~$17',
    },
    'ultra_month': {
        amount: 14.99,
        name: 'Ultra (1 Month)',
        description: 'Ultimate plan for 1 month',
    },
    'ultra_year': {
        amount: 149.00,
        name: 'Ultra (1 Year)',
        description: 'Ultimate plan for 1 year — save ~$31',
    }
};

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    try {
        const { planId: packId } = await req.json();
        const selectedPack = PLANS[packId];

        if (!selectedPack) {
            return NextResponse.json({ error: "Invalid package selected" }, { status: 400 });
        }

        if (!CRYPTOCLOUD_API_KEY || !CRYPTOCLOUD_SHOP_ID) {
            console.warn("CryptoCloud Keys not set. Using POS fallback.");
            const fallbackLink = "https://pay.cryptocloud.plus/pos/gTEj6wIpQ46vKqaH";
            
            // Send fallback to Telegram if token exists
            if (process.env.TELEGRAM_BOT_TOKEN) {
                const userRow = db.prepare('SELECT telegram_id FROM users WHERE id = ?').get(userId) as any;
                if (userRow?.telegram_id) {
                    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            chat_id: userRow.telegram_id,
                            text: `⚠️ <b>Payment Notice</b>\n\nDirect invoices are currently unavailable, but you can pay via the Terminal. <i>(Please enter the amount manually: $${selectedPack.amount})</i>`,
                            parse_mode: "HTML",
                            reply_markup: {
                                inline_keyboard: [[{ text: "Open Terminal", url: fallbackLink }]]
                            }
                        })
                    }).catch(console.error);
                }
            }
            return NextResponse.json({ fallback_url: fallbackLink });
        }

        const uniqueOrderId = `UID_${userId}_PACK_${packId}_TS_${Date.now()}`;

        const res = await fetch("https://api.cryptocloud.plus/v2/invoice/create", {
            method: "POST",
            headers: {
                "Authorization": `Token ${CRYPTOCLOUD_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                shop_id: CRYPTOCLOUD_SHOP_ID,
                amount: selectedPack.amount,
                order_id: uniqueOrderId,
                currency: "USD",
            })
        });

        let data;
        const textResponse = await res.text();
        try {
            data = JSON.parse(textResponse);
        } catch (parseError) {
            console.error("CryptoCloud returned invalid JSON:", textResponse.substring(0, 200));
            return NextResponse.json({ error: "Gateway error", fallback_url: "https://pay.cryptocloud.plus/pos/gTEj6wIpQ46vKqaH" }, { status: 502 });
        }

        if (data.status === "success" || data.result?.link || data.pay_url) {
            const payUrl = data.result?.link || data.pay_url || data.result?.pay_url;
            
            // Send proper generated invoice via Bot
            if (process.env.TELEGRAM_BOT_TOKEN) {
                const userRow = db.prepare('SELECT telegram_id FROM users WHERE id = ?').get(userId) as any;
                if (userRow?.telegram_id) {
                    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            chat_id: userRow.telegram_id,
                            text: `🧾 <b>Invoice Created</b>\n\nPackage: ${selectedPack.name}\nAmount: <b>$${selectedPack.amount}</b>\n\nPlease complete your payment using the secure link below.`,
                            parse_mode: "HTML",
                            reply_markup: {
                                inline_keyboard: [[{ text: "Pay Now", url: payUrl }]]
                            }
                        })
                    }).catch(console.error);
                }
            }

            return NextResponse.json({ url: payUrl });
        } else {
            console.error("CryptoCloud Error:", data);
            return NextResponse.json({ 
                error: data.message || "Failed to generate invoice",
                fallback_url: "https://pay.cryptocloud.plus/pos/gTEj6wIpQ46vKqaH" 
            }, { status: 500 });
        }

    } catch (err: any) {
        console.error("Checkout route error:", err);
        return NextResponse.json({ 
            error: err.message,
            fallback_url: "https://pay.cryptocloud.plus/pos/gTEj6wIpQ46vKqaH"
        }, { status: 500 });
    }
}
