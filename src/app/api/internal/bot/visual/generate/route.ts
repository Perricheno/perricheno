import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { context, language = "python" } = await req.json();
        
        if (!context || !context.text_data) {
            return NextResponse.json({ error: "No context provided" }, { status: 400 });
        }

        const systemPrompt = `You are "Perricheno Visual Agent".
Your task is to generate high-quality ${language} code for data visualization.
The user will provide context (text descriptions, file contents, etc.).

CODE RULES:
1. Output ONLY RAW ${language === 'python' ? 'Python' : 'R'} code.
2. No markdown fences.
3. No commentary or explanations.
4. If Python: Use matplotlib or plotly. Ensure you create a figure named 'fig' (for plotly) or simply use plt.plot (for matplotlib).
5. If R: Use ggplot2 or base R.
6. The compiler will automatically save the output as 'output.png'.
7. Do not include any code to 'show' the plot, just the 'save' or the figure object creation.
8. Assume all necessary data is in the script (mock it or extract from context).

CONTEXT:
${context.text_data}
${context.files_text ? `\nFILES CONTEXT:\n${context.files_text}` : ''}
`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // Use mini for speed/cost, replace with 4o if quality is needed
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Generate the visualization code now." }
                ],
                temperature: 0.1,
            })
        });

        if (!response.ok) {
            const err = await response.text();
            return NextResponse.json({ error: `AI Error: ${err}` }, { status: 502 });
        }

        const data = await response.json();
        const code = data.choices[0].message.content.trim();

        return NextResponse.json({ code });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
