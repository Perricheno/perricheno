import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { getAgentSession } from "@/lib/db";

export const dynamic = 'force-dynamic';

export default async function AgentSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;

    // Auth check via JWT session
    const userId = await verifySession();
    if (!userId) {
        redirect("/agent");
    }

    // Fetch session with ownership check
    const session = await getAgentSession(sessionId);
    if (!session || Number(session.user_id) !== Number(userId)) {
        redirect("/agent");
    }

    // Redirect to the correct route based on doc_type
    if (session.doc_type === 'chat') {
        redirect(`/agent/chat/${sessionId}`);
    } else if (session.doc_type === 'literature_search') {
        redirect(`/citations`);
    } else if (session.doc_type === 'data_analytics' || session.doc_type === 'data-analytics') {
        redirect(`/agent/analytics/${sessionId}`);
    } else {
        redirect(`/agent/research/${sessionId}`);
    }
}
