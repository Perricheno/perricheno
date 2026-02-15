import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        // Forward to external API
        const response = await fetch("https://pdf.perricheno.ru/api/v1/convert/file/pdf", {
            method: "POST",
            headers: {
                "X-API-KEY": "19529837-c5f6-4d7e-9452-37e1d8ef3905",
            },
            body: formData,
        });

        if (!response.ok) {
            return NextResponse.json({ error: `API Error: ${response.statusText}` }, { status: response.status });
        }

        // Get file data
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": 'attachment; filename="converted.pdf"',
            },
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
