"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
    IconHome, IconTerminal2, IconChartBar, 
    IconMessageCircle, IconRobot, IconFileTypePdf,
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
            // Removed /chat from UI 
        ]
    },
    {
        title: "Activity",
        links: [
            { href: "/agent", icon: IconRobot, label: "AI Agent" },
            { href: "/pdf", icon: IconFileTypePdf, label: "PDF Tools" },
        ]
    },
    {
        title: "Set Up",
        links: [
            { href: "/projects", icon: IconTerminal2, label: "Projects" },
            { href: "/settings", icon: IconSettings, label: "Settings" } // Dummy for UI
        ]
    }
];

export default function MinimalSidebar() {
    const pathname = usePathname();
    const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const [collapsed, setCollapsed] = useState(false); // Add simple collapse state

    return (
        <aside className={cn(
            "fixed left-0 top-0 bottom-0 border-r border-[var(--border)] bg-[var(--muted)] flex flex-col z-50 transition-all duration-300",
            collapsed ? "w-16 md:w-20" : "w-16 md:w-[260px]" // Use sidebar width matching ref
        )}>
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            {/* Logo Area */}
            <div className="h-16 flex items-center justify-between px-4 md:px-6 pt-4 mb-4">
                <Link href="/" className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black text-white dark:bg-white dark:text-black rounded-[var(--radius)] flex items-center justify-center shrink-0">
                        {/* Fake hexagon icon for now */}
                        <div className="flex gap-1">
                            <div className="w-1 h-3 bg-current rounded-full"></div>
                            <div className="w-1 h-4 bg-current rounded-full -translate-y-0.5"></div>
                            <div className="w-1 h-3 bg-current rounded-full"></div>
                        </div>
                    </div>
                </Link>
                
                <button 
                    onClick={() => setCollapsed(!collapsed)} 
                    className="hidden md:flex p-2 flex-shrink-0 text-gray-400 hover:text-[var(--foreground)] rounded-[var(--radius)] transition-colors"
                >
                    {collapsed ? <IconLayoutSidebarLeftExpand size={18} /> : <IconLayoutSidebarLeftCollapse size={18} />}
                </button>
            </div>

            {/* Scrollable Links */}
            <div className="flex-1 overflow-y-auto px-3 md:px-4 py-2 space-y-6 minimal-scrollbar">
                {NAV_GROUPS.map((group, sectionIdx) => (
                    <div key={sectionIdx} className={cn("space-y-1", collapsed && "md:hidden")}>
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
                                    <span className={cn(collapsed && "hidden md:hidden")}>{l.label}</span>
                                </div>
                                
                                {l.shortcut && !collapsed && (
                                     <div className="hidden md:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                 {/* Mobile Group title fallback */}
                 {!collapsed && <h4 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 hidden md:block">Account</h4>}
                 
                {user ? (
                    <button onClick={() => setShowLogin(true)} className="flex items-center gap-3 w-full p-2 rounded-[var(--radius)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
                        <div className="w-8 h-8 rounded-full bg-white dark:bg-[#27272a] shadow-sm flex items-center justify-center overflow-hidden shrink-0 border border-[var(--border)]">
                            {user.photo_url ? <img src={user.photo_url || ""} alt={user.first_name || "User"} /> : <IconUser className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div className={cn("flex-1 min-w-0 hidden md:block", collapsed && "md:hidden")}>
                            <p className="text-sm font-semibold truncate text-[var(--foreground)] leading-tight">{user.first_name}</p>
                            <p className="text-xs text-gray-500 truncate leading-tight">Admin</p>
                        </div>
                    </button>
                ) : (
                    <button onClick={() => setShowLogin(true)} 
                        className="w-full flex items-center justify-center gap-2 p-2 rounded-[var(--radius)] bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity text-sm font-semibold shadow-sm">
                        <IconLogin className="w-[18px] h-[18px]" />
                        <span className={cn(collapsed && "hidden md:hidden")}>Sign In</span>
                    </button>
                )}
            </div>
        </aside>
    );
}
