"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { IconX, IconUser, IconTrash, IconLogout, IconBrandTelegram, IconLoader2, IconQrcode } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAdmin } from "@/components/AdminContext";

export const LoginModal = ({ onSuccess, onGuestSuccess, onClose, anchorRect }: { onSuccess: () => void; onGuestSuccess?: (name: string) => void; onClose: () => void; anchorRect?: DOMRect }) => {
    // Desktop popover mode: anchorRect provided + viewport ≥ 768px
    // Use state to avoid hydration mismatch (window not available on SSR)
    const [isWide, setIsWide] = useState<boolean | null>(null);
    useEffect(() => { setIsWide(window.innerWidth >= 768); }, []);
    const isPopover = !!anchorRect && isWide === true;
    const { user, login, logout, deleteAccount } = useAdmin();
    const [error, setError] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Deep Link Auth State
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [deepLink, setDeepLink] = useState<string | null>(null);
    const [authPhase, setAuthPhase] = useState<"idle" | "waiting" | "success">("idle");
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const [qrVisible, setQrVisible] = useState(false);

    // Generate a deep link token on mount (for sign-in view)
    const generateLink = useCallback(async () => {
        setError("");
        setAuthPhase("idle");
        try {
            const res = await fetch("/api/auth/link", { method: "POST" });
            const data = await res.json();
            if (data.token && data.deepLink) {
                setAuthToken(data.token);
                setDeepLink(data.deepLink);
                setAuthPhase("waiting");
            } else {
                setError("Failed to generate login link.");
            }
        } catch (err) {
            setError("Network error. Please try again.");
        }
    }, []);

    useEffect(() => {
        if (!user) {
            generateLink();
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [user, generateLink]);

    // Poll for authentication completion
    useEffect(() => {
        if (authPhase !== "waiting" || !authToken) return;

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/auth/poll?token=${authToken}`);
                const data = await res.json();

                if (data.status === "completed") {
                    setAuthPhase("success");
                    if (pollRef.current) clearInterval(pollRef.current);
                    // Small delay for the success animation, then reload
                    setTimeout(() => {
                        window.location.reload();
                    }, 800);
                } else if (data.status === "expired") {
                    setError("Link expired. Generating new one...");
                    if (pollRef.current) clearInterval(pollRef.current);
                    setTimeout(() => generateLink(), 1000);
                }
            } catch {
                // Silently retry
            }
        }, 2000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [authPhase, authToken, generateLink]);

    // QR code as inline SVG (simple data matrix - no external deps needed)
    const qrDataUrl = deepLink
        ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(deepLink)}&bgcolor=FFFFFF&color=1A1A1A&margin=8`
        : null;

    // Popover position: anchored above the Account button (left-side sidebar)
    // While we haven't resolved viewport width yet (anchorRect mode), don't flash fullscreen
    if (anchorRect && isWide === null) return null;

    const popoverStyle = isPopover && anchorRect ? {
        position: "fixed" as const,
        bottom: window.innerHeight - anchorRect.top + 8,
        left: Math.max(8, anchorRect.left),
        width: 340,
        zIndex: 200,
    } : undefined;

    const innerContent = (
        <>
            {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-10"
                    >
                        <IconX className="w-4 h-4 text-gray-500" />
                    </button>

                    {user ? (
                        /* ── Logged In View ── */
                        <div className="p-8 pt-10">
                            {/* Profile header */}
                            <div className="flex flex-col items-center text-center mb-8">
                                <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden mb-4 shadow-lg">
                                    {user.photo_url
                                        ? <img src={user.photo_url} alt={user.first_name || ""} className="w-full h-full object-cover" />
                                        : <IconUser className="w-8 h-8 text-gray-400" />
                                    }
                                </div>
                                <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight">{user.first_name}</h2>
                                <p className="text-sm text-gray-400 font-medium mt-0.5">@{user.username || "user"}</p>
                                <span className="mt-3 px-4 py-1.5 bg-[#1a1a1a] text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                                    {user.account_tier || "Free Tier"}
                                </span>
                            </div>

                            {/* Account info */}
                            <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-400">Telegram ID</span>
                                    <span className="text-xs font-bold text-gray-600 font-mono">{user.telegram_id}</span>
                                </div>
                                <div className="border-t border-gray-100" />
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-400">Member since</span>
                                    <span className="text-xs font-bold text-gray-600">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-3">
                                <button
                                    onClick={() => { logout(); onClose(); }}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-100 text-[#1a1a1a] rounded-2xl font-bold text-sm hover:bg-gray-200 transition-colors"
                                >
                                    <IconLogout className="w-4 h-4" /> Sign Out
                                </button>

                                {!confirmDelete ? (
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="w-full flex items-center justify-center gap-2 py-3.5 border border-red-200 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-50 transition-colors"
                                    >
                                        <IconTrash className="w-4 h-4" /> Delete Account
                                    </button>
                                ) : (
                                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                                        <p className="text-xs font-medium text-red-600 mb-3 text-center">This will permanently delete all your data. Are you sure?</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setConfirmDelete(false)}
                                                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => { deleteAccount(); onClose(); }}
                                                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-xs hover:bg-red-600 transition-colors"
                                            >
                                                Confirm Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* ── Sign In View - Deep Link Auth ── */
                        <div className="p-8 pt-10">
                            {/* Header */}
                            <div className="flex flex-col items-center text-center mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 flex items-center justify-center mb-5 shadow-lg">
                                    <img src="/newlogo.png" alt="Perricheno" className="w-10 h-10 object-contain" />
                                </div>
                                <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight mb-1">Welcome</h2>
                                <p className="text-sm text-gray-400 font-medium">Sign in instantly via Telegram</p>
                            </div>

                            {/* Auth Card */}
                            <div className="bg-gray-50 rounded-2xl p-6 flex flex-col items-center">
                                {authPhase === "success" ? (
                                    /* Success State */
                                    <div className="flex flex-col items-center gap-3 py-4">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", damping: 10 }}
                                            className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center"
                                        >
                                            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </motion.div>
                                        <p className="text-sm font-bold text-green-600">Authenticated!</p>
                                        <p className="text-[11px] text-gray-400">Loading your account...</p>
                                    </div>
                                ) : authPhase === "waiting" && deepLink ? (
                                    /* Waiting for Telegram confirmation */
                                    <>
                                        {/* Status indicator */}
                                        <div className="flex items-center gap-2 mb-5">
                                            <span className="relative flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                                            </span>
                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Waiting for confirmation</span>
                                        </div>

                                        {/* QR Code (toggle) */}
                                        {qrVisible && qrDataUrl && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mb-5 bg-white rounded-2xl p-4 border border-gray-200 shadow-sm"
                                            >
                                                <img
                                                    src={qrDataUrl}
                                                    alt="QR Code"
                                                    className="w-[180px] h-[180px] mx-auto"
                                                    loading="eager"
                                                />
                                                <p className="text-[10px] text-gray-400 text-center mt-2 font-medium">Scan with your phone camera</p>
                                            </motion.div>
                                        )}

                                        {/* Main CTA */}
                                        <a
                                            href={deepLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex items-center justify-center gap-2.5 py-4 bg-[#1A1A1A] text-white rounded-2xl font-black text-[12px] uppercase tracking-widest hover:bg-black transition-all active:scale-[0.98] shadow-xl shadow-black/10"
                                        >
                                            <IconBrandTelegram className="w-5 h-5" /> Open in Telegram
                                        </a>

                                        {/* QR Toggle */}
                                        <button
                                            onClick={() => setQrVisible(!qrVisible)}
                                            className="mt-4 flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 font-bold uppercase tracking-widest transition-colors"
                                        >
                                            <IconQrcode className="w-3.5 h-3.5" />
                                            {qrVisible ? "Hide QR Code" : "Show QR Code"}
                                        </button>

                                        {/* Instructions */}
                                        <div className="mt-5 pt-5 border-t border-gray-200 w-full">
                                            <div className="space-y-2.5">
                                                <div className="flex items-start gap-3">
                                                    <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                                                    <p className="text-[11px] text-gray-500 font-medium leading-relaxed">Click the button above or scan the QR code</p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                                                    <p className="text-[11px] text-gray-500 font-medium leading-relaxed">Press <strong>"Start"</strong> in the Telegram bot</p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <span className="w-5 h-5 rounded-full bg-[#1a1a1a] text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
                                                    <p className="text-[11px] text-gray-500 font-medium leading-relaxed">This page will update automatically</p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    /* Loading initial link */
                                    <div className="flex flex-col items-center gap-3 py-6">
                                        <IconLoader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Generating secure link...</p>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-xs font-medium text-center p-3 rounded-2xl">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
        </>
    );

    if (isPopover && anchorRect) {
        return (
            <>
                <div className="fixed inset-0 z-[199]" onClick={onClose} />
                <motion.div
                    onClick={e => e.stopPropagation()}
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ type: "spring", damping: 30, stiffness: 420 }}
                    style={popoverStyle}
                    className="bg-white rounded-[24px] shadow-2xl shadow-black/15 border border-[#ebebeb] relative overflow-hidden"
                >
                    {innerContent}
                </motion.div>
            </>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xl"
                onClick={onClose}
            >
                <motion.div
                    onClick={e => e.stopPropagation()}
                    initial={{ scale: 0.92, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 20 }}
                    transition={{ type: "spring", damping: 28, stiffness: 380 }}
                    className="w-full max-w-[420px] mx-4 bg-white rounded-[28px] shadow-2xl shadow-black/20 relative overflow-hidden"
                >
                    {innerContent}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
