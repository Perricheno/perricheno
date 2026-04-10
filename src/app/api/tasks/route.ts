import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jose';
import { getTasksByUserId, createTask, updateTaskStatus, deleteTask, getUserById } from '@/lib/db';
import { supabase } from '@/lib/supabase';

const JWT_SECRET = new TextEncoder().encode("super-secret-key-change-this-in-env-938210");

async function verifyAuth(req: NextRequest) {
    const sessionToken = req.cookies.get('perricheno_session')?.value;
    if (!sessionToken) return null;

    try {
        const { payload } = await jwt.jwtVerify(sessionToken, JWT_SECRET);
        return await getUserById(Number(payload.userId));
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tasks = await getTasksByUserId(user.id);
    return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { text, remindAt } = body;

        if (!text || !remindAt) {
            return NextResponse.json({ error: 'Text and remindAt are required' }, { status: 400 });
        }

        const task = await createTask(user.id, text, remindAt);
        return NextResponse.json(task);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
            await supabase.from('tasks').update(updates).eq('id', taskId);
        } else if (status) {
            await updateTaskStatus(taskId, status);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
