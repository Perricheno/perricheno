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
            // For PDF, we send the LaTeX or Markdown to the processing service
            // Since we have LaTeX, we should ideally use a LaTeX compiler.
            // But the proxy shows 'html-to-pdf' and 'markdown-to-pdf'.
            // If the service supports LaTeX, great. If not, we might need a workaround.
            // Let's assume for now we can get a PDF from the site's shared link or similar.
            // Actually, the simplest is to return the share_id and let the bot/user use that,
            // OR use the internal proxy if it supports TeX.
            
            // For now, let's return a simple message or the ZIP if PDF fails.
            // TO DO: Implement real LaTeX to PDF if possible.
            return NextResponse.json({ error: "PDF generation via bot is pending. Use the ZIP or Web link for now." }, { status: 501 });
        }

        if (type === "images") {
            if (!session.visuals_json) return NextResponse.json({ images: [] });
            const visuals = JSON.parse(session.visuals_json);
            return NextResponse.json({ visuals: visuals.map((v: any) => ({ image: v.image, chart_type: v.chart_type })) });
        }

        if (type === "code") {
            const isPython = session.main_tex?.includes("import ") || session.main_tex?.includes("plt.");
            const filename = isPython ? "visual.py" : "visual.R";
            return new NextResponse(session.main_tex || "", {
                headers: {
                    "Content-Type": "text/plain",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                },
            });
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
