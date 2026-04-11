import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { getAgentSession, getAgentSessionsByUser } from "@/lib/db";
import ChatClient from "./ChatClient";

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
    const { chatId } = await params;

    const userId = await verifySession();
    if (!userId) redirect("/agent");

    const session = await getAgentSession(chatId);
    if (!session || Number(session.user_id) !== Number(userId)) {
        redirect("/agent");
    }

    // Only allow chat sessions
    if (session.doc_type !== 'chat') {
        redirect(`/agent/${chatId}`);
    }

    const sessions = await getAgentSessionsByUser(userId);

    return (
        <ChatClient
            initialSession={session as any}
            sessions={sessions as any}
            userId={userId}
        />
    );
}
