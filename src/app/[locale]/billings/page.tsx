"use client";

import { useState, useEffect, useMemo } from "react";
import { useAdmin } from "@/components/AdminContext";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { CreditCard, Database, Receipt, Sparkles, LogIn, Clock, TrendingUp, FileText, Package, Flame, Zap, ChevronRight, Mail, Check, Lock } from "lucide-react";

// Guarded date formatting - a bad/unparseable input must never surface the
// literal string "Invalid Date" in the UI (confirmed live in production).
function formatDisplayDate(d: Date): string {
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const PLAN_STATIC = [
    {
        id: "free",
        priceMonthly: 0,
        priceAnnual: 0,
        priceKZT: 0,
        priceKZTAnnual: 0,
        priceRUB: 0,
        priceRUBAnnual: 0,
        tag: null,
        accent: "#666",
        features: [
            { text: "50,000 tokens / week", included: true },
            { text: "150,000 tokens / month (Hard Stop)", included: true },
            { text: "Stack: Basic Python (5 chart types)", included: true },
            { text: "7-day chat retention", included: true },
            { text: "Quota resets: Mon, 00:00 AST", included: true },
            { text: "200K chars PDF staging (24h)", included: true },
            { text: "ZIP Project Export", included: true },
            { text: "R Environment (CRAN)", included: false },
            { text: "AI Code Editing", included: false },
        ]
    },
    {
        id: "plus",
        priceMonthly: 3.99,
        priceAnnual: 39.00,
        priceKZT: 1990,
        priceKZTAnnual: 19900,
        priceRUB: 390,
        priceRUBAnnual: 3900,
        tag: null,
        accent: "#a8a8a8",
        features: [
            { text: "150,000 tokens / week", included: true },
            { text: "450,000 tokens / month", included: true },
            { text: "Stack: Full Python (35+ visualizations)", included: true },
            { text: "ZIP Project Export unlocked", included: true },
            { text: "500K chars PDF staging (24h)", included: true },
            { text: "Priority Rendering", included: true },
            { text: "14-day chat retention", included: true },
            { text: "R Environment", included: false },
            { text: "AI Code Editing", included: false },
        ]
    },
    {
        id: "pro",
        priceMonthly: 7.99,
        priceAnnual: 69.00,
        priceKZT: 3990,
        priceKZTAnnual: 39900,
        priceRUB: 790,
        priceRUBAnnual: 7900,
        tag: "Popular",
        accent: "#10b981",
        features: [
            { text: "250,000 tokens / week", included: true },
            { text: "800,000 tokens / month", included: true },
            { text: "Stack: R-Infrastructure + Python", included: true },
            { text: "AI Code Editor enabled", included: true },
            { text: "1M chars PDF staging (24h)", included: true },
            { text: "Share Reports via link", included: true },
            { text: "Exclusive power giveaways", included: true },
            { text: "30-day chat retention", included: true },
        ]
    },
    {
        id: "ultra",
        priceMonthly: 14.99,
        priceAnnual: 149.00,
        priceKZT: 6990,
        priceKZTAnnual: 69900,
        priceRUB: 1490,
        priceRUBAnnual: 14900,
        tag: "Best Value",
        accent: "#f59e0b",
        features: [
            { text: "800,000 tokens / week (Cap)", included: true },
            { text: "3,000,000 tokens / month", included: true },
            { text: "Unlimited PDF staging (24h)", included: true },
            { text: "AI Edit: Low Cost Mode (Cost ÷ 2)", included: true },
            { text: "2x Bonus on Referrals & Promos", included: true },
            { text: "Maximum Rendering Priority", included: true },
            { text: "All Giveaways & Events", included: true },
            { text: "90-day chat retention", included: true },
        ]
    }
];

export default function BillingsPage() {
    const { user, setShowLogin, setIsEditing } = useAdmin();
    const t = useTranslations("billings");

    const PLANS = PLAN_STATIC.map(p => ({
        ...p,
        name: t(`plans.${p.id}.name` as any),
        desc: t(`plans.${p.id}.desc` as any),
        features: p.features.map((f, i) => ({
            ...f,
            text: t(`plans.${p.id}.features.${i}` as any),
        })),
    }));
    const [limits, setLimits] = useState<any>(null);
    const [fullUser, setFullUser] = useState<any>(null);
    const [stagingUsed, setStagingUsed] = useState(0);
    const [stagingCap, setStagingCap] = useState(200_000);
    const [exchangeRate, setExchangeRate] = useState<number | null>(500);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [receipts, setReceipts] = useState<any[]>([]);
    const [isAnnual, setIsAnnual] = useState(true);
    const [currency, setCurrency] = useState<'kzt' | 'usd' | 'rub'>('kzt');
    useEffect(() => {
        // Fetch real-time USD/KZT exchange rate
        fetch("https://open.er-api.com/v6/latest/USD")
            .then(res => res.json())
            .then(data => {
                if (data?.rates?.KZT) {
                    setExchangeRate(data.rates.KZT);
                }
            }).catch(() => {
                setExchangeRate(495); // Fallback if API fails
            });

        if (user) {
            fetch("/api/auth/me")
                .then(r => r.json())
                .then(d => {
                    setLimits(d.limits);
                    setFullUser(d.user);
                    if (d.stagingUsed !== undefined) setStagingUsed(d.stagingUsed);
                    if (d.stagingCap !== undefined) setStagingCap(d.stagingCap);
                });

            fetch("/api/billing/stats")
                .then(r => r.json())
                .then(d => {
                    if (d.transactions) setTransactions(d.transactions);
                    if (d.receipts) setReceipts(d.receipts);
                });
        }
    }, [user]);

    const handleCheckout = async (planId: string) => {
        if (planId === 'free') return;
        setCheckoutLoading(planId);
        try {
            const interval = isAnnual ? 'year' : 'month';
            const fullPlanId = `${planId}_${interval}`;
            const res = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId: fullPlanId, currency })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Payment failed");
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error("No checkout URL returned");
            }
        } catch (err: any) {
            alert(`Checkout error: ${err.message || 'Unknown'}`);
        } finally {
            setCheckoutLoading(null);
        }
    };

    const timelineItems = useMemo(() => {
        const items: any[] = [];
        receipts.forEach(r => {
            const d = new Date(r.created_at + 'Z');
            items.push({
                ...r, is_receipt: true,
                _time: isNaN(d.getTime()) ? 0 : d.getTime(),
                display_date: formatDisplayDate(d),
            });
        });
        transactions.forEach(t => {
            // t.date is a raw ISO timestamp from /api/billing/stats - format
            // it here, once, rather than re-parsing an already-formatted string.
            const d = new Date(t.date);
            items.push({
                ...t, is_receipt: false,
                _time: isNaN(d.getTime()) ? 0 : d.getTime(),
                display_date: formatDisplayDate(d),
            });
        });
        return items.sort((a, b) => b._time - a._time);
    }, [transactions, receipts]);

    // Determine visual UI limits strictly based on plan (defaults to free tier logic)
    const currentPlanId = fullUser?.plan_tier || 'free';
    const planLimits = {
        free: { weekly: 50000, monthly: 150000 },
        plus: { weekly: 150000, monthly: 450000 },
        pro: { weekly: 250000, monthly: 800000 },
        ultra: { weekly: 800000, monthly: 3000000 }
    }[currentPlanId as 'free'|'plus'|'pro'|'ultra'] || { weekly: 50000, monthly: 150000 };

    const weeklyUsed = fullUser?.weekly_chars_used || 0;
    const weeklyLimit = planLimits.weekly;
    const monthlyUsed = fullUser?.monthly_chars_used || 0;
    const monthlyLimit = planLimits.monthly;

    const purchasedChars = fullUser?.purchased_chars || 0;

    return (
        <div className="w-full h-full font-sans overflow-auto pb-24 md:pb-0 bg-[#FBFBFC]">
            <div className="max-w-[1100px] mx-auto px-5 py-10 md:py-20">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

                    {/* ━━ Header ━━ */}
                    <div className="mb-10 text-center">
                        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#1a1a1a] mb-3">{t("title")}</h1>
                        <p className="text-sm md:text-base text-gray-500">{t("subtitle")}</p>
                    </div>

                    {/* ━━ Usage Overview ━━ */}
                    {user && fullUser && limits ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12 max-w-2xl mx-auto items-stretch">
                            {/* Current Usage */}
                            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between">
                                {/* Weekly usage */}
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-[#1a1a1a]" strokeWidth={2} />
                                            <p className="text-xs font-bold text-[#1a1a1a]">{t("weeklyTokens")}</p>
                                        </div>
                                        <p className="text-xs font-black tabular-nums text-[#1a1a1a]">
                                            {(weeklyUsed / 1000).toFixed(0)}K<span className="text-gray-300 font-medium">/{(weeklyLimit / 1000).toFixed(0)}K</span>
                                        </p>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (weeklyUsed / weeklyLimit) * 100)}%` }} />
                                    </div>
                                    <p className="text-[9px] text-gray-400 mt-1">{t("resetsMonday")}</p>
                                </div>

                                {/* Monthly usage */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-[#1a1a1a]" strokeWidth={2} />
                                            <p className="text-xs font-bold text-[#1a1a1a]">{t("monthlyBalance")}</p>
                                        </div>
                                        <p className="text-xs font-black tabular-nums text-[#1a1a1a]">
                                            {(monthlyUsed / 1000).toFixed(0)}K<span className="text-gray-300 font-medium">/{(monthlyLimit / 1000).toFixed(0)}K</span>
                                        </p>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#1a1a1a] rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (monthlyUsed / monthlyLimit) * 100)}%` }} />
                                    </div>
                                    <p className="text-[9px] text-gray-400 mt-1">{t("stopsWhenDepleted")}</p>
                                </div>

                                {/* PDF Staging */}
                                <div className="border-t border-gray-50 pt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-3.5 h-3.5 text-[#1a1a1a]" strokeWidth={2} />
                                            <p className="text-xs font-bold text-[#1a1a1a]">{t("pdfStaging")}</p>
                                        </div>
                                        <p className="text-xs font-black tabular-nums text-[#1a1a1a]">
                                            {stagingCap === -1 ? (
                                                <span className="text-gray-400 font-medium">{t("unlimited")}</span>
                                            ) : (
                                                <>{(stagingUsed / 1000).toFixed(0)}K<span className="text-gray-300 font-medium">/{(stagingCap / 1000).toFixed(0)}K</span></>
                                            )}
                                        </p>
                                    </div>
                                    {stagingCap !== -1 && (
                                        <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                                            <div className="h-full bg-gray-300 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (stagingUsed / stagingCap) * 100)}%` }} />
                                        </div>
                                    )}
                                    <p className="text-[9px] text-gray-400 mt-1">{t("autoClears")}</p>
                                </div>
                            </div>

                            {/* Legacy Char Balance */}
                            <div className="bg-[#111] rounded-2xl border border-gray-800 p-5 shadow-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                                            <Database className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                                        </div>
                                        <p className="text-xs font-bold text-[#F1F1F3]">{t("legacyCredits")}</p>
                                    </div>
                                    <p className="text-lg font-black tabular-nums text-emerald-400">
                                        {purchasedChars >= 1000000 ? `${(purchasedChars / 1000000).toFixed(1)}M` : `${(purchasedChars / 1000).toFixed(0)}K`}
                                    </p>
                                </div>
                                <p className="text-[10px] text-gray-400">{t("neverExpires")}</p>
                            </div>
                        </div>
                    ) : !user ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-10 md:p-14 text-center mb-12 max-w-2xl mx-auto">
                            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                                <LogIn className="w-7 h-7 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold mb-1.5 text-[#1a1a1a]">{t("signInTitle")}</h3>
                            <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">{t("signInDesc")}</p>
                            <button onClick={() => setShowLogin(true)} className="px-8 py-3 bg-[#1a1a1a] text-white rounded-xl font-bold text-sm hover:bg-black transition-all active:scale-95 shadow-lg">
                                {t("signIn")}
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 mb-12 max-w-2xl mx-auto">
                            {[0, 1].map(i => (
                                <div key={i} className="h-24 bg-gray-50 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    )}

                    {/* Toggle + currency switcher */}
                    <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
                        {/* Period toggle */}
                        <div className="flex items-center gap-3">
                            <span className={`text-sm font-semibold transition-colors ${!isAnnual ? 'text-[#1a1a1a]' : 'text-gray-400'}`}>{t("monthly")}</span>
                            <button
                                onClick={() => setIsAnnual(!isAnnual)}
                                className="relative w-14 h-7 bg-[#111] rounded-full p-1 transition-colors"
                            >
                                <motion.div
                                    layout
                                    className="w-5 h-5 bg-white rounded-full shadow-md"
                                    animate={{ x: isAnnual ? 28 : 0 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold transition-colors ${isAnnual ? 'text-[#1a1a1a]' : 'text-gray-400'}`}>{t("annual")}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider">{t("save20")}</span>
                            </div>
                        </div>

                        {/* Currency switcher */}
                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
                            {([
                                { id: 'kzt' as const, label: '₸ KZT' },
                                { id: 'usd' as const, label: '$ USD' },
                                { id: 'rub' as const, label: '₽ RUB' },
                            ]).map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setCurrency(c.id)}
                                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                                        currency === c.id
                                            ? 'bg-[#111] text-white shadow-sm'
                                            : 'text-gray-400 hover:text-[#1a1a1a]'
                                    }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ━━ Subscription Cards ━━ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-20 items-stretch">
                        {PLANS.map((plan, idx) => {
                            const isPro = plan.id === "pro";
                            const isCurrent = plan.id === currentPlanId;
                            const price = currency === 'kzt'
                                ? (isAnnual ? plan.priceKZTAnnual : plan.priceKZT)
                                : currency === 'rub'
                                ? (isAnnual ? plan.priceRUBAnnual : plan.priceRUB)
                                : (isAnnual ? plan.priceAnnual : plan.priceMonthly);
                            const sym = currency === 'kzt' ? '₸' : currency === 'rub' ? '₽' : '$';

                            return (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1, duration: 0.4 }}
                                    className={`relative rounded-3xl p-6 flex flex-col transition-all duration-300 border ${
                                        isCurrent
                                            ? 'bg-[#111] border-white/20 shadow-2xl shadow-white/5 scale-100 lg:scale-[1.02] z-10'
                                            : isPro
                                                ? 'bg-[#111] border-emerald-500/30 hover:border-emerald-500/50 shadow-2xl shadow-emerald-900/10'
                                                : 'bg-[#111] border-gray-800 hover:border-gray-700 shadow-xl'
                                    }`}
                                >
                                    {/* Tag */}
                                    {(isCurrent || (isAnnual && plan.priceAnnual > 0) || plan.tag) && (
                                        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full whitespace-nowrap ${
                                            isCurrent
                                                ? 'bg-white text-[#111] shadow-lg'
                                                : (isAnnual && plan.priceAnnual > 0)
                                                    ? 'bg-[#f59e0b] text-[#111] shadow-lg shadow-[#f59e0b]/20'
                                                    : plan.tag === 'Popular'
                                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                                        : plan.tag === 'Best Value'
                                                            ? 'bg-[#f59e0b] text-[#111]'
                                                            : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {isCurrent ? t("active") : (isAnnual && plan.priceAnnual > 0) ? t("monthsFree") : plan.tag}
                                        </div>
                                    )}

                                    {/* Header */}
                                    <div className="mb-6">
                                        <h3 className="text-lg font-black text-[#F1F1F3] uppercase tracking-wide mb-1">{plan.name}</h3>
                                        <p className="text-sm text-gray-400 min-h-[40px]">{plan.desc}</p>
                                    </div>

                                    {/* Price */}
                                    <div className="mb-6">
                                        {plan.priceMonthly === 0 ? (
                                            <div className="text-4xl font-black text-[#F1F1F3]">{sym}0</div>
                                        ) : (
                                            <>
                                                <div className="flex items-end gap-1">
                                                    <span className="text-xl font-bold text-gray-500 mb-1">{sym}</span>
                                                    <span className="text-4xl font-black text-[#F1F1F3]">
                                                        {currency === 'usd' ? price : price.toLocaleString('ru-RU')}
                                                    </span>
                                                    <span className="text-xs font-semibold text-gray-500 mb-2">/{isAnnual ? 'yr' : 'mo'}</span>
                                                </div>
                                                {currency === 'usd' && exchangeRate && (
                                                    <div className="text-[13px] font-bold text-gray-400 mt-1">
                                                        ~{(price * exchangeRate).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
                                                    </div>
                                                )}
                                                {currency === 'kzt' && (
                                                    <div className="text-[11px] font-semibold text-emerald-400 mt-1">{t("kaspiPay")}</div>
                                                )}
                                                {currency === 'rub' && (
                                                    <div className="text-[11px] font-semibold text-gray-400 mt-1">{t("cryptoCloud")}</div>
                                                )}
                                            </>
                                        )}
                                        <div className="text-[10px] text-gray-500 font-medium mt-1 h-4">
                                            {isAnnual && price > 0 && currency === 'usd' ? t("billedAnnually", { price: price.toFixed(2) }) : ''}
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <button
                                        disabled={isCurrent || plan.id === 'free'}
                                        className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] mb-8 ${
                                            isCurrent
                                                ? 'bg-white/10 text-white cursor-default'
                                                : isPro
                                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20'
                                                    : plan.id === 'free'
                                                        ? 'bg-white/5 text-gray-500 cursor-default'
                                                        : 'bg-[#F1F1F3] text-[#111] hover:bg-white'
                                        }`}
                                        onClick={() => !isCurrent && handleCheckout(plan.id)}
                                    >
                                        {isCurrent ? t("currentPlan") : t("getPlan")}
                                    </button>

                                    {/* Features List */}
                                    <div className="flex-1">
                                        <ul className="space-y-3.5">
                                            {plan.features.map((feature, fIdx) => (
                                                <li key={fIdx} className="flex items-start gap-3">
                                                    {feature.included ? (
                                                        <Check className="w-4 h-4 text-[#F1F1F3] shrink-0 mt-0.5" strokeWidth={3} />
                                                    ) : (
                                                        <Lock className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" strokeWidth={2} />
                                                    )}
                                                    <span className={`text-xs ${feature.included ? 'text-[#F1F1F3]' : 'text-gray-600'}`}>
                                                        {feature.text}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    
                                    {/* Bottom Glow */}
                                    <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none"
                                         style={{ background: `radial-gradient(circle at top right, ${plan.accent}, transparent 70%)` }} />
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* ━━ Transaction History ━━ */}
                    {user && (
                        <div className="mb-10 max-w-3xl mx-auto">
                            <h2 className="text-xl font-black tracking-tight text-[#1a1a1a] mb-5">{t("transactionHistory")}</h2>

                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
                                    {timelineItems.length > 0 ? timelineItems.slice(0, 40).map((item, idx) => (
                                        item.is_receipt ? (
                                            <div key={`r-${item.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                                        <Package className="w-4 h-4 text-emerald-600" strokeWidth={2} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold truncate text-[#1a1a1a]">{item.pack_name || t("subscriptionUpgrade")}</p>
                                                        <p className="text-[11px] text-gray-400 font-medium">{item.display_date}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="text-sm font-black tabular-nums text-emerald-600">{item.amount_text}</span>
                                                    <a href={`/api/billing/receipt/${item.id}`} target="_blank" rel="noopener noreferrer"
                                                        className="text-[9px] font-bold text-gray-300 uppercase tracking-widest hover:text-[#1a1a1a] transition-colors hidden sm:block">
                                                        PDF
                                                    </a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div key={`t-${item.id}-${idx}`} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.is_positive ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                                                        {item.is_positive ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : <Clock className="w-4 h-4 text-gray-400" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold truncate text-[#1a1a1a]">{item.type}</p>
                                                        <p className="text-[11px] text-gray-400 font-medium">{item.display_date}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-sm font-black tabular-nums shrink-0 ${item.is_positive ? 'text-emerald-600' : 'text-[#1a1a1a]'}`}>
                                                    {item.amount}
                                                </span>
                                            </div>
                                        )
                                    )) : (
                                        <div className="p-16 text-center">
                                            <Receipt className="w-10 h-10 mx-auto text-gray-200 mb-3" />
                                            <p className="text-sm text-gray-400 font-medium">{t("noTransactions")}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ━━ Footer ━━ */}
                    <div className="pt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-gray-400">
                        <a href="mailto:support@perricheno.ru" className="flex items-center gap-1.5 hover:text-[#1a1a1a] transition-colors">
                            <Mail className="w-3.5 h-3.5" /> {t("support")}
                        </a>
                        <span className="text-gray-200">·</span>
                        <span className="hover:text-[#1a1a1a] cursor-pointer transition-colors">{t("termsOfService")}</span>
                        <span className="text-gray-200">·</span>
                        <span className="hover:text-[#1a1a1a] cursor-pointer transition-colors">{t("usagePolicy")}</span>
                    </div>

                </motion.div>
            </div>
        </div>
    );
}
