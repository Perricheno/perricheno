import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for webhook calls.
 * Bypasses CORS since the request goes from our server (not browser) to n8n.
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const webhookUrl = formData.get("webhookUrl") as string;

        if (!webhookUrl) {
            return NextResponse.json({ error: "Missing webhookUrl" }, { status: 400 });
        }

        // Remove webhookUrl from the forwarded data - n8n doesn't need it
        formData.delete("webhookUrl");

        // Forward to n8n with a generous timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000); // 120s

        const response = await fetch(webhookUrl, {
            method: "POST",
            body: formData,
            signal: controller.signal,
        });
        clearTimeout(timeout);

        // Read the response and forward it back to the browser
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const data = await response.json();
            return NextResponse.json(data);
        } else {
            const text = await response.text();
            return new NextResponse(text, {
                status: response.status,
                headers: { "Content-Type": "text/plain" },
            });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[webhook-proxy]", message);

        if (message.includes("abort")) {
            return NextResponse.json({ error: "Webhook timed out (120s)" }, { status: 504 });
        }

        return NextResponse.json({ error: message }, { status: 502 });
    }
}
