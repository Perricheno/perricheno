"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
    IconHome,
    IconTerminal2,
    IconChartBar,
    IconMessageCircle,
    IconLayoutSidebarRightCollapse,
    IconLayoutSidebarRightExpand
} from "@tabler/icons-react";

export const DockSidebar = () => {
    const [expanded, setExpanded] = useState(false);
    const pathname = usePathname();

    const items = [
        { title: "Home", icon: <IconHome className="w-5 h-5" />, href: "/" },
        { title: "Projects", icon: <IconTerminal2 className="w-5 h-5" />, href: "/projects" },
        { title: "Dashboard", icon: <IconChartBar className="w-5 h-5" />, href: "/dashboard" },
        { title: "Chat", icon: <IconMessageCircle className="w-5 h-5" />, href: "/chat" },
    ];

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    return (
        <motion.div
            className="fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
        >
            <div className={cn(
                "flex flex-col gap-2 p-2 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl transition-all duration-300 ease-in-out",
                expanded ? "w-48" : "w-14 items-center"
            )}>

                {items.map((item) => (
                    <Link
                        key={item.title}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 p-2 rounded-xl transition-colors group relative",
                            expanded ? "w-full" : "w-10 h-10 justify-center",
                            isActive(item.href)
                                ? "text-emerald-400 bg-emerald-500/15 border border-emerald-500/20"
                                : "text-white/60 hover:text-white hover:bg-white/10 border border-transparent"
                        )}
                    >
                        <span className="shrink-0">{item.icon}</span>

                        {expanded && (
                            <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: "auto" }}
                                exit={{ opacity: 0, width: 0 }}
                                className="whitespace-nowrap overflow-hidden text-sm font-medium"
                            >
                                {item.title}
                            </motion.span>
                        )}

                        {!expanded && (
                            <div className="absolute left-full ml-4 px-2 py-1 bg-black/80 border border-white/10 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                {item.title}
                            </div>
                        )}
                    </Link>
                ))}

                <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-2 w-full flex items-center justify-center p-2 text-white/40 hover:text-white transition-colors"
                >
                    {expanded ? <IconLayoutSidebarRightCollapse className="w-4 h-4" /> : <IconLayoutSidebarRightExpand className="w-4 h-4" />}
                </button>

            </div>
        </motion.div>
    );
};
