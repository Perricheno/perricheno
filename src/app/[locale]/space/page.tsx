"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconPlus, IconSearch, IconFileText, IconLoader2,
    IconDots, IconTrash, IconCopy, IconShare, IconEdit,
    IconClock, IconUsers, IconBraces,
} from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";
import type { Space } from "@/lib/space-db";
import NewSpaceModal from "./NewSpaceModal";
import SpaceCard from "./SpaceCard";

export default function SpaceDashboard() {
    const t = useTranslations("space");
    const { user, setShowLogin } = useAdmin();
    const router = useRouter();

    const [spaces, setSpaces] = useState<Space[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [newModalOpen, setNewModalOpen] = useState(false);

    useEffect(() => {
        if (!user) { setLoading(false); return; }
        loadSpaces();
    }, [user]);

    const loadSpaces = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/space');
            if (res.ok) {
                const { spaces } = await res.json();
                setSpaces(spaces);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t("deleteConfirm"))) return;
        await fetch(`/api/space/${id}`, { method: 'DELETE' });
        setSpaces(prev => prev.filter(s => s.id !== id));
    };

    const handleDuplicate = async (id: string) => {
        const res = await fetch(`/api/space/${id}/duplicate`, { method: 'POST' });
        if (res.ok) loadSpaces();
    };

    const filtered = spaces.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase())
    );

    if (!user) {
        return (
            <div className="min-h-screen bg-[#FBFBFC] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-lg flex items-center justify-center mx-auto mb-5">
                        <IconBraces className="w-8 h-8 text-black" />
                    </div>
                    <h1 className="text-2xl font-black text-black mb-2">{t("title")}</h1>
                    <p className="text-sm text-gray-400 mb-6">{t("subtitle")}</p>
                    <button onClick={() => setShowLogin(true)} className="px-6 py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-all">
                        {t("signIn")}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FBFBFC]">
            {/* Header */}
            <div className="border-b border-[#e5e5e5] bg-white sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <img src="/Vector.svg" alt="" className="w-5 h-5 opacity-30" />
                        <span className="text-[13px] font-black uppercase tracking-widest text-black">Space</span>
                    </div>
                    <div className="flex items-center gap-3 flex-1 max-w-sm">
                        <div className="relative flex-1">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t("searchPlaceholder")}
                                className="w-full pl-8 pr-3 py-1.5 bg-[#f5f5f5] rounded-lg text-[13px] outline-none placeholder:text-gray-400 focus:bg-white focus:ring-1 focus:ring-gray-200 transition-all"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setNewModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-[12px] font-black uppercase tracking-widest hover:bg-[#1a1a1a] transition-all active:scale-95 shadow-sm"
                    >
                        <IconPlus className="w-3.5 h-3.5" />
                        {t("newProject")}
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-10">
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <IconLoader2 className="w-6 h-6 animate-spin text-gray-300" />
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState onNew={() => setNewModalOpen(true)} hasSearch={!!search} />
                ) : (
                    <>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5">
                            {filtered.length} {filtered.length === 1 ? t("projects_singular") : t("projects_plural")}
                        </p>
                        <motion.div
                            layout
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            <AnimatePresence>
                                {filtered.map(space => (
                                    <SpaceCard
                                        key={space.id}
                                        space={space}
                                        onClick={() => router.push(`/space/${space.id}`)}
                                        onDelete={() => handleDelete(space.id)}
                                        onDuplicate={() => handleDuplicate(space.id)}
                                    />
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    </>
                )}
            </div>

            <AnimatePresence>
                {newModalOpen && (
                    <NewSpaceModal
                        onClose={() => setNewModalOpen(false)}
                        onCreate={async (title, template, compiler) => {
                            const res = await fetch('/api/space', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ title, template, compiler }),
                            });
                            if (res.ok) {
                                const { space } = await res.json();
                                router.push(`/space/${space.id}`);
                            }
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function EmptyState({ onNew, hasSearch }: { onNew: () => void; hasSearch: boolean }) {
    const t = useTranslations("space");
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
        >
            <div className="w-20 h-20 rounded-2xl bg-white border border-gray-100 shadow-lg flex items-center justify-center mb-6">
                <IconBraces className="w-10 h-10 text-gray-300" />
            </div>
            {hasSearch ? (
                <>
                    <p className="text-base font-bold text-black mb-1">{t("noProjectsFound")}</p>
                    <p className="text-sm text-gray-400">{t("tryDifferentSearch")}</p>
                </>
            ) : (
                <>
                    <p className="text-base font-bold text-black mb-1">{t("noProjectsYet")}</p>
                    <p className="text-sm text-gray-400 mb-6">{t("createFirstProject")}</p>
                    <button
                        onClick={onNew}
                        className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-[#1a1a1a] transition-all active:scale-95"
                    >
                        <IconPlus className="w-4 h-4" /> {t("newProject")}
                    </button>
                </>
            )}
        </motion.div>
    );
}
