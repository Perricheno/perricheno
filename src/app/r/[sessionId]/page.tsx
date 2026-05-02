import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { getRSession, getRSessionsByUser } from "@/lib/r-db";
import RSessionClient from "./RSessionClient";

export const dynamic = 'force-dynamic';

export default async function RSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;

    const userId = await verifySession();
    if (!userId) redirect("/r");

    const session = await getRSession(sessionId, userId);
    if (!session) {
        redirect("/r");
    }

    const sessions = await getRSessionsByUser(userId);

    return (
        <RSessionClient
            initialSession={session}
            sessions={sessions}
            userId={userId}
        />
    );
}
