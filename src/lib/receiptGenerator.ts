import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import db from '@/lib/db';

export interface ReceiptData {
    id: string;
    userId: number;
    type: 'crypto_purchase' | 'promo_code' | 'admin_bonus';
    packName: string;
    amountText: string;
    dateISO: string;
}

export async function generateAndStoreReceipt(data: ReceiptData): Promise<boolean> {
    try {
        // 1. Save initial record without PDF
        const stmt = db.prepare(`
            INSERT INTO receipts (id, user_id, type, pack_name, amount_text, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO NOTHING
        `);
        stmt.run(data.id, data.userId, data.type, data.packName, data.amountText, data.dateISO);

        // 2. Read template
        const templatePath = path.join(process.cwd(), 'src', 'lib', 'templates', 'receipt.tex');
        if (!fs.existsSync(templatePath)) {
            console.error("Receipt template not found at", templatePath);
            return false;
        }

        let texContent = fs.readFileSync(templatePath, 'utf-8');
        
        // 3. Replace placeholders
        const verifyUrl = `${process.env.SITE_INTERNAL_URL?.replace('http://perricheno-site:3000', process.env.WEBHOOK_DOMAIN || 'https://perricheno.ru') || 'https://perricheno.ru'}/api/billing/receipt/${data.id}/verify`;
        
        const displayDate = new Date(data.dateISO).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
        
        const typeLabels: Record<string, string> = {
            'crypto_purchase': 'Оплата CryptoCloud',
            'promo_code': 'Активация промокода',
            'admin_bonus': 'Бонус от администрации'
        };

        texContent = texContent
            .replace(/\{\{RECEIPT_ID\}\}/g, data.id)
            .replace(/\{\{USER_ID\}\}/g, data.userId.toString())
            .replace(/\{\{TYPE\}\}/g, typeLabels[data.type] || 'Операция')
            .replace(/\{\{PACK_NAME\}\}/g, data.packName.replace(/_/g, '\\_'))
            .replace(/\{\{AMOUNT\}\}/g, data.amountText.replace(/\$/g, '\\$'))
            .replace(/\{\{DATE\}\}/g, displayDate)
            .replace(/\{\{VERIFY_URL\}\}/g, verifyUrl.replace(/_/g, '\\_'));

        // 4. Create ZIP
        const zip = new JSZip();
        zip.file("main.tex", texContent);
        const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

        // 5. Send to compiler
        const COMPILER_URL = process.env.LATEX_COMPILER_URL || 'http://latex-compiler:8000';
        const COMPILER_KEY = process.env.LATEX_COMPILER_KEY || '';

        const formData = new FormData();
        formData.append("file", new Blob([new Uint8Array(zipBuffer)], { type: "application/zip" }), "project.zip");

        const compilerRes = await fetch(COMPILER_URL, {
            method: 'POST',
            headers: { 'x-api-key': COMPILER_KEY },
            body: formData,
            signal: AbortSignal.timeout(60000)
        });

        if (!compilerRes.ok) {
            console.error("Failed to compile receipt PDF:", await compilerRes.text());
            return false;
        }

        // 6. Convert PDF to base64 and store in DB
        const pdfBuffer = Buffer.from(await compilerRes.arrayBuffer());
        const base64Data = pdfBuffer.toString('base64');

        const updateStmt = db.prepare(`UPDATE receipts SET pdf_base64 = ? WHERE id = ?`);
        updateStmt.run(`data:application/pdf;base64,${base64Data}`, data.id);

        console.log(`✅ Passed receipt generation for ${data.id}`);
        return true;

    } catch (err) {
        console.error(`Error generating receipt ${data.id}:`, err);
        return false;
    }
}
