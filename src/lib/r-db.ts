import { prisma } from '@/lib/prisma';

export interface RSessionRow {
    id: string;
    user_id: number;
    title: string;
    prompt: string;
    results_json: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
}

export interface RSessionSummary {
    id: string;
    title: string;
    status: string;
    chart_count: number;
    chart_types: string[];
    created_at: string;
    updated_at: string;
}

export interface RResultItem {
    chartType: string;
    name: string;
    image: string;
    code: string;
    status: 'done' | 'error' | 'generating' | 'pending';
    error?: string;
}

export async function createRSession(data: {
    userId: number;
    title: string;
    prompt: string;
}): Promise<RSessionRow> {
    return prisma.rSession.create({
        data: {
            user_id: data.userId,
            title: data.title.slice(0, 120),
            prompt: data.prompt,
            status: 'generating',
        },
    }) as unknown as RSessionRow;
}

export async function updateRSession(
    id: string,
    data: { results_json?: string; status?: string },
): Promise<void> {
    await prisma.rSession.update({
        where: { id },
        data,
    });
}

export async function getRSessionsByUser(userId: number): Promise<RSessionSummary[]> {
    const rows = await prisma.rSession.findMany({
        where: { user_id: userId },
        orderBy: { updated_at: 'desc' },
        take: 60,
    }) as unknown as RSessionRow[];

    return rows.map(r => {
        let chart_count = 0;
        let chart_types: string[] = [];
        if (r.results_json) {
            try {
                const results: RResultItem[] = JSON.parse(r.results_json);
                const done = results.filter(x => x.status === 'done');
                chart_count = done.length;
                chart_types = done.map(x => x.chartType);
            } catch { /* ignore */ }
        }
        return {
            id: r.id,
            title: r.title,
            status: r.status,
            chart_count,
            chart_types,
            created_at: r.created_at.toISOString(),
            updated_at: r.updated_at.toISOString(),
        };
    });
}

export async function getRSession(id: string, userId: number): Promise<RSessionRow | null> {
    const row = await prisma.rSession.findFirst({
        where: { id, user_id: userId },
    });
    return (row as unknown as RSessionRow) ?? null;
}

export async function deleteRSession(id: string, userId: number): Promise<boolean> {
    try {
        await prisma.rSession.deleteMany({ where: { id, user_id: userId } });
        return true;
    } catch {
        return false;
    }
}
