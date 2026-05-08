"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdmin } from "@/components/AdminContext";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconReceipt, IconPackage, IconTrendingUp, IconClock, IconLogin,
    IconMail, IconChevronRight,
    IconShieldLock, IconTrash, IconPlayerPlay, IconPlayerPause, IconCopy, IconCheck,
    IconUsers, IconSearch, IconX, IconGift, IconCrown, IconUser,
    IconChartBar, IconLifebuoy,
} from "@tabler/icons-react";

interface PromoCode {
    id: number;
    code: string;
    type: string;
    amount: number;
    uses: number;
    max_uses: number;
    is_active: number;
    created_at: string;
}

type Section = "profile" | "usage" | "history" | "support" | "promos" | "users";

const NAV_ITEMS: { id: Section; label: string; icon: any; adminOnly?: boolean }[] = [
    { id: "profile",  label: "Profile",      icon: IconUser },
    { id: "usage",    label: "Usage",         icon: IconChartBar },
    { id: "history",  label: "History",       icon: IconReceipt },
    { id: "support",  label: "Support",       icon: IconLifebuoy },
    { id: "promos",   label: "Promo Codes",   icon: IconGift,       adminOnly: true },
    { id: "users",    label: "Users",         icon: IconUsers,      adminOnly: true },
];

