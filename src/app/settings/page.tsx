"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import { motion } from "framer-motion";
import {
    IconReceipt,
    IconPackage, IconTrendingUp, IconClock, IconLogin,
    IconMail, IconChevronRight, IconDatabase,
    IconShieldLock, IconTrash, IconPlayerPlay, IconPlayerPause, IconCopy, IconCheck,
    IconUsers, IconSearch, IconX, IconGift, IconCrown
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

export default function SettingsPage() {
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const [fullUser, setFullUser] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [receipts, setReceipts] = useState<any[]>([]);

    // Promo management (admin only)
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [promoLoading, setPromoLoading] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // User management (admin only)
    const [users, setUsers] = useState<any[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [userLoading, setUserLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showUserModal, setShowUserModal] = useState(false);

    useEffect(() => {
        if (user) {
            fetch("/api/auth/me")
                .then(r => r.json())
                .then(d => { setFullUser(d.user); });

            fetch("/api/billing/stats")
                .then(r => r.json())
                .then(d => {
                    if (d.transactions) setTransactions(d.transactions);
                    if (d.receipts) setReceipts(d.receipts);
                });
        }
    }, [user]);

    // Load promo codes if admin
    useEffect(() => {
        if (fullUser?.isAdmin) {
            fetchPromos();
        }
    }, [fullUser]);

    const fetchPromos = async () => {
        setPromoLoading(true);
        try {
            const res = await fetch("/api/admin/promos");
            const data = await res.json();
            if (data.promos) setPromos(data.promos);
        } catch (e) {
            console.error("Failed to fetch promos:", e);
        } finally {
            setPromoLoading(false);
        }
    };

    const togglePromo = async (promoId: number, currentActive: number) => {
        try {
            await fetch("/api/admin/promos", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promoId, action: "toggle_active", is_active: currentActive ? 0 : 1 })
            });
            fetchPromos();
        } catch (e) {
            console.error("Failed to toggle promo:", e);
        }
    };

    const deletePromo = async (promoId: number) => {
        if (!confirm("Delete this promo code permanently?")) return;
        try {
            await fetch("/api/admin/promos", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promoId, action: "delete" })
            });
            fetchPromos();
        } catch (e) {
            console.error("Failed to delete promo:", e);
        }
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
        } catch (e) {
            console.error("Failed to search users:", e);
        } finally {
            setUserLoading(false);
        }
    };

    const grantSubscription = async (userId: number, tier: string) => {
        if (!confirm(`Grant ${tier.toUpperCase()} subscription to this user?`)) return;
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: userId, action: 'grant_subscription', tier })
            });
            if (res.ok) {
                alert('Subscription granted successfully!');
                setShowUserModal(false);
                setSelectedUser(null);
                searchUsers(); // Refresh list
            } else {
                const error = await res.json();
                alert(`Error: ${error.error || 'Failed to grant subscription'}`);
            }
        } catch (e) {
            console.error("Failed to grant subscription:", e);
            alert('Failed to grant subscription');
        }
    };

    const timelineItems = useMemo(() => {
        const items: any[] = [];
        receipts.forEach(r => {
            items.push({
                ...r, is_receipt: true,
                _time: new Date(r.created_at + 'Z').getTime(),
                display_date: new Date(r.created_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            });
        });
        transactions.forEach(t => {
            items.push({
                ...t, is_receipt: false,
                _time: new Date(t.date).getTime() || 0,
                display_date: new Date(t.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            });
        });
        return items.sort((a, b) => b._time - a._time);
    }, [transactions, receipts]);

    const currentPlanId = fullUser?.plan_tier || 'free';
    const planLabels: Record<string, string> = {
        free: 'Free',
        plus: 'Plus',
        pro: 'Pro',
        ultra: 'Ultra'
    };
    const planLimits = {
        free: { weekly: 50000, monthly: 150000 },
        plus: { weekly: 150000, monthly: 450000 },
        pro: { weekly: 250000, monthly: 800000 },
        ultra: { weekly: 800000, monthly: 3000000 }
    }[currentPlanId as 'free'|'plus'|'pro'|'ultra'] || { weekly: 50000, monthly: 150000 };

    const weeklyUsed = fullUser?.weekly_chars_used || 0;
    const monthlyUsed = fullUser?.monthly_chars_used || 0;
    const purchasedChars = fullUser?.purchased_chars || 0;

    return (
        <div className="w-full h-full font-sans overflow-auto pb-24 md:pb-0 bg-[#FBFBFC]">
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-[900px] mx-auto px-5 py-10 md:py-20">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

                    {/* ━━ Header ━━ */}
                    <div className="mb-10">
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1a1a1a] mb-1">Settings</h1>
                        <p className="text-sm text-gray-400">Manage your account and view history.</p>
                    </div>

                    {/* ━━ Account Card ━━ */}
                    {user && fullUser ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white font-black text-sm uppercase shrink-0">
                                    {(fullUser.username || "U").slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-base font-bold truncate text-[#1a1a1a]">{fullUser.username || fullUser.first_name || "User"}</p>
                                    <p className="text-xs text-gray-400">
                                        {fullUser.isAdmin ? "Admin" : "Member"} · {planLabels[currentPlanId] || 'Free'} Plan · Since {fullUser.created_at ? new Date(fullUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "-"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Weekly</p>
                                        <p className="text-sm font-black tabular-nums text-[#1a1a1a]">
                                            {(weeklyUsed / 1000).toFixed(0)}K <span className="text-gray-300 font-medium">/ {(planLimits.weekly / 1000).toFixed(0)}K</span>
                                        </p>
                                    </div>
                                    <div className="w-px h-8 bg-gray-100 hidden sm:block" />
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Balance</p>
                                        <p className="text-sm font-black tabular-nums text-emerald-600">{(purchasedChars / 1000).toFixed(0)}K</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : !user ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-10 md:p-14 text-center mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                                <IconLogin className="w-7 h-7 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold mb-1.5 text-[#1a1a1a]">Sign in to continue</h3>
                            <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">Connect your Telegram account to view usage and manage settings.</p>
                            <button onClick={() => setShowLogin(true)} className="px-8 py-3 bg-[#1a1a1a] text-white rounded-xl font-bold text-sm hover:bg-black transition-all active:scale-95 shadow-lg">
                                Sign In
                            </button>
                        </div>
                    ) : (
                        <div className="h-20 bg-gray-50 rounded-2xl animate-pulse mb-8" />
                    )}

                    {/* ━━ Usage Overview (compact) ━━ */}
                    {user && fullUser && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
                            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <IconClock className="w-3.5 h-3.5 text-gray-400" stroke={2} />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Weekly Usage</p>
                                </div>
                                <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden mb-1">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (weeklyUsed / planLimits.weekly) * 100)}%` }} />
                                </div>
                                <p className="text-[10px] text-gray-400">{(weeklyUsed / 1000).toFixed(0)}K / {(planLimits.weekly / 1000).toFixed(0)}K</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <IconPackage className="w-3.5 h-3.5 text-gray-400" stroke={2} />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Monthly Balance</p>
                                </div>
                                <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden mb-1">
                                    <div className="h-full bg-[#1a1a1a] rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (monthlyUsed / planLimits.monthly) * 100)}%` }} />
                                </div>
                                <p className="text-[10px] text-gray-400">{(monthlyUsed / 1000).toFixed(0)}K / {(planLimits.monthly / 1000).toFixed(0)}K</p>
                            </div>
                            <div className="bg-[#111] rounded-2xl border border-gray-800 p-4 shadow-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <IconDatabase className="w-3.5 h-3.5 text-gray-400" stroke={2} />
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Legacy Credits</p>
                                </div>
                                <p className="text-lg font-black tabular-nums text-emerald-400">
                                    {purchasedChars >= 1000000 ? `${(purchasedChars / 1000000).toFixed(1)}M` : `${(purchasedChars / 1000).toFixed(0)}K`}
                                </p>
                                <p className="text-[9px] text-gray-500 mt-0.5">Never expires</p>
                            </div>
                        </div>
                    )}

                    {/* ━━ Promo Code Management (Admin Only) ━━ */}
                    {fullUser?.isAdmin && (
                        <div className="mb-10">
                            <div className="flex items-center gap-2 mb-5">
                                <IconShieldLock className="w-5 h-5 text-[#1a1a1a]" stroke={2} />
                                <h2 className="text-xl font-black tracking-tight text-[#1a1a1a]">Promo Codes</h2>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded">Admin</span>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                {promoLoading ? (
                                    <div className="p-10 text-center">
                                        <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent animate-spin rounded-full mx-auto" />
                                    </div>
                                ) : promos.length > 0 ? (
                                    <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
                                        {promos.map(promo => (
                                            <div key={promo.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors ${!promo.is_active ? 'opacity-50' : ''}`}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${promo.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold font-mono truncate text-[#1a1a1a]">{promo.code}</p>
                                                            <button onClick={() => copyCode(promo.code)} className="text-gray-300 hover:text-[#1a1a1a] transition-colors">
                                                                {copiedCode === promo.code ? <IconCheck className="w-3 h-3 text-emerald-500" /> : <IconCopy className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400">
                                                            {promo.type} · {promo.amount.toLocaleString()} · {promo.uses}/{promo.max_uses} uses
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        onClick={() => togglePromo(promo.id, promo.is_active)}
                                                        className={`p-1.5 rounded-lg transition-colors ${promo.is_active ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-emerald-50 text-emerald-500'}`}
                                                        title={promo.is_active ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {promo.is_active ? <IconPlayerPause className="w-3.5 h-3.5" stroke={2} /> : <IconPlayerPlay className="w-3.5 h-3.5" stroke={2} />}
                                                    </button>
                                                    <button
                                                        onClick={() => deletePromo(promo.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <IconTrash className="w-3.5 h-3.5" stroke={2} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-10 text-center">
                                        <p className="text-sm text-gray-400">No promo codes found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ━━ User Management (Admin Only) ━━ */}
                    {fullUser?.isAdmin && (
                        <div className="mb-10">
                            <div className="flex items-center gap-2 mb-5">
                                <IconUsers className="w-5 h-5 text-[#1a1a1a]" stroke={2} />
                                <h2 className="text-xl font-black tracking-tight text-[#1a1a1a]">User Management</h2>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded">Admin</span>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-5">
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                                        placeholder="Search by username, name, or Telegram ID..."
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] focus:border-transparent"
                                    />
                                    <button
                                        onClick={searchUsers}
                                        disabled={userLoading || !userSearch.trim()}
                                        className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg font-bold text-sm hover:bg-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <IconSearch className="w-4 h-4" />
                                        Search
                                    </button>
                                </div>

                                {userLoading ? (
                                    <div className="p-10 text-center">
                                        <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent animate-spin rounded-full mx-auto" />
                                    </div>
                                ) : users.length > 0 ? (
                                    <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50 -mx-5">
                                        {users.map(u => (
                                            <div key={u.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-white font-black text-xs uppercase shrink-0">
                                                        {(u.username || u.first_name || "U").slice(0, 2)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold truncate text-[#1a1a1a]">{u.username || u.first_name || "User"}</p>
                                                        <p className="text-[10px] text-gray-400">
                                                            ID: {u.id} · {planLabels[u.plan_tier || 'free']} Plan
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => { setSelectedUser(u); setShowUserModal(true); }}
                                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-xs hover:bg-emerald-100 transition-all flex items-center gap-1.5 shrink-0"
                                                >
                                                    <IconGift className="w-3.5 h-3.5" />
                                                    Grant
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : userSearch ? (
                                    <div className="p-10 text-center">
                                        <p className="text-sm text-gray-400">No users found</p>
                                    </div>
                                ) : null}
                            </div>

                            {/* Grant Subscription Modal */}
                            {showUserModal && selectedUser && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUserModal(false)}>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-between mb-5">
                                            <h3 className="text-lg font-black text-[#1a1a1a]">Grant Subscription</h3>
                                            <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-[#1a1a1a] transition-colors">
                                                <IconX className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="mb-5">
                                            <p className="text-sm text-gray-600 mb-1">User:</p>
                                            <p className="text-base font-bold text-[#1a1a1a]">{selectedUser.username || selectedUser.first_name || "User"}</p>
                                            <p className="text-xs text-gray-400">Current plan: {planLabels[selectedUser.plan_tier || 'free']}</p>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-sm font-bold text-gray-600 mb-3">Select Plan:</p>
                                            {['free', 'plus', 'pro', 'ultra'].map(tier => (
                                                <button
                                                    key={tier}
                                                    onClick={() => grantSubscription(selectedUser.id, tier)}
                                                    className={`w-full px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-between ${
                                                        tier === 'ultra' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600' :
                                                        tier === 'pro' ? 'bg-[#1a1a1a] text-white hover:bg-black' :
                                                        tier === 'plus' ? 'bg-emerald-500 text-white hover:bg-emerald-600' :
                                                        'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        {tier === 'ultra' && <IconCrown className="w-4 h-4" />}
                                                        {planLabels[tier]}
                                                    </span>
                                                    <span className="text-xs opacity-75">
                                                        {tier === 'ultra' ? '3M/mo' : tier === 'pro' ? '800K/mo' : tier === 'plus' ? '450K/mo' : '150K/mo'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ━━ Transaction History ━━ */}
                    {user && (
                        <div className="mb-10">
                            <h2 className="text-xl font-black tracking-tight text-[#1a1a1a] mb-5">History</h2>

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
                                    {timelineItems.length > 0 ? timelineItems.slice(0, 30).map((item, idx) => (
                                        item.is_receipt ? (
                                            <div key={`r-${item.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                                        <IconPackage className="w-3.5 h-3.5 text-emerald-600" stroke={2} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold truncate text-[#1a1a1a]">{item.pack_name}</p>
                                                        <p className="text-[10px] text-gray-400 font-medium">{item.display_date}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-xs font-bold tabular-nums text-emerald-600">{item.amount_text}</span>
                                                    <a href={`/api/billing/receipt/${item.id}`} target="_blank" rel="noopener noreferrer"
                                                        className="text-[9px] font-bold text-gray-300 uppercase tracking-widest hover:text-[#1a1a1a] transition-colors hidden sm:block">
                                                        PDF
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div key={`t-${item.id}-${idx}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.is_positive ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                                                        {item.is_positive ? <IconTrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <IconClock className="w-3.5 h-3.5 text-gray-400" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold truncate text-[#1a1a1a]">{item.type}</p>
                                                        <p className="text-[10px] text-gray-400 font-medium">{item.display_date}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-xs font-bold tabular-nums shrink-0 ${item.is_positive ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                    {item.amount}
                                                </span>
                                            </div>
                                        )
                                    )) : (
                                        <div className="p-14 text-center">
                                            <IconReceipt className="w-8 h-8 mx-auto text-gray-200 mb-2" />
                                            <p className="text-sm text-gray-400">No transactions yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ━━ Support ━━ */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-[#1a1a1a] mb-3">Support</h3>
                        <div className="space-y-1">
                            <a href="mailto:support@perricheno.ru" className="flex items-center justify-between py-2 px-1 text-sm text-gray-500 hover:text-[#1a1a1a] transition-colors rounded-lg hover:bg-gray-50">
                                <span className="flex items-center gap-2.5"><IconMail className="w-4 h-4" /> support@perricheno.ru</span>
                                <IconChevronRight className="w-3.5 h-3.5 text-gray-300" />
                            </a>
                            <a href="https://t.me/perricheno" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between py-2 px-1 text-sm text-gray-500 hover:text-[#1a1a1a] transition-colors rounded-lg hover:bg-gray-50">
                                <span className="flex items-center gap-2.5">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.999-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                                    @perricheno
                                </span>
                                <IconChevronRight className="w-3.5 h-3.5 text-gray-300" />
                            </a>
                        </div>
                    </div>

                </motion.div>
            </div>
        </div>
    );
}
