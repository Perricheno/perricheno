import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import { getSpace, getSpaceFiles } from '@/lib/space-db';
import SpaceEditor from './SpaceEditor';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ spaceId: string }> };

export default async function SpacePage({ params }: Props) {
    const userId = await verifySession();
    if (!userId) redirect('/');

    const { spaceId } = await params;
    const space = await getSpace(spaceId, userId);
    if (!space) redirect('/space');

    const files = await getSpaceFiles(spaceId);

    return (
        <SpaceEditor
            initialSpace={space}
            initialFiles={files}
            userId={userId}
        />
    );
}
