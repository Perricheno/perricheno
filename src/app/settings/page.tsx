"use client";

import { useState } from "react";
import { useAdmin } from "@/components/AdminContext";
import MinimalSidebar from "@/components/MinimalSidebar";
import { LoginModal } from "@/components/LoginModal";
import {
    IconUser, IconPalette, IconFileTypePdf, IconInfoCircle,
    IconSun, IconMoon, IconDeviceDesktop, IconLogin, IconChevronRight
} from "@tabler/icons-react";

type Theme = "light" | "dark" | "system";

export default function SettingsPage() {
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== "undefined") {
            return (localStorage.getItem("theme") as Theme) || "system";
        }
        return "system";
    });

    // PDF defaults
    const [defaultDpi, setDefaultDpi] = useState("300");
    const [defaultCompression, setDefaultCompression] = useState(5);
    const [defaultOcrLang, setDefaultOcrLang] = useState("eng");

    const applyTheme = (t: Theme) => {
        setTheme(t);
        localStorage.setItem("theme", t);
        const root = document.documentElement;
        if (t === "dark") {
            root.classList.add("dark");
        } else if (t === "light") {
            root.classList.remove("dark");
        } else {
            // System preference
            if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                root.classList.add("dark");
            } else {
                root.classList.remove("dark");
            }
        }
    };

    const themeOptions: { id: Theme; icon: any; label: string }[] = [
        { id: "light", icon: IconSun, label: "Light" },
        { id: "dark", icon: IconMoon, label: "Dark" },
        { id: "system", icon: IconDeviceDesktop, label: "System" },
    ];

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pl-0 md:pl-20 pb-24 md:pb-0 transition-all font-sans">
            <MinimalSidebar />
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-2xl mx-auto px-6 py-12 md:py-24">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Settings</h1>
                <p className="text-gray-500 mb-10">Manage your account and preferences.</p>

                <div className="space-y-8">
                    {/* ━━━━ Account ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                            <IconUser className="w-4 h-4" /> Account
                        </h2>
                        <div className="bg-white dark:bg-[#18181b] border border-[var(--border)] rounded-[var(--radius)] p-5">
                            {user ? (
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#27272a] flex items-center justify-center overflow-hidden border border-[var(--border)] shrink-0">
                                        {user.photo_url
                                            ? <img src={user.photo_url} alt={user.first_name || ""} className="w-full h-full object-cover" />
                                            : <IconUser className="w-6 h-6 text-gray-400" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-semibold truncate">{user.first_name}</p>
                                        <p className="text-sm text-gray-500 truncate">@{user.username || "user"}</p>
                                    </div>
                                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Connected</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-center py-4">
                                    <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#27272a] flex items-center justify-center mb-3 border border-[var(--border)]">
                                        <IconUser className="w-7 h-7 text-gray-400" />
                                    </div>
                                    <p className="text-sm text-gray-500 mb-4">Sign in with Telegram to enable cloud features and background processing.</p>
                                    <button onClick={() => setShowLogin(true)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] rounded-[var(--radius)] font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm">
                                        <IconLogin className="w-4 h-4" /> Sign In with Telegram
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ━━━━ Appearance ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                            <IconPalette className="w-4 h-4" /> Appearance
                        </h2>
                        <div className="bg-white dark:bg-[#18181b] border border-[var(--border)] rounded-[var(--radius)] p-5">
                            <p className="text-sm text-gray-500 mb-4">Choose your preferred theme.</p>
                            <div className="grid grid-cols-3 gap-3">
                                {themeOptions.map(t => (
                                    <button key={t.id} onClick={() => applyTheme(t.id)}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                            theme === t.id
                                                ? "border-[var(--foreground)] bg-black/5 dark:bg-white/5 shadow-sm"
                                                : "border-transparent hover:border-[var(--border)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                                        }`}>
                                        <t.icon className={`w-6 h-6 ${theme === t.id ? "text-[var(--foreground)]" : "text-gray-400"}`} stroke={1.5} />
                                        <span className={`text-xs font-medium ${theme === t.id ? "text-[var(--foreground)]" : "text-gray-500"}`}>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ━━━━ PDF Defaults ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                            <IconFileTypePdf className="w-4 h-4" /> PDF Defaults
                        </h2>
                        <div className="bg-white dark:bg-[#18181b] border border-[var(--border)] rounded-[var(--radius)] p-5 space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Default Image DPI</p>
                                    <p className="text-xs text-gray-500">Used when converting PDF to images</p>
                                </div>
                                <select value={defaultDpi} onChange={e => setDefaultDpi(e.target.value)}
                                    className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm outline-none">
                                    <option value="72">72 (Draft)</option>
                                    <option value="150">150 (Standard)</option>
                                    <option value="300">300 (High)</option>
                                    <option value="600">600 (Ultra)</option>
                                </select>
                            </div>

                            <div className="border-t border-[var(--border)]" />

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="text-sm font-medium">Compression Level</p>
                                        <p className="text-xs text-gray-500">Default for PDF compression tool</p>
                                    </div>
                                    <span className="text-sm font-bold tabular-nums">{defaultCompression}</span>
                                </div>
                                <input type="range" min={1} max={9} value={defaultCompression} onChange={e => setDefaultCompression(parseInt(e.target.value))}
                                    className="w-full accent-[var(--foreground)]" />
                                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                    <span>Low</span><span>High</span>
                                </div>
                            </div>

                            <div className="border-t border-[var(--border)]" />

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">OCR Language</p>
                                    <p className="text-xs text-gray-500">Default language for text recognition</p>
                                </div>
                                <select value={defaultOcrLang} onChange={e => setDefaultOcrLang(e.target.value)}
                                    className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm outline-none">
                                    <option value="eng">English</option>
                                    <option value="rus">Russian</option>
                                    <option value="deu">German</option>
                                    <option value="fra">French</option>
                                    <option value="spa">Spanish</option>
                                    <option value="chi_sim">Chinese</option>
                                    <option value="jpn">Japanese</option>
                                    <option value="kor">Korean</option>
                                    <option value="ara">Arabic</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* ━━━━ About ━━━━ */}
                    <section>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                            <IconInfoCircle className="w-4 h-4" /> About
                        </h2>
                        <div className="bg-white dark:bg-[#18181b] border border-[var(--border)] rounded-[var(--radius)] p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Version</span>
                                <span className="text-sm font-semibold">1.0.0</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Platform</span>
                                <span className="text-sm font-semibold">Perricheno</span>
                            </div>
                            <div className="border-t border-[var(--border)]" />
                            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-between py-1 text-sm text-gray-500 hover:text-[var(--foreground)] transition-colors group">
                                <span>Source Code</span>
                                <IconChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
