"use client";

import { useState, useEffect, useRef } from "react";
import { IconX, IconUser, IconTrash, IconLogout, IconShieldCheck, IconBrandTelegram, IconRefresh } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAdmin } from "@/components/AdminContext";

export const LoginModal = ({ onSuccess, onGuestSuccess, onClose }: { onSuccess: () => void; onGuestSuccess?: (name: string) => void; onClose: () => void }) => {
    const { user, login, logout, deleteAccount } = useAdmin();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [widgetVisible, setWidgetVisible] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Telegram Auth Callback
    useEffect(() => {
        (window as any).onTelegramAuth = async (tgUser: any) => {
            setLoading(true);
            setError("");
            try {
                await login(tgUser);
                if (onGuestSuccess) onGuestSuccess(tgUser.first_name);
                onClose();
            } catch (e: any) {
                console.error("Telegram Auth Error:", e);
                setError(e.message || "Authentication failed. Please try again.");
            } finally {
                setLoading(false);
            }
        };
    }, [login, onGuestSuccess, onClose]);

    // Widget Loading Logic
    useEffect(() => {
        if (!user && containerRef.current) {
            const script = document.createElement("script");
            script.src = "https://telegram.org/js/telegram-widget.js?22";
            script.setAttribute("data-telegram-login", "PerrichenoBot");
            script.setAttribute("data-size", "large");
            script.setAttribute("data-radius", "14");
            script.setAttribute("data-onauth", "onTelegramAuth(user)");
            script.setAttribute("data-request-access", "write");
            script.async = true;
            
            // Check if widget is blocked after a delay
            const timeout = setTimeout(() => {
                if (containerRef.current?.querySelectorAll('iframe').length === 0) {
                    setWidgetVisible(false);
                } else {
                    setWidgetVisible(true);
                }
            }, 3000);

            containerRef.current.appendChild(script);
            return () => {
                clearTimeout(timeout);
                if (containerRef.current) containerRef.current.innerHTML = "";
            };
        }
    }, [user]);

    const handleManualRetry = () => {
        window.location.reload(); // Hard reset for the widget
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xl"
                onClick={onClose}
            >
                <motion.div
                    onClick={e => e.stopPropagation()}
                    initial={{ scale: 0.92, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 20 }}
                    transition={{ type: "spring", damping: 28, stiffness: 380 }}
                    className="w-full max-w-[420px] mx-4 bg-white rounded-[28px] shadow-2xl shadow-black/20 relative overflow-hidden"
                >
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-10"
                    >
                        <IconX className="w-4 h-4 text-gray-500" />
                    </button>

                    {user ? (
                        /* ── Logged In View ── */
                        <div className="p-8 pt-10">
                            {/* Profile header */}
                            <div className="flex flex-col items-center text-center mb-8">
                                <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden mb-4 shadow-lg">
                                    {user.photo_url
                                        ? <img src={user.photo_url} alt={user.first_name || ""} className="w-full h-full object-cover" />
                                        : <IconUser className="w-8 h-8 text-gray-400" />
                                    }
                                </div>
                                <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight">{user.first_name}</h2>
                                <p className="text-sm text-gray-400 font-medium mt-0.5">@{user.username || "user"}</p>
                                <span className="mt-3 px-4 py-1.5 bg-[#1a1a1a] text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                                    {user.account_tier || "Free Tier"}
                                </span>
                            </div>

                            {/* Account info */}
                            <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-400">Telegram ID</span>
                                    <span className="text-xs font-bold text-gray-600 font-mono">{user.telegram_id}</span>
                                </div>
                                <div className="border-t border-gray-100" />
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-400">Member since</span>
                                    <span className="text-xs font-bold text-gray-600">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-3">
                                <button
                                    onClick={() => { logout(); onClose(); }}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-100 text-[#1a1a1a] rounded-2xl font-bold text-sm hover:bg-gray-200 transition-colors"
                                >
                                    <IconLogout className="w-4 h-4" /> Sign Out
                                </button>

                                {!confirmDelete ? (
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 border border-red-200 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-50 transition-colors"
                                    >
                                        <IconTrash className="w-4 h-4" /> Delete Account
                                    </button>
                                ) : (
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                                        <p className="text-xs font-medium text-red-600 mb-3 text-center">This will permanently delete all your data. Are you sure?</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setConfirmDelete(false)}
                                                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => { deleteAccount(); onClose(); }}
                                                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-xs hover:bg-red-600 transition-colors"
                                            >
                                                Confirm Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* ── Sign In View ── */
                        <div className="p-8 pt-10">
                            {/* Header */}
                            <div className="flex flex-col items-center text-center mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 flex items-center justify-center mb-5 shadow-lg">
                                    <img src="/newlogo.png" alt="Perricheno" className="w-10 h-10 object-contain" />
                                </div>
                                <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight mb-1">Welcome Back</h2>
                                <p className="text-sm text-gray-400 font-medium whitespace-nowrap">Sign in with Telegram to continue</p>
                            </div>

                            {/* Telegram Auth Container */}
                            <div className="bg-gray-50 rounded-2xl p-6 flex flex-col items-center">
                                <div className="flex items-center gap-2 mb-6">
                                    <IconShieldCheck className="w-4 h-4 text-green-500" />
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Secure One-Click Login</span>
                                </div>

                                {/* The actual Telegram Widget container */}
                                <div className="min-h-[48px] w-full flex items-center justify-center relative">
                                    <div ref={containerRef} className="z-10" />
                                    
                                    {/* Ghost placeholder while loading */}
                                    {!loading && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                                             <div className="w-full h-12 bg-gray-200 rounded-xl animate-pulse" />
                                        </div>
                                    )}
                                </div>

                                {/* Loading state */}
                                {loading && (
                                    <div className="mt-4 flex flex-col items-center gap-3">
                                        <div className="w-4 h-4 border-2 border-gray-300 border-t-[#1a1a1a] rounded-full animate-spin" />
                                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Authenticating...</p>
                                    </div>
                                )}

                                {/* Persistent Fallback - Always visible as secondary or if widget fails */}
                                <div className="mt-8 pt-6 border-t border-gray-200 w-full">
                                    <p className="text-[10px] text-gray-400 text-center mb-3 font-medium">Alternative: Open direct in Telegram</p>
                                    <a
                                        href="https://t.me/PerrichenoBot?start=login"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1A1A1A] text-white rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-black transition-all active:scale-[0.98]"
                                    >
                                        <IconBrandTelegram className="w-4 h-4" /> Open in Telegram
                                    </a>
                                    
                                    <button
                                        onClick={handleManualRetry}
                                        className="w-full mt-3 flex items-center justify-center gap-1.5 text-[9px] text-gray-400 hover:text-gray-600 transition-colors uppercase font-bold tracking-tighter"
                                    >
                                        <IconRefresh className="w-3 h-3" /> Still Loading? Reload Widget
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-xs font-medium text-center p-3 rounded-2xl">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
