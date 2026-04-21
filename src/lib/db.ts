import { supabase } from '@/lib/supabase';

// --- Users ---
export interface User {
    id: number;
    telegram_id: string;
    username: string | null;
    first_name: string | null;
    photo_url: string | null;
    created_at: string;
    
    plan_tier?: string;
    account_tier?: string;
    daily_chars_used: number;
    weekly_chars_used: number;
    monthly_chars_used?: number;
    purchased_chars: number;
    daily_visuals_used: number;
    purchased_visuals: number;
    daily_reports_used: number;
    purchased_reports: number;

    last_reset_date: string | null;
    last_week_reset: string | null;
    is_banned: boolean;
    is_admin: boolean;
    is_deleted: boolean;
    referred_by: number | null;
}

export async function getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const { data } = await supabase.from('users').select('*').eq('telegram_id', telegramId).maybeSingle();
    return data || undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
    const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    return data || undefined;
}

export async function upsertUser(data: { telegram_id: string; username?: string; first_name?: string; photo_url?: string }): Promise<User> {
    const existing = await getUserByTelegramId(data.telegram_id);
    const today = new Date().toISOString().split('T')[0];

    if (existing) {
        const { data: updated } = await supabase.from('users').update({
            username: data.username || null,
            first_name: data.first_name || null,
            photo_url: data.photo_url || null,
            is_deleted: false
        }).eq('telegram_id', data.telegram_id).select('*').single();
        return updated;
    } else {
        const { data: inserted } = await supabase.from('users').insert({
            telegram_id: data.telegram_id,
            username: data.username || null,
            first_name: data.first_name || null,
            photo_url: data.photo_url || null,
            last_reset_date: today,
            is_deleted: false
        }).select('*').single();
        return inserted;
    }
}

export async function deleteUser(id: number) {
    await supabase.from('users').update({
        is_deleted: true,
        username: null,
        first_name: null,
        photo_url: null
    }).eq('id', id);
}

// --- Strict Usage Tracking ---
export const PLAN_LIMITS: Record<string, { weekly_chars: number, monthly_chars: number }> = {
    free: { weekly_chars: 50000, monthly_chars: 150000 },
    plus: { weekly_chars: 150000, monthly_chars: 450000 },
    pro: { weekly_chars: 250000, monthly_chars: 800000 },
    ultra: { weekly_chars: 800000, monthly_chars: 3000000 }
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
        await supabase.from('users').update({
            daily_chars_used: 0, daily_visuals_used: 0, daily_reports_used: 0, last_reset_date: today
        }).eq('id', userId);
        
        await supabase.from('transactions').insert({
            user_id: userId, topic: "Daily quota reset", amount_text: "Reset", is_positive: true
        });
        user = await getUserById(userId);
        if (!user) return { success: false, remaining: 0 };
    }

    // Reset weekly limits
    if (user.last_week_reset !== currentWeek) {
        await supabase.from('users').update({
            weekly_chars_used: 0, last_week_reset: currentWeek
        }).eq('id', userId);
        user = await getUserById(userId);
        if (!user) return { success: false, remaining: 0 };
    }

    if (type === 'visuals') {
        // Direct database increment instead of RPC
        const { error } = await supabase.from('users').update({
            daily_visuals_used: user.daily_visuals_used + amount
        }).eq('id', userId);

        if (!error) {
            await supabase.from('transactions').insert({
                user_id: userId, topic: "Visual generation", amount_text: `-${amount} visuals`, is_positive: false
            });
            await supabase.from('usage_logs').insert({ user_id: userId, tokens: amount });
        }
        return { success: true, remaining: 999999 };
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

        // Update database explicitly without relying on the RPC
        const { error } = await supabase.from('users').update({
            weekly_chars_used: newWeekly,
            monthly_chars_used: newMonthly,
            daily_chars_used: newDaily,
            purchased_chars: newPurchased
        }).eq('id', userId);

        if (error) {
            console.error("Direct Update Error deduct_user_usage:", error);
            return { success: false, remaining: totalAvailable };
        }
        
        // Log the usage
        if (amount > 0) {
            await supabase.from('usage_logs').insert({ user_id: userId, tokens: amount });
        }

        return { success: true, remaining: totalAvailable - amount };
    }

    return { success: true, remaining: 999 };
}

export async function addPurchasedTokens(userId: number, type: 'chars' | 'visuals' | 'reports', amount: number) {
    const user = await getUserById(userId);
    if (!user) return;
    
    const field = `purchased_${type}` as const;
    await supabase.from('users').update({
        [field]: user[field] + amount
    }).eq('id', userId);
    
    const typeName = type === 'chars' ? 'chars' : type === 'reports' ? 'reports' : 'visuals';
    if (amount > 0) {
        await supabase.from('transactions').insert({
            user_id: userId, topic: "Purchased resource pack", amount_text: `+${amount.toLocaleString()} ${typeName}`, is_positive: true
        });
    }
}

