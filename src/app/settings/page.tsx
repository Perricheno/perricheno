"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import { motion } from "framer-motion";
import {
    IconBolt, IconDatabase, IconReceipt, IconFileText,
    IconPackage, IconFlame, IconStar, IconArrowRight,
    IconTrendingUp, IconClock, IconLogin, IconCreditCard,
    IconSparkles, IconMail, IconArrowLeft
} from "@tabler/icons-react";

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

export default function SettingsPage() {
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
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
                display_date: new Date(t.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            });
        });
        return items.sort((a, b) => b._time - a._time);
    }, [transactions, receipts]);

    const dailyUsed = fullUser?.daily_chars_used || 0;
    const dailyLimit = limits?.free?.daily_chars || 100000;
    const purchasedChars = fullUser?.purchased_chars || 0;
    const purchasedReports = fullUser?.purchased_reports || 0;

    return (
        <div className="w-full h-full font-sans overflow-auto pb-24 md:pb-0">
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-[1200px] mx-auto px-6 py-12 md:py-24">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col">

                    {/* ━━ Hero ━━ */}
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
                        Credits & Usage
                    </h1>
                    <p className="text-lg text-gray-500 mb-10 max-w-xl">
                        Monitor your consumption, purchase resource packs, and manage your account.
                    </p>

                    {/* ━━ Usage Cards ━━ */}
                    {user && fullUser && limits ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                            {/* Daily Usage */}
                            <div className="group relative bg-[var(--card)] p-6 border border-[var(--border)] rounded-[var(--radius)] transition-all hover:shadow-md h-44 flex flex-col justify-between overflow-hidden">
                                <div className="flex justify-between items-start">
                                    <div className="p-2.5 bg-black/5 rounded-lg group-hover:scale-110 transition-transform">
                                        <IconBolt className="w-6 h-6 stroke-[1.5]" />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Today</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Daily Usage</p>
                                    <p className="text-3xl font-black tabular-nums tracking-tight">
                                        {(dailyUsed / 1000).toFixed(0)}K
                                        <span className="text-sm font-bold text-gray-300 ml-1">/ {(dailyLimit / 1000).toFixed(0)}K</span>
                                    </p>
                                    <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-[var(--foreground)] rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (dailyUsed / dailyLimit) * 100)}%` }} />
                                    </div>
                                </div>
                            </div>

                            {/* Purchased Characters */}
                            <div className="group relative bg-[#111] text-white p-6 border border-transparent rounded-[var(--radius)] transition-all hover:shadow-lg h-44 flex flex-col justify-between overflow-hidden">
                                <div className="flex justify-between items-start">
                                    <div className="p-2.5 bg-white/10 rounded-lg group-hover:scale-110 transition-transform">
                                        <IconDatabase className="w-6 h-6 stroke-[1.5]" />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Roll-over</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Character Balance</p>
                                    <p className="text-3xl font-black tabular-nums tracking-tight text-green-400">
                                        {(purchasedChars / 1000).toFixed(0)}K
                                    </p>
                                </div>
                            </div>

                            {/* Reports */}
                            <div className="group relative bg-[var(--card)] p-6 border border-[var(--border)] rounded-[var(--radius)] transition-all hover:shadow-md h-44 flex flex-col justify-between overflow-hidden">
                                <div className="flex justify-between items-start">
                                    <div className="p-2.5 bg-black/5 rounded-lg group-hover:scale-110 transition-transform">
                                        <IconFileText className="w-6 h-6 stroke-[1.5]" />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Reports Left</p>
                                    <p className="text-3xl font-black tabular-nums tracking-tight text-blue-600">
                                        {purchasedReports}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : !user ? (
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-12 md:p-16 text-center mb-12">
                            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                                <IconLogin className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Sign in to continue</h3>
                            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">Connect your Telegram account to view usage, purchase credits, and access support.</p>
                            <button onClick={() => setShowLogin(true)} className="px-8 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-95 shadow-md">
                                Sign In
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-4 mb-12">
                            {[0,1,2].map(i => (
                                <div key={i} className="h-44 bg-gray-50 rounded-[var(--radius)] animate-pulse" />
                            ))}
                        </div>
                    )}

                    {/* ━━ Resource Packs ━━ */}
                    <div className="mb-12">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Resource Packs</h2>
                                <div className="flex flex-wrap gap-2 bg-[var(--card)] p-1.5 rounded-[var(--radius)] w-fit border border-[var(--border)] shadow-sm">
                                    {[
                                        { id: 'all' as const, label: 'All' },
                                        { id: 'chars' as const, label: 'Characters' },
                                        { id: 'reports' as const, label: 'Reports' },
                                        { id: 'combo' as const, label: 'Bundles' },
                                    ].map(f => (
                                        <button key={f.id} onClick={() => setActiveFilter(f.id)}
                                            className={`px-4 py-1.5 rounded-[calc(var(--radius)-4px)] text-sm font-medium transition-all ${
                                                activeFilter === f.id
                                                    ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm"
                                                    : "text-gray-500 hover:text-[var(--foreground)] hover:bg-black/5"
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

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPacks.map(pack => {
                                const isUltimate = pack.tag === 'Ultimate';
                                const isPopular = pack.tag === 'Popular' || pack.tag === 'Best Value';

                                return (
                                    <div key={pack.id}
                                        className={`group relative bg-[var(--card)] p-6 border border-[var(--border)] hover:border-gray-300 rounded-[var(--radius)] transition-all hover:shadow-md h-44 flex flex-col justify-between overflow-hidden ${
                                            isUltimate ? '!bg-[#111] !text-white !border-gray-800' : ''
                                        }`}>
                                        {pack.tag && (
                                            <div className={`absolute -top-0 right-5 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-b-lg shadow-sm ${
                                                isUltimate ? 'bg-white text-black' :
                                                pack.tag === 'Popular' ? 'bg-[#1a1a1a] text-white' :
                                                pack.tag === 'Best Value' ? 'bg-green-500 text-white' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {pack.tag}
                                            </div>
                                        )}

                                        <div className="flex justify-between items-start">
                                            <div className={`p-2.5 rounded-lg group-hover:scale-110 transition-transform ${
                                                isUltimate ? 'bg-white/10' : 'bg-black/5'
                                            }`}>
                                                <pack.icon className={`w-6 h-6 stroke-[1.5] ${isUltimate ? 'text-white' : ''}`} />
                                            </div>
                                            <div className="flex items-baseline gap-0.5">
                                                <span className="text-xs font-bold opacity-40">$</span>
                                                <span className="text-2xl font-black">{pack.price}</span>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-base font-semibold mb-0.5">{pack.name}</h3>
                                            <p className={`text-sm mb-3 ${isUltimate ? 'text-gray-400' : 'text-gray-500'}`}>{pack.desc}</p>
                                            <button
                                                onClick={() => handleCheckout(pack.id)}
                                                disabled={checkoutLoading === pack.id}
                                                className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all
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

                    {/* ━━ Transaction History ━━ */}
                    {user && (
                        <div className="mb-12">
                            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">History</h2>

                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] shadow-sm overflow-hidden">
                                <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
                                    {timelineItems.length > 0 ? timelineItems.slice(0, 30).map((item, idx) => (
                                        item.is_receipt ? (
                                            <div key={`r-${item.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-black/[0.02] transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                                                        <IconPackage className="w-4 h-4 text-green-600" stroke={2} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold truncate">{item.pack_name}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.display_date}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="text-sm font-black tabular-nums text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">{item.amount_text}</span>
                                                    <a href={`/api/billing/receipt/${item.id}`} target="_blank" rel="noopener noreferrer"
                                                        className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[var(--foreground)] transition-colors hidden sm:block">
                                                        PDF
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div key={`t-${item.id}-${idx}`} className="flex items-center justify-between px-5 py-4 hover:bg-black/[0.02] transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.is_positive ? 'bg-green-50' : 'bg-gray-50'}`}>
                                                        {item.is_positive ? <IconTrendingUp className="w-4 h-4 text-green-500" /> : <IconClock className="w-4 h-4 text-gray-400" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold truncate">{item.type}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.display_date}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-sm font-bold tabular-nums shrink-0 px-2.5 py-1 rounded-lg ${item.is_positive ? 'text-green-600 bg-green-50' : 'text-gray-400'}`}>
                                                    {item.amount}
                                                </span>
                                            </div>
                                        )
                                    )) : (
                                        <div className="p-16 text-center">
                                            <IconReceipt className="w-10 h-10 mx-auto text-gray-200 mb-3" />
                                            <p className="text-sm text-gray-400">No transactions yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ━━ Account & Support ━━ */}
                    {user && fullUser && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Account */}
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-6 shadow-sm">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white font-black text-sm uppercase shrink-0">
                                        {(fullUser.username || "U").slice(0, 2)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-base font-bold truncate">{fullUser.username || fullUser.first_name || "User"}</p>
                                        <p className="text-xs text-gray-400">{fullUser.is_admin ? "Administrator" : "Member"} · {fullUser.telegram_id ? `TG ${fullUser.telegram_id}` : "Telegram"}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400">
                                    Member since {fullUser.created_at ? new Date(fullUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "—"}
                                </p>
                            </div>

                            {/* Support */}
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-6 shadow-sm">
                                <h3 className="text-base font-bold mb-4">Support</h3>
                                <div className="space-y-2">
                                    <a href="mailto:support@perricheno.ru" className="flex items-center justify-between py-2 text-sm text-gray-500 hover:text-[var(--foreground)] transition-colors">
                                        <span className="flex items-center gap-2"><IconMail className="w-4 h-4" /> support@perricheno.ru</span>
                                        <IconArrowRight className="w-3.5 h-3.5" />
                                    </a>
                                    <a href="https://t.me/perricheno" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between py-2 text-sm text-gray-500 hover:text-[var(--foreground)] transition-colors">
                                        <span className="flex items-center gap-2">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.999-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                                            @perricheno
                                        </span>
                                        <IconArrowRight className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                </motion.div>
            </div>
        </div>
    );
}
