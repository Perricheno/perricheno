import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { prisma } from '@/lib/prisma';

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
        await prisma.receipt.upsert({
            where: { id: data.id },
            update: {
                user_id: data.userId,
                type: data.type,
                pack_name: data.packName,
                amount_text: data.amountText,
            },
            create: {
                id: data.id,            
                user_id: data.userId,
                type: data.type,
                pack_name: data.packName,
                amount_text: data.amountText,
                created_at: new Date(data.dateISO)
            }
        });

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

        // Parse custom currency fields from webhook's amount text
        let baseAmount = data.amountText;
        let amountKzt = "-";
        let amountRub = "-";
        
        if (data.amountText.includes(' / ~')) {
            const parts = data.amountText.split(' / ~');
            baseAmount = parts[0] || "-";
            amountKzt = parts[1] ? parts[1].replace(' KZT', '').replace(' ₸', '') : "-";
            amountRub = parts[2] ? parts[2].replace(' RUB', '').replace(' ₽', '') : "-";
        }

        // Generate Crypto-hashes
        const crypto = require('crypto');
        const hashPayload = `${data.id}:${data.userId}:${data.amountText}:${data.dateISO}:SECRET`;
        const sha512Hash = crypto.createHash('sha512').update(hashPayload).digest('hex').toUpperCase();
        
        // Pseudo RSA signature logic for display
        const signatureStr = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET || 'dev_secret')
            .update(hashPayload).digest('hex').toUpperCase();
            
        const fingerprint = signatureStr.substring(0, 32).match(/.{1,2}/g)?.join(':') || 'ERROR';
        
        const verifyUrlLong = `${verifyUrl}?hash=${sha512Hash}&sig=RSA.v1.${signatureStr.substring(0,16)}&date=${encodeURIComponent(data.dateISO)}`;

        const verifyUrlDisplay = verifyUrlLong
            .replace(/&/g, '\\&')
            .replace(/_/g, '\\_')
            .replace(/%/g, '\\%')
            .replace(/#/g, '\\#');

        texContent = texContent
            .replace(/\{\{RECEIPT_ID\}\}/g, data.id)
            .replace(/\{\{USER_ID\}\}/g, data.userId.toString())
            .replace(/\{\{TYPE\}\}/g, typeLabels[data.type] || 'Операция')
            .replace(/\{\{PACK_NAME\}\}/g, data.packName.replace(/_/g, '\\_'))
            .replace(/\{\{AMOUNT\}\}/g, baseAmount.replace(/\$/g, '\\$'))
            .replace(/\{\{AMOUNT_KZT\}\}/g, amountKzt)
            .replace(/\{\{AMOUNT_RUB\}\}/g, amountRub)
            .replace(/\{\{RATE_KZT\}\}/g, "SYS_API")
            .replace(/\{\{RATE_RUB\}\}/g, "SYS_API")
            .replace(/\{\{FINGERPRINT\}\}/g, fingerprint)
            .replace(/\{\{HASH\}\}/g, sha512Hash)
            .replace(/\{\{DATE\}\}/g, displayDate)
            .replace(/\{\{VERIFY_URL_DISPLAY\}\}/g, verifyUrlDisplay)
            .replace(/\{\{VERIFY_URL_QR\}\}/g, verifyUrlLong);

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

        await prisma.receipt.update({
            where: { id: data.id },
            data: { pdf_base64: `data:application/pdf;base64,${base64Data}` }
        });
        console.log(`✅ Passed receipt generation for ${data.id}`);
        return true;

    } catch (err) {
        console.error(`Error generating receipt ${data.id}:`, err);
        return false;
    }
}
