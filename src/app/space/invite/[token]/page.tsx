"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { IconBrandLatex, IconLoader2, IconCheck, IconAlertTriangle, IconLogin } from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";

interface InviteInfo {
    space_id: string;
    email: string;
    role: string;
}

export default function InvitePage() {
    const { token } = useParams() as { token: string };
    const router = useRouter();
    const { user, setShowLogin } = useAdmin();

    const [invite, setInvite]     = useState<InviteInfo | null>(null);
    const [loading, setLoading]   = useState(true);
    const [expired, setExpired]   = useState(false);
    const [accepting, setAccepting] = useState(false);
    const [accepted, setAccepted]   = useState(false);

    useEffect(() => {
        fetch(`/api/space/invite/${token}`)
            .then(r => r.json())
            .then(d => {
                if (d.error) setExpired(true);
                else setInvite(d.invite);
            })
            .finally(() => setLoading(false));
    }, [token]);

    const handleAccept = async () => {
        if (!user) { setShowLogin(true); return; }
        setAccepting(true);
        const res = await fetch(`/api/space/invite/${token}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            setAccepted(true);
            setTimeout(() => router.push(`/space/${data.spaceId}`), 1400);
        } else {
            setExpired(true);
        }
        setAccepting(false);
    };

    return (
        <div className="min-h-screen bg-[#FBFBFC] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-sm"
            >
                {/* Logo */}
                <div className="flex items-center justify-center mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-md flex items-center justify-center">
                        <IconBrandLatex className="w-6 h-6 text-black" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#e5e5e5] shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-14">
                            <IconLoader2 className="w-5 h-5 animate-spin text-gray-300" />
                        </div>
                    ) : expired ? (
                        <div className="p-8 text-center">
                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                                <IconAlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <h2 className="text-[15px] font-black text-black mb-1">Link expired</h2>
                            <p className="text-[13px] text-gray-400 mb-5">This invite link is no longer valid. Ask the project owner for a new one.</p>
                            <button onClick={() => router.push('/space')} className="px-4 py-2 rounded-xl bg-black text-white text-[13px] font-bold hover:bg-[#1a1a1a] transition-all">
                                Go to Space
                            </button>
                        </div>
                    ) : accepted ? (
                        <div className="p-8 text-center">
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4"
                            >
                                <IconCheck className="w-5 h-5 text-emerald-500" />
                            </motion.div>
                            <h2 className="text-[15px] font-black text-black mb-1">Joined!</h2>
                            <p className="text-[13px] text-gray-400">Redirecting to the project…</p>
                        </div>
                    ) : invite ? (
                        <div className="p-7">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Project invite</p>
                            <h2 className="text-[18px] font-black text-black mb-1 leading-tight">You've been invited</h2>
                            <p className="text-[13px] text-gray-500 mb-6">
                                You'll join as <span className="font-bold text-black capitalize">{invite.role}</span>.
                            </p>

                            {!user ? (
                                <div className="space-y-3">
                                    <p className="text-[12px] text-gray-400 text-center">Sign in to accept this invite</p>
                                    <button
                                        onClick={() => setShowLogin(true)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black text-white text-[13px] font-bold hover:bg-[#1a1a1a] transition-all active:scale-95"
                                    >
                                        <IconLogin className="w-4 h-4" />
                                        Sign in
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <button
                                        onClick={handleAccept}
                                        disabled={accepting}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black text-white text-[13px] font-bold hover:bg-[#1a1a1a] transition-all active:scale-95 disabled:opacity-60"
                                    >
                                        {accepting
                                            ? <IconLoader2 className="w-4 h-4 animate-spin" />
                                            : <IconCheck className="w-4 h-4" />
                                        }
                                        {accepting ? 'Joining…' : 'Accept invite'}
                                    </button>
                                    <button
                                        onClick={() => router.push('/space')}
                                        className="w-full py-2 rounded-xl text-[13px] text-gray-400 hover:text-black hover:bg-gray-50 transition-all"
                                    >
                                        Decline
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                <p className="text-center text-[11px] text-gray-300 mt-6">Perricheno Space</p>
            </motion.div>
        </div>
    );
}
