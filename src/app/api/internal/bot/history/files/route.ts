import { NextRequest, NextResponse } from "next/server";
import { getAgentSession, getUserById } from "@/lib/db";
import JSZip from "jszip";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || "https://pdf.perricheno.ru/api/v1";
const PDF_API_KEY = process.env.PDF_API_KEY || "0a69f4b4-0210-47c0-a2a9-946e3e894c4c";

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
            
            // Include main content (LaTeX or code)
            if (session.main_tex) {
                zip.file("main.tex", session.main_tex);
            }
            
            // Include stream_text as the visualization code (this is where bot-generated code lives)
            if (session.stream_text) {
                const lang = session.stream_text.includes("import ") ? "py" : "R";
                zip.file(`visual.${lang}`, session.stream_text);
            }
            
            if (session.references_bib) {
                zip.file("references.bib", session.references_bib);
            }

            // Include visuals if any
            if (session.visuals_json) {
                try {
                    const visuals = JSON.parse(session.visuals_json);
                    const imgFolder = zip.folder("images");
                    visuals.forEach((v: any, i: number) => {
                        if (v.image) {
                            const base64Data = v.image.replace(/^data:image\/\w+;base64,/, "");
                            imgFolder?.file(`fig_${i + 1}_${v.chart_type || "chart"}.png`, base64Data, { base64: true });
                        }
                        if (v.source_code) {
                            const ext = v.language === 'r' ? 'R' : 'py';
                            zip.file(`code_${i + 1}.${ext}`, v.source_code);
                        }
                    });
                } catch (e) { /* visuals_json might be invalid */ }
            }

            const content = await zip.generateAsync({ type: "nodebuffer" });
            return new NextResponse(content as any, {
                headers: {
                    "Content-Type": "application/zip",
                    "Content-Disposition": `attachment; filename="project_${sessionId.slice(0, 8)}.zip"`,
                },
            });
        }

        if (type === "pdf") {
            // Use the markdown-to-pdf converter since we don't have a LaTeX compiler
            // If main_tex exists, try to convert it; otherwise use stream_text as-is
            const content = session.main_tex || session.stream_text;
            
            if (!content) {
                return NextResponse.json({ error: "Нет содержимого для генерации PDF." }, { status: 404 });
            }

            try {
                // Use multipart/form-data as expected by the PDF service
                const formData = new FormData();
                
                // Create a file from the content and send it as markdown
                const blob = new Blob([content], { type: "text/markdown" });
                formData.append("fileInput", blob, "document.md");

                const compRes = await fetch(`${PDF_SERVICE_URL}/convert/markdown/pdf`, {
                    method: "POST",
                    headers: { "X-API-KEY": PDF_API_KEY },
                    body: formData
                });

                if (compRes.ok) {
                    const pdfBuffer = await compRes.arrayBuffer();
                    return new NextResponse(pdfBuffer as any, {
                        headers: {
                            "Content-Type": "application/pdf",
                            "Content-Disposition": `attachment; filename="report_${sessionId.slice(0, 8)}.pdf"`,
                        },
                    });
                } else {
                    const errText = await compRes.text();
                    console.error("PDF service error:", compRes.status, errText);
                }
            } catch (err) {
                console.error("PDF Comp Error:", err);
            }
            return NextResponse.json({ error: "Не удалось скомпилировать PDF. Используйте ZIP." }, { status: 500 });
        }

        if (type === "images") {
            // Check both visuals_json and compiled images
            if (!session.visuals_json) {
                return NextResponse.json({ visuals: [] });
            }
            try {
                const visuals = JSON.parse(session.visuals_json);
                return NextResponse.json({ visuals: visuals.map((v: any) => ({ image: v.image, chart_type: v.chart_type })) });
            } catch (e) {
                return NextResponse.json({ visuals: [] });
            }
        }

        if (type === "code") {
            // Primary source: stream_text (where bot-generated code is stored)
            // Fallback: visuals_json[].source_code
            const code = session.stream_text;
            
            if (code && code.length > 10) {
                const lang = code.includes("import ") ? "py" : "R";
                return new NextResponse(code, {
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                        "Content-Disposition": `attachment; filename="visual_${sessionId.slice(0, 8)}.${lang}"`,
                    },
                });
            }
            
            // Fallback to visuals_json
            if (session.visuals_json) {
                try {
                    const visuals = JSON.parse(session.visuals_json);
                    if (visuals.length === 1 && visuals[0].source_code) {
                        const v = visuals[0];
                        const lang = v.language === 'python' ? 'py' : 'R';
                        return new NextResponse(v.source_code, {
                            headers: {
                                "Content-Type": "text/plain; charset=utf-8",
                                "Content-Disposition": `attachment; filename="visual_${sessionId.slice(0, 8)}.${lang}"`,
                            },
                        });
                    } else if (visuals.length > 1) {
                        const zip = new JSZip();
                        visuals.forEach((v: any, i: number) => {
                            const lang = v.language === 'python' ? 'py' : 'R';
                            zip.file(`visual_${i + 1}.${lang}`, v.source_code || "");
                        });
                        const content = await zip.generateAsync({ type: "nodebuffer" });
                        return new NextResponse(content as any, {
                            headers: {
                                "Content-Type": "application/zip",
                                "Content-Disposition": `attachment; filename="source_codes_${sessionId.slice(0, 8)}.zip"`,
                            },
                        });
                    }
                } catch (e) { /* ignore parse errors */ }
            }
            
            return NextResponse.json({ error: "Код для этой сессии отсутствует." }, { status: 404 });
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
