/**
 * Escapes special characters for Telegram's legacy Markdown.
 * Characters to escape: *, _, `, [
 */
export function escapeMarkdown(text: string | undefined | null): string {
    if (!text) return "";
    return text.replace(/([_*`\[])/g, '\\$1');
}
