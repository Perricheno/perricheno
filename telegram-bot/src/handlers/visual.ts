import { generateChartImage, parsePromptToChart } from "../services/chart";
import { getVisualContextButtons } from "../keyboards/menu";

export async function handleVisualRequest(ctx: any) {
    const text = ctx.message.text;
    
    // 1. Show "Thinking" status via "Typing..." action
    await ctx.sendChatAction("upload_photo");
    
    // 2. Parse the prompt via AI logic
    const chartData = await parsePromptToChart(text);
    
    if (!chartData) {
        return ctx.reply("❌ Не удалось распознать данные для графика. Попробуйте написать по-другому, например: 'Создай бар график по доходам за 4 месяца'.");
    }

    try {
        // 3. Generate the PNG buffer and Source Code
        const { buffer, code, url } = await generateChartImage(chartData.type as any, chartData.data);
        
        // 4. Send the visual first
        await ctx.replyWithPhoto({ source: buffer }, {
            caption: `📊 *Визуализация готова!*\n\n` +
                     `_Запрос: "${text}"_\n` +
                     `Тип: ${chartData.type === 'bar' ? 'Столбчатая' : 'Линейная'}\n\n` +
                     `Ниже вы можете скачать исходный код и изменить оформление.`,
            parse_mode: "Markdown",
            ...getVisualContextButtons("temp_id_123")
        });

        // 5. Send the source code as a file (optional but requested)
        await ctx.replyWithDocument({ source: Buffer.from(code), filename: "chart_source.js" });

    } catch (err) {
        console.error(err);
        await ctx.reply("⚠️ Ошибка при генерации визуализации.");
    }
}
