import { Markup } from "telegraf";

export function getMainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback("📊 Визуализация", "tool_visual")],
        [Markup.button.callback("📂 История", "history_1")],
        [
            Markup.button.callback("👤 Профиль", "me_info"),
            Markup.button.callback("💳 Биллинг", "billing_info")
        ],
        [Markup.button.callback("⚙️ Настройки", "settings_main")]
    ]);
}


export function getHistoryMenu(chats: any[], page: number, totalPages: number) {
    const buttons = chats.map(c => [Markup.button.callback(c.title || "Без названия", `history_view_${c.id}`)]);
    
    const nav = [];
    if (page > 1) nav.push(Markup.button.callback("«", `history_${page - 1}`));
    nav.push(Markup.button.callback(`${page} / ${totalPages}`, "noop"));
    if (page < totalPages) nav.push(Markup.button.callback("»", `history_${page + 1}`));
    
    buttons.push(nav);
    buttons.push([Markup.button.callback("🏠 В главное меню", "main_menu")]);
    
    return Markup.inlineKeyboard(buttons);
}

export function getSessionDetailKeyboard(sessionId: string, shareId?: string) {
    const buttons = [
        [
            Markup.button.callback("📄 PDF", `dl_pdf_${sessionId}`),
            Markup.button.callback("📦 ZIP", `dl_zip_${sessionId}`)
        ],
        [
            Markup.button.callback("🖼 Фото", `view_images_${sessionId}`),
            Markup.button.callback("💻 Код", `dl_code_${sessionId}`)
        ]
    ];

    if (shareId) {
        buttons.push([Markup.button.url("🔗 Открыть на сайте", `https://perricheno.ru/agent/s/${shareId}`)]);
    }

    buttons.push([Markup.button.callback("« Назад к списку", "history_1")]);
    
    return Markup.inlineKeyboard(buttons);
}

export function getVisualSuggestionsKeyboard() {
    const types = [
        "Line", "Bar", "Pie", "Scatter", "Histogram", "Boxplot", "Violin", "Area",
        "Heatmap", "Bubble", "Donut", "Radar", "Treemap", "Sunburst", "Waterfall",
        "Sankey", "Funnel", "Gauge", "Bullet", "Candlestick", "OHLC", "Polar",
        "Error Bar", "Stack Bar", "Stack Area", "Percent Stack", "Dendrogram",
        "Surface 3D", "Mesh 3D", "Contour", "Streamtube", "Cone 3D", "Quiver",
        "Windrose", "Hexbin", "Density 2D", "Parallel Coord", "Parallel Categories",
        "Sunburst", "Icicle", "Network", "Tree", "Chord", "Map"
    ];
    
    // Group into rows of 2
    const buttons = [];
    for (let i = 0; i < types.length; i += 2) {
        const row = [Markup.button.callback(types[i], `select_type_${types[i].toLowerCase()}`)];
        if (types[i+1]) row.push(Markup.button.callback(types[i+1], `select_type_${types[i+1].toLowerCase()}`));
        buttons.push(row);
    }
    
    buttons.push([Markup.button.callback("🤖 Авто-выбор (ИИ)", "select_type_auto")]);
    buttons.push([Markup.button.callback("« Назад", "main_menu")]);
    
    return Markup.inlineKeyboard(buttons);
}

export function getVisualActionKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback("🚀 Сгенерировать", "visual_generate")],
        [Markup.button.callback("❌ Очистить и заново", "visual_reset")],
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
