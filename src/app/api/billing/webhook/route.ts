import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { upgradeSubscriptionPlan, isPaymentProcessed, markPaymentProcessed, addPurchasedTokens } from '@/lib/db';

const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SECRET = process.env.CRYPTOCLOUD_SECRET; // This is used to verify signatures

const PLANS: Record<string, { tier?: string, duration?: string, name: string, chars?: number, visuals?: number, reports?: number }> = {
    // Subscriptions
    'plus_month': { tier: 'plus', duration: '1 Month', name: 'Plus (1 Month)' },
    'plus_year': { tier: 'plus', duration: '1 Year', name: 'Plus (1 Year)' },
    'pro_month': { tier: 'pro', duration: '1 Month', name: 'Pro (1 Month)' },
    'pro_year': { tier: 'pro', duration: '1 Year', name: 'Pro (1 Year)' },
    'ultra_month': { tier: 'ultra', duration: '1 Month', name: 'Ultra (1 Month)' },
    'ultra_year': { tier: 'ultra', duration: '1 Year', name: 'Ultra (1 Year)' },

    // Web purchases (AgentBillingModal)
    'data_scientist': { chars: 2000000, visuals: 50, name: 'Data Scientist Pack' },
    'researcher': { chars: 5000000, visuals: 150, name: 'Researcher Bundle' },

    // Telegram Bot purchases
    'starter_chars': { chars: 100000, name: 'Starter Pack' },
    'writer': { chars: 500000, name: 'Writer Pack' },
    'report_single': { reports: 3, name: '3 Reports' },
    'report_bulk': { reports: 15, name: '15 Reports' },
    'combo_lite': { chars: 1000000, reports: 5, name: 'Lite Bundle' },
    'combo_pro': { chars: 10000000, reports: 30, name: 'Pro Bundle' },
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

        // --- IDEMPOTENCY CHECK ---
        if (orderId && await isPaymentProcessed(orderId)) {
            console.log(`ℹ️ Webhook: Skipping already processed order ${orderId}`);
            return new NextResponse('Already processed', { status: 200 });
        }

        if (CRYPTOCLOUD_SECRET && receivedSign) {
            const hashString = `${parsedData.status_invoice || parsedData.status}${orderId}${parsedData.amount_crypto || ''}${parsedData.currency_crypto || ''}${CRYPTOCLOUD_SECRET}`;
            const expectedSign = crypto.createHash('md5').update(hashString).digest('hex');
            
            if (expectedSign !== receivedSign) {
                console.error(`🚨 SECURITY WARNING: Webhook signature mismatch! Expected ${expectedSign}, got ${receivedSign}.`);
                return new NextResponse('Invalid signature', { status: 403 });
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
        // The orderId string is like: UID_8_PACK_plus_month_TS_1711234
        // 'UID' [0], '8' [1], 'PACK' [2], 'plus' [3], 'month' [4] wait.
        // Wait, what splitting logic does `checkout` use? Let's fix this safely.
        // Let's find "PACK_" in orderId...
        const packStartIndex = orderId.indexOf("PACK_") + 5;
        const tsIndex = orderId.indexOf("_TS_");
        const packId = orderId.substring(packStartIndex, tsIndex);

        const userId = parseInt(userIdStr, 10);
        const plan = PLANS[packId];

        if (isNaN(userId) || !plan) {
            return new NextResponse('Bad package data', { status: 400 });
        }

        console.log(`✅ Webhook: Received payment from UID ${userId} for plan ${packId}`);

        // Grant resources
        if (plan.tier) {
            await upgradeSubscriptionPlan(userId, packId);
        } else {
            if (plan.chars) await addPurchasedTokens(userId, 'chars', plan.chars);
            if (plan.visuals) await addPurchasedTokens(userId, 'visuals', plan.visuals);
            if (plan.reports) await addPurchasedTokens(userId, 'reports', plan.reports);
        }

        // Mark as processed to prevent double-crediting
        await markPaymentProcessed(orderId);

        const packName = plan.name;
        const uniqueId = crypto.randomBytes(6).toString('hex').toUpperCase();
        const receiptId = `PRN-${uniqueId}-${userId}`;

        // ── Generate and save logical receipt ──
        try {
            const { generateAndStoreReceipt } = await import('@/lib/receiptGenerator');
            const usdAmount = parseFloat(parsedData.amount) || 0;
            let kztRate = 480;
            let rubRate = 95;

            // Fetch live rates
            try {
                const fxRes = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } });
                const fxData = await fxRes.json();
                if (fxData && fxData.rates) {
                    if (fxData.rates.KZT) kztRate = fxData.rates.KZT;
                    if (fxData.rates.RUB) rubRate = fxData.rates.RUB;
                }
            } catch (fxErr) {
                console.error("Failed to fetch live FX rates:", fxErr);
            }

            const kztAmount = Math.round(usdAmount * kztRate).toLocaleString('ru-RU');
            const rubAmount = Math.round(usdAmount * rubRate).toLocaleString('ru-RU');

            let amountText = "";
            if (parsedData.amount_crypto && parsedData.currency_crypto) {
                amountText = `${parsedData.amount_crypto} ${parsedData.currency_crypto}`;
                if (usdAmount > 0) {
                    amountText += ` / ~${kztAmount} KZT / ~${rubAmount} RUB`;
                }
            } else {
                amountText = `${parsedData.amount} USD / ~${kztAmount} KZT / ~${rubAmount} RUB`;
            }
            
            // Fire-and-forget logic for receipt PDF compilation and storage
            generateAndStoreReceipt({
                id: receiptId,
                userId: userId,
                type: 'crypto_purchase',
                packName: packName,
                amountText: amountText,
                dateISO: new Date().toISOString()
            }).catch(e => console.error("Receipt background gen failed:", e));
        } catch (e) {
            console.error("Failed to trigger receipt generator:", e);
        }

        // ── Send payment confirmation to Telegram ──
        try {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const { getUserById } = await import('@/lib/db');
            const user = await getUserById(userId);
            
            if (botToken && user?.telegram_id) {
                const lines = [
                    `✅ <b>Оплата подтверждена!</b>`,
                    ``,
                    `━━━━━━━━━━━━━━━━━━`,
                    `🧾 <b>Чек #${receiptId}</b>`,
                    `━━━━━━━━━━━━━━━━━━`,
                    ``,
                    `📦 Пакет: <b>${packName}</b>`,
                ];
                
                if (plan.tier) lines.push(`🔤 Доступ: <b>${plan.name}</b>`);
                if (plan.duration) lines.push(`⌛ Период: <b>${plan.duration}</b>`);
                
                lines.push(
                    ``,
                    `💳 Метод: CryptoCloud (Crypto)`,
                    `📅 Дата: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`,
                    ``,
                    `━━━━━━━━━━━━━━━━━━`,
                    `<i>Ресурсы добавлены на ваш баланс.</i>`,
                );

                const webDomain = process.env.WEBHOOK_DOMAIN || 'https://perricheno.ru';

                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: user.telegram_id,
                        text: lines.join('\n'),
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "📄 Скачать PDF-чек", url: `${webDomain}/api/billing/receipt/${receiptId}` }],
                                [{ text: "💳 Мой баланс", callback_data: "billing_info" }],
                                [{ text: "🛒 Купить ещё", callback_data: "billing_shop" }]
                            ]
                        }
                    })
                });
            }
        } catch (e) {
            console.error("Failed to send payment notification:", e);
        }

        return new NextResponse('OK', { status: 200 });
    } catch (err: any) {
        console.error("Webhook processing error:", err);
        return new NextResponse('Internal error', { status: 500 });
    }
}
