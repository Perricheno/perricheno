import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { upgradeSubscriptionPlan, isPaymentProcessed, addPurchasedTokens } from '@/lib/db';
import { prisma } from '@/lib/prisma';

const KASPI_WEBHOOK_SECRET = process.env.KASPI_WEBHOOK_SECRET;

// Same plan map as the main CryptoCloud webhook — keeps both in sync
const PLANS: Record<string, { tier?: string; duration?: string; name: string; chars?: number; visuals?: number; reports?: number }> = {
    'plus_month':   { tier: 'plus',  duration: '1 Month', name: 'Plus (1 Month)'  },
    'plus_year':    { tier: 'plus',  duration: '1 Year',  name: 'Plus (1 Year)'   },
    'pro_month':    { tier: 'pro',   duration: '1 Month', name: 'Pro (1 Month)'   },
    'pro_year':     { tier: 'pro',   duration: '1 Year',  name: 'Pro (1 Year)'    },
    'ultra_month':  { tier: 'ultra', duration: '1 Month', name: 'Ultra (1 Month)' },
    'ultra_year':   { tier: 'ultra', duration: '1 Year',  name: 'Ultra (1 Year)'  },
};

// KZT amounts per plan (mirrors checkout/route.ts PLANS_KZT)
const PLANS_KZT: Record<string, number> = {
    'plus_month':  1990,  'plus_year':  19900,
    'pro_month':   3990,  'pro_year':   39900,
    'ultra_month': 6990,  'ultra_year': 69900,
};

/**
 * Kaspi Pay webhook — called by Kaspi after a payment is confirmed.
 *
 * Expected POST body (JSON):
 *   { txn_id, order_id, status, amount, currency, sign }
 *
 * Signature: HMAC-SHA256 of `{txn_id}{order_id}{status}{amount}` using KASPI_WEBHOOK_SECRET.
 *
 * Order ID format: KASPI_UID_{userId}_PACK_{packId}_TS_{timestamp}
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { txn_id, order_id, status, amount, currency, sign } = body as Record<string, string>;

        // Only process confirmed payments
        if (status !== 'SUCCESS' && status !== 'PAID') {
            return NextResponse.json({ result: 0 }); // Kaspi expects 0 = OK
        }

        // Signature verification (skip if secret not configured — misconfiguration guard)
        if (!KASPI_WEBHOOK_SECRET) {
            console.error('🚨 KASPI_WEBHOOK_SECRET not set — Kaspi webhook disabled for safety');
            return NextResponse.json({ result: 1, message: 'Server misconfiguration' }, { status: 500 });
        }
        if (!sign) {
            return NextResponse.json({ result: 1, message: 'Missing signature' }, { status: 403 });
        }
        const expectedSign = crypto
            .createHmac('sha256', KASPI_WEBHOOK_SECRET)
            .update(`${txn_id}${order_id}${status}${amount}`)
            .digest('hex');
        if (expectedSign !== sign) {
            console.error('🚨 Kaspi webhook signature mismatch');
            return NextResponse.json({ result: 1, message: 'Invalid signature' }, { status: 403 });
        }

        if (!order_id?.startsWith('KASPI_UID_')) {
            return NextResponse.json({ result: 1, message: 'Invalid order ID' }, { status: 400 });
        }

        // Idempotency (after signature)
        if (await isPaymentProcessed(order_id)) {
            return NextResponse.json({ result: 0 });
        }

        // Parse order_id: KASPI_UID_{userId}_PACK_{packId}_TS_{ts}
        const packStart = order_id.indexOf('PACK_') + 5;
        const tsIndex   = order_id.indexOf('_TS_');
        const packId    = order_id.substring(packStart, tsIndex);
        const userId    = parseInt(order_id.split('_')[2], 10);
        const plan      = PLANS[packId];

        if (isNaN(userId) || !plan) {
            return NextResponse.json({ result: 1, message: 'Bad package data' }, { status: 400 });
        }

        console.log(`✅ Kaspi webhook: UID ${userId} paid for ${packId} (${amount} KZT)`);

        // Grant resources atomically
        try {
            await prisma.$transaction(async (tx) => {
                await tx.processedPayment.create({ data: { order_id } });
                if (plan.tier) {
                    await upgradeSubscriptionPlan(userId, packId, tx);
                } else {
                    if (plan.chars)   await addPurchasedTokens(userId, 'chars',   plan.chars,   tx);
                    if (plan.visuals) await addPurchasedTokens(userId, 'visuals', plan.visuals, tx);
                    if (plan.reports) await addPurchasedTokens(userId, 'reports', plan.reports, tx);
                }
            });
        } catch (txErr: unknown) {
            const err = txErr as { code?: string };
            if (err?.code === 'P2002') {
                return NextResponse.json({ result: 0 }); // already processed
            }
            throw txErr;
        }

        // Generate receipt
        const receiptId = `KSP-${crypto.randomBytes(6).toString('hex').toUpperCase()}-${userId}`;
        const kztAmount = PLANS_KZT[packId] ?? parseInt(amount, 10);

        try {
            const { generateAndStoreReceipt } = await import('@/lib/receiptGenerator');
            generateAndStoreReceipt({
                id:         receiptId,
                userId,
                type:       'crypto_purchase',
                packName:   plan.name,
                amountText: `${kztAmount.toLocaleString('ru-RU')} ₸`,
                dateISO:    new Date().toISOString(),
            }).catch(e => console.error('[kaspi-webhook] receipt gen failed:', e));
        } catch (e) {
            console.error('[kaspi-webhook] receipt trigger error:', e);
        }

        // Telegram notification
        try {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const { getUserById } = await import('@/lib/db');
            const userRow = await getUserById(userId);
            if (botToken && userRow?.telegram_id) {
                const webDomain = process.env.WEBHOOK_DOMAIN || 'https://perricheno.ru';
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: userRow.telegram_id,
                        text: [
                            `✅ <b>Оплата через Kaspi подтверждена!</b>`,
                            ``,
                            `📦 Пакет: <b>${plan.name}</b>`,
                            `💳 Сумма: <b>${kztAmount.toLocaleString('ru-RU')} ₸</b>`,
                            `📅 Дата: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`,
                            ``,
                            `<i>Ресурсы добавлены на ваш баланс.</i>`,
                        ].join('\n'),
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📄 Скачать PDF-чек', url: `${webDomain}/api/billing/receipt/${receiptId}` }],
                                [{ text: '💳 Мой баланс', callback_data: 'billing_info' }],
                            ],
                        },
                    }),
                });
            }
        } catch (e) {
            console.error('[kaspi-webhook] telegram notify error:', e);
        }

        return NextResponse.json({ result: 0 }); // Kaspi expects 0 = processed OK
    } catch (err) {
        console.error('[kaspi-webhook] error:', err);
        return NextResponse.json({ result: 1, message: 'Internal error' }, { status: 500 });
    }
}
