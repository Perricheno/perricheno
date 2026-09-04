import { NextRequest, NextResponse } from "next/server";
import { getUserById, PLAN_LIMITS, addPurchasedTokens } from "@/lib/db";
import { prisma } from "@/lib/prisma";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SHOP_ID = process.env.CRYPTOCLOUD_SHOP_ID;

// ── Pack catalog (mirrors checkout/route.ts) ──
const PACKAGES: Record<string, {
    amount: number;
    chars: number;
    reports: number;
    name: string;
    description: string;
    tag?: string;
    emoji: string;
}> = {
    'starter_chars': { amount: 1, chars: 100_000, reports: 0, name: 'Starter Pack', description: '100K символов', tag: 'Budget', emoji: '⚡' },
    'writer': { amount: 3, chars: 500_000, reports: 0, name: 'Writer Pack', description: '500K символов', emoji: '✍️' },
    'data_scientist': { amount: 5, chars: 2_000_000, reports: 0, name: 'Data Scientist', description: '2M символов', tag: 'Popular', emoji: '🔬' },
    'researcher': { amount: 12, chars: 5_000_000, reports: 0, name: 'Researcher', description: '5M символов', emoji: '📚' },
    'report_single': { amount: 2, chars: 0, reports: 3, name: '3 Reports', description: '3 отчёта', emoji: '📄' },
    'report_bulk': { amount: 8, chars: 0, reports: 15, name: '15 Reports', description: '15 отчётов', tag: 'Best Value', emoji: '⭐' },
    'combo_lite': { amount: 7, chars: 1_000_000, reports: 5, name: 'Lite Bundle', description: '1M символов + 5 отчётов', emoji: '📦' },
    'combo_pro': { amount: 20, chars: 10_000_000, reports: 30, name: 'Pro Bundle', description: '10M символов + 30 отчётов', tag: 'Ultimate', emoji: '🔥' },
};

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { action, telegram_id } = body;

        if (!telegram_id && action !== 'packages') {
            return NextResponse.json({ error: "Missing telegram_id" }, { status: 400 });
        }

        const user = telegram_id
            ? await prisma.user.findFirst({ where: { telegram_id: String(telegram_id) } })
            : null;

        // ═══════════════════════════════
        // ACTION: status - Current billing info
        // ═══════════════════════════════
        if (action === "status" || !action) {
            if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

            const tier = user.plan_tier || "free";
            const limits = PLAN_LIMITS[tier as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
            
            const billing = {
                id: user.id,
                tier,
                daily_chars: {
                    used: user.daily_chars_used || 0,
                    max: 0,
                    remaining: 0
                },
                weekly_chars: {
                    used: user.weekly_chars_used || 0,
                    max: limits.weekly_chars,
                    remaining: Math.max(0, limits.weekly_chars - (user.weekly_chars_used || 0))
                },
                purchased: {
                    chars: user.purchased_chars || 0,
                    visuals: user.purchased_visuals || 0,
                    reports: user.purchased_reports || 0
                },
                generations: {
                    reports_daily: user.daily_reports_used || 0,
                    reports_max: 999,
                    visuals_daily: user.daily_visuals_used || 0
                },
                resets: {
                    daily: user.last_reset_date,
                    weekly: user.last_week_reset
                }
            };
            return NextResponse.json({ billing });
        }

        // ═══════════════════════════════
        // ACTION: packages - List available packs
        // ═══════════════════════════════
        if (action === "packages") {
            const { category } = body;
            let packs = Object.entries(PACKAGES).map(([id, p]) => ({ id, ...p }));
            if (category && category !== 'all') {
                packs = packs.filter(p => {
                    if (category === 'chars') return p.chars > 0 && p.reports === 0;
                    if (category === 'reports') return p.reports > 0 && p.chars === 0;
                    if (category === 'combo') return p.chars > 0 && p.reports > 0;
                    return true;
                });
            }
            return NextResponse.json({ packages: packs });
        }

        // ═══════════════════════════════
        // ACTION: checkout - Create CryptoCloud invoice
        // ═══════════════════════════════
        if (action === "checkout") {
            if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

            const { packId } = body;
            const selectedPack = PACKAGES[packId];
            if (!selectedPack) {
                return NextResponse.json({ error: "Invalid package" }, { status: 400 });
            }

            // Try CryptoCloud API
            if (CRYPTOCLOUD_API_KEY && CRYPTOCLOUD_SHOP_ID) {
                const uniqueOrderId = `UID_${user.id}_PACK_${packId}_TS_${Date.now()}`;

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

                const data = await res.json().catch(() => ({}));

                if (data.status === "success" || data.result?.link || data.pay_url) {
                    const payUrl = data.result?.link || data.pay_url || data.result?.pay_url;
                    return NextResponse.json({
                        success: true,
                        pay_url: payUrl,
                        order_id: uniqueOrderId,
                        pack: selectedPack
                    });
                }
            }

            // Fallback to POS terminal
            return NextResponse.json({
                success: true,
                pay_url: "https://pay.cryptocloud.plus/pos/gTEj6wIpQ46vKqaH",
                fallback: true,
                pack: selectedPack
            });
        }

        // ═══════════════════════════════
        // ACTION: transactions - Last N transactions
        // ═══════════════════════════════
        if (action === "transactions") {
            if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

            const limit = body.limit || 10;
            const txs = await prisma.transaction.findMany({
                where: {
                    user_id: user.id,
                    NOT: { amount_text: { in: ["0", "-0", ""] } }
                },
                select: { id: true, topic: true, amount_text: true, is_positive: true, created_at: true },
                orderBy: { created_at: 'desc' },
                take: limit
            });

            const transactions = txs.map((tx: any) => ({
                id: tx.id,
                topic: tx.topic,
                amount: tx.amount_text,
                is_positive: tx.is_positive,
                date: tx.created_at
            }));

            const receiptsDb = await prisma.receipt.findMany({
                where: { user_id: user.id },
                select: { id: true, type: true, pack_name: true, amount_text: true, created_at: true },
                orderBy: { created_at: 'desc' },
                take: limit
            });

            const receipts = receiptsDb.map((r: any) => ({
                id: r.id,
                title: r.pack_name,
                url: `${process.env.SITE_INTERNAL_URL?.replace('http://perricheno-site:3000', process.env.WEBHOOK_DOMAIN || 'https://perricheno.ru') || 'https://perricheno.ru'}/api/billing/receipt/${r.id}`,
                date: r.created_at
            }));

            return NextResponse.json({ transactions, receipts });
        }

        // ═══════════════════════════════
        // ACTION: promo - Apply promo code
        // ═══════════════════════════════
        if (action === "promo") {
            if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

            const { code } = body;
            if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

            const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
            if (!promo) return NextResponse.json({ error: "Промокод не найден." }, { status: 404 });
            if (promo.is_active === false) return NextResponse.json({ error: "Промокод деактивирован." }, { status: 410 });
            if (promo.uses >= promo.max_uses) return NextResponse.json({ error: "Лимит активаций исчерпан." }, { status: 410 });

            // Check if user already used this promo & apply atomically
            const type = promo.type as 'chars' | 'visuals' | 'reports';

            try {
                await prisma.$transaction(async (tx) => {
                    // 1. Record usage (throws P2002 if already used)
                    await tx.promoUsage.create({ data: { promo_id: promo.id, user_id: user.id } });

                    // 2. Increment uses ONLY IF under max_uses
                    const updatedPromo = await tx.promoCode.updateMany({
                        where: { id: promo.id, uses: { lt: promo.max_uses } },
                        data: { uses: { increment: 1 } }
                    });

                    if (updatedPromo.count === 0) {
                        throw new Error('EXHAUSTED');
                    }

                    // 3. Apply promo
                    await addPurchasedTokens(user.id, type, promo.amount, tx);
                });
            } catch (err: any) {
                if (err.code === 'P2002') {
                    return NextResponse.json({ error: "Вы уже использовали этот промокод." }, { status: 403 });
                }
                if (err.message === 'EXHAUSTED') {
                    return NextResponse.json({ error: "Лимит активаций исчерпан." }, { status: 410 });
                }
                throw err;
            }

            const crypto = require('crypto');
            const uniqueId = crypto.randomBytes(6).toString('hex').toUpperCase();
            const receiptId = `PRN-PROMO-${uniqueId}-${user.id}`;
            const amountText = `${promo.amount.toLocaleString()} ${type} (Promo)`;
            
            // Fire-and-forget receipt generation
            try {
                const { generateAndStoreReceipt } = await import('@/lib/receiptGenerator');
                generateAndStoreReceipt({
                    id: receiptId,
                    userId: user.id,
                    type: 'promo_code',
                    packName: `Promo: ${code}`,
                    amountText: amountText,
                    dateISO: new Date().toISOString()
                }).catch(e => console.error(e));
            } catch(e) {
                console.error("Receipt gen failed", e);
            }

            const webDomain = process.env.WEBHOOK_DOMAIN || 'https://perricheno.ru';

            return NextResponse.json({
                success: true,
                type,
                amount: promo.amount,
                receipt_url: `${webDomain}/api/billing/receipt/${receiptId}`,
                message: `Промокод применён! +${promo.amount.toLocaleString()} ${type}.`
            });
        }

        // ═══════════════════════════════
        // ACTION: receipt - Generate receipt data
        // ═══════════════════════════════
        if (action === "receipt") {
            if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

            const { transactionId } = body;
            const tx = await prisma.transaction.findFirst({
                where: { id: Number(transactionId), user_id: user.id }
            });
            if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

            return NextResponse.json({
                receipt: {
                    id: `PRN-${String(tx.id).padStart(6, '0')}`,
                    user_id: user.id,
                    username: user.username || user.first_name || `TG#${user.telegram_id}`,
                    topic: tx.topic,
                    amount: tx.amount_text,
                    is_positive: tx.is_positive,
                    date: tx.created_at,
                    platform: "Perricheno",
                    payment_method: "CryptoCloud (Crypto)"
                }
            });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
