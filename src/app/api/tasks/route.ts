import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getTasksByUserId, createTask, updateTaskStatus, deleteTask } from '@/lib/db';
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
        if (text || remindAt) {
            const updates: Record<string, any> = {};
            if (text) updates.task_text = text;
            if (remindAt) updates.remind_at = remindAt;
            if (status) updates.status = status;
            await prisma.task.update({ where: { id: taskId }, data: updates });
        } else if (status) {
            await updateTaskStatus(taskId, status);
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

        await deleteTask(Number(taskId));
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }
}
