import { redirect } from 'next/navigation';
import { getSpaceByShareId, getSpaceFiles } from '@/lib/space-db';
import SpaceEditor from '../../[spaceId]/SpaceEditor';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ shareId: string }> };

export default async function PublicSpacePage({ params }: Props) {
    const { shareId } = await params;
    const space = await getSpaceByShareId(shareId);
    if (!space) redirect('/space');

    const files = await getSpaceFiles(space.id);

    // Read-only view - userId=-1 signals no-write (enforced by API anyway)
    return (
        <SpaceEditor
            initialSpace={space}
            initialFiles={files}
            userId={-1}
            readOnly
        />
    );
}
