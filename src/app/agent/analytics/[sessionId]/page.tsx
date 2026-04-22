import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { getAgentSession, getAgentSessionsByUser } from "@/lib/db";
import AgentSessionClient from "./AgentSessionClient";

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

    // Fetch sidebar sessions (lightweight metadata only)
    const sessions = await getAgentSessionsByUser(userId);

    return (
        <AgentSessionClient
            initialSession={session as any}
            sessions={sessions as any}
            userId={userId}
        />
    );
}
