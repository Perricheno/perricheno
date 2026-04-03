import { Markup } from "telegraf";

export function getMainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback("📊 Визуализация данных", "tool_visual")],
        [Markup.button.callback("📜 История чатов", "history_1")],
        [Markup.button.callback("👤 Мой профиль", "me_info")]
    ]);
}

export function getVisualMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback("📉 Линейный график", "gen_line")],
        [Markup.button.callback("📊 Столбчатая диаграмма", "gen_bar")],
        [Markup.button.callback("🥧 Круговая диаграмма", "gen_pie")],
        [Markup.button.callback("« Назад", "main_menu")]
    ]);
}

export function getHistoryMenu(chats: any[], page: number, totalPages: number) {
    const buttons = chats.map(c => [Markup.button.callback(c.title || "Без названия", `chat_${c.id}`)]);
    
    const nav = [];
    if (page > 1) nav.push(Markup.button.callback("« Назад", `history_${page - 1}`));
    nav.push(Markup.button.callback(`${page} / ${totalPages}`, "noop"));
    if (page < totalPages) nav.push(Markup.button.callback("Вперед »", `history_${page + 1}`));
    
    buttons.push(nav);
    buttons.push([Markup.button.callback("« В главное меню", "main_menu")]);
    
    return Markup.inlineKeyboard(buttons);
}

export function getVisualContextButtons(chartId: string) {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback("🎨 Изменить цвета", `edit_color_${chartId}`),
            Markup.button.callback("🔄 Другой тип", `edit_type_${chartId}`)
        ],
        [Markup.button.callback("📥 Скачать код (.js)", `download_code_${chartId}`)]
    ]);
}
