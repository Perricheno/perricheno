import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    try {
        const { currentCode, editPrompt } = await req.json();

        const prompt = `You are an R visualization expert editing existing R code. 
        
CURRENT R CODE:
\`\`\`R
${currentCode}
\`\`\`

USER EDIT REQUEST:
"${editPrompt}"

TASK: Return the FULL updated R code incorporating the user's request. Maintain all requirements (no Cairo() calls, publication quality, self-contained).
CRUCIAL: Ensure text readability! Use \`ggrepel\` to prevent text overlaps if labels are used. Rotate x-axis labels if there are many categories. Do not clutter the plot. Use a clean theme.
Do NOT wrap in \`\`\`R or markdown. Return ONLY the raw executable R code.`;

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07",
                messages: [
                    { role: "system", content: "You are an expert R programmer modifying code. Output ONLY raw executable R code. No formatting or explanations." },
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!aiRes.ok) throw new Error("AI Edit failed completion");

        const data = await aiRes.json();
        let newCode = data.choices[0].message.content.trim();
        if (newCode.startsWith("```")) newCode = newCode.replace(/^```(?:r|R)?\s*/, "");
        if (newCode.endsWith("```")) newCode = newCode.replace(/```\s*$/, "");

        return NextResponse.json({ code: newCode });

    } catch (err: any) {
        console.error("Visualize edit error:", err);
        return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
    }
}
