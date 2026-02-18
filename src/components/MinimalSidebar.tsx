"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
    IconHome, IconTerminal2, IconChartBar, 
    IconMessageCircle, IconRobot, IconFileTypePdf,
    IconUser, IconLogin, IconSettings
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";

export default function MinimalSidebar() {
    const pathname = usePathname();
    const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
    const { user, showLogin, setShowLogin, isEditing, setIsEditing } = useAdmin();

    const links = [
        { href: "/", icon: IconHome, label: "Home" },
        { href: "/projects", icon: IconTerminal2, label: "Projects" },
        { href: "/dashboard", icon: IconChartBar, label: "Dashboard" },
        { href: "/agent", icon: IconRobot, label: "Agent" },
        { href: "/chat", icon: IconMessageCircle, label: "Chat" },
        { href: "/pdf", icon: IconFileTypePdf, label: "PDF" },
    ];

    return (
        <nav className="fixed left-0 top-0 bottom-0 w-16 md:w-64 border-r border-[var(--border)] bg-[var(--background)] flex flex-col z-50">
            {/* Login Modal Global Trigger */}
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            {/* Logo Area */}
            <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-[var(--border)]">
                <div className="w-8 h-8 relative">
                   <img src="/logo-dark.png" alt="Logo" className="dark:hidden absolute inset-0 w-full h-full object-contain" />
                   <img src="/logo.png" alt="Logo" className="hidden dark:block absolute inset-0 w-full h-full object-contain" />
                </div>
                <span className="hidden md:block ml-3 font-bold text-lg tracking-tight">Perricheno</span>
            </div>

            {/* Links */}
            <div className="flex-1 py-6 flex flex-col gap-1 px-2 md:px-4">
                {links.map(l => (
                    <Link key={l.href} href={l.href} 
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                            isActive(l.href)                                    ? "bg-[var(--foreground)] text-[var(--background)] shadow-lg"
                                    : "text-[var(--foreground)] hover:bg-[var(--muted)] hover:translate-x-1"
                        )}>
                        <l.icon className="w-5 h-5 shrink-0" stroke={1.5} />
                        <span className="hidden md:block">{l.label}</span>
                    </Link>
                ))}
            </div>

            {/* User / Status Area (Desktop) */}
            <div className="p-4 border-t border-[var(--border)] hidden md:block">
                {user ? (
                    <button onClick={() => setShowLogin(true)} className="flex items-center gap-3 w-full text-left mb-4 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center overflow-hidden">
                            {user.photo_url ? <img src={user.photo_url || ""} alt={user.first_name || "User"} /> : <IconUser className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{user.first_name}</p>
                            <p className="text-[10px] opacity-50 truncate">Online</p>
                        </div>
                        <IconSettings className="w-4 h-4 opacity-50" />
                    </button>
                ) : (
                    <button onClick={() => setShowLogin(true)} 
                        className="w-full flex items-center justify-center gap-2 mb-4 px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors text-sm font-bold">
                        <IconLogin className="w-4 h-4" />
                        <span>Sign In</span>
                    </button>
                )}

                <div className="flex items-center gap-2 text-xs text-[var(--foreground)] opacity-50">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Systems Operational</span>
                </div>
            </div>

            {/* Mobile Auth (Icon only) */}
             <div className="md:hidden pb-4 flex flex-col items-center gap-4">
                <button onClick={() => setShowLogin(true)} className="p-2 rounded-lg hover:bg-[var(--muted)]">
                    {user ? (
                         <div className="w-8 h-8 rounded-full bg-[var(--foreground)] overflow-hidden">
                            {user.photo_url ? <img src={user.photo_url || ""} alt="User" /> : <div className="w-full h-full bg-[var(--foreground)]" />}
                        </div>
                    ) : (
                        <IconLogin className="w-6 h-6 opacity-70" />
                    )}
                </button>
            </div>
        </nav>
    );
}
