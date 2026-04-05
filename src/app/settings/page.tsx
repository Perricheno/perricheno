"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconUser, IconCreditCard, IconSettings, IconSparkles,
    IconBolt, IconDatabase, IconReceipt, IconFileText,
    IconPackage, IconFlame, IconStar, IconArrowRight,
    IconTrendingUp, IconClock, IconLogin, IconMail
} from "@tabler/icons-react";

// ── Pack catalog (mirrors server-side) ──
const PACKS = [
    { id: 'starter_chars', name: 'Starter Pack', desc: '100K Characters', price: 1, tag: 'Budget', category: 'chars', icon: IconBolt },
    { id: 'writer', name: 'Writer Pack', desc: '500K Characters', price: 3, category: 'chars', icon: IconFileText },
    { id: 'data_scientist', name: 'Data Scientist', desc: '2M Characters', price: 5, tag: 'Popular', category: 'chars', icon: IconSparkles },
    { id: 'researcher', name: 'Researcher', desc: '5M Characters', price: 12, category: 'chars', icon: IconTrendingUp },
    { id: 'report_single', name: '3 Reports', desc: '3 Full Research Reports', price: 2, category: 'reports', icon: IconReceipt },
    { id: 'report_bulk', name: '15 Reports', desc: '15 Full Research Reports', price: 8, tag: 'Best Value', category: 'reports', icon: IconStar },
    { id: 'combo_lite', name: 'Lite Bundle', desc: '1M Chars + 5 Reports', price: 7, category: 'combo', icon: IconPackage },
    { id: 'combo_pro', name: 'Pro Bundle', desc: '10M Chars + 30 Reports', price: 20, tag: 'Ultimate', category: 'combo', icon: IconFlame },
];

type TabId = "account" | "billing" | "support";

const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: "account", label: "Account", icon: IconUser },
    { id: "billing", label: "Billing & Usage", icon: IconCreditCard },
    { id: "support", label: "Support", icon: IconMail },
];

