"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    IconHome, IconTerminal2, IconChartBar,
    IconRobot, IconFileTypePdf, IconListCheck,
    IconUser, IconLogin, IconSettings,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarLeftExpand, IconLayoutBoard,
    IconSparkles, IconCreditCard, IconBraces, IconBook2,
    IconChartDots2, IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate, useMotionValueEvent, usePresence } from "framer-motion";
import type { PanInfo, Variants } from "framer-motion";

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
            { href: "/r", icon: IconChartDots2, label: "R Studio" },
            { href: "/agent", icon: IconSparkles, label: "AI Agent" },
            { href: "/citations", icon: IconBook2, label: "Citations" },
            { href: "/space", icon: IconBraces, label: "Space" },
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

// Bottom nav: 4 items + Logo button in center
const MOBILE_NAV_LEFT: NavLink[] = [
    { href: "/agent", icon: IconSparkles, label: "Agent" },
    { href: "/r", icon: IconChartDots2, label: "R Studio" },
];
const MOBILE_NAV_RIGHT: NavLink[] = [
    { href: "/pdf", icon: IconFileTypePdf, label: "PDF" },
    { href: "/settings", icon: IconSettings, label: "Settings" },
];

// All pages for the radial spin wheel
const RADIAL_ALL = [
    { href: "/", icon: IconHome, label: "Home" },
    { href: "/canvas", icon: IconLayoutBoard, label: "Canvas" },
    { href: "/r", icon: IconChartDots2, label: "R Studio" },
    { href: "/agent", icon: IconSparkles, label: "Agent" },
    { href: "/citations", icon: IconBook2, label: "Citations" },
    { href: "/space", icon: IconBraces, label: "Space" },
    { href: "/pdf", icon: IconFileTypePdf, label: "PDF" },
    { href: "/billings", icon: IconCreditCard, label: "Billings" },
    { href: "/settings", icon: IconSettings, label: "Settings" },
];

// ─── Animation Variants ───────────────────────────────────────────────────────
const containerVariants: Variants = {
    hidden: {
        opacity: 0,
    },
    visible: {
        opacity: 1,
        transition: {
            duration: 0.15,
            ease: "easeOut"
        }
    },
    exit: {
        opacity: 0,
        transition: {
            duration: 0.15,
            ease: "easeIn",
            delay: 0.05
        }
    }
};

const itemVariants = {
    hidden: {
        scale: 0,
        opacity: 0,
    },
    visible: (custom: { enterDelay: number; exitDelay: number }) => ({
        scale: 1,
        opacity: 1,
        transition: {
            delay: custom.enterDelay,
            type: "spring" as const,
            damping: 18,
            stiffness: 100,
            mass: 1,
        }
    }),
    exit: (custom: { enterDelay: number; exitDelay: number }) => ({
        scale: 0,
        opacity: 0,
        transition: {
            delay: custom.exitDelay,
            duration: 0.25,
            ease: "easeInOut" as const
        }
    })
};

