"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconBolt, IconReceipt, IconFileText,
    IconPackage, IconFlame, IconStar, IconArrowRight,
    IconTrendingUp, IconClock, IconLogin, IconCreditCard,
    IconSparkles, IconMail, IconUser, IconChevronRight
} from "@tabler/icons-react";

const PACKS = [
    { id: 'starter_chars', name: 'Starter', desc: '100K Characters', price: 1, tag: null, gradient: 'from-gray-50 to-white', accent: '#666', category: 'chars', icon: IconBolt },
    { id: 'writer', name: 'Writer', desc: '500K Characters', price: 3, tag: null, gradient: 'from-gray-50 to-white', accent: '#444', category: 'chars', icon: IconFileText },
    { id: 'data_scientist', name: 'Data Scientist', desc: '2M Characters', price: 5, tag: 'Popular', gradient: 'from-[#111] to-[#1a1a1a]', accent: '#10b981', category: 'chars', icon: IconSparkles },
    { id: 'researcher', name: 'Researcher', desc: '5M Characters', price: 12, tag: null, gradient: 'from-gray-50 to-white', accent: '#3b82f6', category: 'chars', icon: IconTrendingUp },
    { id: 'combo_lite', name: 'Lite Bundle', desc: '1M Chars + 10 Visuals', price: 7, tag: null, gradient: 'from-gray-50 to-white', accent: '#8b5cf6', category: 'combo', icon: IconPackage },
    { id: 'combo_pro', name: 'Pro Bundle', desc: '10M Chars + 50 Visuals', price: 20, tag: 'Best', gradient: 'from-[#0a0a0a] to-[#111]', accent: '#f59e0b', category: 'combo', icon: IconFlame },
];

export default function SettingsPage() {
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const [limits, setLimits] = useState<any>(null);
    const [fullUser, setFullUser] = useState<any>(null);
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

    return (
        <div className="w-full h-full font-sans overflow-auto pb-24 md:pb-0 bg-[#FBFBFC]">
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-[900px] mx-auto px-5 py-10 md:py-20">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

                    {/* ━━ Header ━━ */}
                    <div className="mb-10">
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1a1a1a] mb-1">Settings</h1>
                        <p className="text-sm text-gray-400">Manage your account and purchase credits.</p>
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
                                    <p className="text-xs text-gray-400">{fullUser.is_admin ? "Admin" : "Member"} · Since {fullUser.created_at ? new Date(fullUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "—"}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Today</p>
                                        <p className="text-sm font-black tabular-nums text-[#1a1a1a]">{(dailyUsed / 1000).toFixed(0)}K <span className="text-gray-300 font-medium">/ {(dailyLimit / 1000).toFixed(0)}K</span></p>
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
                            <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">Connect your Telegram account to view usage and purchase credits.</p>
                            <button onClick={() => setShowLogin(true)} className="px-8 py-3 bg-[#1a1a1a] text-white rounded-xl font-bold text-sm hover:bg-black transition-all active:scale-95 shadow-lg">
                                Sign In
                            </button>
                        </div>
                    ) : (
                        <div className="h-20 bg-gray-50 rounded-2xl animate-pulse mb-8" />
                    )}

                    {/* ━━ Resource Packs ━━ */}
                    <div className="mb-10">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-black tracking-tight text-[#1a1a1a]">Resource Packs</h2>
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-100 shadow-sm rounded-lg">
                                <IconCreditCard className="w-3 h-3 text-gray-400" />
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">CryptoCloud</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {PACKS.map((pack, idx) => {
                                const isDark = pack.gradient.includes('#111') || pack.gradient.includes('#0a0a0a');
                                
                                return (
                                    <motion.div 
                                        key={pack.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05, duration: 0.4 }}
                                        className={`group relative rounded-2xl p-5 cursor-pointer transition-all duration-300 overflow-hidden border ${
                                            isDark 
                                                ? 'bg-gradient-to-br ' + pack.gradient + ' border-gray-800 hover:border-gray-700 shadow-lg hover:shadow-2xl' 
                                                : 'bg-gradient-to-br ' + pack.gradient + ' border-gray-100 hover:border-gray-200 hover:shadow-md'
                                        }`}
                                        onClick={() => handleCheckout(pack.id)}
                                    >
                                        {/* Tag */}
                                        {pack.tag && (
                                            <div className={`absolute top-3 right-3 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md ${
                                                pack.tag === 'Popular' ? 'bg-emerald-500 text-white' :
                                                pack.tag === 'Best' ? 'bg-amber-400 text-black' :
                                                'bg-gray-200 text-gray-600'
                                            }`}>
                                                {pack.tag}
                                            </div>
                                        )}

                                        {/* Icon */}
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${
                                            isDark ? 'bg-white/10' : 'bg-black/5'
                                        }`}>
                                            <pack.icon className={`w-4.5 h-4.5 ${isDark ? 'text-white' : 'text-[#1a1a1a]'}`} stroke={2} />
                                        </div>

                                        {/* Info */}
                                        <div className="mb-4">
                                            <h3 className={`text-base font-bold mb-0.5 ${isDark ? 'text-white' : 'text-[#1a1a1a]'}`}>{pack.name}</h3>
                                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{pack.desc}</p>
                                        </div>

                                        {/* Price & CTA */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-baseline gap-0.5">
                                                <span className={`text-xs font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>$</span>
                                                <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#1a1a1a]'}`}>{pack.price}</span>
                                            </div>
                                            <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-all group-hover:gap-2 ${
                                                isDark ? 'text-gray-400 group-hover:text-white' : 'text-gray-400 group-hover:text-[#1a1a1a]'
                                            }`}>
                                                {checkoutLoading === pack.id ? (
                                                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin rounded-full" />
                                                ) : (
                                                    <>Buy <IconChevronRight className="w-3 h-3" /></>
                                                )}
                                            </div>
                                        </div>

                                        {/* Hover glow for dark cards */}
                                        {isDark && (
                                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                                style={{ background: `radial-gradient(circle at 50% 120%, ${pack.accent}15 0%, transparent 70%)` }} />
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

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
