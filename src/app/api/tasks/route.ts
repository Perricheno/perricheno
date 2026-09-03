import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getTasksByUserId, createTask } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tasks = await getTasksByUserId(userId);
    return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { text, remindAt } = body;

        if (!text || !remindAt) {
            return NextResponse.json({ error: 'Text and remindAt are required' }, { status: 400 });
        }

        const task = await createTask(userId, text, remindAt);
        return NextResponse.json(task);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { taskId, status, text, remindAt } = body;

        if (!taskId) {
            return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        // Update text and remindAt if provided
        const updates: Record<string, any> = {};
        if (text) updates.task_text = text;
        if (remindAt) updates.remind_at = remindAt;
        if (status) updates.status = status;

        // Scoped to the caller's own tasks (user_id filter) - a task ID alone
        // isn't proof of ownership. updateMany matches 0 rows instead of
        // updating someone else's task if the ID doesn't belong to this user.
        const result = await prisma.task.updateMany({
            where: { id: taskId, user_id: userId },
            data: updates,
        });
        if (result.count === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const taskId = searchParams.get('id');

        if (!taskId) {
            return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
        }

        const result = await prisma.task.deleteMany({
            where: { id: Number(taskId), user_id: userId },
        });
        if (result.count === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }
}
