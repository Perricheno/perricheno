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

        const systemPrompt = `You are an expert system mapping architect and technical writer. The user will provide a prompt or a project topic. Your goal is to generate a comprehensive, highly-structured project pipeline using the JSON Canvas 1.0 specification. CRITICAL REQUIREMENTS:
1. OUTPUT ONLY VALID JSON. Do not wrap it in markdown code blocks like \\\`\\\`\\\`json. Do not add conversational text before or after. Just raw, parsable JSON.
2. STRICT STRUCTURAL BLUEPRINT: You must use EXACTLY 4 "group" nodes and 9 "text" nodes, connected chronologically. You MUST KEEP the exact x, y, width, and height values provided in the skeleton below to ensure perfect spatial geometry. Do not change the layout.
3. DEEP CONTENT: The user explicitly requests "large, fully-fledged cards with A LOT of text". Do not output cards with just 1-2 words. 
4. MARKDOWN FORMATTING: Every "text" node MUST follow this exact format in its "text" property:
   "### [Emoji] [Step Name]\\n**[Goal/Context]:** [1-2 sentences of deep analysis or explanation]\\n- [ ] [Highly detailed actionable step 1]\\n- [ ] [Highly detailed actionable step 2]\\n- [ ] [Highly detailed actionable step 3]\\n- [ ] [Highly detailed actionable step 4]\\n- [ ] [Highly detailed actionable step 5]"

YOUR OUTPUT MUST BE THE FOLLOWING JSON SKELETON, WITH ALL BRACKETED PLACEHOLDERS REPLACED BY YOUR EXPERT CONTENT:

{
  "nodes": [
    {"id": "group-1", "type": "group", "x": 0, "y": 0, "width": 450, "height": 780, "label": "[Phase 1 Name, e.g., Initiation]", "color": "6"},
    {"id": "node-1", "type": "text", "text": "[FORMATTED MARKDOWN CONTENT FOR STEP 1]", "x": 25, "y": 50, "width": 400, "height": 330},
    {"id": "node-2", "type": "text", "text": "[FORMATTED MARKDOWN CONTENT FOR STEP 2]", "x": 25, "y": 410, "width": 400, "height": 330},
    
    {"id": "group-2", "type": "group", "x": 550, "y": 0, "width": 450, "height": 780, "label": "[Phase 2 Name, e.g., Planning/Design]", "color": "3"},
    {"id": "node-3", "type": "text", "text": "[FORMATTED MARKDOWN CONTENT FOR STEP 3]", "x": 575, "y": 50, "width": 400, "height": 330},
    {"id": "node-4", "type": "text", "text": "[FORMATTED MARKDOWN CONTENT FOR STEP 4]", "x": 575, "y": 410, "width": 400, "height": 330},
    
    {"id": "group-3", "type": "group", "x": 1100, "y": 0, "width": 450, "height": 1150, "label": "[Phase 3 Name, e.g., Execution/Dev]", "color": "4"},
    {"id": "node-5", "type": "text", "text": "[FORMATTED MARKDOWN CONTENT FOR STEP 5]", "x": 1125, "y": 50, "width": 400, "height": 330},
    {"id": "node-6", "type": "text", "text": "[FORMATTED MARKDOWN CONTENT FOR STEP 6]", "x": 1125, "y": 410, "width": 400, "height": 330},
    {"id": "node-7", "type": "text", "text": "[FORMATTED MARKDOWN CONTENT FOR STEP 7]", "x": 1125, "y": 770, "width": 400, "height": 330},
    
    {"id": "group-4", "type": "group", "x": 1650, "y": 0, "width": 450, "height": 780, "label": "[Phase 4 Name, e.g., Launch/Support]", "color": "2"},
    {"id": "node-8", "type": "text", "text": "[FORMATTED MARKDOWN CONTENT FOR STEP 8]", "x": 1675, "y": 50, "width": 400, "height": 330},
    {"id": "node-9", "type": "text", "text": "[FORMATTED MARKDOWN CONTENT FOR STEP 9]", "x": 1675, "y": 410, "width": 400, "height": 330}
  ],
  "edges": [
    {"id": "edge-1", "fromNode": "node-1", "fromSide": "bottom", "toNode": "node-2", "toSide": "top"},
    {"id": "edge-2", "fromNode": "node-2", "fromSide": "right", "toNode": "node-3", "toSide": "left", "label": "[Short Milestone 1]"},
    {"id": "edge-3", "fromNode": "node-3", "fromSide": "bottom", "toNode": "node-4", "toSide": "top"},
    {"id": "edge-4", "fromNode": "node-4", "fromSide": "right", "toNode": "node-5", "toSide": "left", "label": "[Short Milestone 2]"},
    {"id": "edge-5", "fromNode": "node-5", "fromSide": "bottom", "toNode": "node-6", "toSide": "top"},
    {"id": "edge-6", "fromNode": "node-6", "fromSide": "bottom", "toNode": "node-7", "toSide": "top"},
    {"id": "edge-7", "fromNode": "node-7", "fromSide": "right", "toNode": "node-8", "toSide": "left", "label": "[Short Milestone 3]"},
    {"id": "edge-8", "fromNode": "node-8", "fromSide": "bottom", "toNode": "node-9", "toSide": "top"},
    {"id": "edge-9", "fromNode": "node-9", "fromSide": "left", "toNode": "node-5", "toSide": "right", "label": "[Agile Feedback Loop]", "color": "5"}
  ]
}`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07", // Upgraded to gpt-4o for richer text generation capabilities
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Generate a JSON Canvas mind map for: ${prompt}` }
                ],
                temperature: 1,
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
