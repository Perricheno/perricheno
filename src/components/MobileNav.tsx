"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
    IconHome, IconTerminal2, IconChartBar, 
    IconMessageCircle, IconFileTypePdf, IconRobot 
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export default function MobileNav() {
    const pathname = usePathname();
    const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

    const links = [
        { href: "/", icon: IconHome, label: "Home" },
        { href: "/projects", icon: IconTerminal2, label: "Projects" },
        { href: "/dashboard", icon: IconChartBar, label: "Stats" },
        { href: "/agent", icon: IconRobot, label: "Agent" },
        { href: "/chat", icon: IconMessageCircle, label: "Chat" },
        { href: "/pdf", icon: IconFileTypePdf, label: "PDF" },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--background)] border-t border-[var(--border)] z-50 flex items-center justify-around px-2 pb-safe">
            {links.map(l => (
                <Link key={l.href} href={l.href} 
                    className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-lg transition-colors w-full",
                        isActive(l.href) 
                            ? "text-[var(--foreground)]" 
                            : "text-[var(--foreground)] opacity-50"
                    )}>
                    <l.icon className={cn("w-6 h-6 mb-1", isActive(l.href) && "stroke-2")} stroke={1.5} />
                    <span className="text-[10px] font-medium tracking-tight">{l.label}</span>
                </Link>
            ))}
        </nav>
    );
}
