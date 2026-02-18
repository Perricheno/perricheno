"use client";

import { useState, useEffect, useRef } from "react";
import { IconX, IconUser, IconTrash, IconLogout } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAdmin } from "@/components/AdminContext";

export const LoginModal = ({ onSuccess, onGuestSuccess, onClose }: { onSuccess: () => void; onGuestSuccess?: (name: string) => void; onClose: () => void }) => {
    const { user, login, logout, deleteAccount } = useAdmin();
    const [username, setUsername] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const scriptRef = useRef<HTMLScriptElement | null>(null);

    useEffect(() => {
        // Global handler
        (window as any).onTelegramAuth = async (tgUser: any) => {
            console.log("TG Widget Auth:", tgUser);
            setLoading(true);
            try {
                await login(tgUser);
                if (onGuestSuccess) onGuestSuccess(tgUser.first_name);
                onClose();
            } catch (e) {
                console.error(e);
                setError("Login failed. Check console.");
            } finally {
                setLoading(false);
            }
        };

        // Inject Script
        if (!user) {
            const container = document.getElementById("telegram-login-container");
            if (container && !container.hasChildNodes()) {
                const script = document.createElement("script");
                script.src = "https://telegram.org/js/telegram-widget.js?22";
                script.setAttribute("data-telegram-login", "PerrichenoBot");
                script.setAttribute("data-size", "large");
                script.setAttribute("data-radius", "10");
                script.setAttribute("data-onauth", "onTelegramAuth(user)");
                script.setAttribute("data-request-access", "write");
                script.async = true;
                container.appendChild(script);
                scriptRef.current = script;
            }
        }

        return () => {
             // Cleanup if needed
        }
    }, [user]);

    const handleAdminLogin = () => {
        if (username === "admin" && pass === "admin") onSuccess();
        else setError("Invalid credentials");
    };

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={onClose}>
                
                <motion.div onClick={e => e.stopPropagation()}
                    initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                    className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                    
                    <button onClick={onClose} className="absolute top-4 right-4 opacity-50 hover:opacity-100">
                        <IconX className="w-5 h-5" />
                    </button>

                    <h2 className="text-xl font-bold mb-6 text-center tracking-tight">
                        {user ? `Hello, ${user.first_name}` : "Authentication"}
                    </h2>

                    {user ? (
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-center">
                                <img src={user.photo_url || ""} className="w-20 h-20 rounded-full border-2 border-white/10" />
                            </div>
                            <div className="text-center opacity-50 text-sm font-mono">ID: {user.telegram_id}</div>
                            <button onClick={() => { logout(); onClose(); }} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                                <IconLogout className="w-4 h-4" /> Sign Out
                            </button>
                            <button onClick={deleteAccount} className="p-3 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2">
                                <IconTrash className="w-4 h-4" /> Delete Data
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {/* Telegram Section */}
                            <div className="flex flex-col items-center justify-center py-4 bg-white/5 rounded-xl">
                                <p className="text-xs opacity-50 uppercase tracking-widest mb-4">One-Click Login</p>
                                <div id="telegram-login-container" className="min-h-[40px]"></div>
                                {loading && <p className="mt-2 text-xs animate-pulse opacity-50">Authenticating...</p>}
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#111] px-2 opacity-30">Or Admin</span></div>
                            </div>

                            {/* Admin Form */}
                            <div className="flex flex-col gap-2">
                                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="bg-transparent border border-white/10 p-3 rounded-xl outline-none focus:border-white/40 transition-colors text-sm" />
                                <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password" className="bg-transparent border border-white/10 p-3 rounded-xl outline-none focus:border-white/40 transition-colors text-sm" />
                                <button onClick={handleAdminLogin} className="mt-2 bg-white text-black font-bold p-3 rounded-xl hover:opacity-90 transition-opacity">
                                    Access Admin
                                </button>
                            </div>
                            
                            {error && <p className="text-red-500 text-xs text-center bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
