"use client";

import { useState, useEffect } from "react";
import { IconX } from "@tabler/icons-react";
import { motion } from "framer-motion";

export const LoginModal = ({ onSuccess, onGuestSuccess, onClose }: { onSuccess: () => void; onGuestSuccess?: (name: string) => void; onClose: () => void }) => {
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");

    // Verify Telegram Auth
    useEffect(() => {
        // Define callback for Telegram widget
        (window as any).onTelegramAuth = (user: any) => {
            console.log("Telegram Auth:", user);
            localStorage.setItem("tg_user", JSON.stringify(user));
            if (onGuestSuccess) onGuestSuccess(user.first_name);
            onClose();
            // Optional: Reload to update all components relying on localStorage
            window.location.reload();
        };

        // Inject script
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
            container.innerHTML = ""; // clear previous
            container.appendChild(script);
        }
    }, [onGuestSuccess, onClose]);

    const handleLogin = () => {
        if (pass) {
            if (user === "admin" && pass === "admin") onSuccess();
            else setError("Wrong credentials");
        } else {
            if (user.trim().length > 0) {
                if (onGuestSuccess) onGuestSuccess(user);
                else setError("Guest login not allowed here");
            } else {
                setError("Username required");
            }
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
                className="w-80 rounded-2xl bg-black/70 border border-white/10 backdrop-blur-xl p-6"
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold text-sm">Sign In</h3>
                    <motion.button onClick={onClose} whileHover={{ rotate: 90 }} whileTap={{ scale: 0.8 }} className="text-white/40 hover:text-white">
                        <IconX className="w-4 h-4" />
                    </motion.button>
                </div>
                <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Username"
                    className="w-full mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500 placeholder:text-white/30" />
                <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Password (Optional for Guest)"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="w-full mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm outline-none focus:border-emerald-500 placeholder:text-white/30" />
                {error && <motion.p initial={{ x: -10 }} animate={{ x: 0 }} className="text-red-400 text-xs mb-2">{error}</motion.p>}
                <motion.button onClick={handleLogin} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    className="w-full py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm font-bold hover:bg-emerald-500/30 transition-all mb-4">
                    {pass ? "Login as Admin" : (onGuestSuccess ? "Join as Guest" : "Login")}
                </motion.button>

                <div className="flex items-center gap-2 mb-4">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-white/30 text-xs uppercase">OR</span>
                    <div className="h-px bg-white/10 flex-1" />
                </div>

                <div id="telegram-login-container" className="flex justify-center min-h-[40px]">
                    {/* Telegram script injects here */}
                </div>
            </motion.div>
        </motion.div>
    );
};
