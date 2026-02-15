"use client";

import { IconUser } from "@tabler/icons-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoginModal } from "@/components/LoginModal";
import { useAdmin } from "@/components/AdminContext";
import { motion, AnimatePresence } from "framer-motion";

export function AdminBar() {
    const { isEditing, setIsEditing, showLogin, setShowLogin } = useAdmin();

    const handleAdminClick = () => {
        if (isEditing) setIsEditing(false);
        else setShowLogin(true);
    };

    return (
        <>
            <motion.button onClick={handleAdminClick}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                className={`fixed top-4 right-4 z-50 p-2 rounded-full border backdrop-blur-md transition-all ${isEditing ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
                    }`}>
                <IconUser className="w-4 h-4" />
            </motion.button>

            <div className="fixed top-4 right-14 z-50"><ThemeToggle /></div>

            <AnimatePresence>
                {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}
            </AnimatePresence>
        </>
    );
}
