"use client";

import { useState } from "react";
import ChatPage from "@/components/ChatPage";
import { DockSidebar } from "@/components/ui/DockSidebar";
import { AnimatePresence, motion } from "framer-motion";

export default function Chat() {
    const [showNav, setShowNav] = useState(true);

    return (
        <main className="h-screen relative flex flex-col">
            <ChatPage onToggleNavbar={() => setShowNav(!showNav)} />
            <AnimatePresence>
                {showNav && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <DockSidebar />
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