export async function upgradeSubscriptionPlan(userId: number, planId: string) {
    const parts = planId.split('_');
    const tier = parts[0]; 
    if (['plus', 'pro', 'ultra'].includes(tier)) {
        await supabase.from('users').update({
            plan_tier: tier, account_tier: tier, monthly_chars_used: 0
        }).eq('id', userId);
        
        await supabase.from('transactions').insert({
            user_id: userId, topic: "Subscription Upgrade", amount_text: `Tier: ${tier.toUpperCase()}`, is_positive: true
        });
    }
}

export async function isPaymentProcessed(orderId: string): Promise<boolean> {
    const { data } = await supabase.from('processed_payments').select('order_id').eq('order_id', orderId).maybeSingle();
    return !!data;
}

export async function markPaymentProcessed(orderId: string): Promise<void> {
    await supabase.from('processed_payments').insert({ order_id: orderId });
}

// --- Tasks ---
export interface Task {
    id: number;
    user_id: number;
    task_text: string;
    remind_at: string;
    status: 'pending' | 'done';
    created_at: string;
}

export async function getTasksByUserId(userId: number): Promise<Task[]> {
    const { data } = await supabase.from('tasks').select('*').eq('user_id', userId).order('remind_at', { ascending: true });
    return data || [];
}

export async function createTask(userId: number, text: string, remindAt: string): Promise<Task> {
    const { data } = await supabase.from('tasks').insert({
        user_id: userId, task_text: text, remind_at: remindAt
    }).select('*').single();
    return data;
}

export async function updateTaskStatus(taskId: number, status: 'pending' | 'done'): Promise<void> {
    await supabase.from('tasks').update({ status }).eq('id', taskId);
}

export async function deleteTask(taskId: number): Promise<void> {
    await supabase.from('tasks').delete().eq('id', taskId);
}

export async function getPendingTasksToRemind(currentTimeIso: string): Promise<Task[]> {
    const { data } = await supabase.from('tasks')
        .select('*')
        .eq('status', 'pending')
        .lte('remind_at', currentTimeIso);
    return data || [];
}

