"use client";

import { useState, useEffect } from "react";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import {
    IconUser, IconPalette, IconInfoCircle,
    IconLogin, IconChevronRight,
    IconCreditCard, IconDatabase, IconLink
} from "@tabler/icons-react";

export default function SettingsPage() {
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();

    const [limits, setLimits] = useState<any>(null);
    const [fullUser, setFullUser] = useState<any>(null);

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

                    {/* ━━━━ Intelligence Preferences ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                            <IconPalette className="w-4 h-4" /> Agent Preferences
                        </h2>
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold">Custom Instructions</p>
                                    <p className="text-[11px] font-medium text-gray-500">Provide persistent base context for your Personal AI</p>
                                </div>
                                <button className="px-4 py-2 border border-[var(--border)] rounded-xl text-xs font-bold hover:bg-black/5 transition-colors">Edit Context</button>
                            </div>

                            <div className="border-t border-[var(--border)]" />

                            <div className="flex items-center justify-between mt-4">
                                <div>
                                    <p className="text-sm font-bold">Research Aggressiveness</p>
                                    <p className="text-[11px] font-medium text-gray-500">How deep the AI should search per query</p>
                                </div>
                                <select className="bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:border-[var(--foreground)] transition-colors">
                                    <option value="balanced">Balanced (Default)</option>
                                    <option value="deep">Deep Dive (Slow)</option>
                                    <option value="fast">Fast Overview</option>
                                </select>
                            </div>

                            <div className="border-t border-[var(--border)]" />

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold">Default Output Format</p>
                                    <p className="text-[11px] font-medium text-gray-500">Preferred style for downloaded code or documents</p>
                                </div>
                                <select className="bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:border-[var(--foreground)] transition-colors">
                                    <option value="markdown">Markdown (.md)</option>
                                    <option value="latex">LaTeX (.tex)</option>
                                    <option value="pdf">Formal PDF (.pdf)</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* ━━━━ Notifications & Integrations ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                            <IconLink className="w-4 h-4" /> Integrations
                        </h2>
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between p-4 border border-[var(--border)] rounded-2xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-[#24A1DE] text-white rounded-xl flex items-center justify-center">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">Telegram Bot Notifications</p>
                                        <p className="text-[11px] text-gray-500">Get alerts when heavy tasks finish</p>
                                    </div>
                                </div>
                                <label className="relative inline-block w-12 h-6 cursor-pointer">
                                    <input type="checkbox" defaultChecked className="sr-only peer" />
                                    <span className="absolute inset-0 bg-gray-200 rounded-full peer peer-checked:bg-green-500 transition-colors"></span>
                                    <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></span>
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-4 border border-[var(--border)] rounded-2xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-100 text-black rounded-xl flex items-center justify-center">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold">GitHub Copilot Link</p>
                                        <p className="text-[11px] text-gray-500">Sync code logic immediately</p>
                                    </div>
                                </div>
                                <button className="px-4 py-2 border border-[var(--border)] rounded-xl text-xs font-bold hover:bg-black hover:text-white transition-colors">Connect</button>
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