// ─── Ring Item ────────────────────────────────────────────────────────────────
// Separate component so hooks can be called at top level (not inside a loop)
function RingItem({
    index,
    total,
    radiusValue,
    rotationAngle,
    item,
    onClose,
    custom
}: {
    index: number;
    total: number;
    radiusValue: any;
    rotationAngle: any;
    item: (typeof RADIAL_ALL)[number];
    onClose: () => void;
    custom: { enterDelay: number; exitDelay: number };
}) {
    const router = useRouter();
    const baseAngle = (index / total) * 360;

    // Calculate final position based on rotation
    const finalX = useTransform([rotationAngle, radiusValue], ([a, r]: any) => {
        const rad = ((baseAngle + a) * Math.PI) / 180;
        return Math.sin(rad) * r;
    });
    const finalY = useTransform([rotationAngle, radiusValue], ([a, r]: any) => {
        const rad = ((baseAngle + a) * Math.PI) / 180;
        return -Math.cos(rad) * r;
    });
    
    const arcOpacity = useTransform(rotationAngle, (a: number) => {
        const rad = ((baseAngle + a) * Math.PI) / 180;
        const yPos = -Math.cos(rad) * 130;
        const t = (yPos + 130) / (2 * 130); // 0 = top, 1 = bottom
        if (t < 0.36) return 1;
        if (t < 0.58) return Math.max(0, 1 - (t - 0.36) / 0.22);
        return 0;
    });
    const arcScale = useTransform(rotationAngle, (a: number) => {
        const rad = ((baseAngle + a) * Math.PI) / 180;
        const yPos = -Math.cos(rad) * 130;
        const t = (yPos + 130) / (2 * 130);
        return Math.max(0.6, 1 - t * 0.45);
    });
    const pointerEvents = useTransform(arcOpacity, (o: number) =>
        o < 0.15 ? "none" : "auto"
    );

    return (
        <motion.div
            custom={custom}
            variants={itemVariants}
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                pointerEvents,
            }}
            className="flex flex-col items-center justify-center overflow-visible"
        >
            <motion.div
                style={{
                    x: finalX,
                    y: finalY,
                }}
                className="absolute flex items-center justify-center w-0 h-0"
            >
                <motion.div
                    style={{
                        opacity: arcOpacity,
                        scale: arcScale,
                    }}
                >
                <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => {
                        e.stopPropagation();
                        onClose();
                        router.push(item.href);
                    }}
                    className="flex flex-col items-center gap-1.5 select-none"
                >
                    <div className="w-[52px] h-[52px] bg-[#1a1a1a] rounded-[18px] flex items-center justify-center shadow-xl shadow-black/20 active:scale-90 transition-transform duration-100" style={{ willChange: "transform" }}>
                        <item.icon className="w-[22px] h-[22px] text-white" stroke={1.5} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#1a1a1a] whitespace-nowrap">
                        {item.label}
                    </span>
                </button>
            </motion.div>
            </motion.div>
        </motion.div>
    );
}

