"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
    IconHome, IconTerminal2, IconChartBar, 
    IconRobot, IconFileTypePdf, IconListCheck,
    IconUser, IconLogin, IconSettings,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarLeftExpand
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import { useState } from "react";

type NavLink = {
    href: string;
    icon: any;
    label: string;
    shortcut?: string;
};

type NavGroup = {
    title: string;
    links: NavLink[];
};

// Categorized Links matching the UI vibe
const NAV_GROUPS: NavGroup[] = [
    {
        title: "Main menu",
        links: [
            { href: "/", icon: IconHome, label: "Home", shortcut: "⌘ H" },
            { href: "/dashboard", icon: IconChartBar, label: "Dashboard", shortcut: "⌘ D" },
        ]
    },
    {
        title: "Activity",
        links: [
            { href: "/tasks", icon: IconListCheck, label: "Tasks" },
            { href: "/agent", icon: IconRobot, label: "AI Agent" },
            { href: "/pdf", icon: IconFileTypePdf, label: "PDF Tools" },
        ]
    },
    {
        title: "Set Up",
        links: [
            { href: "/settings", icon: IconSettings, label: "Settings" }
        ]
    }
];

// Mobile bottom bar — 5 key items (icons + labels)
const MOBILE_NAV: NavLink[] = [
    { href: "/", icon: IconHome, label: "Home" },
    { href: "/tasks", icon: IconListCheck, label: "Tasks" },
    { href: "/pdf", icon: IconFileTypePdf, label: "PDF" },
    { href: "/agent", icon: IconRobot, label: "Agent" },
    // 5th slot = profile/sign-in
];

