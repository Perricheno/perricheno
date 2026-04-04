import { Markup } from "telegraf";
import { InlineKeyboardButton } from "telegraf/types";

export function getMainMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Визуализация", callback_data: "tool_visual", style: 'Primary' } as any],
                [{ text: "📂 История", callback_data: "history_1" } as any],
                [
                    { text: "👤 Профиль", callback_data: "me_info" } as any,
                    { text: "💳 Биллинг", callback_data: "billing_info" } as any
                ],
                [{ text: "⚙️ Настройки", callback_data: "settings_main", style: 'Secondary' } as any]
            ]
        }
    };
}


export function getHistoryMenu(chats: any[], page: number, totalPages: number) {
    const buttons = chats.map(c => [{ text: c.title || "Без названия", callback_data: `history_view_${c.id}` } as any]);
    
    const nav = [];
    if (page > 1) nav.push({ text: "«", callback_data: `history_${page - 1}` } as any);
    nav.push({ text: `${page} / ${totalPages}`, callback_data: "noop" } as any);
    if (page < totalPages) nav.push({ text: "»", callback_data: `history_${page + 1}` } as any);
    
    buttons.push(nav);
    buttons.push([{ text: "🏠 В главное меню", callback_data: "main_menu", style: 'Secondary' } as any]);
    
    return { reply_markup: { inline_keyboard: buttons } };
}

export function getSessionDetailKeyboard(sessionId: string, shareId?: string) {
    const buttons: any[][] = [
        [
            { text: "📄 PDF", callback_data: `dl_pdf_${sessionId}`, style: 'Primary' } as any,
            { text: "📦 ZIP", callback_data: `dl_zip_${sessionId}`, style: 'Primary' } as any
        ],
        [
            { text: "🖼 Фото", callback_data: `view_images_${sessionId}` } as any,
            { text: "💻 Код", callback_data: `dl_code_${sessionId}` } as any
        ]
    ];

    if (shareId) {
        buttons.push([{ text: "🔗 Открыть на сайте", url: `https://perricheno.ru/agent/shared/${shareId}` } as any]);
    }

    buttons.push([{ text: "« Назад к списку", callback_data: "history_1", style: 'Secondary' } as any]);
    
    return { reply_markup: { inline_keyboard: buttons } };
}

export function getVisualSuggestionsKeyboard(selectedTypes: string[] = []) {
    const types = [
        "Line", "Bar", "Pie", "Scatter", "Histogram", "Boxplot", "Violin", "Area",
        "Heatmap", "Bubble", "Donut", "Radar", "Treemap", "Sunburst", "Waterfall",
        "Sankey", "Funnel", "Gauge", "Bullet", "Candlestick", "OHLC", "Polar",
        "Map", "Network", "Tree", "Chord", "Density", "Surface"
    ];
    
    const buttons = [];
    for (let i = 0; i < types.length; i += 3) {
        const row = [];
        for (let j = 0; j < 3; j++) {
            const type = types[i + j];
            if (type) {
                const isSelected = selectedTypes.includes(type.toLowerCase());
                row.push({
                    text: `${isSelected ? '✅ ' : ''}${type}`,
                    callback_data: `toggle_type_${type.toLowerCase()}`,
                    style: isSelected ? 'Primary' : undefined
                } as any);
            }
        }
        buttons.push(row);
    }
    
    const isAuto = selectedTypes.includes('auto');
    buttons.push([{
        text: `${isAuto ? '✅ ' : '🤖 '}Авто-выбор (ИИ)`,
        callback_data: "toggle_type_auto",
        style: isAuto ? 'Primary' : undefined
    } as any]);
    
    if (selectedTypes.length > 0) {
        buttons.push([{
            text: `🚀 Сгенерировать (${selectedTypes.length})`,
            callback_data: "visual_generate_start",
            style: 'Primary'
        } as any]);
    }
    
    buttons.push([{ text: "« Назад", callback_data: "main_menu", style: 'Secondary' } as any]);
    
    return { reply_markup: { inline_keyboard: buttons } };
}

export function getVisualActionKeyboard() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🚀 Сгенерировать", callback_data: "visual_generate", style: 'Primary' } as any],
                [{ text: "❌ Очистить и заново", callback_data: "visual_reset", style: 'Destructive' } as any],
                [{ text: "« Отмена", callback_data: "main_menu", style: 'Secondary' } as any]
            ]
        }
    };
}



export function getLangSelectionKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback("🐍 Python (Plotly/Matplotlib)", "lang_python")],
        [Markup.button.callback("📊 R (ggplot2/Shiny)", "lang_r")]
    ]);
}

export function getPostVisualKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback("🔧 Модифицировать", "visual_modify")],
        [Markup.button.callback("✅ Завершить", "main_menu")]
    ]);
}

// ── Billing Keyboards ──

export function getBillingDashboardKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback("🛒 Магазин пакетов", "billing_shop")],
        [Markup.button.callback("📜 История транзакций", "billing_history")],
        [Markup.button.callback("🎟 Ввести промокод", "billing_promo")],
        [Markup.button.callback("« Назад", "main_menu")]
    ]);
}

export function getBillingShopKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback("🔤 Символы", "billing_cat_chars"), Markup.button.callback("📄 Отчёты", "billing_cat_reports")],
        [Markup.button.callback("📦 Бандлы", "billing_cat_combo"), Markup.button.callback("🏷 Все", "billing_cat_all")],
        [Markup.button.callback("« Назад к биллингу", "billing_info")]
    ]);
}

export function getBillingPackListKeyboard(packs: { id: string; emoji: string; name: string; amount: number }[]) {
    const buttons = packs.map(p => [
        Markup.button.callback(`${p.emoji} ${p.name} — $${p.amount}`, `billing_buy_${p.id}`)
    ]);
    buttons.push([Markup.button.callback("« Назад к категориям", "billing_shop")]);
    return Markup.inlineKeyboard(buttons);
}

export function getBillingConfirmKeyboard(packId: string) {
    return Markup.inlineKeyboard([
        [Markup.button.callback("✅ Подтвердить покупку", `billing_confirm_${packId}`)],
        [Markup.button.callback("« Назад", "billing_shop")]
    ]);
}

export function getBillingHistoryKeyboard(hasTxs: boolean) {
    const buttons: any[][] = [];
    if (hasTxs) {
        buttons.push([Markup.button.callback("🔄 Обновить", "billing_history")]);
    }
    buttons.push([Markup.button.callback("« Назад к биллингу", "billing_info")]);
    return Markup.inlineKeyboard(buttons);
}
