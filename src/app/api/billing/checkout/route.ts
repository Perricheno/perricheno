import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SHOP_ID = process.env.CRYPTOCLOUD_SHOP_ID;
const KASPI_MERCHANT_ID   = process.env.KASPI_MERCHANT_ID;
const KASPI_API_KEY       = process.env.KASPI_API_KEY;
const KASPI_API_BASE_URL  = process.env.KASPI_API_BASE_URL || 'https://kaspi.kz/online/api';
const POS_FALLBACK        = 'https://pay.cryptocloud.plus/pos/gTEj6wIpQ46vKqaH';
const WEBHOOK_DOMAIN      = process.env.WEBHOOK_DOMAIN || 'https://perricheno.ru';

// ── USD plan prices ───────────────────────────────────────────────────────────
export const PLANS: Record<string, { amount: number; name: string; description: string }> = {
    'plus_month':    { amount: 3.99,  name: 'Plus (1 Month)',        description: 'Standard plan for 1 month'           },
    'plus_year':     { amount: 39.00, name: 'Plus (1 Year)',         description: 'Standard plan for 1 year - save ~$9' },
    'pro_month':     { amount: 7.99,  name: 'Pro (1 Month)',         description: 'Researcher plan for 1 month'         },
    'pro_year':      { amount: 79.00, name: 'Pro (1 Year)',          description: 'Researcher plan for 1 year'          },
    'ultra_month':   { amount: 14.99, name: 'Ultra (1 Month)',       description: 'Ultimate plan for 1 month'           },
    'ultra_year':    { amount: 149.00,name: 'Ultra (1 Year)',        description: 'Ultimate plan for 1 year'            },
    'data_scientist':{ amount: 25.00, name: 'Data Scientist Pack',   description: '2M Chars + 50 Visuals'               },
    'researcher':    { amount: 60.00, name: 'Researcher Bundle',     description: '5M Chars + 150 Visuals'              },
};

// ── KZT plan prices (fixed, Kaspi Pay) ───────────────────────────────────────
const PLANS_KZT: Record<string, { amount: number; name: string }> = {
    'plus_month':    { amount: 1990,  name: 'Plus (1 Month)'    },
    'plus_year':     { amount: 19900, name: 'Plus (1 Year)'     },
    'pro_month':     { amount: 3990,  name: 'Pro (1 Month)'     },
    'pro_year':      { amount: 39900, name: 'Pro (1 Year)'      },
    'ultra_month':   { amount: 6990,  name: 'Ultra (1 Month)'   },
    'ultra_year':    { amount: 69900, name: 'Ultra (1 Year)'    },
    'data_scientist':{ amount: 12990, name: 'Data Scientist Pack'},
    'researcher':    { amount: 29990, name: 'Researcher Bundle' },
};