// ─── Radial Spin Menu ─────────────────────────────────────────────────────────
function RadialSpinMenu({ onClose }: { onClose: () => void }) {
    const initialRot = -20;
    const rotationAngle = useMotionValue(initialRot);
    const radiusValue = useMotionValue(0);

    const { enterDelays, exitDelays } = useMemo(() => {
        const angles = RADIAL_ALL.map((_, i) => {
            const baseAngle = (i / RADIAL_ALL.length) * 360;
            let norm = ((baseAngle + initialRot) % 360 + 360) % 360;
            if (norm > 180) norm -= 360;
            return { index: i, angle: norm };
        });
        
        angles.sort((a, b) => a.angle - b.angle);
        
        const enter = new Array(RADIAL_ALL.length).fill(0);
        const exit = new Array(RADIAL_ALL.length).fill(0);
        
        angles.forEach((item, rank) => {
            enter[item.index] = rank * 0.04 + 0.02;
            exit[item.index] = (angles.length - 1 - rank) * 0.03;
        });
        
        return { enterDelays: enter, exitDelays: exit };
    }, []);

    const [isPresent] = usePresence();

    useEffect(() => {
        if (isPresent) {
            // Spin in on open
            animate(rotationAngle, 0, { type: "spring", damping: 24, stiffness: 110 });
            animate(radiusValue, 130, { type: "spring", damping: 20, stiffness: 120 });
        } else {
            // Spin out on close
            animate(rotationAngle, initialRot, { type: "spring", damping: 24, stiffness: 90 });
            animate(radiusValue, 0, { type: "spring", damping: 24, stiffness: 150 });
        }
    }, [isPresent, rotationAngle, initialRot, radiusValue]);

    const handlePan = (_: PointerEvent, info: PanInfo) => {
        rotationAngle.set(rotationAngle.get() + info.delta.x * 0.42);
    };

    const handlePanEnd = (_: PointerEvent, info: PanInfo) => {
        // Smooth deceleration without snap
        animate(rotationAngle, rotationAngle.get() + info.velocity.x * 0.24, {
            type: "spring",
            damping: 22,
            stiffness: 50,
            mass: 1.1,
        });
    };

    return (
        <motion.div
            className="fixed inset-0 z-[9998] md:hidden"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
        >
            {/* Soft radial blur behind the menu to improve contrast without covering the whole screen */}
            <div 
                className="absolute pointer-events-none"
                style={{
                    bottom: "calc(48px - 250px + env(safe-area-inset-bottom))", // Center Y at the logo
                    left: "50%",
                    marginLeft: -250, // Center X
                    width: 500,
                    height: 500,
                    background: 'radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 70%)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    maskImage: 'radial-gradient(circle, black 40%, transparent 70%)',
                    WebkitMaskImage: 'radial-gradient(circle, black 40%, transparent 70%)',
                }}
            />

            {/* Drag capture zone — transparent, full screen */}
            <motion.div
                className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
                onPan={handlePan}
                onPanEnd={handlePanEnd}
            >
                {/* Drag hint */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { delay: 0, duration: 0.15 } }}
                    transition={{ delay: 0.35 }}
                    className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none text-[9px] font-black uppercase tracking-[0.24em] text-gray-400 drop-shadow-sm"
                    style={{ bottom: 104 }}
                >
                    ← drag to spin →
                </motion.p>

                <div
                    className="absolute pointer-events-none flex justify-center"
                    style={{ bottom: "calc(48px + env(safe-area-inset-bottom))", left: 0, right: 0 }}
                >
                    <div className="relative w-0 h-0 flex items-center justify-center">
                        {RADIAL_ALL.map((item, i) => (
                            <RingItem
                                key={item.href}
                                index={i}
                                total={RADIAL_ALL.length}
                                radiusValue={radiusValue}
                                rotationAngle={rotationAngle}
                                item={item}
                                onClose={onClose}
                                custom={{ enterDelay: enterDelays[i], exitDelay: exitDelays[i] }}
                            />
                        ))}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── MinimalSidebar ───────────────────────────────────────────────────────────
export default function MinimalSidebar() {
    const pathname = usePathname();
    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const [collapsed, setCollapsed] = useState(false);
    const [anchorRect, setAnchorRect] = useState<DOMRect | undefined>(undefined);
    const accountBtnRef = useRef<HTMLButtonElement>(null);
    const [radialOpen, setRadialOpen] = useState(false);

    const NavItem = ({ l }: { l: NavLink }) => (
        <Link
            href={l.href}
            className="flex flex-col items-center justify-center p-2 relative group w-16 h-14"
        >
            <div className={cn(
                "absolute inset-0 rounded-[18px] transition-all duration-300",
                isActive(l.href)
                    ? "bg-gray-100/80 scale-100 opacity-100"
                    : "bg-transparent scale-90 opacity-0 group-hover:opacity-100 group-hover:bg-gray-50 group-hover:scale-100"
            )} />
            <l.icon
                className={cn(
                    "w-6 h-6 z-10 transition-all duration-300 mb-1",
                    isActive(l.href) ? "text-[#1a1a1a]" : "text-gray-400"
                )}
                stroke={isActive(l.href) ? 2.5 : 1.5}
            />
            <span className={cn(
                "z-10 text-[10px] font-medium tracking-wide transition-all",
                isActive(l.href) ? "text-[#1a1a1a]" : "text-gray-400"
            )}>
                {l.label}
            </span>
        </Link>
    );

    return (
        <>
            {showLogin && (
                <LoginModal
                    onSuccess={() => { setIsEditing(true); setShowLogin(false); }}
                    onClose={() => { setShowLogin(false); setAnchorRect(undefined); }}
                    anchorRect={anchorRect}
                />
            )}

            {/* ═══════════════════════════════════════ */}
            {/* Desktop Sidebar - hidden on mobile      */}
            {/* ═══════════════════════════════════════ */}
            <aside className={cn(
                "relative left-0 top-0 bottom-0 bg-transparent flex-col z-50 transition-all duration-300",
                "hidden md:flex",
                collapsed ? "w-20" : "md:w-[260px]"
            )}>
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
                        {collapsed
                            ? <IconLayoutSidebarLeftExpand size={18} />
                            : <IconLayoutSidebarLeftCollapse size={18} />
                        }
                    </button>
                </div>

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

                <div className="p-4 mt-auto">
                    {!collapsed && <h4 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Account</h4>}
                    {user ? (
                        <button
                            ref={accountBtnRef}
                            onClick={() => { setAnchorRect(accountBtnRef.current?.getBoundingClientRect()); setShowLogin(true); }}
                            className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-black/5 transition-colors text-left"
                        >
                            <div className="w-8 h-8 rounded-full bg-[var(--card)] shadow-sm flex items-center justify-center overflow-hidden shrink-0 border border-[var(--border)]">
                                {user.photo_url
                                    ? <img src={user.photo_url || ""} alt={user.first_name || "User"} />
                                    : <IconUser className="w-4 h-4 text-[var(--muted)]" />
                                }
                            </div>
                            <div className={cn("flex-1 min-w-0", collapsed && "hidden")}>
                                <p className="text-sm font-semibold truncate text-[var(--foreground)] leading-tight">{user.first_name}</p>
                                <p className="text-xs text-gray-500 truncate leading-tight">Admin</p>
                            </div>
                        </button>
                    ) : (
                        <button
                            ref={accountBtnRef}
                            onClick={() => { setAnchorRect(accountBtnRef.current?.getBoundingClientRect()); setShowLogin(true); }}
                            className="w-full flex items-center justify-center gap-2 p-2 rounded-[var(--radius)] bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity text-sm font-semibold shadow-sm"
                        >
                            <IconLogin className="w-[18px] h-[18px]" />
                            <span className={cn(collapsed && "hidden")}>Sign In</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* ═══════════════════════════════════════ */}
            {/* Mobile Bottom Nav + Radial Menu         */}
            {/* ═══════════════════════════════════════ */}

            {/* Radial spin menu overlay */}
            <AnimatePresence>
                {radialOpen && <RadialSpinMenu onClose={() => setRadialOpen(false)} />}
            </AnimatePresence>

            <nav className={cn(
                "fixed bottom-0 left-0 right-0 z-[9999] md:hidden w-full pb-safe transition-colors duration-300",
                "bg-white/50 backdrop-blur-xl border-t border-gray-200/50"
            )}>
                <div className="flex items-center justify-between px-2 pt-2 pb-5 relative">

                    {/* Left items */}
                    <div className="flex items-center justify-around w-[40%]">
                        {MOBILE_NAV_LEFT.map(l => (
                            <div key={l.href} className="transition-all duration-300 opacity-100 scale-100">
                                <NavItem l={l} />
                            </div>
                        ))}
                    </div>

                    {/* ── Center Logo Button ── */}
                    <div className="absolute inset-x-0 bottom-[20px] flex justify-center pointer-events-none z-10">
                        <button
                            onClick={() => setRadialOpen(v => !v)}
                            className="pointer-events-auto flex items-center justify-center w-16 h-14"
                        >
                        <motion.div
                            animate={{ rotate: radialOpen ? 180 : 0, scale: radialOpen ? 1.08 : 1 }}
                            transition={{ type: "spring", damping: 20, stiffness: 280 }}
                            className="w-14 h-14 rounded-full bg-[#1a1a1a] flex items-center justify-center shadow-2xl shadow-black/30 border-[3px] border-white"
                        >
                            <AnimatePresence mode="wait">
                                {radialOpen ? (
                                    <motion.div
                                        key="close"
                                        initial={{ opacity: 0, rotate: -90 }}
                                        animate={{ opacity: 1, rotate: 0 }}
                                        exit={{ opacity: 0, rotate: 90 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <IconX className="w-5 h-5 text-white" stroke={2.5} />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="logo"
                                        initial={{ opacity: 0, rotate: 90 }}
                                        animate={{ opacity: 1, rotate: 0 }}
                                        exit={{ opacity: 0, rotate: -90 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <img src="/Vector.svg" alt="P" className="w-6 h-6 invert brightness-200" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                        </button>
                    </div>

                    {/* Right items */}
                    <div className="flex items-center justify-around w-[40%]">
                        {MOBILE_NAV_RIGHT.map(l => (
                            <div key={l.href} className="transition-all duration-300 opacity-100 scale-100">
                                <NavItem l={l} />
                            </div>
                        ))}
                    </div>
                </div>
            </nav>
        </>
    );
}
