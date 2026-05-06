import { prisma } from '@/lib/prisma';
import type { User, Task, AgentSession, AgentUpload, Session, Prisma } from '@prisma/client';

export type { User, Task, AgentSession, AgentUpload, Session };

export type AgentSessionSummary = Pick<AgentSession,
    'id' | 'user_id' | 'title' | 'doc_type' | 'status' | 'share_id' | 'created_at' | 'updated_at'
>;

// ── DB layer input types ────────────────────────────────────────────────────

export interface CreateAgentSessionData {
    id: string;
    user_id: number;
    title: string;
    doc_type: string;
    settings_json?: string | null;
    stage_json?: string | null;
    main_tex?: string | null;
    references_bib?: string | null;
    visuals_json?: string | null;
    status?: string;
    stream_text?: string | null;
    tg_message_id?: number | null;
    share_id?: string | null;
}

export interface UpdateAgentSessionData {
    title?: string;
    doc_type?: string;
    settings_json?: string | Record<string, unknown> | null;
    stage_json?: string | Record<string, unknown> | null;
    main_tex?: string | null;
    references_bib?: string | null;
    visuals_json?: string | Record<string, unknown> | null;
    status?: string;
    stream_text?: string | null;
    tg_message_id?: number | null;
    share_id?: string | null;
    error_msg?: string | null;
}

export async function getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const data = await prisma.user.findUnique({ where: { telegram_id: telegramId } });
    return data || undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
    const data = await prisma.user.findUnique({ where: { id } });
    return data || undefined;
}

export async function upsertUser(data: { telegram_id: string; username?: string; first_name?: string; photo_url?: string }): Promise<User> {
    const existing = await getUserByTelegramId(data.telegram_id);
    const today = new Date().toISOString().split('T')[0];

    if (existing) {
        return prisma.user.update({
            where: { telegram_id: data.telegram_id },
            data: {
                username: data.username || null,
                first_name: data.first_name || null,
                photo_url: data.photo_url || null,
                is_deleted: false,
            }
        });
    } else {
        return prisma.user.create({
            data: {
                telegram_id: data.telegram_id,
                username: data.username || null,
                first_name: data.first_name || null,
                photo_url: data.photo_url || null,
                last_reset_date: today,
                is_deleted: false,
            }
        });
    }
}

export async function deleteUser(id: number) {
    await prisma.user.update({
        where: { id },
        data: {
            is_deleted: true,
            username: null,
            first_name: null,
            photo_url: null,
        }
    });
}

// --- Strict Usage Tracking ---
export const PLAN_LIMITS: Record<string, { weekly_chars: number, monthly_chars: number }> = {
    free: { weekly_chars: 50000, monthly_chars: 150000 },
    plus: { weekly_chars: 150000, monthly_chars: 450000 },
    pro: { weekly_chars: 250000, monthly_chars: 800000 },
    ultra: { weekly_chars: 800000, monthly_chars: 3000000 }
};

// Max chars that can be staged (active uploads within 24h window) per plan
export const PDF_STAGING_CAPS: Record<string, number> = {
    free: 200_000,
    plus: 500_000,
    pro: 1_000_000,
    ultra: -1, // unlimited
};

function getWeekNumber(d: Date): string {
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - start.getTime();
    const oneWeek = 604800000;
    return `${d.getFullYear()}-W${Math.ceil((diff / oneWeek) + 1)}`;
}

