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
    const maxHourly = Math.max(...hourlyData.map(h => h?.value || 0), 100);

    return (
        <div className="w-full h-full font-sans overflow-auto bg-[var(--background)] selection:bg-black selection:text-white">
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 md:py-20">
                {/* ━━━━ Header Section ━━━━ */}
                <header className="mb-12 md:mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-[var(--border)] rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 shadow-sm">
                                <IconCreditCard className="w-3 h-3" /> Billing Dashboard
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[var(--foreground)]">
                                Credits & <span className="text-gray-400">Usage</span>
                            </h1>
                            <p className="mt-4 text-sm md:text-base font-medium text-gray-500 max-w-lg leading-relaxed">
                                Manage your global resource balance, monitor real-time AI consumption, and scale your limits as needed.
                            </p>
                        </div>
                        {fullUser && (
                            <div className="hidden md:flex items-center gap-3 p-2 bg-white border border-[var(--border)] rounded-2xl shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white font-black text-xs uppercase">
                                    {(fullUser.username || "U").slice(0, 2)}
                                </div>
                                <div className="pr-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Logged in as</p>
                                    <p className="text-sm font-bold text-black">{fullUser.username}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-12 gap-6 md:gap-8">
                    
                    {/* ━━━━ Left Column: Quotas & Chart ━━━━ */}
                    <div className="col-span-12 lg:col-span-8 space-y-8 md:space-y-12">
                        
                        {/* ━━ Quotas ━━ */}
                        {fullUser && limits ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                                {/* Daily Card */}
                                <div className="group relative bg-white border border-[var(--border)] rounded-[32px] p-6 md:p-8 overflow-hidden shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
                                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform duration-500 text-black">
                                        <IconBolt className="w-16 h-16" stroke={1} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Daily Capacity</p>
                                        <h3 className="text-2xl font-black mb-6">Real-time <span className="text-gray-400">Burst</span></h3>
                                        
                                        <div className="space-y-4">
                                            <div className="flex items-end justify-between">
                                                <span className="text-3xl font-black tabular-nums">
                                                    {((fullUser.daily_chars_used || 0) / 1000).toFixed(0)}K
                                                    <span className="text-sm font-bold text-gray-300 ml-1">/ {(limits.free.daily_chars / 1000).toFixed(0)}K</span>
                                                </span>
                                                <span className="text-xs font-black text-gray-400 uppercase">Used today</span>
                                            </div>
                                            <div className="h-3 w-full bg-gray-50 border border-gray-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-black rounded-full transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)]" 
                                                    style={{ width: `${Math.min(100, ((fullUser.daily_chars_used || 0) / (limits.free.daily_chars || 1)) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Purchased Card */}
                                <div className="group relative bg-[#1a1a1a] text-white border border-black rounded-[32px] p-6 md:p-8 overflow-hidden shadow-2xl transition-all hover:-translate-y-1 hover:brightness-110">
                                    <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:rotate-12 transition-transform duration-500">
                                        <IconDatabase className="w-16 h-16" stroke={1} />
                                    </div>
                                    <div className="relative z-10">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Roll-over Storage</p>
                                        <h3 className="text-2xl font-black mb-6">Permanent <span className="text-gray-500">Buffer</span></h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-2xl font-black tabular-nums text-green-400">{((fullUser.purchased_chars || 0) / 1000).toFixed(0)}K</p>
                                                <p className="text-[10px] font-black uppercase text-gray-500">Chars available</p>
                                            </div>
                                            <div className="border-l border-white/10 pl-4">
                                                <p className="text-2xl font-black tabular-nums text-blue-400">{fullUser.purchased_reports || 0}</p>
                                                <p className="text-[10px] font-black uppercase text-gray-500">Reports left</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white border border-[var(--border)] rounded-[32px] p-12 text-center shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <IconReceipt className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                                <h3 className="text-xl font-black mb-2">Connect Your Account</h3>
                                <p className="text-sm font-medium text-gray-500 mb-8 max-w-xs mx-auto">Sign in to track your usage history and unlock permanent credit packs.</p>
                                <button onClick={() => setShowLogin(true)} className="px-10 py-4 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-all active:scale-95 shadow-xl">
                                    Authorize Access
                                </button>
                            </div>
                        )}

                    </div>

                    {/* ━━━━ Right Column: Transactions ━━━━ */}
                    <div className="col-span-12 lg:col-span-4 animate-in fade-in slide-in-from-right-4 duration-700 delay-300">
                        <section className="bg-white border border-[var(--border)] rounded-[32px] overflow-hidden shadow-sm h-full flex flex-col">
                            <div className="p-8 border-b border-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-black">
                                        <IconReceipt className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-lg font-black">Timeline</h3>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto max-h-[500px] lg:max-h-none divide-y divide-gray-50">
                                {transactions.length > 0 ? transactions.map((tx) => (
                                    <div key={tx.id} className="flex items-center justify-between px-8 py-5 hover:bg-gray-50/50 transition-colors group">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${tx.is_positive ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-400'}`}>
                                                {tx.is_positive ? <IconTrendingUp className="w-4 h-4" /> : <IconClock className="w-4 h-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-bold truncate text-black">{tx.type}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{tx.date}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[13px] font-black tabular-nums whitespace-nowrap px-3 py-1 rounded-lg ${tx.is_positive ? 'bg-green-50 text-green-600' : 'text-gray-400'}`}>
                                            {tx.amount}
                                        </span>
                                    </div>
                                )) : (
                                    <div className="p-12 text-center">
                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Quiet in here...</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-gray-50/50 border-t border-gray-100">
                                <button className="w-full py-4 bg-white border border-[var(--border)] rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-all active:scale-95 shadow-sm">
                                    Export Activity Log
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* ━━━━ Marketplace Section ━━━━ */}
                    <div className="col-span-12 mt-12 md:mt-16">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                            <div>
                                <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Resource <span className="text-gray-400">Packs</span></h2>
                                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {[
                                        { id: 'all' as const, label: 'All Store' },
                                        { id: 'chars' as const, label: 'Characters' },
                                        { id: 'reports' as const, label: 'Reports' },
                                        { id: 'combo' as const, label: 'Bundles' },
                                    ].map(f => (
                                        <button key={f.id} onClick={() => setActiveFilter(f.id)}
                                            className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap shadow-sm border ${
                                                activeFilter === f.id
                                                    ? 'bg-black text-white border-black ring-4 ring-black/5'
                                                    : 'bg-white text-gray-400 border-[var(--border)] hover:border-gray-400'
                                            }`}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="hidden md:flex items-center gap-3 px-4 py-3 bg-white border border shadow-sm rounded-2xl">
                                <IconCreditCard className="w-4 h-4 text-gray-400" />
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Powered by <span className="text-black">CryptoCloud</span></span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
                            {filteredPacks.map(pack => {
                                const isUltimate = pack.tag === 'Ultimate';
                                const isPopular = pack.tag === 'Popular' || pack.tag === 'Best Value';
                                
                                return (
                                    <div key={pack.id} className="group relative">
                                        <div className={`absolute -inset-px rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${isUltimate ? 'bg-gradient-to-br from-gray-500/20 to-black/20' : 'bg-gray-100'}`}></div>
                                        
                                        <div className={`relative h-full flex flex-col rounded-[32px] p-8 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-2 border
                                            ${isUltimate ? 'bg-[#111] text-white border-gray-800' : 'bg-white text-black border-[var(--border)] group-hover:border-gray-300'}
                                        `}>
                                            {pack.tag && (
                                                <div className={`absolute -top-3 left-8 px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg ${
                                                    isUltimate ? 'bg-white text-black shadow-white/10' : 
                                                    pack.tag === 'Popular' ? 'bg-[#1a1a1a] text-white' : 
                                                    pack.tag === 'Best Value' ? 'bg-green-500 text-white' : 
                                                    'bg-gray-50 text-gray-400 border'
                                                }`}>
                                                    {pack.tag}
                                                </div>
                                            )}

                                            <div className="flex items-start justify-between mb-8">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors group-hover:scale-110 duration-500 ${isUltimate ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                                    <pack.icon className={`w-7 h-7 ${isUltimate ? 'text-white' : 'text-black'}`} stroke={1.5} />
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-start justify-end gap-0.5">
                                                        <span className="text-sm font-black mt-1 opacity-50">$</span>
                                                        <span className={`text-4xl font-black tracking-tighter ${isUltimate ? 'text-white' : 'text-black'}`}>{pack.price}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mb-8 flex-1">
                                                <h3 className="text-2xl font-black mb-2 tracking-tight">{pack.name}</h3>
                                                <p className={`text-xs font-bold leading-relaxed mb-6 ${isUltimate ? 'text-gray-400' : 'text-gray-500'}`}>{pack.desc}</p>
                                                
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${isUltimate ? 'bg-white/10 text-white' : 'bg-gray-50 text-black'}`}>
                                                            <IconArrowRight className="w-3 h-3" stroke={3} />
                                                        </div>
                                                        <span className={`text-[11px] font-bold ${isUltimate ? 'text-gray-300' : 'text-gray-600'}`}>Roll-over credits</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${isUltimate ? 'bg-white/10 text-white' : 'bg-gray-50 text-black'}`}>
                                                            <IconArrowRight className="w-3 h-3" stroke={3} />
                                                        </div>
                                                        <span className={`text-[11px] font-bold ${isUltimate ? 'text-gray-300' : 'text-gray-600'}`}>API priority access</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleCheckout(pack.id)}
                                                disabled={checkoutLoading === pack.id}
                                                className={`w-full py-5 rounded-[22px] flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] transition-all
                                                    ${checkoutLoading === pack.id ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                                                    ${isUltimate ? 'bg-white text-black hover:bg-gray-200 shadow-xl shadow-white/5' : 
                                                      isPopular ? 'bg-black text-white hover:bg-gray-800 shadow-xl' : 
                                                      'bg-gray-50 text-black hover:bg-gray-200'
                                                    }
                                                `}
                                            >
                                                {checkoutLoading === pack.id ? (
                                                    <span className="w-4 h-4 border-[3px] border-current border-t-transparent animate-spin rounded-full" />
                                                ) : (
                                                    <>Get Started <IconArrowRight className="w-4 h-4" /></>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                
                {/* ━━━━ Footer Help ━━━━ */}
                <footer className="mt-20 pt-12 border-t border-[var(--border)] text-center animate-in fade-in duration-1000">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4">Enterprise Billing Support</p>
                    <div className="flex items-center justify-center gap-6">
                        <a href="mailto:support@perricheno.ru" className="text-xs font-bold text-gray-500 hover:text-black transition-colors">Contact Support</a>
                        <span className="text-gray-200">/</span>
                        <a href="#" className="text-xs font-bold text-gray-500 hover:text-black transition-colors">Terms of Service</a>
                        <span className="text-gray-200">/</span>
                        <a href="#" className="text-xs font-bold text-gray-500 hover:text-black transition-colors">Usage Policy</a>
                    </div>
                </footer>
            </div>
        </div>
    );
}
