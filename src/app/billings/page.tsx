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

// Real transaction data is now loaded from API.

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

    const [transactions, setTransactions] = useState<any[]>([]);
    const [hourlyData, setHourlyData] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            fetch("/api/auth/me")
                .then(r => r.json())
                .then(d => { setLimits(d.limits); setFullUser(d.user); });

            fetch("/api/billing/stats")
                .then(r => r.json())
                .then(d => {
                    if (d.transactions) setTransactions(d.transactions);
                    if (d.hourlyData) setHourlyData(d.hourlyData);
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
            
            const rawText = await res.text();
            let data;
            try {
                data = JSON.parse(rawText);
            } catch (parseErr) {
                console.error("Server crashed and returned HTML instead of JSON:", rawText.slice(0, 500));
                window.location.assign("https://pay.cryptocloud.plus/pos/gTEj6wIpQ46vKqaH");
                return;
            }

            if (data.url) {
                window.location.assign(data.url);
            } else if (data.fallback_url) {
                window.location.assign(data.fallback_url);
            } else {
                alert('Checkout failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err: any) {
            console.error("Checkout fetch failed:", err);
            alert(`Checkout error: ${err.message || 'Unknown network error. Check console.'}`);
        } finally {
            setCheckoutLoading(null);
        }
    };

    const filteredPacks = PACKS.filter(p => activeFilter === 'all' || p.category === activeFilter);

    const maxHourly = Math.max(...hourlyData.map(h => h?.value || 0), 100); // minimum scale

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
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tx.is_positive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                                {tx.is_positive ? <IconTrendingUp className="w-4 h-4" /> : <IconClock className="w-4 h-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate">{tx.type}</p>
                                                <p className="text-[11px] text-gray-400 font-medium">{tx.date}</p>
                                            </div>
                                        </div>
                                        <span className={`text-sm font-black tabular-nums whitespace-nowrap ${tx.is_positive ? 'text-green-600' : 'text-gray-500'}`}>
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

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {filteredPacks.map(pack => {
                                const isUltimate = pack.tag === 'Ultimate';
                                const isPopular = pack.tag === 'Popular' || pack.tag === 'Best Value';
                                
                                return (
                                    <div key={pack.id} className="relative group">
                                        {/* Hover glow effect behind the card */}
                                        <div className={`absolute -inset-0.5 rounded-[32px] blur opacity-0 group-hover:opacity-100 transition duration-500 ${isUltimate ? 'bg-gradient-to-br from-gray-500 to-black' : isPopular ? 'bg-gradient-to-br from-gray-300 to-gray-400' : 'bg-gray-200'}`}></div>
                                        
                                        <div className={`relative h-full flex flex-col rounded-[28px] p-7 transition-all duration-300 ${isUltimate ? 'bg-[#111] text-white border border-[#222]' : 'bg-white text-black border border-[var(--border)] group-hover:border-gray-300'}`}>
                                            {/* Tag */}
                                            {pack.tag && (
                                                <div className={`absolute -top-3 left-7 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm ${
                                                    isUltimate ? 'bg-white text-black' : 
                                                    pack.tag === 'Popular' ? 'bg-[#1a1a1a] text-white' : 
                                                    pack.tag === 'Best Value' ? 'bg-green-500 text-white' : 
                                                    'bg-gray-100 text-gray-500 border border-gray-200'
                                                }`}>
                                                    {pack.tag}
                                                </div>
                                            )}

                                            <div className="flex items-start justify-between mb-6 pt-2">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${isUltimate ? 'bg-white/10 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
                                                    <pack.icon className={`w-6 h-6 ${isUltimate ? 'text-white' : 'text-gray-700'}`} stroke={1.5} />
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-3xl font-black tracking-tighter ${isUltimate ? 'text-white' : 'text-black'}`}>${pack.price}</span>
                                                    <span className={`block text-[10px] font-bold uppercase tracking-widest ${isUltimate ? 'text-gray-400' : 'text-gray-400'}`}>One-time</span>
                                                </div>
                                            </div>

                                            <div className="mb-6 flex-1">
                                                <h3 className="text-xl font-black mb-2">{pack.name}</h3>
                                                <p className={`text-xs font-semibold leading-relaxed ${isUltimate ? 'text-gray-400' : 'text-gray-500'}`}>{pack.desc}</p>
                                                
                                                {/* Perks */}
                                                <ul className="mt-5 space-y-2.5">
                                                    {pack.category === 'chars' || pack.category === 'combo' ? (
                                                        <li className="flex items-center gap-2 text-xs font-bold">
                                                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isUltimate ? 'bg-white/20' : 'bg-green-100 text-green-600'}`}>
                                                                <IconArrowRight className="w-2.5 h-2.5" stroke={4} />
                                                            </div>
                                                            <span className={isUltimate ? 'text-gray-300' : 'text-gray-600'}>{pack.desc.split('+')[0]}</span>
                                                        </li>
                                                    ) : null}
                                                    {pack.category === 'reports' || pack.category === 'combo' ? (
                                                        <li className="flex items-center gap-2 text-xs font-bold">
                                                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isUltimate ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                                                                <IconArrowRight className="w-2.5 h-2.5" stroke={4} />
                                                            </div>
                                                            <span className={isUltimate ? 'text-gray-300' : 'text-gray-600'}>Full Academic Reports</span>
                                                        </li>
                                                    ) : null}
                                                    <li className="flex items-center gap-2 text-xs font-bold">
                                                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isUltimate ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>
                                                            <IconArrowRight className="w-2.5 h-2.5" stroke={4} />
                                                        </div>
                                                        <span className={isUltimate ? 'text-gray-300' : 'text-gray-500'}>Tokens Roll-over</span>
                                                    </li>
                                                </ul>
                                            </div>

                                            <button
                                                onClick={() => handleCheckout(pack.id)}
                                                disabled={checkoutLoading === pack.id}
                                                className={`w-full py-4 mt-2 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                                    checkoutLoading === pack.id ? 'opacity-50 cursor-not-allowed' : ''
                                                } ${
                                                    isUltimate ? 'bg-white text-black hover:bg-gray-200 shadow-xl' : 
                                                    isPopular ? 'bg-black text-white hover:bg-gray-800 shadow-xl' : 
                                                    'bg-gray-100 text-black hover:bg-gray-200'
                                                }`}
                                            >
                                                {checkoutLoading === pack.id ? (
                                                    <span className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                                                ) : (
                                                    <>BUY NOW <IconArrowRight className="w-4 h-4 shrink-0" /></>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