export default function MinimalSidebar() {
    const pathname = usePathname();
    const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <>
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}
            
            {/* ═══════════════════════════════════════ */}
            {/* Desktop Sidebar — hidden on mobile      */}
            {/* ═══════════════════════════════════════ */}
            <aside className={cn(
                "fixed left-0 top-0 bottom-0 border-r border-[var(--border)] bg-[#F4F4F6] dark:bg-[#18181b] flex-col z-50 transition-all duration-300",
                "hidden md:flex", // Hide on mobile
                collapsed ? "w-20" : "md:w-[260px]"
            )}>

                {/* Logo Area */}
                <div className="h-16 flex items-center justify-between px-6 pt-4 mb-4">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[var(--radius)] flex items-center justify-center shrink-0 overflow-hidden">
                            <img src="/logo-dark.png" alt="Perricheno" className="w-full h-full object-contain hidden dark:block" />
                            <img src="/logo.png" alt="Perricheno" className="w-full h-full object-contain dark:hidden" />
                        </div>
                    </Link>
                    
                    <button 
                        onClick={() => setCollapsed(!collapsed)} 
                        className="p-2 flex-shrink-0 text-gray-400 hover:text-[var(--foreground)] rounded-[var(--radius)] transition-colors"
                    >
                        {collapsed ? <IconLayoutSidebarLeftExpand size={18} /> : <IconLayoutSidebarLeftCollapse size={18} />}
                    </button>
                </div>

                {/* Scrollable Links */}
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 minimal-scrollbar">
                    {NAV_GROUPS.map((group, sectionIdx) => (
                        <div key={sectionIdx} className="space-y-1">
                            <h4 className={cn(
                                "px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2",
                                collapsed && "hidden"
                            )}>
                                {group.title}
                            </h4>
                            
                            {group.links.map(l => (
                                <Link key={l.href} href={l.href} 
                                    className={cn(
                                        "group flex items-center justify-between px-3 py-2 rounded-[var(--radius)] transition-all font-medium text-sm",
                                        isActive(l.href)                                            
                                            ? "bg-white dark:bg-[#27272a] text-[var(--foreground)] shadow-sm font-semibold"
                                            : "text-gray-500 hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5"
                                    )}>
                                    <div className="flex items-center gap-3">
                                        <l.icon className={cn(
                                            "w-[18px] h-[18px] shrink-0",
                                            isActive(l.href) ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                                        )} stroke={isActive(l.href) ? 2 : 1.5} />
                                        <span className={cn(collapsed && "hidden")}>{l.label}</span>
                                    </div>
                                    
                                    {l.shortcut && !collapsed && (
                                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <kbd className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-400">{l.shortcut.split(" ")[0]}</kbd>
                                            <kbd className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-400">{l.shortcut.split(" ")[1]}</kbd>
                                         </div>
                                    )}
                                </Link>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Bottom User Area */}
                <div className="p-4 mt-auto">
                     {!collapsed && <h4 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Account</h4>}
                     
                    {user ? (
                        <button onClick={() => setShowLogin(true)} className="flex items-center gap-3 w-full p-2 rounded-[var(--radius)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                            <div className="w-8 h-8 rounded-full bg-white dark:bg-[#27272a] shadow-sm flex items-center justify-center overflow-hidden shrink-0 border border-[var(--border)]">
                                {user.photo_url ? <img src={user.photo_url || ""} alt={user.first_name || "User"} /> : <IconUser className="w-4 h-4 text-gray-400" />}
                            </div>
                            <div className={cn("flex-1 min-w-0", collapsed && "hidden")}>
                                <p className="text-sm font-semibold truncate text-[var(--foreground)] leading-tight">{user.first_name}</p>
                                <p className="text-xs text-gray-500 truncate leading-tight">Admin</p>
                            </div>
                        </button>
                    ) : (
                        <button onClick={() => setShowLogin(true)} 
                            className="w-full flex items-center justify-center gap-2 p-2 rounded-[var(--radius)] bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity text-sm font-semibold shadow-sm">
                            <IconLogin className="w-[18px] h-[18px]" />
                            <span className={cn(collapsed && "hidden")}>Sign In</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* ═══════════════════════════════════════ */}
            {/* Mobile Bottom Nav — shown only on mobile */}
            {/* ═══════════════════════════════════════ */}
            <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 md:hidden w-[92%] max-w-[400px]">
                <div className="flex items-center justify-around px-1 py-1.5 bg-white dark:bg-[#18181b] rounded-2xl border border-[var(--border)] shadow-xl shadow-black/5">
                    {MOBILE_NAV.map(l => (
                        <Link key={l.href} href={l.href}
                            className="flex flex-col items-center justify-center w-[56px] relative group gap-0.5 py-1">
                            {/* Pill background for active state */}
                            <div className={cn(
                                "w-10 h-6 rounded-full transition-all duration-300 flex items-center justify-center",
                                isActive(l.href)
                                    ? "bg-black dark:bg-white"
                                    : "bg-transparent group-hover:bg-black/5 dark:group-hover:bg-white/5"
                            )}>
                                <l.icon className={cn(
                                    "w-[18px] h-[18px] transition-colors",
                                    isActive(l.href)
                                        ? "text-white dark:text-black stroke-[2.5px]"
                                        : "text-gray-500 stroke-[1.5px]"
                                )} />
                            </div>
                            
                            {/* Label */}
                            <span className={cn(
                                "text-[10px] leading-tight transition-colors",
                                isActive(l.href) ? "text-[var(--foreground)] font-bold" : "text-gray-500 font-medium"
                            )}>
                                {l.label}
                            </span>
                        </Link>
                    ))}

                    {/* Settings slot */}
                    <Link href="/settings"
                        className="flex flex-col items-center justify-center w-[56px] relative group gap-0.5 py-1">
                        <div className={cn(
                            "w-10 h-6 rounded-full transition-all duration-300 flex items-center justify-center",
                            isActive("/settings")
                                ? "bg-black dark:bg-white"
                                : "bg-transparent group-hover:bg-black/5 dark:group-hover:bg-white/5"
                        )}>
                            <IconSettings className={cn(
                                "w-[18px] h-[18px] transition-colors",
                                isActive("/settings") ? "text-white dark:text-black stroke-[2.5px]" : "text-gray-500 stroke-[1.5px]"
                            )} />
                        </div>
                        
                        <span className={cn(
                            "text-[10px] leading-tight transition-colors",
                            isActive("/settings") ? "text-[var(--foreground)] font-bold" : "text-gray-500 font-medium"
                        )}>
                            Settings
                        </span>
                    </Link>
                </div>
            </nav>
        </>
    );
}
