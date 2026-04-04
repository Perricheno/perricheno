import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
        return new NextResponse("Invalid receipt ID", { status: 400 });
    }

    try {
        const stmt = db.prepare(`SELECT pdf_base64 FROM receipts WHERE id = ?`);
        const result = stmt.get(id) as any;

        if (!result || !result.pdf_base64) {
            // Receipt might still be generating in the background, or doesn't exist.
            // If it exists but no PDB, we can show a wait message.
            const checkStmt = db.prepare(`SELECT id FROM receipts WHERE id = ?`);
            const exists = checkStmt.get(id) as any;
            
            if (exists) {
                return new NextResponse(
                    "<html><body><h2>Чек генерируется... (Обычно занимает 5-15 секунд)</h2><p>Пожалуйста, обновите страницу через пару секунд.</p><script>setTimeout(()=>window.location.reload(), 5000)</script></body></html>",
                    { status: 202, headers: { "Content-Type": "text/html; charset=utf-8" } }
                );
            }

            return new NextResponse("Receipt not found. It may be processing or does not exist.", { status: 404 });
        }

        // pdf_base64 format is usually: data:application/pdf;base64,JVBERi0...
        const base64Data = result.pdf_base64.replace(/^data:application\/pdf;base64,/, "");
        let pdfBuffer = Buffer.from(base64Data, 'base64');

        // Some compilers return 'application/zip' which got stored incorrectly if not parsed.
        // PDF magic number is %PDF (0x25, 0x50, 0x44, 0x46). ZIP magic number is PK (0x50, 0x4B)
        if (pdfBuffer.length > 4 && pdfBuffer[0] === 0x50 && pdfBuffer[1] === 0x4B) {
            // It's a ZIP archive! We must extract the PDF.
            const JSZip = require('jszip');
            const unzipped = await JSZip.loadAsync(pdfBuffer);
            
            // Find any pdf file in the zip
            const pdfFile = Object.values(unzipped.files).find((f: any) => f.name.endsWith('.pdf'));
            if (pdfFile) {
                pdfBuffer = await (pdfFile as any).async('nodebuffer');
            }
        }

        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Length": pdfBuffer.length.toString(),
                "Accept-Ranges": "bytes",
                "Content-Disposition": `inline; filename="receipt_${id}.pdf"`,
            }
        });

    } catch (err: any) {
        console.error("Fetch receipt error:", err);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
