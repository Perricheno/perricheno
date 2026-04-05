import { Markup } from "telegraf";
import { InlineKeyboardButton } from "telegraf/types";

export function getMainMenu() {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback("📊 Аналитика", "tool_visual"),
            Markup.button.callback("💻 Компиляция", "tool_compile")
        ],
        [
            Markup.button.callback("📂 История", "history_1"),
            Markup.button.callback("⚡ Задачи", "tasks_active")
        ],
        [
            Markup.button.callback("💳 Баланс", "billing_info"),
            Markup.button.callback("👤 Профиль", "me_info")
        ],
        [
            Markup.button.callback("👥 Рефералы", "referral_main"),
            Markup.button.callback("⚙️ Настройки", "settings_main")
        ]
    ]);
}


export function getHistoryMenu(chats: any[], page: number, totalPages: number) {
    const buttons = chats.map(c => [
        Markup.button.callback(`📊 ${c.title || "Без названия"}`, `history_view_${c.id}`)
    ]);
    
    const nav = [];
    if (page > 1) nav.push(Markup.button.callback("⬅️", `history_${page - 1}`));
    nav.push(Markup.button.callback(`стр. ${page} из ${totalPages}`, "noop"));
    if (page < totalPages) nav.push(Markup.button.callback("➡️", `history_${page + 1}`));
    
    if (nav.length > 0) buttons.push(nav);
    buttons.push([Markup.button.callback("🏠 Главное меню", "main_menu")]);
    
    return Markup.inlineKeyboard(buttons);
}

export function getSessionDetailKeyboard(sessionId: string, shareId?: string) {
    const buttons: any[][] = [
        [
            Markup.button.callback("📄 Отчет PDF", `dl_pdf_${sessionId}`),
            Markup.button.callback("📦 Данные ZIP", `dl_zip_${sessionId}`)
        ],
        [
            Markup.button.callback("🖼 Изображения", `view_images_${sessionId}`),
            Markup.button.callback("💻 Исходный код", `dl_code_${sessionId}`)
        ]
    ];

    if (shareId) {
        const domain = process.env.WEBHOOK_DOMAIN || "perricheno.ru";
        const protocol = domain.includes("localhost") ? "http" : "https";
        buttons.push([Markup.button.url("🌐 Посмотреть на Perricheno Site", `${protocol}://${domain}/agent/shared/${shareId}`)]);
    }

    buttons.push([
        Markup.button.callback("« К списку", "history_1"),
        Markup.button.callback("🗑 Удалить", `history_delete_${sessionId}`)
    ]);
    
    return Markup.inlineKeyboard(buttons);
}

export function getVisualSuggestionsKeyboard(selectedTypes: string[] = []) {
    const types = [
        "Line", "Bar", "Pie", "Scatter", "Histogram", "Boxplot", "Violin", "Area",
        "Heatmap", "Bubble", "Donut", "Radar", "Treemap", "Sunburst", "Waterfall",
        "Sankey", "Funnel", "Gauge", "Bullet", "Candlestick", "OHLC", "Polar",
        "Map", "Network", "Tree", "Chord", "Density", "Surface"
    ];
    
    const buttons = [];
    for (let i = 0; i < types.length; i += 2) { // Changed to 2 for better grid on mobile
        const row = [];
        for (let j = 0; j < 2; j++) {
            const type = types[i + j];
            if (type) {
                const isSelected = selectedTypes.includes(type.toLowerCase());
                row.push(Markup.button.callback(`${isSelected ? '✅ ' : ''}${type}`, `toggle_type_${type.toLowerCase()}`));
            }
        }
        buttons.push(row);
    }
    
    const isAuto = selectedTypes.includes('auto');
    buttons.push([Markup.button.callback(`${isAuto ? '✅ ' : '🤖 '}Авто-выбор ИИ`, "toggle_type_auto")]);
    
    if (selectedTypes.length > 0) {
        buttons.push([Markup.button.callback(`🚀 Создать визуализации (${selectedTypes.length})`, "visual_generate_start")]);
    }
    
    buttons.push([Markup.button.callback("« Главное меню", "main_menu")]);
    
    return Markup.inlineKeyboard(buttons);
}

export function getVisualActionKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback("⚡ Сгенерировать", "visual_generate")],
        [Markup.button.callback("🧹 Сбросить контекст", "visual_reset")],
        [Markup.button.callback("« Отмена", "main_menu")]
    ]);
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

// ── Settings & Security Keyboards ──

export function getSettingsMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback("🛡 Безопасность и Сессии", "security_main")],
        [Markup.button.callback("🌐 Сменить язык (Beta)", "noop")],
        [Markup.button.callback("« Назад", "main_menu")]
    ]);
}

export function getSecurityMenu(sessions: any[]) {
    const buttons = [];
    
    // List active sessions as text-buttons (informative)
    for (const s of sessions) {
        const date = new Date(s.created_at).toLocaleDateString();
        const shortUa = s.user_agent.split(' (')[0];
        buttons.push([Markup.button.callback(`📍 ${shortUa} — ${s.location} (${date})`, "noop")]);
    }

    if (sessions.length > 1) {
        buttons.push([Markup.button.callback("🚫 Завершить другие сеансы", "security_terminate_others")]);
    }
    
    buttons.push([Markup.button.callback("« Назад в настройки", "settings_main")]);
    
    return Markup.inlineKeyboard(buttons);
}
