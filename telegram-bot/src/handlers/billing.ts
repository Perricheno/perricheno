import { Markup } from "telegraf";
import { getBillingDashboardKeyboard, getBillingShopKeyboard, getBillingPackListKeyboard, getBillingConfirmKeyboard, getBillingHistoryKeyboard } from "../keyboards/menu";

const SITE_URL = process.env.SITE_INTERNAL_URL || "http://perricheno-site:3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// ── Helper ──
async function apiFetch(action: string, data: any): Promise<any> {
    const res = await fetch(`${SITE_URL}/api/internal/bot/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
        body: JSON.stringify({ action, ...data }),
    });
    return res.json();
}

// ═══════════════════════════════════════
// 💳 handleBilling — Dashboard
// ═══════════════════════════════════════
export async function handleBilling(ctx: any) {
    const tgUser = ctx.from;
    
    try {
        const { billing: b, error } = await apiFetch("status", { telegram_id: String(tgUser.id) });
        
        if (error || !b) {
            await ctx.reply("❌ Не удалось загрузить данные биллинга.");
            return;
        }

        const dailyPct = b.daily_chars.max > 0 ? Math.round((b.daily_chars.used / b.daily_chars.max) * 100) : 0;
        const progressBar = buildProgressBar(dailyPct, 10);

        const text = [
            `💳 *Биллинг*`,
            ``,
            `👤 ID: \`${b.id}\` · Тариф: *${b.tier.toUpperCase()}*`,
            ``,
            `━━━ 📊 *Использование сегодня* ━━━`,
            ``,
            `${progressBar} ${dailyPct}%`,
            `🔤 Символов: ${(b.daily_chars.used || 0).toLocaleString()} / ${(b.daily_chars.max || 0).toLocaleString()}`,
            `📄 Отчётов: ${b.generations.reports_daily} / ${b.generations.reports_max}`,
            `📊 Визуализаций: ${b.generations.visuals_daily}`,
            ``,
            `━━━ 💰 *Купленные ресурсы* ━━━`,
            ``,
            `🔤 Символов: *${(b.purchased.chars || 0).toLocaleString()}*`,
            `📊 Визуализаций: *${b.purchased.visuals || 0}*`,
            `📄 Отчётов: *${b.purchased.reports || 0}*`,
        ].join('\n');

        const keyboard = getBillingDashboardKeyboard();

        if (ctx.callbackQuery) {
            await ctx.answerCbQuery();
            await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard }).catch(() => {});
        } else {
            await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
        }
    } catch (err) {
        console.error("handleBilling:", err);
        await ctx.reply("⚠️ Ошибка связи с сервером.");
    }
}

// ═══════════════════════════════════════
// 🛒 handleBillingShop — Category selector
// ═══════════════════════════════════════
export async function handleBillingShop(ctx: any) {
    await ctx.answerCbQuery?.();
    const text = `🛒 *Магазин пакетов*\n\nВыберите категорию:`;
    const keyboard = getBillingShopKeyboard();
    
    if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard }).catch(() => {});
    } else {
        await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
    }
}

// ═══════════════════════════════════════
// 📦 handleBillingCategory — Show packs for category
// ═══════════════════════════════════════
export async function handleBillingCategory(ctx: any, category: string) {
    await ctx.answerCbQuery?.();
    
    try {
        const { packages } = await apiFetch("packages", { category });
        
        if (!packages || packages.length === 0) {
            await ctx.editMessageText("📭 Нет доступных пакетов в этой категории.", {
                ...getBillingShopKeyboard()
            }).catch(() => {});
            return;
        }

        const categoryNames: Record<string, string> = {
            'chars': '🔤 Символы',
            'reports': '📄 Отчёты',
            'combo': '📦 Бандлы',
            'all': '🏷 Все пакеты'
        };

        const lines = [
            `${categoryNames[category] || '📦 Пакеты'}\n`,
        ];

        for (const p of packages) {
            const tagStr = p.tag ? ` _(${p.tag})_` : '';
            lines.push(`${p.emoji} *${p.name}* — $${p.amount}${tagStr}`);
            lines.push(`   └ ${p.description}`);
        }

        lines.push(`\n_Нажмите на пакет для покупки:_`);

        const keyboard = getBillingPackListKeyboard(packages);
        await ctx.editMessageText(lines.join('\n'), { parse_mode: "Markdown", ...keyboard }).catch(() => {});
    } catch (err) {
        console.error("handleBillingCategory:", err);
        await ctx.reply("⚠️ Ошибка загрузки пакетов.");
    }
}

