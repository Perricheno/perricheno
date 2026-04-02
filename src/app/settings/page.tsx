"use client";

import { useState, useEffect } from "react";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import {
    IconUser, IconPalette, IconInfoCircle,
    IconLogin, IconChevronRight, IconLink
} from "@tabler/icons-react";

export default function SettingsPage() {
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const [fullUser, setFullUser] = useState<any>(null);

    useEffect(() => {
        if (user) {
            fetch("/api/auth/me")
                .then(r => r.json())
                .then(d => setFullUser(d.user));
        }
    }, [user]);

    return (
        <div className="w-full h-full font-sans overflow-auto bg-[var(--background)]">
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-3xl mx-auto px-6 py-12 md:py-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3">Settings</h1>
                <p className="text-gray-500 mb-10 font-medium">Manage your account and preferences.</p>

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
                                    <p className="text-sm font-medium text-gray-500 mb-6">Sign in with Telegram to access your account.</p>
                                    <button onClick={() => setShowLogin(true)}
                                        className="flex items-center gap-2 px-8 py-3.5 bg-[var(--foreground)] text-[var(--background)] rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl active:scale-95">
                                        <IconLogin className="w-4 h-4" /> Sign In
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                    
                    {/* ━━━━ Admin Controls ━━━━ */}
                    {fullUser?.telegram_id === '1153844209' && (
                        <section className="mb-10">
                            <h2 className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                                <IconInfoCircle className="w-4 h-4" /> System Administration
                            </h2>
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[32px] p-6 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold">Platform Overseer</p>
                                    <p className="text-[11px] font-medium text-gray-500">Access Global Telemetry & User Controls</p>
                                </div>
                                <a href="/dashboard" className="px-6 py-3 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-colors shadow-lg active:scale-95 shadow-black/20">
                                    Launch Board
                                </a>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
