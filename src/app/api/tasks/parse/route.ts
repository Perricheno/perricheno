import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { createTask } from '@/lib/db';

export async function POST(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OpenAI API key is missing' }, { status: 500 });
    }

    try {
        const { text, timezoneOffset, currentTime } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text input is required' }, { status: 400 });
        }

        const systemPrompt = `You are a smart assistant that schedules tasks. 
The user will give you a natural language request like "remind me at 18:00 to call mom".
You must extract the exact task description and the exact date/time they want to be reminded.
Return ONLY a raw JSON object with no markdown formatting. Do not wrap in \`\`\`json.
The JSON must have two fields:
- "task": String, the description of the task.
- "remind_at": String, the ISO 8601 string of the absolute date and time to remind the user (in UTC).

Context for calculating the time:
The user's current local time is: ${currentTime}
The user's timezone offset from UTC in minutes is: ${timezoneOffset}
If the user specifies a time without a date, assume it's for today if that time is in the future, or tomorrow if that time has already passed today.

Example output:
{
  "task": "call mom",
  "remind_at": "2026-03-01T15:00:00.000Z"
}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4.1-nano-2025-04-14',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                temperature: 0.1,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI Error:', errorText);
            return NextResponse.json({ error: 'Failed to parse task from OpenAI' }, { status: 500 });
        }

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        // Parse the JSON blocks out if the model ignored our formatting rules
        let parsed;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
        } catch (parseError) {
             console.error('Failed to parse the JSON from OpenAI:', content);
             return NextResponse.json({ error: 'Failed to parse model response' }, { status: 500 });
        }

        // Save to DB automatically
        if (parsed.task && parsed.remind_at) {
             const newTask = await createTask(userId, parsed.task, parsed.remind_at);
             return NextResponse.json({ success: true, task: newTask });
        } else {
             return NextResponse.json({ error: 'Model returned incomplete data' }, { status: 500 });
        }

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