// ═══════════════════════════════════════
// 🏷 handleBillingBuy — Pack details + confirm
// ═══════════════════════════════════════
export async function handleBillingBuy(ctx: any, packId: string) {
    await ctx.answerCbQuery?.();
    
    try {
        const { packages } = await apiFetch("packages", {});
        const pack = packages?.find((p: any) => p.id === packId);
        
        if (!pack) {
            await ctx.reply("❌ Пакет не найден.");
            return;
        }

        const lines = [
            `🧾 *Подтверждение покупки*`,
            ``,
            `━━━━━━━━━━━━━━━━━━`,
            `${pack.emoji} *${pack.name}*`,
            ``,
        ];

        if (pack.chars > 0) lines.push(`🔤 Символов: +${pack.chars.toLocaleString()}`);
        if (pack.reports > 0) lines.push(`📄 Отчётов: +${pack.reports}`);
        
        lines.push(
            ``,
            `💵 Стоимость: *$${pack.amount}*`,
            `💳 Оплата: _CryptoCloud (Crypto)_`,
            `━━━━━━━━━━━━━━━━━━`,
            ``,
            `Нажмите "Подтвердить" для создания счёта.`
        );

        const keyboard = getBillingConfirmKeyboard(packId);
        await ctx.editMessageText(lines.join('\n'), { parse_mode: "Markdown", ...keyboard }).catch(() => {});
    } catch (err) {
        console.error("handleBillingBuy:", err);
        await ctx.reply("⚠️ Ошибка.");
    }
}

// ═══════════════════════════════════════
// ✅ handleBillingConfirm — Create invoice
// ═══════════════════════════════════════
export async function handleBillingConfirm(ctx: any, packId: string) {
    await ctx.answerCbQuery("⏳ Создаю счёт...");
    
    try {
        const result = await apiFetch("checkout", { 
            telegram_id: String(ctx.from.id),
            packId 
        });

        if (result.success && result.pay_url) {
            const pack = result.pack;
            const text = result.fallback
                ? `⚠️ *Прямые счета временно недоступны*\n\nПожалуйста, оплатите через терминал:\n• Сумма: *$${pack.amount}*`
                : `🧾 *Счёт создан!*\n\n📦 Пакет: *${pack.name}*\n💵 Сумма: *$${pack.amount}*\n\nНажмите кнопку ниже для оплаты:`;

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.url("💳 Оплатить", result.pay_url)],
                [Markup.button.callback("« Назад", "billing_shop")]
            ]);

            await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard }).catch(() => {});
        } else {
            await ctx.reply(`❌ ${result.error || "Не удалось создать счёт."}`);
        }
    } catch (err) {
        console.error("handleBillingConfirm:", err);
        await ctx.reply("⚠️ Ошибка создания счёта.");
    }
}

// ═══════════════════════════════════════
// 📜 handleBillingHistory — Transaction list
// ═══════════════════════════════════════
export async function handleBillingHistory(ctx: any) {
    await ctx.answerCbQuery?.();
    
    try {
        const { transactions, error } = await apiFetch("transactions", {
            telegram_id: String(ctx.from.id),
            limit: 10
        });

        if (error) {
            await ctx.reply(`❌ ${error}`);
            return;
        }

        if (!transactions || transactions.length === 0) {
            const text = `📜 *История транзакций*\n\n_Транзакций пока нет._`;
            await ctx.editMessageText(text, { 
                parse_mode: "Markdown", 
                ...getBillingHistoryKeyboard(false) 
            }).catch(() => {});
            return;
        }

        const lines = [`📜 *История транзакций*\n`];

        for (const tx of transactions) {
            const icon = tx.is_positive ? '💚' : '🔸';
            const d = new Date(tx.date + 'Z');
            const dateStr = d.toLocaleString('ru-RU', { 
                day: '2-digit', month: '2-digit', 
                hour: '2-digit', minute: '2-digit',
                timeZone: 'Asia/Almaty' 
            });
            lines.push(`${icon} \`${dateStr}\` ${tx.topic}`);
            lines.push(`   └ ${tx.amount}`);
        }

        const keyboard = getBillingHistoryKeyboard(true);
        await ctx.editMessageText(lines.join('\n'), { parse_mode: "Markdown", ...keyboard }).catch(() => {});
    } catch (err) {
        console.error("handleBillingHistory:", err);
        await ctx.reply("⚠️ Ошибка загрузки истории.");
    }
}

// ═══════════════════════════════════════
// 🎟 handleBillingPromo — Promo code flow
// ═══════════════════════════════════════
export async function handleBillingPromoStart(ctx: any) {
    await ctx.answerCbQuery?.();
    // Set session state for promo input
    if (ctx.session) {
        ctx.session.step = 'promo_input';
    }
    
    const text = `🎟 *Ввод промокода*\n\nОтправьте промокод текстовым сообщением:`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("« Отмена", "billing_info")]
    ]);
    await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard }).catch(() => {});
}

export async function handleBillingPromoApply(ctx: any, code: string) {
    try {
        const result = await apiFetch("promo", {
            telegram_id: String(ctx.from.id),
            code
        });

        if (result.success) {
            await ctx.reply(
                `✅ *Промокод активирован!*\n\n${result.message}`,
                { parse_mode: "Markdown", ...getBillingDashboardKeyboard() }
            );
        } else {
            await ctx.reply(
                `❌ ${result.error || "Неизвестная ошибка."}`,
                { ...getBillingDashboardKeyboard() }
            );
        }
    } catch (err) {
        console.error("handleBillingPromoApply:", err);
        await ctx.reply("⚠️ Ошибка активации промокода.");
    } finally {
        if (ctx.session) ctx.session.step = 'idle';
    }
}

// ── Helpers ──

function buildProgressBar(pct: number, length: number): string {
    const filled = Math.round((pct / 100) * length);
    const empty = length - filled;
    return '█'.repeat(Math.min(filled, length)) + '░'.repeat(Math.max(empty, 0));
}
