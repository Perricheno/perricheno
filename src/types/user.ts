export interface User {
    id: number;
    telegram_id: string;
    username: string | null;
    first_name: string | null;
    photo_url: string | null;
    created_at: string;
    plan_tier?: string;
    daily_chars_used?: number;
    weekly_chars_used?: number;
    monthly_chars_used?: number;
    purchased_chars?: number;
    daily_visuals_used?: number;
    purchased_visuals?: number;
    daily_reports_used?: number;
    purchased_reports?: number;
    is_banned?: number;
    isAdmin?: boolean;
}