export async function checkAndDeductUsage(
    userId: number, 
    type: 'chars' | 'visuals' | 'reports', 
    amount: number = 1
): Promise<{ success: boolean; remaining: number }> {
    let user = await getUserById(userId);
    if (!user) return { success: false, remaining: 0 };

    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekNumber(new Date());
    
    // Reset daily limits
    if (user.last_reset_date !== today) {
        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { daily_chars_used: 0, daily_visuals_used: 0, daily_reports_used: 0, last_reset_date: today }
            }),
            prisma.transaction.create({
                data: { user_id: userId, topic: "Daily quota reset", amount_text: "Reset", is_positive: true }
            })
        ]);
        user = await getUserById(userId);
        if (!user) return { success: false, remaining: 0 };
    }

    // Reset weekly limits
    if (user.last_week_reset !== currentWeek) {
        await prisma.user.update({
            where: { id: userId },
            data: { weekly_chars_used: 0, last_week_reset: currentWeek }
        });
        user = await getUserById(userId);
        if (!user) return { success: false, remaining: 0 };
    }

    if (type === 'visuals') {
        try {
            await prisma.$transaction([
                prisma.user.update({
                    where: { id: userId },
                    data: { daily_visuals_used: user.daily_visuals_used + amount }
                }),
                prisma.transaction.create({
                    data: { user_id: userId, topic: "Visual generation", amount_text: `-${amount} visuals`, is_positive: false }
                }),
                prisma.usageLog.create({
                    data: { user_id: userId, tokens: amount }
                })
            ]);
            return { success: true, remaining: 999999 };
        } catch (error) {
            console.error("Direct Update Error visuals:", error);
            return { success: false, remaining: 0 };
        }
    }

    const planId = user.plan_tier || 'free';
    const limits = PLAN_LIMITS[planId] || PLAN_LIMITS['free'];

    if (type === 'chars') {
        const weeklyMax = limits.weekly_chars;
        const monthlyMax = limits.monthly_chars;
        const purchased = user.purchased_chars;

        const remainingWeekly = Math.max(0, weeklyMax - user.weekly_chars_used);
        const remainingMonthly = Math.max(0, monthlyMax - (user.monthly_chars_used || 0));
        
        const freeAvailable = Math.min(remainingWeekly, remainingMonthly);
        const totalAvailable = freeAvailable + purchased;

        if (totalAvailable < amount) return { success: false, remaining: totalAvailable };

        const fromFree = Math.min(freeAvailable, amount);
        const fromPurchased = amount - fromFree;

        const newWeekly = (user.weekly_chars_used || 0) + fromFree;
        const newMonthly = (user.monthly_chars_used || 0) + fromFree;
        const newDaily = (user.daily_chars_used || 0) + fromFree;
        const newPurchased = Math.max(0, purchased - fromPurchased);

        try {
            const updates: Prisma.PrismaPromise<unknown>[] = [
                prisma.user.update({
                    where: { id: userId },
                    data: {
                        weekly_chars_used: newWeekly,
                        monthly_chars_used: newMonthly,
                        daily_chars_used: newDaily,
                        purchased_chars: newPurchased
                    }
                })
            ];
            
            if (amount > 0) {
                updates.push(prisma.usageLog.create({
                    data: { user_id: userId, tokens: amount }
                }));
            }
            
            await prisma.$transaction(updates);
            return { success: true, remaining: totalAvailable - amount };
        } catch (error) {
            console.error("Direct Update Error deduct_user_usage:", error);
            return { success: false, remaining: totalAvailable };
        }
    }

    return { success: true, remaining: 999 };
}

export async function addPurchasedTokens(userId: number, type: 'chars' | 'visuals' | 'reports', amount: number, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    
    const field = `purchased_${type}` as const;
    await db.user.update({
        where: { id: userId },
        data: { [field]: { increment: amount } }
    });
    
    const typeName = type === 'chars' ? 'chars' : type === 'reports' ? 'reports' : 'visuals';
    if (amount > 0) {
        await db.transaction.create({
            data: { user_id: userId, topic: "Purchased resource pack", amount_text: `+${amount.toLocaleString()} ${typeName}`, is_positive: true }
        });
    }
}

export async function upgradeSubscriptionPlan(userId: number, planId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const parts = planId.split('_');
    const tier = parts[0]; 
    if (['plus', 'pro', 'ultra'].includes(tier)) {
        if (tx) {
            await db.user.update({
                where: { id: userId },
                data: { plan_tier: tier, account_tier: tier, monthly_chars_used: 0 }
            });
            await db.transaction.create({
                data: { user_id: userId, topic: "Subscription Upgrade", amount_text: `Tier: ${tier.toUpperCase()}`, is_positive: true }
            });
        } else {
            await prisma.$transaction([
                prisma.user.update({
                    where: { id: userId },
                    data: { plan_tier: tier, account_tier: tier, monthly_chars_used: 0 }
                }),
                prisma.transaction.create({
                    data: { user_id: userId, topic: "Subscription Upgrade", amount_text: `Tier: ${tier.toUpperCase()}`, is_positive: true }
                })
            ]);
        }
    }
}

