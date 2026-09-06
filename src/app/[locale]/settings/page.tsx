"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdmin } from "@/components/AdminContext";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Receipt, Package, TrendingUp, Clock, LogIn, Mail, ChevronRight, ShieldCheck, Trash2, Play, Pause, Copy, Check, Users, Search, X, Gift, Crown } from "lucide-react";

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

const fmtK = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1_000)}K`;

export default function SettingsPage() {
    const { user, setShowLogin } = useAdmin();
    const t = useTranslations("settings");

    const [fullUser, setFullUser]       = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [receipts, setReceipts]       = useState<any[]>([]);
    const [promos, setPromos]           = useState<PromoCode[]>([]);
    const [promoLoading, setPromoLoading] = useState(false);
    const [copiedCode, setCopiedCode]   = useState<string | null>(null);
    const [users, setUsers]             = useState<any[]>([]);
    const [userSearch, setUserSearch]   = useState("");
    const [userLoading, setUserLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showAllBilling, setShowAllBilling] = useState(false);

    useEffect(() => {
        if (!user) return;
        fetch("/api/auth/me").then(r => r.json()).then(d => setFullUser(d.user));
        fetch("/api/billing/stats").then(r => r.json()).then(d => {
            if (d.transactions) setTransactions(d.transactions);
            if (d.receipts) setReceipts(d.receipts);
        });
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
        } finally { setPromoLoading(false); }
    };

    const togglePromo = async (id: number, cur: number) => {
        await fetch("/api/admin/promos", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promoId: id, action: "toggle_active", is_active: cur ? 0 : 1 }),
        });
        fetchPromos();
    };

    const deletePromo = async (id: number) => {
        if (!confirm(t("deletePromoConfirm"))) return;
        await fetch("/api/admin/promos", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promoId: id, action: "delete" }),
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
        } finally { setUserLoading(false); }
    };

    const grantSubscription = async (userId: number, tier: string) => {
        if (!confirm(t("grantConfirm", { tier: tier.toUpperCase() }))) return;
        const res = await fetch("/api/admin/users", {
            method: "PUT", headers: { "Content-Type": "application/json" },
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
            display_date: new Date(r.created_at + "Z").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        }));
        transactions.forEach(tx => items.push({
            ...tx, is_receipt: false,
            _time: new Date(tx.date).getTime() || 0,
            display_date: new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        }));
        return items.sort((a, b) => b._time - a._time);
    }, [transactions, receipts]);

    const currentPlanId = fullUser?.plan_tier || "free";
    const planLabels: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", ultra: "Ultra" };
    const planLimits = {
        free:  { weekly: 50_000,  monthly: 150_000 },
        plus:  { weekly: 150_000, monthly: 450_000 },
        pro:   { weekly: 250_000, monthly: 800_000 },
        ultra: { weekly: 800_000, monthly: 3_000_000 },
    }[currentPlanId as "free"|"plus"|"pro"|"ultra"] || { weekly: 50_000, monthly: 150_000 };

    const weeklyUsed    = fullUser?.weekly_chars_used  || 0;
    const monthlyUsed   = fullUser?.monthly_chars_used || 0;
    const purchasedChars = fullUser?.purchased_chars   || 0;
    const weeklyPct     = Math.min(100, (weeklyUsed  / planLimits.weekly)  * 100);
    const monthlyPct    = Math.min(100, (monthlyUsed / planLimits.monthly) * 100);

    const visibleBilling = showAllBilling ? timelineItems : timelineItems.slice(0, 5);

    return (
        <div className="w-full h-full font-sans overflow-auto pb-24 md:pb-8" style={{ background: "#F2F2F7", WebkitFontSmoothing: "antialiased" }}>
            <div className="max-w-[600px] mx-auto px-4 py-6 md:py-10 space-y-6">

                {/* ── Title ── */}
                <div className="px-1">
                    <h1 className="text-[22px] font-bold text-[#1a1a1a] tracking-tight">{t("title")}</h1>
                    <p className="text-[13px] text-gray-400 mt-0.5">{t("subtitle")}</p>
                </div>

                {/* ═══════════════════════════════════════
                    PROFILE
                ═══════════════════════════════════════ */}
                {user && fullUser ? (
                    <Card>
                        <div className="px-4 py-4 flex items-center gap-4">
                            <div className="w-[52px] h-[52px] rounded-[16px] bg-[#1a1a1a] flex items-center justify-center text-white font-black text-[15px] uppercase shrink-0 select-none">
                                {(fullUser.username || fullUser.first_name || "U").slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[16px] font-bold text-[#1a1a1a] truncate leading-tight">
                                        {fullUser.username || fullUser.first_name || "User"}
                                    </span>
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
                    </Card>
                ) : !user ? (
                    <Card>
                        <div className="px-4 py-10 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#f0f0f0] flex items-center justify-center mx-auto mb-3">
                                <LogIn className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-[15px] font-semibold text-[#1a1a1a] mb-1">{t("signInTitle")}</p>
                            <p className="text-[13px] text-gray-400 mb-5 max-w-xs mx-auto">{t("signInDesc")}</p>
                            <button
                                onClick={() => setShowLogin(true)}
                                className="px-6 py-2.5 bg-[#1a1a1a] text-white rounded-xl font-semibold text-[14px] hover:bg-black transition-all active:scale-95"
                            >
                                {t("signIn")}
                            </button>
                        </div>
                    </Card>
                ) : (
                    <div className="h-[72px] bg-white rounded-2xl animate-pulse" />
                )}

                {/* ═══════════════════════════════════════
                    USAGE
                ═══════════════════════════════════════ */}
                {user && fullUser && (
                    <>
                        <SectionLabel>Usage</SectionLabel>
                        <Card>
                            {/* Weekly */}
                            <div className="px-4 pt-4 pb-3.5">
                                <div className="flex items-baseline justify-between mb-2">
                                    <span className="text-[15px] font-medium text-[#1a1a1a]">Weekly</span>
                                    <span className="text-[13px] font-mono text-[#1a1a1a] tabular-nums">
                                        {fmtK(weeklyUsed)}<span className="text-gray-300"> / {fmtK(planLimits.weekly)}</span>
                                    </span>
                                </div>
                                <ProgressBar pct={weeklyPct} />
                            </div>
                            <RowDivider />
                            {/* Monthly */}
                            <div className="px-4 pt-4 pb-3.5">
                                <div className="flex items-baseline justify-between mb-2">
                                    <span className="text-[15px] font-medium text-[#1a1a1a]">Monthly</span>
                                    <span className="text-[13px] font-mono text-[#1a1a1a] tabular-nums">
                                        {fmtK(monthlyUsed)}<span className="text-gray-300"> / {fmtK(planLimits.monthly)}</span>
                                    </span>
                                </div>
                                <ProgressBar pct={monthlyPct} />
                            </div>
                            <RowDivider />
                            {/* Legacy credits */}
                            <div className="px-4 py-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[15px] font-medium text-[#1a1a1a]">Legacy Credits</p>
                                    <p className="text-[12px] text-gray-400 mt-0.5">{t("neverExpires")}</p>
                                </div>
                                <span className="text-[20px] font-bold text-[#1a1a1a] tabular-nums">{fmtK(purchasedChars)}</span>
                            </div>
                        </Card>
                    </>
                )}

                {/* ═══════════════════════════════════════
                    BILLING HISTORY
                ═══════════════════════════════════════ */}
                {user && (
                    <>
                        <SectionLabel>Billing</SectionLabel>
                        <Card>
                            {timelineItems.length > 0 ? (
                                <>
                                    <div className="divide-y divide-[#f2f2f2]">
                                        {visibleBilling.map((item, idx) =>
                                            item.is_receipt ? (
                                                <div key={`r-${item.id}`} className="flex items-center gap-3 px-4 py-3">
                                                    <div className="w-8 h-8 rounded-xl bg-[#f0f0f0] flex items-center justify-center shrink-0">
                                                        <Package className="w-4 h-4 text-[#1a1a1a]" strokeWidth={1.5} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[14px] font-medium text-[#1a1a1a] truncate">{item.pack_name}</p>
                                                        <p className="text-[11px] text-gray-400">{item.display_date}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[13px] font-semibold text-[#1a1a1a] tabular-nums">{item.amount_text}</span>
                                                        <a href={`/api/billing/receipt/${item.id}`} target="_blank" rel="noopener noreferrer"
                                                            className="text-[10px] font-bold text-gray-300 uppercase hover:text-[#1a1a1a] transition-colors hidden sm:block">
                                                            PDF
                                                        </a>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={`t-${item.id}-${idx}`} className="flex items-center gap-3 px-4 py-3">
                                                    <div className="w-8 h-8 rounded-xl bg-[#f0f0f0] flex items-center justify-center shrink-0">
                                                        {item.is_positive
                                                            ? <TrendingUp className="w-4 h-4 text-[#1a1a1a]" strokeWidth={1.5} />
                                                            : <Clock className="w-4 h-4 text-[#999]" strokeWidth={1.5} />
                                                        }
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[14px] font-medium text-[#1a1a1a] truncate">{item.type}</p>
                                                        <p className="text-[11px] text-gray-400">{item.display_date}</p>
                                                    </div>
                                                    <span className={`text-[13px] font-semibold tabular-nums shrink-0 ${item.is_positive ? "text-[#1a1a1a]" : "text-gray-400"}`}>
                                                        {item.amount}
                                                    </span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                    {timelineItems.length > 5 && (
                                        <>
                                            <RowDivider />
                                            <button
                                                onClick={() => setShowAllBilling(v => !v)}
                                                className="w-full px-4 py-3 text-[14px] font-medium text-gray-500 hover:text-[#1a1a1a] text-left transition-colors flex items-center justify-between"
                                            >
                                                <span>{showAllBilling ? "Show less" : `Show all ${timelineItems.length} transactions`}</span>
                                                <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${showAllBilling ? "rotate-90" : ""}`} />
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <div className="px-4 py-10 text-center">
                                    <Receipt className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                                    <p className="text-[13px] text-gray-400">{t("noTransactions")}</p>
                                </div>
                            )}
                        </Card>
                    </>
                )}

                {/* ═══════════════════════════════════════
                    SUPPORT
                ═══════════════════════════════════════ */}
                <SectionLabel>Support</SectionLabel>
                <Card>
                    <a href="mailto:support@perricheno.ru"
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.02] transition-colors">
                        <div className="w-8 h-8 rounded-xl bg-[#f0f0f0] flex items-center justify-center shrink-0">
                            <Mail className="w-4 h-4 text-[#1a1a1a]" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-[#1a1a1a]">Email</p>
                            <p className="text-[11px] text-gray-400">support@perricheno.ru</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </a>
                    <RowDivider />
                    <a href="https://t.me/perricheno" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-black/[0.02] transition-colors">
                        <div className="w-8 h-8 rounded-xl bg-[#f0f0f0] flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-[#1a1a1a]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.999-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-[#1a1a1a]">Telegram</p>
                            <p className="text-[11px] text-gray-400">@perricheno</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </a>
                </Card>

                {/* ═══════════════════════════════════════
                    ADMIN — PROMO CODES
                ═══════════════════════════════════════ */}
                {fullUser?.isAdmin && (
                    <>
                        <SectionLabel>
                            <span>Promo Codes</span>
                            <span className="ml-1.5 text-[9px] font-bold text-gray-400 bg-[#ebebeb] px-1.5 py-0.5 rounded uppercase">Admin</span>
                        </SectionLabel>
                        <Card>
                            {promoLoading ? (
                                <div className="py-10 flex justify-center">
                                    <div className="w-5 h-5 border-2 border-[#ddd] border-t-[#1a1a1a] rounded-full animate-spin" />
                                </div>
                            ) : promos.length > 0 ? (
                                <div className="divide-y divide-[#f2f2f2]">
                                    {promos.map(promo => (
                                        <div key={promo.id} className={`flex items-center gap-3 px-4 py-3 ${!promo.is_active ? "opacity-40" : ""}`}>
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${promo.is_active ? "bg-[#1a1a1a]" : "bg-gray-300"}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[13px] font-bold font-mono text-[#1a1a1a] truncate">{promo.code}</span>
                                                    <button onClick={() => copyCode(promo.code)} className="text-gray-300 hover:text-[#1a1a1a] transition-colors">
                                                        {copiedCode === promo.code
                                                            ? <Check className="w-3 h-3 text-[#1a1a1a]" />
                                                            : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-gray-400">{promo.type} · {promo.amount.toLocaleString()} · {promo.uses}/{promo.max_uses} uses</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => togglePromo(promo.id, promo.is_active)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f0f0f0] transition-colors">
                                                    {promo.is_active
                                                        ? <Pause className="w-3.5 h-3.5 text-[#555]" />
                                                        : <Play className="w-3.5 h-3.5 text-[#555]" />}
                                                </button>
                                                <button onClick={() => deletePromo(promo.id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[13px] text-gray-400 text-center px-4 py-8">{t("noPromoCodes")}</p>
                            )}
                        </Card>

                        {/* ─── User Management ─── */}
                        <SectionLabel>
                            <span>Users</span>
                            <span className="ml-1.5 text-[9px] font-bold text-gray-400 bg-[#ebebeb] px-1.5 py-0.5 rounded uppercase">Admin</span>
                        </SectionLabel>
                        <Card>
                            <div className="px-4 pt-4 pb-3 flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && searchUsers()}
                                        placeholder={t("searchPlaceholder")}
                                        style={{ fontSize: "16px" }}
                                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#f2f2f2] text-[13px] focus:outline-none placeholder-gray-300"
                                    />
                                </div>
                                <button onClick={searchUsers} disabled={userLoading || !userSearch.trim()}
                                    className="px-4 py-2 bg-[#1a1a1a] text-white rounded-xl font-semibold text-[12px] hover:bg-black transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                                    {userLoading
                                        ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <Search className="w-3.5 h-3.5" />}
                                    {t("search")}
                                </button>
                            </div>
                            {users.length > 0 && (
                                <div className="divide-y divide-[#f2f2f2] border-t border-[#f2f2f2]">
                                    {users.map(u => (
                                        <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                                            <div className="w-9 h-9 rounded-[12px] bg-[#1a1a1a] flex items-center justify-center text-white font-bold text-[11px] uppercase shrink-0">
                                                {(u.username || u.first_name || "U").slice(0, 2)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[14px] font-medium text-[#1a1a1a] truncate">{u.username || u.first_name || "User"}</p>
                                                <p className="text-[11px] text-gray-400">ID: {u.id} · {u.plan_tier || "free"}</p>
                                            </div>
                                            <button onClick={() => { setSelectedUser(u); setShowUserModal(true); }}
                                                className="px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-[#f0f0f0] text-[#1a1a1a] hover:bg-[#e8e8e8] transition-all flex items-center gap-1.5 shrink-0">
                                                <Gift className="w-3.5 h-3.5" />
                                                {t("grant")}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {userSearch && !userLoading && users.length === 0 && (
                                <p className="text-[12px] text-gray-400 text-center py-6 border-t border-[#f2f2f2]">{t("noUsersFound")}</p>
                            )}
                        </Card>
                    </>
                )}
            </div>

            {/* ── Grant Modal ── */}
            {showUserModal && selectedUser && (
                <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
                    onClick={() => setShowUserModal(false)}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[16px] font-bold text-[#1a1a1a]">{t("grantSubscription")}</p>
                            <button onClick={() => setShowUserModal(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#f0f0f0] text-gray-400 hover:text-[#1a1a1a] transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[13px] text-gray-400 mb-4">
                            {selectedUser.username || selectedUser.first_name} · current: {selectedUser.plan_tier || "free"}
                        </p>
                        <div className="space-y-2">
                            {["free","plus","pro","ultra"].map(tier => (
                                <button key={tier} onClick={() => grantSubscription(selectedUser.id, tier)}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-[14px] transition-all
                                        bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#1a1a1a] active:scale-[0.98]">
                                    <span className="flex items-center gap-2">
                                        {tier === "ultra" && <Crown className="w-4 h-4" />}
                                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                                    </span>
                                    <span className="text-[12px] text-gray-400 font-normal">
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
}

// ── Primitives ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="px-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            {children}
        </p>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-[#e8e8e8] overflow-hidden">
            {children}
        </div>
    );
}

function RowDivider() {
    return <div className="h-px bg-[#f2f2f2] mx-4" />;
}

function ProgressBar({ pct }: { pct: number }) {
    return (
        <div className="h-[2px] w-full bg-[#efefef] rounded-full overflow-hidden">
            <div className="h-full bg-[#1a1a1a] rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
    );
}

function PlanBadge({ tier }: { tier: string }) {
    const labels: Record<string, string> = { free: "Free", plus: "Plus", pro: "Pro", ultra: "Ultra" };
    if (!tier || tier === "free") {
        return (
            <span className="text-[10px] font-semibold text-gray-400 border border-[#e0e0e0] px-2 py-0.5 rounded-full">
                Free
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#1a1a1a] px-2 py-0.5 rounded-full uppercase tracking-wide">
            {tier === "ultra" && <Crown className="w-2.5 h-2.5" />}
            {labels[tier] || tier}
        </span>
    );
}
