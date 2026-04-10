import { getAgentSessionByShareId } from '@/lib/db';
import { notFound } from 'next/navigation';
import SharedSessionView from './SharedSessionView';

interface PageProps {
    params: Promise<{ shareId: string }>;
}

export default async function SharedSessionPage({ params }: PageProps) {
    const { shareId } = await params;
    const session = await getAgentSessionByShareId(shareId);

    if (!session) return notFound();

    return (
        <SharedSessionView
            title={session.title}
            docType={session.doc_type}
            mainTex={session.main_tex || ''}
            referencesBib={session.references_bib || null}
            visuals={session.visuals_json ? JSON.parse(session.visuals_json) : []}
            createdAt={session.created_at}
        />
    );
}