export async function isPaymentProcessed(orderId: string): Promise<boolean> {
    const data = await prisma.processedPayment.findUnique({ where: { order_id: orderId } });
    return !!data;
}

export async function markPaymentProcessed(orderId: string): Promise<void> {
    await prisma.processedPayment.create({ data: { order_id: orderId } });
}

// --- Tasks ---

export async function getTasksByUserId(userId: number): Promise<Task[]> {
    return prisma.task.findMany({ where: { user_id: userId }, orderBy: { remind_at: 'asc' } });
}

export async function createTask(userId: number, text: string, remindAt: string): Promise<Task> {
    return prisma.task.create({
        data: { user_id: userId, task_text: text, remind_at: new Date(remindAt) }
    });
}

export async function updateTaskStatus(taskId: number, status: 'pending' | 'done'): Promise<void> {
    await prisma.task.update({ where: { id: taskId }, data: { status } });
}

export async function deleteTask(taskId: number): Promise<void> {
    await prisma.task.delete({ where: { id: taskId } });
}

export async function getPendingTasksToRemind(currentTimeIso: string): Promise<Task[]> {
    return prisma.task.findMany({
        where: { status: 'pending', remind_at: { lte: new Date(currentTimeIso) } }
    });
}

// --- Background Task Scheduler (Server-side only) ---
export async function cleanupStuckSessions(): Promise<void> {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000);
    await prisma.agentSession.updateMany({
        where: { status: 'generating', updated_at: { lt: fifteenMinsAgo } },
        data: { status: 'error', error_msg: 'Session timed out (system restart or crash)' }
    });
}

// Ensure the task scheduler only runs once locally via Next.js global state
if (typeof window === 'undefined') {
    const POLLING_INTERVAL = 60000; 
    
    if (!(globalThis as any).taskSchedulerActive) {
        (globalThis as any).taskSchedulerActive = true;
        
        setInterval(async () => {
            try {
                const now = new Date().toISOString();
                await cleanupStuckSessions();

                const pending = await getPendingTasksToRemind(now);
                const botToken = process.env.TELEGRAM_BOT_TOKEN;

                if (!botToken || pending.length === 0) return;

                for (const task of pending) {
                    const user = await getUserById(task.user_id);
                    if (!user || !user.telegram_id) continue;

                    const text = `🔔 *Reminder!*\n\n${task.task_text}`;
                    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: user.telegram_id,
                            text: text,
                            parse_mode: 'Markdown'
                        })
                    });

                    if (res.ok) {
                        await updateTaskStatus(task.id, 'done');
                    } else {
                        console.error('Failed to send reminder:', await res.text());
                    }
                }
            } catch (err) {
                console.error('Error in task scheduler interval:', err);
            }
        }, POLLING_INTERVAL);
        console.log('Task background scheduler started.');
    }
}

// --- Agent Sessions ---

export async function createAgentSession(data: CreateAgentSessionData): Promise<AgentSession> {
    return prisma.agentSession.create({
        data: {
            id: data.id,
            user_id: data.user_id,
            title: data.title,
            doc_type: data.doc_type,
            settings_json: data.settings_json || null,
            stage_json: data.stage_json || null,
            main_tex: data.main_tex || null,
            references_bib: data.references_bib || null,
            visuals_json: data.visuals_json || null,
            status: data.status || 'done',
            stream_text: data.stream_text || null,
            tg_message_id: data.tg_message_id || null,
            share_id: data.share_id || null
        }
    });
}

