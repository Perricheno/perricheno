"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import {
    IconCreditCard, IconDatabase, IconChartBar, IconReceipt,
    IconSparkles, IconLogin, IconClock, IconTrendingUp,
    IconFileText, IconPackage, IconFlame, IconStar,
    IconArrowRight, IconBolt
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

// ── Fake transaction history for UI ──
function generateFakeTransactions() {
    const types = ['Daily quota reset', 'Report generated', 'Visual generated', 'Purchased tokens', 'Research completed'];
    const amounts = ['-12,400 chars', '-34,200 chars', '-5,800 chars', '+500,000 chars', '-88,100 chars'];
    const statuses = ['completed', 'completed', 'completed', 'completed', 'completed'];
    const result = [];
    const now = Date.now();
    for (let i = 0; i < 8; i++) {
        const date = new Date(now - i * 3600000 * (3 + Math.random() * 8));
        result.push({
            id: `txn_${i}`,
            type: types[i % types.length],
            amount: amounts[i % amounts.length],
            status: statuses[i % statuses.length],
            date: date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        });
    }
    return result;
}

// ── Usage chart bar component ──
function UsageBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = Math.min(100, (value / max) * 100);
    return (
        <div className="flex items-end gap-2 flex-1 min-w-0">
            <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-28 bg-gray-100 rounded-xl relative overflow-hidden flex items-end">
                    <div
                        className="w-full rounded-xl transition-all duration-1000 ease-out"
                        style={{ height: `${Math.max(4, pct)}%`, backgroundColor: color }}
                    />
                </div>
                <span className="text-[10px] font-bold text-gray-400 truncate w-full text-center">{label}</span>
            </div>
        </div>
    );
}