export default function SettingsPage() {
    const { user, setShowLogin, setIsEditing } = useAdmin();
    const t = useTranslations("settings");
    const [fullUser, setFullUser] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [receipts, setReceipts] = useState<any[]>([]);
    const [activeSection, setActiveSection] = useState<Section>("profile");

    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [promoLoading, setPromoLoading] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const [users, setUsers] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState("");
    const [userLoading, setUserLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showUserModal, setShowUserModal] = useState(false);

    useEffect(() => {
        if (user) {
            fetch("/api/auth/me").then(r => r.json()).then(d => setFullUser(d.user));
            fetch("/api/billing/stats").then(r => r.json()).then(d => {
                if (d.transactions) setTransactions(d.transactions);
                if (d.receipts) setReceipts(d.receipts);
            });
        }
    }, [user]);

    useEffect(() => {
        if (fullUser?.isAdmin) fetchPromos();
    }, [fullUser]);

    const fetchPromos = async () => {
        setPromoLoading(true);
        try {
            const res = await fetch("/api/admin/promos");
            const data = await res.json();
            if (data.promos) setPromos(data.promos);
        } finally {
            setPromoLoading(false);
        }
    };

    const togglePromo = async (promoId: number, currentActive: number) => {
        await fetch("/api/admin/promos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promoId, action: "toggle_active", is_active: currentActive ? 0 : 1 }),
        });
        fetchPromos();
    };

    const deletePromo = async (promoId: number) => {
        if (!confirm(t("deletePromoConfirm"))) return;
        await fetch("/api/admin/promos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promoId, action: "delete" }),
        });
        fetchPromos();
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const searchUsers = async () => {
        if (!userSearch.trim()) return;
        setUserLoading(true);
        try {
            const res = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}`);
            const data = await res.json();
            if (data.users) setUsers(data.users);
        } finally {
            setUserLoading(false);
        }
    };

    const grantSubscription = async (userId: number, tier: string) => {
        if (!confirm(t("grantConfirm", { tier: tier.toUpperCase() }))) return;
        const res = await fetch("/api/admin/users", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetUserId: userId, action: "grant_subscription", tier }),
        });
        if (res.ok) {
            alert(t("grantSuccess"));
            setShowUserModal(false);
            setSelectedUser(null);
            searchUsers();
        } else {
            const err = await res.json();
            alert(`Error: ${err.error || t("grantFailed")}`);
        }
    };

    const timelineItems = useMemo(() => {
        const items: any[] = [];
        receipts.forEach(r => items.push({
            ...r, is_receipt: true,
            _time: new Date(r.created_at + "Z").getTime(),
            display_date: new Date(r.created_at + "Z").toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        }));
        transactions.forEach(tx => items.push({
            ...tx, is_receipt: false,
            _time: new Date(tx.date).getTime() || 0,
            display_date: new Date(tx.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        }));
        return items.sort((a, b) => b._time - a._time);
    }, [transactions, receipts]);

    const currentPlanId = fullUser?.plan_tier || "free";
    const planLabels: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", ultra: "Ultra" };
    const planLimits = {
        free: { weekly: 50000, monthly: 150000 },
        plus: { weekly: 150000, monthly: 450000 },
        pro: { weekly: 250000, monthly: 800000 },
        ultra: { weekly: 800000, monthly: 3000000 },
    }[currentPlanId as "free" | "plus" | "pro" | "ultra"] || { weekly: 50000, monthly: 150000 };

    const weeklyUsed = fullUser?.weekly_chars_used || 0;
    const monthlyUsed = fullUser?.monthly_chars_used || 0;
    const purchasedChars = fullUser?.purchased_chars || 0;
    const weeklyPct = Math.min(100, (weeklyUsed / planLimits.weekly) * 100);
    const monthlyPct = Math.min(100, (monthlyUsed / planLimits.monthly) * 100);

    const visibleNav = NAV_ITEMS.filter(n => !n.adminOnly || fullUser?.isAdmin);

    // ── Section renderers ───────────────────────────────────────────────────────

    const fmtChars = (n: number) =>
        n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${(n / 1_000).toFixed(0)}K`;

    const renderProfile = () => (
        <div className="space-y-3">
            {user && fullUser ? (
                <>
                    {/* Account card */}
                    <div className="bg-white rounded-2xl border border-[#e8e8e8] px-5 py-4">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-[14px] bg-[#1a1a1a] flex items-center justify-center text-white font-black text-[13px] uppercase shrink-0 select-none">
                                {(fullUser.username || fullUser.first_name || "U").slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[15px] font-bold text-[#1a1a1a] truncate leading-tight">
                                        {fullUser.username || fullUser.first_name || "User"}
                                    </p>
                                    <PlanBadge tier={currentPlanId} />
                                </div>
                                <p className="text-[12px] text-gray-400 mt-0.5 leading-tight">
                                    {fullUser.isAdmin ? t("admin") : t("member")}
                                    {fullUser.created_at && (
                                        <> · {t("since")} {new Date(fullUser.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Usage stats — single card, vertical rows */}
                    <div className="bg-white rounded-2xl border border-[#e8e8e8] overflow-hidden">
                        {/* Weekly */}
                        <div className="px-5 pt-4 pb-3.5">
                            <div className="flex items-baseline justify-between mb-2">
                                <span className="text-[12px] font-semibold text-[#1a1a1a]">Weekly</span>
                                <span className="text-[12px] font-mono text-[#1a1a1a] tabular-nums">
                                    {fmtChars(weeklyUsed)}<span className="text-gray-300"> / {fmtChars(planLimits.weekly)}</span>
                                </span>
                            </div>
                            <div className="h-[3px] w-full bg-[#f0f0f0] rounded-full overflow-hidden">
                                <div className="h-full bg-[#1a1a1a] rounded-full transition-all duration-700" style={{ width: `${weeklyPct}%` }} />
                            </div>
                        </div>
                        <div className="h-px bg-[#f5f5f5] mx-5" />
                        {/* Monthly */}
                        <div className="px-5 pt-4 pb-3.5">
                            <div className="flex items-baseline justify-between mb-2">
                                <span className="text-[12px] font-semibold text-[#1a1a1a]">Monthly</span>
                                <span className="text-[12px] font-mono text-[#1a1a1a] tabular-nums">
                                    {fmtChars(monthlyUsed)}<span className="text-gray-300"> / {fmtChars(planLimits.monthly)}</span>
                                </span>
                            </div>
                            <div className="h-[3px] w-full bg-[#f0f0f0] rounded-full overflow-hidden">
                                <div className="h-full bg-[#1a1a1a] rounded-full transition-all duration-700" style={{ width: `${monthlyPct}%` }} />
                            </div>
                        </div>
                        <div className="h-px bg-[#f5f5f5] mx-5" />
                        {/* Legacy credits */}
                        <div className="px-5 py-4 flex items-center justify-between">
                            <div>
                                <p className="text-[12px] font-semibold text-[#1a1a1a]">Legacy Credits</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">{t("neverExpires")}</p>
                            </div>
                            <span className="text-[18px] font-black text-[#1a1a1a] tabular-nums">
                                {fmtChars(purchasedChars)}
                            </span>
                        </div>
                    </div>
                </>
            ) : !user ? (
                <div className="bg-white rounded-2xl border border-[#e8e8e8] p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#f5f5f5] flex items-center justify-center mx-auto mb-4">
                        <IconLogin className="w-6 h-6 text-gray-300" />
                    </div>
                    <h3 className="text-[15px] font-bold text-[#1a1a1a] mb-1">{t("signInTitle")}</h3>
                    <p className="text-[12px] text-gray-400 mb-5 max-w-xs mx-auto leading-relaxed">{t("signInDesc")}</p>
                    <button
                        onClick={() => setShowLogin(true)}
                        className="px-7 py-2.5 bg-[#1a1a1a] text-white rounded-xl font-bold text-[13px] hover:bg-black transition-all active:scale-95"
                    >
                        {t("signIn")}
                    </button>
                </div>
            ) : (
                <div className="h-20 bg-[#f5f5f5] rounded-2xl animate-pulse" />
            )}
        </div>
    );

    const renderUsage = () => (
        <div className="space-y-3">
            {user && fullUser ? (
                <div className="bg-white rounded-2xl border border-[#e8e8e8] overflow-hidden">
                    <div className="px-5 pt-4 pb-3.5">
                        <div className="flex items-baseline justify-between mb-2">
                            <span className="text-[12px] font-semibold text-[#1a1a1a]">Weekly</span>
                            <span className="text-[12px] font-mono text-[#1a1a1a] tabular-nums">
                                {fmtChars(weeklyUsed)}<span className="text-gray-300"> / {fmtChars(planLimits.weekly)}</span>
                            </span>
                        </div>
                        <div className="h-[3px] w-full bg-[#f0f0f0] rounded-full overflow-hidden">
                            <div className="h-full bg-[#1a1a1a] rounded-full transition-all duration-700" style={{ width: `${weeklyPct}%` }} />
                        </div>
                    </div>
                    <div className="h-px bg-[#f5f5f5] mx-5" />
                    <div className="px-5 pt-4 pb-3.5">
                        <div className="flex items-baseline justify-between mb-2">
                            <span className="text-[12px] font-semibold text-[#1a1a1a]">Monthly</span>
                            <span className="text-[12px] font-mono text-[#1a1a1a] tabular-nums">
                                {fmtChars(monthlyUsed)}<span className="text-gray-300"> / {fmtChars(planLimits.monthly)}</span>
                            </span>
                        </div>
                        <div className="h-[3px] w-full bg-[#f0f0f0] rounded-full overflow-hidden">
                            <div className="h-full bg-[#1a1a1a] rounded-full transition-all duration-700" style={{ width: `${monthlyPct}%` }} />
                        </div>
                    </div>
                    <div className="h-px bg-[#f5f5f5] mx-5" />
                    <div className="px-5 py-4 flex items-center justify-between">
                        <div>
                            <p className="text-[12px] font-semibold text-[#1a1a1a]">Legacy Credits</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{t("neverExpires")}</p>
                        </div>
                        <span className="text-[18px] font-black text-[#1a1a1a] tabular-nums">{fmtChars(purchasedChars)}</span>
                    </div>
                </div>
            ) : (
                <SignInPrompt onSignIn={() => setShowLogin(true)} t={t} />
            )}
        </div>
    );

    const renderHistory = () => (
        <div className="space-y-4">
            {user ? (
                <div className="bg-white rounded-2xl border border-[#ebebeb] shadow-sm overflow-hidden">
                    {timelineItems.length > 0 ? (
                        <div className="divide-y divide-[#f5f5f5]">
                            {timelineItems.slice(0, 40).map((item, idx) =>
                                item.is_receipt ? (
                                    <div key={`r-${item.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                                <IconPackage className="w-3.5 h-3.5 text-emerald-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-semibold text-[#1a1a1a] truncate">{item.pack_name}</p>
                                                <p className="text-[10px] text-gray-400">{item.display_date}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[12px] font-bold text-emerald-600 tabular-nums">{item.amount_text}</span>
                                            <a href={`/api/billing/receipt/${item.id}`} target="_blank" rel="noopener noreferrer"
                                                className="text-[9px] font-bold text-gray-300 uppercase tracking-widest hover:text-[#1a1a1a] transition-colors hidden sm:block">
                                                PDF
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    <div key={`t-${item.id}-${idx}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.is_positive ? "bg-emerald-50" : "bg-[#f5f5f5]"}`}>
                                                {item.is_positive ? <IconTrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <IconClock className="w-3.5 h-3.5 text-gray-400" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-semibold text-[#1a1a1a] truncate">{item.type}</p>
                                                <p className="text-[10px] text-gray-400">{item.display_date}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[12px] font-bold tabular-nums shrink-0 ${item.is_positive ? "text-emerald-600" : "text-gray-400"}`}>
                                            {item.amount}
                                        </span>
                                    </div>
                                )
                            )}
                        </div>
                    ) : (
                        <div className="py-16 text-center">
                            <IconReceipt className="w-8 h-8 mx-auto text-gray-200 mb-3" />
                            <p className="text-[13px] text-gray-400">{t("noTransactions")}</p>
                        </div>
                    )}
                </div>
            ) : (
                <SignInPrompt onSignIn={() => setShowLogin(true)} t={t} />
            )}
        </div>
    );

    const renderSupport = () => (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#ebebeb] shadow-sm overflow-hidden">
                <a
                    href="mailto:support@perricheno.ru"
                    className="flex items-center justify-between px-5 py-4 hover:bg-[#fafafa] transition-colors border-b border-[#f5f5f5]"
                >
                    <span className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#f5f5f5] flex items-center justify-center">
                            <IconMail className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                            <p className="text-[13px] font-semibold text-[#1a1a1a]">Email Support</p>
                            <p className="text-[11px] text-gray-400">support@perricheno.ru</p>
                        </div>
                    </span>
                    <IconChevronRight className="w-4 h-4 text-gray-300" />
                </a>
                <a
                    href="https://t.me/perricheno"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-5 py-4 hover:bg-[#fafafa] transition-colors"
                >
                    <span className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#f5f5f5] flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.999-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[13px] font-semibold text-[#1a1a1a]">Telegram</p>
                            <p className="text-[11px] text-gray-400">@perricheno</p>
                        </div>
                    </span>
                    <IconChevronRight className="w-4 h-4 text-gray-300" />
                </a>
            </div>
        </div>
    );

    const renderPromos = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-[#f3f3f3] px-2 py-0.5 rounded">{t("admin")}</span>
            </div>
            <div className="bg-white rounded-2xl border border-[#ebebeb] shadow-sm overflow-hidden">
                {promoLoading ? (
                    <div className="py-12 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-gray-200 border-t-[#1a1a1a] animate-spin rounded-full" />
                    </div>
                ) : promos.length > 0 ? (
                    <div className="divide-y divide-[#f5f5f5]">
                        {promos.map(promo => (
                            <div key={promo.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-[#fafafa] transition-colors ${!promo.is_active ? "opacity-50" : ""}`}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${promo.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[13px] font-bold font-mono text-[#1a1a1a] truncate">{promo.code}</p>
                                            <button onClick={() => copyCode(promo.code)} className="text-gray-300 hover:text-[#1a1a1a] transition-colors">
                                                {copiedCode === promo.code ? <IconCheck className="w-3 h-3 text-emerald-500" /> : <IconCopy className="w-3 h-3" />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-400">{promo.type} · {promo.amount.toLocaleString()} · {promo.uses}/{promo.max_uses} uses</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => togglePromo(promo.id, promo.is_active)}
                                        className={`p-1.5 rounded-lg transition-colors ${promo.is_active ? "hover:bg-amber-50 text-amber-500" : "hover:bg-emerald-50 text-emerald-500"}`}>
                                        {promo.is_active ? <IconPlayerPause className="w-3.5 h-3.5" /> : <IconPlayerPlay className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => deletePromo(promo.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                                        <IconTrash className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 text-center">
                        <p className="text-[13px] text-gray-400">{t("noPromoCodes")}</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderUsers = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-[#f3f3f3] px-2 py-0.5 rounded">{t("admin")}</span>
            </div>
            <div className="bg-white rounded-2xl border border-[#ebebeb] shadow-sm overflow-hidden p-4">
                <div className="flex gap-2 mb-4">
                    <div className="flex-1 relative">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <input
                            type="text"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                            placeholder={t("searchPlaceholder")}
                            className="w-full pl-9 pr-4 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:border-transparent"
                        />
                    </div>
                    <button
                        onClick={searchUsers}
                        disabled={userLoading || !userSearch.trim()}
                        className="px-4 py-2.5 bg-[#1a1a1a] text-white rounded-xl font-bold text-[12px] hover:bg-black transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {userLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full" /> : <IconSearch className="w-4 h-4" />}
                        {t("search")}
                    </button>
                </div>

                {users.length > 0 && (
                    <div className="divide-y divide-[#f5f5f5] -mx-4">
                        {users.map(u => (
                            <div key={u.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-[#fafafa] transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white font-black text-xs uppercase shrink-0">
                                        {(u.username || u.first_name || "U").slice(0, 2)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-bold text-[#1a1a1a] truncate">{u.username || u.first_name || "User"}</p>
                                        <p className="text-[10px] text-gray-400">ID: {u.id} · {planLabels[u.plan_tier || "free"]} Plan</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setSelectedUser(u); setShowUserModal(true); }}
                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-[11px] hover:bg-emerald-100 transition-all flex items-center gap-1.5 shrink-0"
                                >
                                    <IconGift className="w-3.5 h-3.5" />
                                    {t("grant")}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {userSearch && !userLoading && users.length === 0 && (
                    <p className="text-[12px] text-gray-400 text-center py-6">{t("noUsersFound")}</p>
                )}
            </div>

            {/* Grant Modal */}
            {showUserModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUserModal(false)}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-[16px] font-black text-[#1a1a1a]">{t("grantSubscription")}</h3>
                            <button onClick={() => setShowUserModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#1a1a1a] hover:bg-[#f5f5f5] transition-all">
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="mb-5">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t("user")}</p>
                            <p className="text-[14px] font-bold text-[#1a1a1a]">{selectedUser.username || selectedUser.first_name || "User"}</p>
                            <p className="text-[11px] text-gray-400">{t("currentPlan")} {planLabels[selectedUser.plan_tier || "free"]}</p>
                        </div>
                        <div className="space-y-2">
                            {["free", "plus", "pro", "ultra"].map(tier => (
                                <button key={tier} onClick={() => grantSubscription(selectedUser.id, tier)}
                                    className={`w-full px-4 py-3 rounded-xl font-bold text-[13px] transition-all flex items-center justify-between ${
                                        tier === "ultra" ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                                        : tier === "pro" ? "bg-[#1a1a1a] text-white hover:bg-black"
                                        : tier === "plus" ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                        : "bg-[#f5f5f5] text-gray-600 hover:bg-[#ebebeb]"
                                    }`}>
                                    <span className="flex items-center gap-2">
                                        {tier === "ultra" && <IconCrown className="w-4 h-4" />}
                                        {planLabels[tier]}
                                    </span>
                                    <span className="text-xs opacity-70">
                                        {tier === "ultra" ? "3M/mo" : tier === "pro" ? "800K/mo" : tier === "plus" ? "450K/mo" : "150K/mo"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );

    const sectionContent: Record<Section, React.ReactNode> = {
        profile: renderProfile(),
        usage: renderUsage(),
        history: renderHistory(),
        support: renderSupport(),
        promos: renderPromos(),
        users: renderUsers(),
    };

    return (
        <div className="w-full h-full font-sans overflow-auto pb-24 md:pb-8 bg-[#F8F8F8]">
            <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6 md:py-10">

                {/* ── Page header ── */}
                <div className="mb-6 md:mb-8">
                    <h1 className="text-[22px] md:text-[28px] font-black tracking-tight text-[#1a1a1a]">{t("title")}</h1>
                    <p className="text-[12px] text-gray-400 mt-0.5">{t("subtitle")}</p>
                </div>

                <div className="flex gap-6 items-start">

                    {/* ── Desktop left nav ── */}
                    <nav className="hidden md:flex flex-col w-[200px] shrink-0 gap-0.5 sticky top-4">
                        {visibleNav.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all text-[13px] font-semibold
                                    ${activeSection === item.id
                                        ? "bg-white text-[#1a1a1a] shadow-sm border border-[#e8e8e8]"
                                        : "text-gray-500 hover:text-[#1a1a1a] hover:bg-white/60"
                                    }`}
                            >
                                <item.icon className="w-4 h-4 shrink-0" stroke={activeSection === item.id ? 2.2 : 1.8} />
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    {/* ── Content ── */}
                    <div className="flex-1 min-w-0">

                        {/* Mobile tab scroller */}
                        <div className="md:hidden flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                            {visibleNav.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id)}
                                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all
                                        ${activeSection === item.id
                                            ? "bg-[#1a1a1a] text-white"
                                            : "bg-white text-gray-500 border border-[#e8e8e8]"
                                        }`}
                                >
                                    <item.icon className="w-3.5 h-3.5 shrink-0" />
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeSection}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                            >
                                {sectionContent[activeSection]}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────


function PlanBadge({ tier }: { tier: string }) {
    const labels: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", ultra: "Ultra" };
    if (!tier || tier === "free") {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-gray-400 border border-[#e8e8e8]">
                Free
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-[#1a1a1a] uppercase tracking-wide">
            {tier === "ultra" && <IconCrown className="w-2.5 h-2.5" />}
            {labels[tier] || tier}
        </span>
    );
}


function SignInPrompt({ onSignIn, t }: { onSignIn: () => void; t: (k: string) => string }) {
    return (
        <div className="bg-white rounded-2xl border border-[#ebebeb] p-8 text-center shadow-sm">
            <p className="text-[13px] text-gray-400 mb-4">{t("signInDesc")}</p>
            <button onClick={onSignIn} className="px-6 py-2.5 bg-[#1a1a1a] text-white rounded-xl font-bold text-[13px] hover:bg-black transition-all active:scale-95">
                {t("signIn")}
            </button>
        </div>
    );
}