export async function getAgentSessionsByUser(userId: number): Promise<AgentSessionSummary[]> {
    return prisma.agentSession.findMany({
        where: { user_id: userId },
        select: {
            id: true,
            user_id: true,
            title: true,
            doc_type: true,
            status: true,
            share_id: true,
            created_at: true,
            updated_at: true,
            // Exclude large fields: main_tex, references_bib, visuals_json, stage_json, stream_text, settings_json
        },
        orderBy: { updated_at: 'desc' }
    });
}

export async function getAgentSession(id: string): Promise<AgentSession | undefined> {
    const session = await prisma.agentSession.findUnique({ 
        where: { id }
    });
    return session || undefined;
}

export async function getAgentSessionByShareId(shareId: string): Promise<AgentSession | undefined> {
    const session = await prisma.agentSession.findUnique({ 
        where: { share_id: shareId }
    });
    return session || undefined;
}

export async function getRecentSessionByTitle(userId: number, title: string): Promise<AgentSession | undefined> {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const session = await prisma.agentSession.findFirst({
        where: { user_id: userId, title, created_at: { gt: oneHourAgo } },
        orderBy: { created_at: 'desc' }
    });
    return session || undefined;
}

export async function updateAgentSession(id: string, data: UpdateAgentSessionData): Promise<void> {
    if (Object.keys(data).length === 0) return;
    
    // Auto-serialize object fields to strings for the DB
    const finalData = { ...data };
    if (finalData.stage_json && typeof finalData.stage_json !== 'string') {
        finalData.stage_json = JSON.stringify(finalData.stage_json);
    }
    if (finalData.settings_json && typeof finalData.settings_json !== 'string') {
        finalData.settings_json = JSON.stringify(finalData.settings_json);
    }
    if (finalData.visuals_json && typeof finalData.visuals_json !== 'string') {
        finalData.visuals_json = JSON.stringify(finalData.visuals_json);
    }

    await prisma.agentSession.update({ where: { id }, data: finalData });
}

export async function deleteAgentSession(id: string, userId: number): Promise<boolean> {
    try {
        await prisma.agentSession.deleteMany({ where: { id, user_id: userId } });
        return true;
    } catch (e) {
        console.error("deleteAgentSession failed for id", id, e);
        return false;
    }
}

export async function toggleAgentSessionShare(id: string, userId: number): Promise<string | null> {
    const session = await getAgentSession(id);
    if (!session || session.user_id !== userId) return null;

    if (session.share_id) {
        await prisma.agentSession.update({ where: { id }, data: { share_id: null } });
        return null;
    } else {
        const shareId = crypto.randomUUID().split('-')[0];
        await prisma.agentSession.update({ where: { id }, data: { share_id: shareId } });
        return shareId;
    }
}

export async function getActiveAgentSessionsCount(userId: number): Promise<number> {
    return prisma.agentSession.count({ where: { user_id: userId, status: 'generating' } });
}

export async function sendTelegramNotification(userId: number, message: string): Promise<number | null> {
    try {
        const user = await getUserById(userId);
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!user || !user.telegram_id || !botToken) return null;

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user.telegram_id,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        if (res.ok) {
            const data = await res.json();
            return data.result.message_id;
        }
        return null;
    } catch (e) {
        console.error("sendTelegramNotification failed for userId", userId, e);
        return null;
    }
}

export async function updateTelegramNotification(userId: number, messageId: number, message: string): Promise<void> {
    try {
        const user = await getUserById(userId);
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!user || !user.telegram_id || !botToken) return;

        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user.telegram_id,
                message_id: messageId,
                text: message,
                parse_mode: 'Markdown'
            })
        });
    } catch (e) {
        console.error("updateTelegramNotification failed for userId", userId, e);
    }
}

export async function deleteTelegramNotification(userId: number, messageId: number): Promise<void> {
    try {
        const user = await getUserById(userId);
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!user || !user.telegram_id || !botToken) return;

        await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user.telegram_id,
                message_id: messageId
            })
        });
    } catch (e) {
        console.error("deleteTelegramNotification failed for userId", userId, e);
    }
}

// --- Bot Persistence ---
export async function getBotSession(telegramId: string): Promise<Record<string, unknown> | null> {
    const data = await prisma.botSession.findUnique({ where: { telegram_id: telegramId } });
    if (!data) return null;
    try {
        return JSON.parse(data.session_data);
    } catch (e) {
        console.error("getBotSession: failed to parse session_data for telegramId", telegramId, e);
        return null;
    }
}

