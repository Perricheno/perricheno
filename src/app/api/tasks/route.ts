import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jwt from 'jose';
import db, { getTasksByUserId, createTask, updateTaskStatus, deleteTask, getUserById } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode("super-secret-key-change-this-in-env-938210");

async function verifyAuth(req: NextRequest) {
    const sessionToken = req.cookies.get('perricheno_session')?.value;
    if (!sessionToken) return null;

    try {
        const { payload } = await jwt.jwtVerify(sessionToken, JWT_SECRET);
        return getUserById(Number(payload.userId));
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest) {
    const user = await verifyAuth(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tasks = getTasksByUserId(user.id);
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

        const task = createTask(user.id, text, remindAt);
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
            const updates: string[] = [];
            const values: any[] = [];
            if (text) { updates.push('task_text = ?'); values.push(text); }
            if (remindAt) { updates.push('remind_at = ?'); values.push(remindAt); }
            if (status) { updates.push('status = ?'); values.push(status); }
            values.push(taskId);
            db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        } else if (status) {
            updateTaskStatus(taskId, status);
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

        deleteTask(Number(taskId));
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }
}
