import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { getAgentSession, getAgentSessionsByUser } from "@/lib/db";
import ScholarClient from "./ScholarClient";

export const dynamic = 'force-dynamic';

export default async function ScholarPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const userId = await verifySession();
    if (!userId) redirect("/agent");

    const session = await getAgentSession(id);
    if (!session || Number(session.user_id) !== Number(userId)) {
        redirect("/agent");
    }

    if (session.doc_type !== 'literature_search') {
        redirect(`/agent`);
    }

    const sessions = await getAgentSessionsByUser(userId);

    return (
        <ScholarClient
            initialSession={session as any}
            sessions={sessions as any}
            userId={userId}
        />
    );
}
