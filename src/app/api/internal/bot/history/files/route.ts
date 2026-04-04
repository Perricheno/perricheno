import { NextRequest, NextResponse } from "next/server";
import { getAgentSession, getUserById } from "@/lib/db";
import JSZip from "jszip";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PDF_SERVICE_URL = "https://pdf.perricheno.ru/api/v1/convert/markdown/pdf"; // Adjust if needed
const PDF_API_KEY = "0a69f4b4-0210-47c0-a2a9-946e3e894c4c";

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { sessionId, type } = await req.json();
        const session = getAgentSession(sessionId);

        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        if (type === "zip") {
            const zip = new JSZip();
            zip.file("main.tex", session.main_tex || "");
            if (session.references_bib) {
                zip.file("references.bib", session.references_bib);
            }

            // Include visuals if any
            if (session.visuals_json) {
                const visuals = JSON.parse(session.visuals_json);
                const imgFolder = zip.folder("images");
                visuals.forEach((v: any, i: number) => {
                    if (v.image) {
                        const base64Data = v.image.replace(/^data:image\/\w+;base64,/, "");
                        imgFolder?.file(`fig_${i + 1}_${v.chart_type}.png`, base64Data, { base64: true });
                    }
                });
            }

            const content = await zip.generateAsync({ type: "nodebuffer" });
            return new NextResponse(content as any, {
                headers: {
                    "Content-Type": "application/zip",
                    "Content-Disposition": `attachment; filename="project_${sessionId}.zip"`,
                },
            });
        }

        if (type === "pdf") {
            const zip = new JSZip();
            zip.file("main.tex", session.main_tex || "");
            if (session.references_bib) zip.file("references.bib", session.references_bib);

            // PDF compilation via internal service
            try {
                const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
                // We assume there's a dedicated LaTeX compilation endpoint that takes a ZIP
                const compRes = await fetch("https://pdf.perricheno.ru/api/v1/compile/latex", {
                    method: "POST",
                    headers: { "X-API-KEY": PDF_API_KEY, "Content-Type": "application/octet-stream" },
                    body: zipBuffer as any
                });

                if (compRes.ok) {
                    const pdfBuffer = await compRes.arrayBuffer();
                    return new NextResponse(pdfBuffer as any, {
                        headers: {
                            "Content-Type": "application/pdf",
                            "Content-Disposition": `attachment; filename="report_${sessionId}.pdf"`,
                        },
                    });
                }
            } catch (err) {
                console.error("PDF Comp Error:", err);
            }
            return NextResponse.json({ error: "Не удалось скомпилировать PDF. Используйте ZIP." }, { status: 500 });
        }

        if (type === "images") {
            if (!session.visuals_json) return NextResponse.json({ images: [] });
            const visuals = JSON.parse(session.visuals_json);
            return NextResponse.json({ visuals: visuals.map((v: any) => ({ image: v.image, chart_type: v.chart_type })) });
        }

        if (type === "code") {
            if (!session.visuals_json) return NextResponse.json({ error: "Код для этой сессии отсутствует." }, { status: 404 });
            const visuals = JSON.parse(session.visuals_json);
            
            if (visuals.length === 1) {
                const v = visuals[0];
                const lang = v.chart_type === 'python' ? 'py' : 'R';
                return new NextResponse(v.source_code || "", {
                    headers: {
                        "Content-Type": "text/plain",
                        "Content-Disposition": `attachment; filename="visual_${sessionId.slice(0, 4)}.${lang}"`,
                    },
                });
            } else {
                // If multiple, zip them
                const zip = new JSZip();
                visuals.forEach((v: any, i: number) => {
                    const lang = v.chart_type === 'python' ? 'py' : 'R';
                    zip.file(`visual_${i + 1}_${v.chart_type}.${lang}`, v.source_code || "");
                });
                const content = await zip.generateAsync({ type: "nodebuffer" });
                return new NextResponse(content as any, {
                    headers: {
                        "Content-Type": "application/zip",
                        "Content-Disposition": `attachment; filename="source_codes_${sessionId}.zip"`,
                    },
                });
            }
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