// ── Kaspi Pay ─────────────────────────────────────────────────────────────────
async function createKaspiPayment(userId: number, packId: string): Promise<{ url?: string; error?: string }> {
    const plan = PLANS_KZT[packId];
    if (!plan) return { error: 'Plan not available in KZT' };

    const orderId = `KASPI_UID_${userId}_PACK_${packId}_TS_${Date.now()}`;

    // Full API mode
    if (KASPI_MERCHANT_ID && KASPI_API_KEY) {
        try {
            const res = await fetch(`${KASPI_API_BASE_URL}/payments/order/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${KASPI_API_KEY}`,
                },
                body: JSON.stringify({
                    merchant_id: KASPI_MERCHANT_ID,
                    order_id:    orderId,
                    amount:      plan.amount,
                    currency:    'KZT',
                    description: plan.name,
                    back_url:    `${WEBHOOK_DOMAIN}/successful-payment`,
                    fail_url:    `${WEBHOOK_DOMAIN}/failed-payment`,
                }),
            });
            const data = await res.json() as { payment_url?: string; url?: string; status?: string };
            const payUrl = data.payment_url || data.url;
            if (payUrl) return { url: payUrl };
            console.error('[kaspi-checkout] API responded without URL:', data);
        } catch (e) {
            console.error('[kaspi-checkout] API call failed:', e);
        }
    }

    // Simple redirect fallback: standard Kaspi POS link with pre-filled amount
    if (KASPI_MERCHANT_ID) {
        const url = `https://pay.kaspi.kz/pay/${KASPI_MERCHANT_ID}?amount=${plan.amount}&order=${encodeURIComponent(orderId)}`;
        return { url };
    }

    return { error: 'Kaspi Pay not configured (KASPI_MERCHANT_ID missing)' };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    try {
        const body = await req.json();
        const packId: string   = body.planId || body.packId;
        const currency: string = body.currency || 'usd';

        // ── KZT → Kaspi Pay ───────────────────────────────────────────────────
        if (currency === 'kzt') {
            if (!PLANS_KZT[packId]) {
                return NextResponse.json({ error: 'Plan not available for KZT payment' }, { status: 400 });
            }
            const result = await createKaspiPayment(userId, packId);
            if (result.url) {
                // Notify user via Telegram
                if (process.env.TELEGRAM_BOT_TOKEN) {
                    const userRow = await prisma.user.findUnique({ select: { telegram_id: true }, where: { id: userId } });
                    if (userRow?.telegram_id) {
                        const plan = PLANS_KZT[packId];
                        fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: userRow.telegram_id,
                                text: `🧾 <b>Счёт Kaspi Pay создан</b>\n\nПакет: ${plan.name}\nСумма: <b>${plan.amount.toLocaleString('ru-RU')} ₸</b>\n\nОплатите по ссылке ниже.`,
                                parse_mode: 'HTML',
                                reply_markup: { inline_keyboard: [[{ text: '💳 Оплатить через Kaspi', url: result.url }]] },
                            }),
                        }).catch(console.error);
                    }
                }
                return NextResponse.json({ url: result.url });
            }
            // Kaspi not configured - fall through to CryptoCloud
            console.warn('[checkout] Kaspi not configured:', result.error);
        }

        // ── USD / RUB → CryptoCloud ───────────────────────────────────────────
        const selectedPack = PLANS[packId];
        if (!selectedPack) return NextResponse.json({ error: 'Invalid package selected' }, { status: 400 });

        if (!CRYPTOCLOUD_API_KEY || !CRYPTOCLOUD_SHOP_ID) {
            console.warn('CryptoCloud keys not set. Using POS fallback.');
            if (process.env.TELEGRAM_BOT_TOKEN) {
                const userRow = await prisma.user.findUnique({ select: { telegram_id: true }, where: { id: userId } });
                if (userRow?.telegram_id) {
                    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: userRow.telegram_id,
                            text: `⚠️ <b>Payment Notice</b>\n\nDirect invoices unavailable. Pay via Terminal <i>(amount: $${selectedPack.amount})</i>.`,
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: [[{ text: 'Open Terminal', url: POS_FALLBACK }]] },
                        }),
                    }).catch(console.error);
                }
            }
            return NextResponse.json({ fallback_url: POS_FALLBACK });
        }

        const uniqueOrderId = `UID_${userId}_PACK_${packId}_TS_${Date.now()}`;

        const res = await fetch('https://api.cryptocloud.plus/v2/invoice/create', {
            method: 'POST',
            headers: { 'Authorization': `Token ${CRYPTOCLOUD_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_id: CRYPTOCLOUD_SHOP_ID, amount: selectedPack.amount, order_id: uniqueOrderId, currency: 'USD' }),
        });

        let data: Record<string, unknown>;
        const textResponse = await res.text();
        try {
            data = JSON.parse(textResponse);
        } catch {
            console.error('CryptoCloud returned invalid JSON:', textResponse.substring(0, 200));
            return NextResponse.json({ error: 'Gateway error', fallback_url: POS_FALLBACK }, { status: 502 });
        }

        if (data.status === 'success' || (data.result as Record<string, unknown>)?.link || data.pay_url) {
            const payUrl = (data.result as Record<string, unknown>)?.link || data.pay_url || (data.result as Record<string, unknown>)?.pay_url;
            if (process.env.TELEGRAM_BOT_TOKEN) {
                const userRow = await prisma.user.findUnique({ select: { telegram_id: true }, where: { id: userId } });
                if (userRow?.telegram_id) {
                    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: userRow.telegram_id,
                            text: `🧾 <b>Invoice Created</b>\n\nPackage: ${selectedPack.name}\nAmount: <b>$${selectedPack.amount}</b>\n\nComplete your payment below.`,
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: [[{ text: 'Pay Now', url: payUrl }]] },
                        }),
                    }).catch(console.error);
                }
            }
            return NextResponse.json({ url: payUrl });
        }

        console.error('CryptoCloud Error:', data);
        return NextResponse.json({ error: (data.message as string) || 'Failed to generate invoice', fallback_url: POS_FALLBACK }, { status: 500 });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Checkout route error:', message);
        return NextResponse.json({ error: message, fallback_url: POS_FALLBACK }, { status: 500 });
    }
}
