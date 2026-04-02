"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
    IconHome, IconTerminal2, IconChartBar, 
    IconRobot, IconFileTypePdf, IconListCheck,
    IconUser, IconLogin, IconSettings,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarLeftExpand, IconLayoutBoard,
    IconSparkles, IconCreditCard
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
        ]
    },
    {
        title: "Activity",
        links: [
            { href: "/canvas", icon: IconLayoutBoard, label: "Canvas" },
            { href: "/agent", icon: IconSparkles, label: "AI Agent" },
            { href: "/pdf", icon: IconFileTypePdf, label: "PDF Tools" },
        ]
    },
    {
        title: "Set Up",
        links: [
            { href: "/settings", icon: IconSettings, label: "Settings" },
            { href: "/billings", icon: IconCreditCard, label: "Billings & Usage" }
        ]
    }
];

// Mobile bottom bar — 5 key items (icons only now)
const MOBILE_NAV: NavLink[] = [
    { href: "/", icon: IconHome, label: "Home" },
    { href: "/canvas", icon: IconLayoutBoard, label: "Canvas" },
    { href: "/pdf", icon: IconFileTypePdf, label: "PDF" },
    { href: "/agent", icon: IconSparkles, label: "Agent" },
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
                "relative left-0 top-0 bottom-0 bg-transparent flex-col z-50 transition-all duration-300",
                "hidden md:flex", // Hide on mobile
                collapsed ? "w-20" : "md:w-[260px]"
            )}>

                {/* Logo Area */}
                <div className="h-16 flex items-center justify-between px-6 pt-4 mb-4">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[var(--radius)] flex items-center justify-center shrink-0 overflow-hidden">
                            <img src="/Vector.svg" alt="Perricheno" className="w-full h-full object-contain" />
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
                                        "group flex items-center justify-between px-3 py-2 rounded-xl transition-all font-medium text-sm",
                                        isActive(l.href)                                            
                                            ? "bg-white text-[var(--foreground)] shadow-sm font-semibold border border-[var(--border)]"
                                            : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5"
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
                                            <kbd className="text-[10px] bg-black/5 px-1.5 py-0.5 rounded text-[var(--muted)]">{l.shortcut.split(" ")[0]}</kbd>
                                            <kbd className="text-[10px] bg-black/5 px-1.5 py-0.5 rounded text-[var(--muted)]">{l.shortcut.split(" ")[1]}</kbd>
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
                        <button onClick={() => setShowLogin(true)} className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-black/5 transition-colors text-left">
                            <div className="w-8 h-8 rounded-full bg-[var(--card)] shadow-sm flex items-center justify-center overflow-hidden shrink-0 border border-[var(--border)]">
                                {user.photo_url ? <img src={user.photo_url || ""} alt={user.first_name || "User"} /> : <IconUser className="w-4 h-4 text-[var(--muted)]" />}
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
            <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden w-full bg-white/95 backdrop-blur-2xl border-t border-gray-100 pb-safe">
                <div className="flex items-center justify-around px-2 pt-2 pb-5">
                    {MOBILE_NAV.map(l => (
                        <Link key={l.href} href={l.href}
                            className="flex flex-col items-center justify-center p-2 relative group w-16 h-14">
                            
                            {/* Active Indicator Background */}
                            <div className={cn(
                                "absolute inset-0 rounded-[18px] transition-all duration-300",
                                isActive(l.href)
                                    ? "bg-gray-100/80 scale-100 opacity-100"
                                    : "bg-transparent scale-90 opacity-0 group-hover:opacity-100 group-hover:bg-gray-50 group-hover:scale-100"
                            )} />

                            {/* Icon */}
                            <l.icon className={cn(
                                "w-6 h-6 z-10 transition-all duration-300 mb-1",
                                isActive(l.href)
                                    ? "text-[#1a1a1a]"
                                    : "text-gray-400"
                            )} stroke={isActive(l.href) ? 2.5 : 1.5} />
                            
                            {/* Label */}
                            <span className={cn(
                                "z-10 text-[10px] font-medium tracking-wide transition-all",
                                isActive(l.href) ? "text-[#1a1a1a]" : "text-gray-400"
                            )}>{l.label}</span>
                        </Link>
                    ))}

                    {/* Settings slot */}
                    <Link href="/settings"
                        className="flex flex-col items-center justify-center p-2 relative group w-16 h-14">
                        <div className={cn(
                            "absolute inset-0 rounded-[18px] transition-all duration-300",
                            isActive("/settings")
                                ? "bg-gray-100/80 scale-100 opacity-100"
                                : "bg-transparent scale-90 opacity-0 group-hover:opacity-100 group-hover:bg-gray-50 group-hover:scale-100"
                        )} />
                        
                        <IconSettings className={cn(
                            "w-6 h-6 z-10 transition-all duration-300 mb-1",
                            isActive("/settings")
                                ? "text-[#1a1a1a]"
                                : "text-gray-400"
                        )} stroke={isActive("/settings") ? 2.5 : 1.5} />
                        
                        <span className={cn(
                            "z-10 text-[10px] font-medium tracking-wide transition-all",
                            isActive("/settings") ? "text-[#1a1a1a]" : "text-gray-400"
                        )}>Settings</span>
                    </Link>
                </div>
            </nav>
        </>
    );
}
