import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
        return new NextResponse("Invalid receipt ID", { status: 400 });
    }

    try {
        const stmt = db.prepare(`
            SELECT r.id, r.type, r.pack_name, r.amount_text, r.created_at, u.username, u.telegram_id 
            FROM receipts r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        `);
        const result = stmt.get(id) as any;

        if (!result) {
            return new NextResponse(
                "<html><body><h2>Ошибка: Чек не найден</h2><p>Данный инвойс не зарегистрирован в системе Perricheno.</p></body></html>", 
                { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
        }

        const date = new Date(result.created_at + 'Z').toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
        const isFree = result.amount_text === 'Free' || result.amount_text.includes('0.00');

        const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Проверка чека | Perricheno</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f3f4f6; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                .card { background: white; padding: 2rem; border-radius: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); max-width: 400px; width: 100%; border-top: 6px solid #1a1a1a; }
                .status { color: #10b981; font-weight: 800; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 2rem; border: 1px solid #10b981; background: #ecfdf5; padding: 0.5rem 1rem; border-radius: 99px; width: fit-content; }
                h1 { margin: 0 0 1.5rem 0; font-size: 1.5rem; color: #111827; }
                .row { display: flex; justify-content: space-between; margin-bottom: 0.75rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.75rem; }
                .row:last-child { border: none; margin-bottom: 0; padding-bottom: 0; }
                .label { color: #6b7280; font-size: 0.875rem; }
                .value { font-weight: 600; color: #1f2937; text-align: right; }
                .logo { font-size: 1.2rem; font-weight: 900; letter-spacing: -0.5px; opacity: 0.3; text-align: center; margin-top: 2rem; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="status">✓ Подлинный чек</div>
                <h1>Детали операции</h1>
                <div class="row"><span class="label">ID чека</span><span class="value">${result.id}</span></div>
                <div class="row"><span class="label">Дата</span><span class="value">${date}</span></div>
                <div class="row"><span class="label">Покупатель (UID)</span><span class="value">${result.telegram_id || result.username || 'Аноним'}</span></div>
                <div class="row"><span class="label">Тип</span><span class="value">${result.type}</span></div>
                <div class="row"><span class="label">Услуга / Пакет</span><span class="value">${result.pack_name}</span></div>
                <div class="row">
                    <span class="label">Сумма</span>
                    <span class="value" style="font-size: 1.25rem; color: ${isFree ? '#10b981' : '#111827'}">${result.amount_text}</span>
                </div>
                <div class="logo">PERRICHENO</div>
            </div>
        </body>
        </html>
        `;

        return new NextResponse(html, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });

    } catch (err: any) {
        console.error("Verify receipt error:", err);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
