"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import {
    IconUser, IconPalette, IconFileTypePdf, IconInfoCircle,
    IconSun, IconMoon, IconDeviceDesktop, IconLogin, IconChevronRight,
    IconCreditCard, IconDatabase
} from "@tabler/icons-react";

type Theme = "light" | "dark" | "system";

export default function SettingsPage() {
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const { theme, setTheme } = useTheme();

    const [limits, setLimits] = useState<any>(null);
    const [fullUser, setFullUser] = useState<any>(null);

    // PDF defaults
    const [defaultDpi, setDefaultDpi] = useState("300");
    const [defaultCompression, setDefaultCompression] = useState(5);
    const [defaultOcrLang, setDefaultOcrLang] = useState("eng");

    useEffect(() => {
        if (user) {
            fetch("/api/auth/me")
                .then(r => r.json())
                .then(d => {
                    setLimits(d.limits);
                    setFullUser(d.user);
                });
        }
    }, [user]);

    const applyTheme = (t: Theme) => {
        setTheme(t);
    };

    const themeOptions: { id: Theme; icon: any; label: string }[] = [
        { id: "light", icon: IconSun, label: "Light" },
        { id: "dark", icon: IconMoon, label: "Dark" },
        { id: "system", icon: IconDeviceDesktop, label: "System" },
    ];

    const handleCheckout = async (packId: string) => {
        try {
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packId })
            });
            const data = await res.json();
            if (data.url) {
                window.open(data.url, '_blank');
            } else if (data.fallback_url) {
                window.open(data.fallback_url, '_blank');
            } else {
                alert('Checkout failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('Checkout error.');
        }
    };

    const renderProgressBar = (label: string, used: number, max: number, purchased: number) => {
        const dailyRemaining = Math.max(0, max - used);
        const percentage = Math.min(100, Math.max(0, (used / max) * 100));

        return (
            <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between text-sm font-bold">
                    <span className="uppercase tracking-widest text-gray-500 text-[10px]">{label} Daily Quota</span>
                    <span className="text-[var(--foreground)]">{used.toLocaleString()} / {max.toLocaleString()}</span>
                </div>
                <div className="w-full bg-[var(--border)] h-2 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ${percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-orange-400' : 'bg-[var(--foreground)]'}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                {purchased > 0 && (
                    <div className="flex items-center gap-2 pt-2 text-xs font-bold text-green-600">
                        <IconDatabase className="w-4 h-4" />
                        +{purchased.toLocaleString()} tokens roll-over
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full h-full font-sans overflow-auto bg-[var(--background)]">
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-3xl mx-auto px-6 py-12 md:py-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3">Settings</h1>
                <p className="text-gray-500 mb-10 font-medium">Manage your account, billing, and preferences.</p>

                <div className="space-y-10">
                    
                    {/* ━━━━ Account ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                            <IconUser className="w-4 h-4" /> Profile Details
                        </h2>
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 shadow-sm">
                            {fullUser ? (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-[var(--border)] shrink-0 shadow-sm">
                                            {fullUser.photo_url
                                                ? <img src={fullUser.photo_url} alt={fullUser.first_name || ""} className="w-full h-full object-cover" />
                                                : <IconUser className="w-8 h-8 text-gray-400" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xl font-black truncate">{fullUser.first_name}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <p className="text-sm text-gray-500 font-medium truncate">@{fullUser.username || "user"}</p>
                                                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-[var(--foreground)] text-[var(--background)] shadow-sm">{fullUser.account_tier || "Free Tier"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-center py-6">
                                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 border border-[var(--border)]">
                                        <IconUser className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-500 mb-6">Sign in with Telegram to access your billing and agent features.</p>
                                    <button onClick={() => setShowLogin(true)}
                                        className="flex items-center gap-2 px-8 py-3.5 bg-[var(--foreground)] text-[var(--background)] rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl active:scale-95">
                                        <IconLogin className="w-4 h-4" /> Sign In
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ━━━━ Billing & Limits ━━━━ */}
                    {fullUser && limits && (
                        <section>
                            <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                                <IconCreditCard className="w-4 h-4" /> Billing & Usage
                            </h2>
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-8 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                    {renderProgressBar('Characters', fullUser.daily_chars_used, limits.free.chars, fullUser.purchased_chars)}
                                    {renderProgressBar('Visualizations', fullUser.daily_visuals_used, limits.free.visuals, fullUser.purchased_visuals)}
                                </div>

                                <div className="border border-[var(--border)] rounded-3xl p-6 bg-gradient-to-br from-white to-gray-50 shadow-inner">
                                    <h2 className="text-xl font-black mb-1">Buy Resource Packs</h2>
                                    <p className="text-[12px] font-medium text-gray-500 mb-6">Need more power? Purchased tokens roll-over permanently until consumed.</p>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <button onClick={() => handleCheckout('data_scientist')} className="block group bg-white border border-gray-200 rounded-3xl p-6 hover:border-black transition-all hover:shadow-2xl hover:-translate-y-1 text-left w-full cursor-pointer">
                                            <h3 className="text-base font-black mb-2 text-black">Data Scientist Pack</h3>
                                            <p className="text-xs font-medium text-gray-400 mb-6">2M Chars + 50 Visuals</p>
                                            <div className="bg-black text-white text-[10px] font-black uppercase tracking-widest text-center py-3 rounded-xl group-hover:bg-[#222] transition-colors">Buy for $5</div>
                                        </button>
                                        <button onClick={() => handleCheckout('researcher')} className="block group bg-black border border-black rounded-3xl p-6 hover:shadow-2xl hover:shadow-black/30 hover:-translate-y-1 transition-all text-left w-full cursor-pointer text-white">
                                            <h3 className="text-base font-black mb-2 text-white">Researcher Bundle</h3>
                                            <p className="text-xs font-medium text-gray-400 mb-6">5M Chars + 150 Visuals</p>
                                            <div className="bg-white text-black text-[10px] font-black uppercase tracking-widest text-center py-3 rounded-xl group-hover:bg-gray-100 transition-colors">Buy for $15</div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ━━━━ Appearance ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                            <IconPalette className="w-4 h-4" /> Appearance
                        </h2>
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 shadow-sm">
                            <div className="grid grid-cols-3 gap-3">
                                {themeOptions.map(t => (
                                    <button key={t.id} onClick={() => applyTheme(t.id)}
                                        className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                                            theme === t.id
                                                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] shadow-xl scale-105"
                                                : "border-transparent hover:border-[var(--border)] hover:bg-black/[0.02]"
                                        }`}>
                                        <t.icon className={`w-6 h-6 ${theme === t.id ? "text-[var(--background)]" : "text-gray-400"}`} stroke={2} />
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${theme === t.id ? "text-[var(--background)]" : "text-gray-500"}`}>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ━━━━ PDF Defaults ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                            <IconFileTypePdf className="w-4 h-4" /> PDF Defaults
                        </h2>
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold">Default Image DPI</p>
                                    <p className="text-[11px] font-medium text-gray-500">Used when converting PDF to images</p>
                                </div>
                                <select value={defaultDpi} onChange={e => setDefaultDpi(e.target.value)}
                                    className="bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:border-[var(--foreground)] transition-colors">
                                    <option value="72">72 (Draft)</option>
                                    <option value="150">150 (Standard)</option>
                                    <option value="300">300 (High)</option>
                                    <option value="600">600 (Ultra)</option>
                                </select>
                            </div>

                            <div className="border-t border-[var(--border)]" />

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-sm font-bold">Compression Level</p>
                                        <p className="text-[11px] font-medium text-gray-500">Default for PDF compression tool</p>
                                    </div>
                                    <span className="text-sm font-black tabular-nums">{defaultCompression}</span>
                                </div>
                                <input type="range" min={1} max={9} value={defaultCompression} onChange={e => setDefaultCompression(parseInt(e.target.value))}
                                    className="w-full h-2 rounded-full appearance-none bg-[var(--border)] accent-[var(--foreground)]" />
                            </div>

                            <div className="border-t border-[var(--border)]" />

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold">OCR Language</p>
                                    <p className="text-[11px] font-medium text-gray-500">Default language for text recognition</p>
                                </div>
                                <select value={defaultOcrLang} onChange={e => setDefaultOcrLang(e.target.value)}
                                    className="bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:border-[var(--foreground)] transition-colors">
                                    <option value="eng">English</option>
                                    <option value="rus">Russian</option>
                                    <option value="deu">German</option>
                                    <option value="fra">French</option>
                                    <option value="spa">Spanish</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* ━━━━ About ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                            <IconInfoCircle className="w-4 h-4" /> About
                        </h2>
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Version</span>
                                <span className="text-sm font-black px-3 py-1 bg-[var(--background)] rounded-full">1.0.0</span>
                            </div>
                            <div className="border-t border-[var(--border)]" />
                            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-between py-1 text-sm font-bold text-gray-500 hover:text-[var(--foreground)] transition-colors group">
                                <span className="text-[11px] uppercase tracking-widest">Source Code</span>
                                <IconChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