export async function updateBotSession(telegramId: string, payload: Record<string, unknown>): Promise<void> {
    const sessionJson = JSON.stringify(payload);
    await prisma.botSession.upsert({
        where: { telegram_id: telegramId },
        update: { session_data: sessionJson },
        create: { telegram_id: telegramId, session_data: sessionJson }
    });
}

// --- Stateful Sessions ---
export async function createSessionRecord(data: { id: string, user_id: number, user_agent?: string, ip?: string, location?: string }) {
    await prisma.session.create({
        data: {
            id: data.id,
            user_id: data.user_id,
            user_agent: data.user_agent || null,
            ip: data.ip || null,
            location: data.location || null
        }
    });
}

export async function getSessionById(id: string): Promise<Session | null> {
    return prisma.session.findUnique({ where: { id } });
}

export async function getSessionsByUserId(userId: number): Promise<Session[]> {
    return prisma.session.findMany({ where: { user_id: userId }, orderBy: { created_at: 'desc' } });
}

export async function deleteSessionRecord(id: string) {
    await prisma.session.delete({ where: { id } });
}

export async function deleteAllOtherSessions(userId: number, currentSessionId: string) {
    await prisma.session.deleteMany({ where: { user_id: userId, id: { not: currentSessionId } } });
}

// ─── Agent uploads (staged pipeline) ───

export async function createAgentUpload(data: {
    user_id: number;
    filename: string;
    text_content: string | null;
    images: { dataUrl: string; contentType: string; bytes: number }[];
    page_count: number;
    ocr_used: boolean;
    storage_path?: string | null;
    file_size?: number | null;
    mime_type?: string | null;
}): Promise<AgentUpload> {
    return prisma.agentUpload.create({
        data: {
            user_id: data.user_id,
            filename: data.filename,
            text_content: data.text_content,
            images_json: JSON.stringify(data.images),
            char_count: data.text_content?.length || 0,
            image_count: data.images.length,
            page_count: data.page_count,
            ocr_used: data.ocr_used,
            storage_path: data.storage_path || null,
            file_size: data.file_size || null,
            mime_type: data.mime_type || null,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
    });
}

export async function getAgentUpload(id: string, userId: number): Promise<AgentUpload | undefined> {
    const upload = await prisma.agentUpload.findFirst({
        where: { id, user_id: userId, expires_at: { gt: new Date() } }
    });
    return upload || undefined;
}

export async function getAgentUploadsByIds(ids: string[], userId: number): Promise<AgentUpload[]> {
    if (!ids || ids.length === 0) return [];
    return prisma.agentUpload.findMany({
        where: { id: { in: ids }, user_id: userId, expires_at: { gt: new Date() } }
    });
}

export async function getUserActiveUploadsCharTotal(userId: number): Promise<number> {
    const result = await prisma.agentUpload.aggregate({
        _sum: { char_count: true },
        where: { user_id: userId, expires_at: { gt: new Date() } }
    });
    return result._sum.char_count || 0;
}

export async function deleteAgentUpload(id: string, userId: number): Promise<void> {
    await prisma.agentUpload.deleteMany({ where: { id, user_id: userId } });
}

export async function deleteExpiredAgentUploads(): Promise<number> {
    const result = await prisma.agentUpload.deleteMany({
        where: { expires_at: { lt: new Date() } }
    });
    return result.count;
}

export async function getReferralStats(userId: number) {
    const invitedCount = await prisma.user.count({ where: { referred_by: userId } });
    
    const bonusData = await prisma.transaction.findMany({
        where: { user_id: userId, topic: 'Referral Bonus' },
        select: { amount_text: true }
    });
    
    let totalBonus = 0;
    for (const row of bonusData) {
        const num = parseInt(row.amount_text.replace('+', '').replace(' chars', ''), 10);
        if (!isNaN(num)) totalBonus += num;
    }
    
    return { invitedCount, totalBonus };
}