export default function BillingsPage() {
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const [limits, setLimits] = useState<any>(null);
    const [fullUser, setFullUser] = useState<any>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | 'chars' | 'reports' | 'combo'>('all');
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

    const transactions = useMemo(() => generateFakeTransactions(), []);

    useEffect(() => {
        if (user) {
            fetch("/api/auth/me")
                .then(r => r.json())
                .then(d => { setLimits(d.limits); setFullUser(d.user); });
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
            const data = await res.json();
            if (data.url) window.open(data.url, '_blank');
            else if (data.fallback_url) window.open(data.fallback_url, '_blank');
            else alert('Checkout failed: ' + (data.error || 'Unknown error'));
        } catch {
            alert('Checkout error.');
        } finally {
            setCheckoutLoading(null);
        }
    };

    const filteredPacks = PACKS.filter(p => activeFilter === 'all' || p.category === activeFilter);

    // Simulated hourly usage data for graph
    const hourlyData = useMemo(() => {
        const hours = [];
        for (let i = 23; i >= 0; i--) {
            const h = (new Date().getHours() - i + 24) % 24;
            hours.push({
                label: `${h}:00`,
                value: Math.floor(Math.random() * 15000) + 500,
            });
        }
        return hours;
    }, []);

    const maxHourly = Math.max(...hourlyData.map(h => h.value));

    return (
        <div className="w-full h-full font-sans overflow-auto bg-[var(--background)]">
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-4xl mx-auto px-6 py-12 md:py-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-1">Billings & Usage</h1>
                <p className="text-gray-500 mb-10 font-medium">Monitor your resources, track usage, and purchase tokens.</p>

                <div className="space-y-10">

                    {/* ━━━━ Quotas Overview ━━━━ */}
                    {fullUser && limits ? (
                        <section>
                            <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                                <IconDatabase className="w-4 h-4" /> Current Quotas
                            </h2>
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-8 shadow-sm">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    {/* Daily chars */}
                                    <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Daily Characters</span>
                                            <span className="text-xs font-bold text-gray-500">{((fullUser.daily_chars_used || 0) / 1000).toFixed(0)}K / {(limits.free.daily_chars / 1000).toFixed(0)}K</span>
                                        </div>
                                        <div className="w-full bg-[var(--border)] h-2.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${
                                                    (fullUser.daily_chars_used / limits.free.daily_chars) > 0.9 ? 'bg-red-500' :
                                                    (fullUser.daily_chars_used / limits.free.daily_chars) > 0.7 ? 'bg-orange-400' : 'bg-[#1a1a1a]'
                                                }`}
                                                style={{ width: `${Math.min(100, (fullUser.daily_chars_used / limits.free.daily_chars) * 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Weekly chars */}
                                    <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Weekly Characters</span>
                                            <span className="text-xs font-bold text-gray-500">{((fullUser.weekly_chars_used || 0) / 1000).toFixed(0)}K / {(limits.free.weekly_chars / 1000).toFixed(0)}K</span>
                                        </div>
                                        <div className="w-full bg-[var(--border)] h-2.5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${
                                                    (fullUser.weekly_chars_used / limits.free.weekly_chars) > 0.9 ? 'bg-red-500' : 'bg-[#1a1a1a]'
                                                }`}
                                                style={{ width: `${Math.min(100, ((fullUser.weekly_chars_used || 0) / limits.free.weekly_chars) * 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Purchased Tokens */}
                                    <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Purchased Roll-Over</span>
                                        <div className="flex items-baseline gap-3 mt-1">
                                            <span className="text-2xl font-black text-green-600">{((fullUser.purchased_chars || 0) / 1000).toFixed(0)}K</span>
                                            <span className="text-xs font-medium text-gray-400">chars</span>
                                            <span className="text-xl font-black text-green-600 ml-auto">{fullUser.purchased_reports || 0}</span>
                                            <span className="text-xs font-medium text-gray-400">reports</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section>
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-12 shadow-sm text-center">
                                <IconLogin className="w-10 h-10 mx-auto text-gray-300 mb-4" />
                                <p className="text-sm font-medium text-gray-500 mb-6">Sign in to view your usage and purchase tokens.</p>
                                <button onClick={() => setShowLogin(true)}
                                    className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#1a1a1a] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-colors shadow-xl">
                                    <IconLogin className="w-4 h-4" /> Sign In
                                </button>
                            </div>
                        </section>
                    )}

                    {/* ━━━━ Usage Chart (Hourly) ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                            <IconChartBar className="w-4 h-4" /> Usage Over 24h
                        </h2>
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 shadow-sm">
                            <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
                                {hourlyData.map((h, i) => {
                                    const pct = (h.value / maxHourly) * 100;
                                    const isNow = i === hourlyData.length - 1;
                                    return (
                                        <div key={i} className="flex-1 min-w-[14px] flex flex-col items-center gap-1 group relative">
                                            {/* Tooltip */}
                                            <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                                                {(h.value / 1000).toFixed(1)}K chars
                                            </div>
                                            <div
                                                className={`w-full rounded-lg transition-all duration-500 ${isNow ? 'bg-[#1a1a1a]' : 'bg-gray-200 group-hover:bg-gray-400'}`}
                                                style={{ height: `${Math.max(4, pct)}%` }}
                                            />
                                            {i % 4 === 0 && (
                                                <span className="text-[8px] font-bold text-gray-300 mt-1">{h.label}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* ━━━━ Transaction History ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                            <IconReceipt className="w-4 h-4" /> Recent Activity
                        </h2>
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] overflow-hidden shadow-sm">
                            <div className="divide-y divide-[var(--border)]">
                                {transactions.map((tx) => (
                                    <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-black/[0.02] transition-colors">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tx.amount.startsWith('+') ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                                {tx.amount.startsWith('+') ? <IconTrendingUp className="w-4 h-4" /> : <IconClock className="w-4 h-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate">{tx.type}</p>
                                                <p className="text-[11px] text-gray-400 font-medium">{tx.date}</p>
                                            </div>
                                        </div>
                                        <span className={`text-sm font-black tabular-nums whitespace-nowrap ${tx.amount.startsWith('+') ? 'text-green-600' : 'text-gray-500'}`}>
                                            {tx.amount}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ━━━━ Resource Packs Store ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                            <IconCreditCard className="w-4 h-4" /> Buy Resource Packs
                        </h2>

                        {/* Category Filter */}
                        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
                            {[
                                { id: 'all' as const, label: 'All Packs' },
                                { id: 'chars' as const, label: 'Characters' },
                                { id: 'reports' as const, label: 'Reports' },
                                { id: 'combo' as const, label: 'Bundles' },
                            ].map(f => (
                                <button key={f.id} onClick={() => setActiveFilter(f.id)}
                                    className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                        activeFilter === f.id
                                            ? 'bg-[#1a1a1a] text-white shadow-lg'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}>
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPacks.map(pack => {
                                const isUltimate = pack.tag === 'Ultimate';
                                return (
                                    <button
                                        key={pack.id}
                                        onClick={() => handleCheckout(pack.id)}
                                        disabled={checkoutLoading === pack.id}
                                        className={`group relative text-left rounded-3xl p-6 border transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer w-full ${
                                            isUltimate
                                                ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white hover:shadow-black/30'
                                                : 'bg-white border-gray-200 hover:border-black'
                                        }`}
                                    >
                                        {pack.tag && (
                                            <span className={`absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                                                isUltimate ? 'bg-white/20 text-white' :
                                                pack.tag === 'Popular' ? 'bg-amber-100 text-amber-700' :
                                                pack.tag === 'Best Value' ? 'bg-green-100 text-green-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>{pack.tag}</span>
                                        )}
                                        <pack.icon className={`w-7 h-7 mb-4 ${isUltimate ? 'text-white/60' : 'text-gray-400'}`} stroke={1.5} />
                                        <h3 className="text-base font-black mb-1">{pack.name}</h3>
                                        <p className={`text-xs font-medium mb-5 ${isUltimate ? 'text-gray-400' : 'text-gray-400'}`}>{pack.desc}</p>
                                        <div className={`flex items-center justify-between text-[10px] font-black uppercase tracking-widest py-3 px-4 rounded-xl transition-colors ${
                                            isUltimate
                                                ? 'bg-white text-black group-hover:bg-gray-100'
                                                : 'bg-[#1a1a1a] text-white group-hover:bg-black'
                                        }`}>
                                            <span>${pack.price}</span>
                                            <IconArrowRight className="w-3.5 h-3.5" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