// --- Background Task Scheduler (Server-side only) ---
export async function cleanupStuckSessions(): Promise<void> {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
    await supabase.from('agent_sessions')
        .update({ status: 'error', error_msg: 'Session timed out (system restart or crash)' })
        .eq('status', 'generating')
        .lt('updated_at', fifteenMinsAgo);
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
export interface AgentSession {
    id: string;
    user_id: number;
    title: string;
    doc_type: string;
    settings_json: string | null;
    main_tex: string | null;
    references_bib: string | null;
    visuals_json: string | null;
    share_id: string | null;
    status: string;
    error_msg: string | null;
    stream_text: string | null;
    tg_message_id: number | null;
    created_at: string;
    updated_at: string;
}

export async function createAgentSession(data: any): Promise<AgentSession> {
    const { data: session } = await supabase.from('agent_sessions').insert({
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        doc_type: data.doc_type,
        settings_json: data.settings_json || null,
        main_tex: data.main_tex || null,
        references_bib: data.references_bib || null,
        visuals_json: data.visuals_json || null,
        status: data.status || 'done',
        stream_text: data.stream_text || null,
        tg_message_id: data.tg_message_id || null,
        share_id: data.share_id || null
    }).select('*').single();
    return session;
}

export async function getAgentSessionsByUser(userId: number): Promise<AgentSession[]> {
    const { data } = await supabase.from('agent_sessions')
        .select('id, title, doc_type, status, error_msg, share_id, updated_at, created_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    return (data || []) as AgentSession[];
}

export async function getAgentSession(id: string): Promise<AgentSession | undefined> {
    const { data } = await supabase.from('agent_sessions').select('*').eq('id', id).maybeSingle();
    return data || undefined;
}

export async function getAgentSessionByShareId(shareId: string): Promise<AgentSession | undefined> {
    const { data } = await supabase.from('agent_sessions').select('*').eq('share_id', shareId).maybeSingle();
    return data || undefined;
}

export async function getRecentSessionByTitle(userId: number, title: string): Promise<AgentSession | undefined> {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data } = await supabase.from('agent_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('title', title)
        .gt('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data || undefined;
}

export async function updateAgentSession(id: string, data: any): Promise<void> {
    if (Object.keys(data).length === 0) return;
    
    // Auto update updated_at
    data.updated_at = new Date().toISOString();

    await supabase.from('agent_sessions').update(data).eq('id', id);
}

export async function deleteAgentSession(id: string, userId: number): Promise<boolean> {
    const { error } = await supabase.from('agent_sessions').delete().eq('id', id).eq('user_id', userId);
    return !error;
}

export async function toggleAgentSessionShare(id: string, userId: number): Promise<string | null> {
    const session = await getAgentSession(id);
    if (!session || session.user_id !== userId) return null;

    if (session.share_id) {
        await supabase.from('agent_sessions').update({ share_id: null }).eq('id', id);
        return null;
    } else {
        const shareId = crypto.randomUUID().split('-')[0];
        await supabase.from('agent_sessions').update({ share_id: shareId }).eq('id', id);
        return shareId;
    }
}

export async function getActiveAgentSessionsCount(userId: number): Promise<number> {
    const { count } = await supabase.from('agent_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'generating');
    return count || 0;
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
    } catch (e) {}
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
    } catch (e) {}
}

// --- Bot Persistence ---
export async function getBotSession(telegramId: string): Promise<any | null> {
    const { data } = await supabase.from('bot_sessions').select('session_data').eq('telegram_id', telegramId).maybeSingle();
    if (!data) return null;
    try {
        return JSON.parse(data.session_data);
    } catch {
        return null;
    }
}

export async function updateBotSession(telegramId: string, payload: any): Promise<void> {
    const sessionJson = JSON.stringify(payload);
    await supabase.from('bot_sessions').upsert({
        telegram_id: telegramId,
        session_data: sessionJson,
        updated_at: new Date().toISOString()
    }, { onConflict: 'telegram_id' });
}

// --- Stateful Sessions ---
export async function createSessionRecord(data: { id: string, user_id: number, user_agent?: string, ip?: string, location?: string }) {
    await supabase.from('sessions').insert({
        id: data.id,
        user_id: data.user_id,
        user_agent: data.user_agent || null,
        ip: data.ip || null,
        location: data.location || null
    });
}

export async function getSessionById(id: string): Promise<any> {
    const { data } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
    return data;
}

export async function getSessionsByUserId(userId: number): Promise<any[]> {
    const { data } = await supabase.from('sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return data || [];
}

export async function deleteSessionRecord(id: string) {
    await supabase.from('sessions').delete().eq('id', id);
}

export async function deleteAllOtherSessions(userId: number, currentSessionId: string) {
    await supabase.from('sessions').delete().eq('user_id', userId).neq('id', currentSessionId);
}

// ─── Agent uploads (staged pipeline) ───
// Short-lived (24h) server-side cache of parsed PDF bundles.
// The client uploads a PDF once; generate calls reference these ids.

export interface AgentUpload {
    id: string;
    user_id: number;
    filename: string;
    text_content: string;
    images_json: { dataUrl: string; contentType: string; bytes: number }[] | string;
    char_count: number;
    image_count: number;
    page_count: number;
    ocr_used: boolean;
    created_at: string;
    expires_at: string;
}

export async function createAgentUpload(data: {
    user_id: number;
    filename: string;
    text_content: string;
    images: { dataUrl: string; contentType: string; bytes: number }[];
    page_count: number;
    ocr_used: boolean;
}): Promise<AgentUpload> {
    const { data: row, error } = await supabase.from('agent_uploads').insert({
        user_id: data.user_id,
        filename: data.filename,
        text_content: data.text_content,
        images_json: data.images,
        char_count: data.text_content.length,
        image_count: data.images.length,
        page_count: data.page_count,
        ocr_used: data.ocr_used,
    }).select('*').single();
    if (error) throw error;
    return row as AgentUpload;
}

export async function getAgentUpload(id: string, userId: number): Promise<AgentUpload | undefined> {
    const { data } = await supabase.from('agent_uploads')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
    return data ? (data as AgentUpload) : undefined;
}

export async function getAgentUploadsByIds(ids: string[], userId: number): Promise<AgentUpload[]> {
    if (!ids || ids.length === 0) return [];
    const { data } = await supabase.from('agent_uploads')
        .select('*')
        .in('id', ids)
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString());
    return (data || []) as AgentUpload[];
}

// Sum of text sizes for the user's still-valid uploads — used to enforce the
// 200 000-character hard cap before accepting a new ingest.
export async function getUserActiveUploadsCharTotal(userId: number): Promise<number> {
    const { data } = await supabase.from('agent_uploads')
        .select('char_count')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString());
    if (!data) return 0;
    return data.reduce((acc: number, row: any) => acc + (row.char_count || 0), 0);
}

export async function deleteAgentUpload(id: string, userId: number): Promise<void> {
    await supabase.from('agent_uploads').delete().eq('id', id).eq('user_id', userId);
}

export async function deleteExpiredAgentUploads(): Promise<number> {
    const { count } = await supabase.from('agent_uploads')
        .delete({ count: 'exact' })
        .lt('expires_at', new Date().toISOString());
    return count || 0;
}

export async function getReferralStats(userId: number) {
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('referred_by', userId);
    
    const { data: bonusData } = await supabase.from('transactions').select('amount_text').eq('user_id', userId).eq('topic', 'Referral Bonus');
    
    let totalBonus = 0;
    if (bonusData) {
        bonusData.forEach(row => {
            const num = parseInt(row.amount_text.replace('+', '').replace(' chars', ''), 10);
            if (!isNaN(num)) totalBonus += num;
        });
    }
    
    return { invitedCount: count || 0, totalBonus };
}
