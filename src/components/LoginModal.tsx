"use client";

import { useState, useEffect } from "react";
import { IconX, IconUser, IconTrash, IconLogout } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAdmin } from "@/components/AdminContext";

export const LoginModal = ({ onSuccess, onGuestSuccess, onClose }: { onSuccess: () => void; onGuestSuccess?: (name: string) => void; onClose: () => void }) => {
    const { user, login, logout, deleteAccount } = useAdmin();
    const [username, setUsername] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Verify Telegram Auth
    useEffect(() => {
        if (user) return; // Don't inject if logged in

        (window as any).onTelegramAuth = async (tgUser: any) => {
            console.log("Telegram Auth:", tgUser);
            setLoading(true);
            try {
                await login(tgUser);
                if (onGuestSuccess) onGuestSuccess(tgUser.first_name);
                // Don't close immediately if we want to show profile?
                // Actually, typically we close modal on success.
                // But if user opened it to see profile, we keep it?
                // Let's keep it open to show "Welcome" or profile.
            } catch (e) {
                setError("Login failed on server");
            } finally {
                setLoading(false);
            }
        };

        const script = document.createElement("script");
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.setAttribute("data-telegram-login", "PerrichenoBot");
        script.setAttribute("data-size", "medium");
        script.setAttribute("data-radius", "8");
        script.setAttribute("data-onauth", "onTelegramAuth(user)");
        script.setAttribute("data-request-access", "write");
        script.async = true;

        const container = document.getElementById("telegram-login-container");
        if (container) {
            container.innerHTML = "";
            container.appendChild(script);
        }
    }, [user, login, onGuestSuccess]);

    const handleAdminLogin = () => {
        if (pass) {
            if (username === "admin" && pass === "admin") onSuccess();
            else setError("Wrong credentials");
        } else {
            setError("Password required for admin");
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0, rotateX: -10 }}
                animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                exit={{ scale: 0.9, opacity: 0, rotateX: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-80 rounded-2xl bg-black/70 border border-white/10 backdrop-blur-xl p-6 relative overflow-hidden"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-bold text-sm">
                        {user ? "Your Profile" : "Sign In"}
                    </h3>
                    <motion.button onClick={onClose} whileHover={{ rotate: 90 }} whileTap={{ scale: 0.8 }} className="text-white/40 hover:text-white">
                        <IconX className="w-4 h-4" />
                    </motion.button>
                </div>

                <AnimatePresence mode="wait">
                    {user ? (
                        <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col items-center gap-4">
                            <div className="w-20 h-20 rounded-full border-2 border-emerald-500 overflow-hidden relative bg-white/5">
                                {user.photo_url ? (
                                    <img src={user.photo_url} alt={user.first_name || "User"} className="w-full h-full object-cover" />
                                ) : (
                                    <IconUser className="w-10 h-10 text-white/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                )}
                            </div>
                            <div className="text-center">
                                <h4 className="text-white font-bold">{user.first_name}</h4>
                                {user.username && <p className="text-white/40 text-xs">@{user.username}</p>}
                                <p className="text-emerald-400 text-xs mt-1">ID: {user.telegram_id}</p>
                            </div>

                            <div className="w-full h-px bg-white/10 my-2" />

                            <button onClick={() => { logout(); onClose(); }}
                                className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm flex items-center justify-center gap-2 transition-colors">
                                <IconLogout className="w-4 h-4" /> Log Out
                            </button>

                            <button onClick={deleteAccount}
                                className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm flex items-center justify-center gap-2 transition-colors">
                                <IconTrash className="w-4 h-4" /> Delete Account
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                            {/* Telegram Widget */}
                            <div id="telegram-login-container" className="flex justify-center min-h-[40px] mb-6">
                                {loading && <p className="text-white/50 text-xs">Verifying...</p>}
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-px bg-white/10 flex-1" />
                                <span className="text-white/30 text-xs uppercase">OR ADMIN</span>
                                <div className="h-px bg-white/10 flex-1" />
                            </div>

                            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username"
                                className="w-full mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500 placeholder:text-white/30" />
                            <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Password"
                                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                                className="w-full mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500 placeholder:text-white/30" />

                            {error && <p className="text-red-400 text-xs mb-2 text-center">{error}</p>}

                            <motion.button onClick={handleAdminLogin} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                className="w-full py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 transition-all">
                                Login as Admin
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

