import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    try {
        const { topic, dataContext, availableTypes } = await req.json();

        const prompt = `You are an expert Data Scientist and Visualization Architect.
The user is writing a research paper on the following topic: "${topic}"
User's data context/instructions: "${dataContext}"

Based on this, recommend EXACTLY 3 chart types from the following list that would be the most insightful, creative, or visually impactful for this specific context.
Think outside the box (e.g., if there are correlations, suggest a chord diagram or network graph; if there are parts-of-a-whole, suggest a waffle chart or circlepack).

Available types: ${availableTypes.join(", ")}

Respond ONLY with a valid JSON array of strings containing the 3 chart IDs. No markdown, no explanations. Example: ["waffle", "network", "ridge"]`;

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07",
                messages: [
                    { role: "system", content: "You are a data visualization recommendation engine. Output ONLY a valid JSON array of 3 string IDs." },
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!aiRes.ok) throw new Error("AI Recommendation failed");

        const aiData = await aiRes.json();
        let rawAnswer = aiData.choices[0].message.content.trim();
        
        // Clean up potential markdown
        if (rawAnswer.startsWith("```")) rawAnswer = rawAnswer.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
        
        try {
            const recommended = JSON.parse(rawAnswer);
            if (Array.isArray(recommended)) {
                return NextResponse.json({ recommended: recommended.slice(0, 4) });
            }
        } catch (e) {
            // fallback
        }

        return NextResponse.json({ recommended: ["bar", "scatter", "wordcloud"] }); // fallback

    } catch (err: any) {
        console.error("Visualize recommend error:", err);
        return NextResponse.json({ error: err.message || "Recommendation failed" }, { status: 500 });
    }
}
