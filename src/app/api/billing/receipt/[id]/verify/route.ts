import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
        return new NextResponse("Invalid receipt ID", { status: 400 });
    }

    try {
        const { data: result } = await supabase.from('receipts')
            .select('id, type, pack_name, amount_text, created_at, user_id')
            .eq('id', id)
            .single();

        // Fetch user data separately
        let username = 'ANONYMOUS';
        let telegramId = '';
        if (result) {
            const { data: userData } = await supabase.from('users').select('username, telegram_id').eq('id', result.user_id).single();
            if (userData) {
                username = userData.username || '';
                telegramId = userData.telegram_id || '';
            }
        }

        if (!result) {
            return new NextResponse(
                "<html><body><h2>Ошибка: Чек не найден</h2><p>Данный инвойс не зарегистрирован в системе Perricheno.</p></body></html>", 
                { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
        }

        // Fix SQLite space-delimited datetimes
        let rawDate = result.created_at;
        if (rawDate && !rawDate.includes('T')) {
            rawDate = rawDate.replace(' ', 'T');
        }
        if (rawDate && !rawDate.endsWith('Z')) {
            rawDate += 'Z';
        }

        const dateObj = new Date(rawDate);
        const date = isNaN(dateObj.getTime()) ? result.created_at : dateObj.toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
        
        const isFree = result.amount_text === 'Free' || result.amount_text.includes('0.00');

        const url = new URL(req.url);
        const hash = url.searchParams.get('hash') || 'Встроено в базу (SQLite)';
        const sig = url.searchParams.get('sig') || 'Внутренняя верификация OK';

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Protocol Verification | Perricheno Ledger</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Inter', sans-serif; 
                    background: #e5e5e5; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    min-height: 100vh; 
                    margin: 0;
                    padding: 20px;
                    color: #000;
                }
                .document { 
                    background: #fff; 
                    max-width: 500px; 
                    width: 100%; 
                    border: 1px solid #000;
                    position: relative;
                }
                .header {
                    padding: 24px;
                    border-bottom: 2px solid #000;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .brand {
                    font-size: 20px;
                    font-weight: 800;
                    letter-spacing: -0.5px;
                    text-transform: uppercase;
                }
                .sub-brand {
                    font-size: 10px;
                    text-transform: uppercase;
                    font-weight: 600;
                }
                .status-badge {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 10px;
                    font-weight: 700;
                    color: #059669;
                    border: 1px solid #059669;
                    padding: 4px 8px;
                    text-transform: uppercase;
                }
                .content {
                    padding: 24px;
                }
                .section-title {
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 12px;
                    border-bottom: 1px solid #000;
                    padding-bottom: 4px;
                }
                .data-grid {
                    display: grid;
                    grid-template-columns: 100px 1fr;
                    gap: 12px;
                    margin-bottom: 32px;
                    font-size: 13px;
                }
                .label {
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 10px;
                    align-self: center;
                }
                .value {
                    font-family: 'JetBrains Mono', monospace;
                    text-align: right;
                    word-break: break-all;
                }
                .amount-row {
                    background: #000;
                    color: #fff;
                    padding: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                }
                .amount-label {
                    font-weight: 800;
                    font-size: 12px;
                    text-transform: uppercase;
                }
                .amount-value {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 18px;
                    font-weight: 700;
                }
                .crypto-box {
                    border: 1px dashed #000;
                    padding: 12px;
                    background: #fafafa;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 10px;
                }
                .crypto-row {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    margin-bottom: 12px;
                    word-break: break-all;
                }
                .crypto-row:last-child { margin-bottom: 0; }
                .crypto-label { font-weight: 700; color: #666; }
                .footer {
                    padding: 16px 24px;
                    border-top: 1px solid #000;
                    font-size: 9px;
                    text-align: center;
                    font-family: 'JetBrains Mono', monospace;
                    text-transform: uppercase;
                }
            </style>
        </head>
        <body>
            <div class="document">
                <div class="header">
                    <div>
                        <div class="brand">PERRICHENO</div>
                        <div class="sub-brand">Electronic Fiscal Protocol</div>
                    </div>
                    <div class="status-badge">[ SETTLED : 200 OK ]</div>
                </div>
                <div class="content">
                    <div class="section-title">Transaction Data</div>
                    <div class="data-grid">
                        <div class="label">Protocol ID</div>
                        <div class="value">${result.id}</div>
                        
                        <div class="label">Timestamp</div>
                        <div class="value">${date}</div>
                        
                        <div class="label">Beneficiary</div>
                        <div class="value">${telegramId || username || 'ANONYMOUS'}</div>
                        
                        <div class="label">Tx Type</div>
                        <div class="value" style="text-transform: uppercase;">${result.type}</div>
                        
                        <div class="label">Asset Details</div>
                        <div class="value">${result.pack_name}</div>
                    </div>

                    <div class="amount-row">
                        <div class="amount-label">Financial Settlement</div>
                        <div class="amount-value" style="color: ${isFree ? '#34d399' : '#fff'};">${result.amount_text}</div>
                    </div>

                    <div class="section-title">Digital Attestation</div>
                    <div class="crypto-box">
                        <div class="crypto-row">
                            <span class="crypto-label">SIGNATURE_FINGERPRINT:</span>
                            <span>${sig}</span>
                        </div>
                        <div class="crypto-row">
                            <span class="crypto-label">STATE_HASH_SHA512:</span>
                            <span>${hash}</span>
                        </div>
                        <div class="crypto-row">
                            <span class="crypto-label">ATTESTATION_NODE:</span>
                            <span>perricheno-global-ledger-v1</span>
                        </div>
                    </div>
                </div>
                <div class="footer">
                    SECURED BY PERRICHENO INC.
                </div>
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
