import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key is not configured." }, { status: 500 });
    }

    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
        }

        const systemPrompt = `You are an expert system mapping architect and technical writer. 
The user will provide a prompt or topic. Your goal is to generate a comprehensive, highly-structured mind map or architecture diagram using the exact JSON Canvas 1.0 specification.

CRITICAL REQUIREMENT:
The user explicitly requested "large, fully-fledged cards with A LOT of text". 
DO NOT output cards with just 1-2 words. EVERY node must contain detailed markdown content: paragraphs, bullet points, deep analysis, and examples. Provide substantial depth and value in each block.

RULES:
1. OUTPUT ONLY VALID JSON. Do not wrap it in markdown code blocks like \`\`\`json. Just raw parsable JSON.
2. The JSON must have two root array properties: "nodes" and "edges".
3. "nodes" must contain objects with:
   - "id": string (unique, e.g., "1", "2")
   - "type": "text"
   - "text": string (CRITICAL: MUST contain extensive Markdown text, multiple paragraphs, headers, and bullet lists explaining the topic in depth).
   - "x": number (horizontal position)
   - "y": number (vertical position)
   - "width": number (Make these LARGE: between 400 and 600)
   - "height": number (Make these LARGE: between 300 and 800 depending on the massive text length)
   - "color": (optional) string like "1" (red), "2" (orange), "3" (yellow), "4" (green), "5" (cyan), "6" (purple).
4. "edges" must contain objects connecting the nodes:
   - "id": string (unique)
   - "fromNode": string (id of source node)
   - "fromSide": string ("right", "left", "top", "bottom")
   - "toNode": string (id of target node)
   - "toSide": string ("right", "left", "top", "bottom")
   - "toEnd": "arrow"
5. SPATIAL MATH IS CRITICAL: Spread nodes out significantly so they don't overlap, considering their large widths and heights.
   - Example spacing: Parent at x:0, y:0. Child 1 at x: 800, y: -500. Child 2 at x: 800, y: 500.`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o", // Upgraded to gpt-4o for richer text generation capabilities
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Generate a JSON Canvas mind map for: ${prompt}` }
                ],
                temperature: 0.7,
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error("OpenAI API Error:", errBody);
            return NextResponse.json({ error: "Failed to generate canvas. External API error." }, { status: 500 });
        }

        const data = await response.json();
        const output = data.choices[0].message.content.trim();

        // Sanitize output in case the AI stubbornly includes markdown blocks
        let cleanJson = output;
        if (cleanJson.startsWith("```json")) {
            cleanJson = cleanJson.replace(/^```json/, "");
        }
        if (cleanJson.endsWith("```")) {
            cleanJson = cleanJson.replace(/```$/, "");
        }

        // Try parsing to validate exactly
        const parsedData = JSON.parse(cleanJson);
        
        if (!parsedData.nodes || !parsedData.edges) {
             return NextResponse.json({ error: "AI generated invalid JSON Canvas format." }, { status: 500 });
        }

        return NextResponse.json({ canvas: parsedData });

    } catch (err: any) {
        console.error("Canvas Generation Error:", err);
        return NextResponse.json({ error: "An unexpected parsing error occurred.", details: err.message }, { status: 500 });
    }
}