export default function SettingsPage() {
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const [activeTab, setActiveTab] = useState<TabId>("account");
    const [limits, setLimits] = useState<any>(null);
    const [fullUser, setFullUser] = useState<any>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | 'chars' | 'reports' | 'combo'>('all');
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [receipts, setReceipts] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            fetch("/api/auth/me")
                .then(r => r.json())
                .then(d => { setLimits(d.limits); setFullUser(d.user); });

            fetch("/api/billing/stats")
                .then(r => r.json())
                .then(d => {
                    if (d.transactions) setTransactions(d.transactions);
                    if (d.receipts) setReceipts(d.receipts);
                });
        }
    }, [user]);

    const handleCheckout = async (packId: string) => {
        setCheckoutLoading(packId);
        try {
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packId })
            });
            let data;
            try { data = JSON.parse(await res.text()); } catch {
                window.location.assign("https://pay.cryptocloud.plus/pos/gTEj6wIpQ46vKqaH");
                return;
            }
            if (data.url) window.location.assign(data.url);
            else if (data.fallback_url) window.location.assign(data.fallback_url);
            else alert('Checkout failed: ' + (data.error || 'Unknown error'));
        } catch (err: any) {
            alert(`Checkout error: ${err.message || 'Unknown'}`);
        } finally {
            setCheckoutLoading(null);
        }
    };

    const filteredPacks = PACKS.filter(p => activeFilter === 'all' || p.category === activeFilter);

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
                display_date: t.date
            });
        });
        return items.sort((a, b) => b._time - a._time);
    }, [transactions, receipts]);

    return (
        <div className="w-full h-full font-sans overflow-auto bg-[var(--background)] selection:bg-black selection:text-white pb-24 md:pb-0">
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-16">
                {/* ━━ Header ━━ */}
                <header className="mb-8 md:mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Settings</h1>
                    <p className="text-sm text-gray-500">Manage your account, billing, and preferences.</p>
                </header>

                {/* ━━ Tab Navigation ━━ */}
                <div className="flex gap-1 mb-8 bg-[var(--card)] p-1 rounded-xl w-full md:w-fit border border-[var(--border)] shadow-sm overflow-x-auto">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm"
                                    : "text-gray-500 hover:text-[var(--foreground)] hover:bg-black/5"
                            }`}>
                            <tab.icon className="w-4 h-4" stroke={1.5} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* ━━ Tab Content ━━ */}
                <AnimatePresence mode="wait">
                    {/* ═══ ACCOUNT ═══ */}
                    {activeTab === "account" && (
                        <motion.div key="account" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}
                            className="space-y-6">
                            {user && fullUser ? (
                                <>
                                    {/* Profile Card */}
                                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 md:p-8 shadow-sm">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] flex items-center justify-center text-white font-black text-lg uppercase shrink-0">
                                                {(fullUser.username || "U").slice(0, 2)}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold">{fullUser.username || fullUser.first_name || "User"}</h3>
                                                <p className="text-sm text-gray-500">
                                                    {fullUser.telegram_id ? `Telegram ID: ${fullUser.telegram_id}` : "Connected via Telegram"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Role</p>
                                                <p className="text-sm font-semibold">{fullUser.is_admin ? "Administrator" : "User"}</p>
                                            </div>
                                            <div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Member Since</p>
                                                <p className="text-sm font-semibold">
                                                    {fullUser.created_at ? new Date(fullUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "—"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Usage Overview */}
                                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 md:p-8 shadow-sm">
                                        <h3 className="text-base font-bold mb-4">Quick Overview</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="text-center p-4 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                                                <p className="text-2xl font-black tabular-nums">{((fullUser.daily_chars_used || 0) / 1000).toFixed(0)}K</p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Used Today</p>
                                            </div>
                                            <div className="text-center p-4 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                                                <p className="text-2xl font-black tabular-nums text-green-600">{((fullUser.purchased_chars || 0) / 1000).toFixed(0)}K</p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Credits</p>
                                            </div>
                                            <div className="text-center p-4 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                                                <p className="text-2xl font-black tabular-nums text-blue-600">{fullUser.purchased_reports || 0}</p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Reports</p>
                                            </div>
                                            <div className="text-center p-4 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                                                <p className="text-2xl font-black tabular-nums">{fullUser.purchased_visuals || 0}</p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Visuals</p>
                                            </div>
                                        </div>

                                        <button onClick={() => setActiveTab("billing")} className="mt-4 w-full py-3 border border-[var(--border)] rounded-xl text-sm font-semibold text-gray-500 hover:text-[var(--foreground)] hover:border-gray-400 transition-all flex items-center justify-center gap-2">
                                            View Detailed Billing <IconArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 text-center shadow-sm">
                                    <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                                        <IconLogin className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">Sign in to continue</h3>
                                    <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">Connect via Telegram to access your account settings and billing.</p>
                                    <button onClick={() => setShowLogin(true)} className="px-8 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-95 shadow-md">
                                        Sign In
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ═══ BILLING ═══ */}
                    {activeTab === "billing" && (
                        <motion.div key="billing" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}
                            className="space-y-8">

                            {/* Quotas */}
                            {fullUser && limits ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Daily Card */}
                                    <div className="group relative bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 overflow-hidden shadow-sm transition-all hover:shadow-md">
                                        <div className="absolute top-0 right-0 p-4 opacity-5">
                                            <IconBolt className="w-16 h-16" stroke={1} />
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Daily Capacity</p>
                                            <h3 className="text-xl font-bold mb-4">Real-time Burst</h3>
                                            <div className="space-y-3">
                                                <div className="flex items-end justify-between">
                                                    <span className="text-3xl font-black tabular-nums">
                                                        {((fullUser.daily_chars_used || 0) / 1000).toFixed(0)}K
                                                        <span className="text-sm font-bold text-gray-300 ml-1">/ {(limits.free.daily_chars / 1000).toFixed(0)}K</span>
                                                    </span>
                                                </div>
                                                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[var(--foreground)] rounded-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${Math.min(100, ((fullUser.daily_chars_used || 0) / (limits.free.daily_chars || 1)) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Purchased Card */}
                                    <div className="group relative bg-[#1a1a1a] text-white border border-transparent rounded-2xl p-6 overflow-hidden shadow-lg">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <IconDatabase className="w-16 h-16" stroke={1} />
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Roll-over Storage</p>
                                            <h3 className="text-xl font-bold mb-4">Permanent Buffer</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-2xl font-black tabular-nums text-green-400">{((fullUser.purchased_chars || 0) / 1000).toFixed(0)}K</p>
                                                    <p className="text-[10px] font-bold uppercase text-gray-500">Chars available</p>
                                                </div>
                                                <div className="border-l border-white/10 pl-4">
                                                    <p className="text-2xl font-black tabular-nums text-blue-400">{fullUser.purchased_reports || 0}</p>
                                                    <p className="text-[10px] font-bold uppercase text-gray-500">Reports left</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : !user ? (
                                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 text-center shadow-sm">
                                    <IconReceipt className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                                    <h3 className="text-xl font-bold mb-2">Connect Your Account</h3>
                                    <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">Sign in to track your usage and unlock credit packs.</p>
                                    <button onClick={() => setShowLogin(true)} className="px-8 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-95 shadow-md">
                                        Authorize Access
                                    </button>
                                </div>
                            ) : null}

                            {/* Transaction History */}
                            {user && (
                                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                                    <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                                            <IconReceipt className="w-4 h-4" />
                                        </div>
                                        <h3 className="text-base font-bold">Transaction History</h3>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
                                        {timelineItems.length > 0 ? timelineItems.slice(0, 20).map((item) => (
                                            item.is_receipt ? (
                                                <div key={item.id} className="flex flex-col px-5 py-4 hover:bg-gray-50/50 transition-colors">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2.5">
                                                            <IconPackage className="w-4 h-4 text-[var(--foreground)]" stroke={2} />
                                                            <p className="text-sm font-bold">{item.pack_name}</p>
                                                        </div>
                                                        <span className="text-sm font-black tabular-nums">{item.amount_text}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.display_date}</p>
                                                        <a href={`/api/billing/receipt/${item.id}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:text-blue-800 transition-colors">
                                                            <IconFileText className="w-3 h-3" /> Receipt
                                                        </a>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={item.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.is_positive ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-400'}`}>
                                                            {item.is_positive ? <IconTrendingUp className="w-4 h-4" /> : <IconClock className="w-4 h-4" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold truncate">{item.type}</p>
                                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.display_date}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-sm font-bold tabular-nums whitespace-nowrap px-2.5 py-1 rounded-lg ${item.is_positive ? 'bg-green-50 text-green-600' : 'text-gray-400'}`}>
                                                        {item.amount}
                                                    </span>
                                                </div>
                                            )
                                        )) : (
                                            <div className="p-12 text-center">
                                                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">No transactions yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ━━ Resource Packs Marketplace ━━ */}
                            <div>
                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                                    <div>
                                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Resource Packs</h2>
                                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                                            {[
                                                { id: 'all' as const, label: 'All' },
                                                { id: 'chars' as const, label: 'Characters' },
                                                { id: 'reports' as const, label: 'Reports' },
                                                { id: 'combo' as const, label: 'Bundles' },
                                            ].map(f => (
                                                <button key={f.id} onClick={() => setActiveFilter(f.id)}
                                                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap border ${
                                                        activeFilter === f.id
                                                            ? 'bg-[var(--foreground)] text-[var(--background)] border-transparent'
                                                            : 'bg-[var(--card)] text-gray-500 border-[var(--border)] hover:border-gray-400'
                                                    }`}>
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-[var(--card)] border border-[var(--border)] shadow-sm rounded-xl">
                                        <IconCreditCard className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Powered by <span className="text-[var(--foreground)]">CryptoCloud</span></span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredPacks.map(pack => {
                                        const isUltimate = pack.tag === 'Ultimate';
                                        const isPopular = pack.tag === 'Popular' || pack.tag === 'Best Value';

                                        return (
                                            <div key={pack.id}
                                                className={`relative flex items-start gap-5 p-5 rounded-2xl border transition-all hover:shadow-md group ${
                                                    isUltimate ? 'bg-[#111] text-white border-gray-800' : 'bg-[var(--card)] border-[var(--border)] hover:border-gray-300'
                                                }`}>
                                                {pack.tag && (
                                                    <div className={`absolute -top-2.5 right-5 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full shadow-sm ${
                                                        isUltimate ? 'bg-white text-black' :
                                                        pack.tag === 'Popular' ? 'bg-[#1a1a1a] text-white' :
                                                        pack.tag === 'Best Value' ? 'bg-green-500 text-white' :
                                                        'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {pack.tag}
                                                    </div>
                                                )}

                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                                                    isUltimate ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-100'
                                                }`}>
                                                    <pack.icon className={`w-6 h-6 ${isUltimate ? 'text-white' : 'text-[var(--foreground)]'}`} stroke={1.5} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between mb-1">
                                                        <h3 className="text-base font-bold">{pack.name}</h3>
                                                        <div className="flex items-baseline gap-0.5 shrink-0">
                                                            <span className="text-xs font-bold opacity-50">$</span>
                                                            <span className="text-2xl font-black">{pack.price}</span>
                                                        </div>
                                                    </div>
                                                    <p className={`text-xs mb-3 ${isUltimate ? 'text-gray-400' : 'text-gray-500'}`}>{pack.desc}</p>

                                                    <button
                                                        onClick={() => handleCheckout(pack.id)}
                                                        disabled={checkoutLoading === pack.id}
                                                        className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all
                                                            ${checkoutLoading === pack.id ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                                                            ${isUltimate ? 'bg-white text-black hover:bg-gray-200' :
                                                              isPopular ? 'bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 shadow-sm' :
                                                              'bg-gray-50 text-[var(--foreground)] hover:bg-gray-200 border border-[var(--border)]'
                                                            }
                                                        `}>
                                                        {checkoutLoading === pack.id ? (
                                                            <span className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                                                        ) : (
                                                            <>Get Started <IconArrowRight className="w-3.5 h-3.5" /></>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ═══ SUPPORT ═══ */}
                    {activeTab === "support" && (
                        <motion.div key="support" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}
                            className="space-y-6">

                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 md:p-8 shadow-sm">
                                <h3 className="text-base font-bold mb-4">Get in Touch</h3>
                                <div className="space-y-4">
                                    <a href="mailto:support@perricheno.ru" className="flex items-center gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border)] hover:border-gray-400 transition-all group">
                                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <IconMail className="w-5 h-5 text-gray-600" stroke={1.5} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">Email Support</p>
                                            <p className="text-xs text-gray-500">support@perricheno.ru</p>
                                        </div>
                                        <IconArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:translate-x-1 transition-transform" />
                                    </a>

                                    <a href="https://t.me/perricheno" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-[var(--background)] rounded-xl border border-[var(--border)] hover:border-gray-400 transition-all group">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.999-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold">Telegram</p>
                                            <p className="text-xs text-gray-500">@perricheno</p>
                                        </div>
                                        <IconArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:translate-x-1 transition-transform" />
                                    </a>
                                </div>
                            </div>

                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 md:p-8 shadow-sm">
                                <h3 className="text-base font-bold mb-4">Legal</h3>
                                <div className="flex flex-col gap-2">
                                    <a href="#" className="text-sm text-gray-500 hover:text-[var(--foreground)] transition-colors py-2 flex items-center justify-between">
                                        Terms of Service <IconArrowRight className="w-3.5 h-3.5" />
                                    </a>
                                    <a href="#" className="text-sm text-gray-500 hover:text-[var(--foreground)] transition-colors py-2 flex items-center justify-between">
                                        Privacy Policy <IconArrowRight className="w-3.5 h-3.5" />
                                    </a>
                                    <a href="#" className="text-sm text-gray-500 hover:text-[var(--foreground)] transition-colors py-2 flex items-center justify-between">
                                        Usage Policy <IconArrowRight className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
