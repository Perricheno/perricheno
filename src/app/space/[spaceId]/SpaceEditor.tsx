"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconLoader2, IconUserPlus } from "@tabler/icons-react";
import type { Space, SpaceFile, Compiler } from "@/lib/space-db";

import TopBar from "./components/TopBar";
import FileTree, { type FileEntry } from "./components/FileTree";
import LatexEditor from "./components/LatexEditor";
import PdfPreview from "./components/PdfPreview";
import CompilerLog from "./components/CompilerLog";

// ── Tab ────────────────────────────────────────────────────────────────────

interface EditorTab {
    path: string;
    content: string;
    savedContent: string;   // last version persisted to server
}

// ── Resizable splitter ─────────────────────────────────────────────────────

function Splitter({ onDrag }: { onDrag: (dx: number) => void }) {
    const dragging = useRef(false);
    const last = useRef(0);

    const onMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        last.current = e.clientX;
        e.preventDefault();
    };

    useEffect(() => {
        const move = (e: MouseEvent) => {
            if (!dragging.current) return;
            onDrag(e.clientX - last.current);
            last.current = e.clientX;
        };
        const up = () => { dragging.current = false; };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    }, [onDrag]);

    return (
        <div
            onMouseDown={onMouseDown}
            className="w-1 shrink-0 bg-[#2a2a2a] hover:bg-blue-500/50 cursor-col-resize transition-colors active:bg-blue-500 relative group"
        >
            <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
    );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
    initialSpace: Space;
    initialFiles: SpaceFile[];
    userId: number;
    readOnly?: boolean;
}

type CompileStatus = 'idle' | 'compiling' | 'success' | 'error';

export default function SpaceEditor({ initialSpace, initialFiles, userId, readOnly = false }: Props) {
    const router = useRouter();
    const [space, setSpace] = useState<Space>(initialSpace);
    const [files, setFiles]  = useState<FileEntry[]>(
        initialFiles.map(f => ({ path: f.path, mime_type: f.mime_type, size_bytes: f.size_bytes, updated_at: f.updated_at, is_binary: f.is_binary }))
    );

    // Tabs
    const [tabs, setTabs]           = useState<EditorTab[]>([]);
    const [activeTab, setActiveTab] = useState<string | null>(null);

    // Compilation
    const [compileStatus, setCompileStatus] = useState<CompileStatus>('idle');
    const [pdfUrl, setPdfUrl]               = useState<string | null>(null);
    const [compileLog, setCompileLog]       = useState<string | null>(null);
    const [logOpen, setLogOpen]             = useState(false);

    // Jump-to-line from log
    const [goToLine, setGoToLine] = useState<number | null>(null);

    // Cursor / stats
    const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1, words: 0, chars: 0 });

    // Panels widths (px)
    const [treeWidth, setTreeWidth]     = useState(220);
    const [editorWidth, setEditorWidth] = useState(0); // 0 = fill flex-1
    const [previewWidth, setPreviewWidth] = useState(480);

    // Modal states
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [shareOpen, setShareOpen]       = useState(false);
    const [inviteOpen, setInviteOpen]     = useState(false);
    const [savingSnapshot, setSavingSnapshot] = useState(false);

    // New-file prompt
    const [newFilePrompt, setNewFilePrompt] = useState<{ parent: string } | null>(null);
    const [newFileName, setNewFileName]     = useState("");

    // Auto-compile timer
    const autoCompileTimer = useRef<NodeJS.Timeout | null>(null);
    const [autoCompile, setAutoCompile] = useState(space.auto_compile);

    // ── Open file ───────────────────────────────────────────────────────────

    const openFile = useCallback(async (path: string) => {
        // Already open?
        if (tabs.find(t => t.path === path)) { setActiveTab(path); return; }
        const res = await fetch(`/api/space/${space.id}/files/${path}`);
        if (!res.ok) return;
        const { file } = await res.json() as { file: SpaceFile };
        const content = file.content ?? '';
        setTabs(prev => [...prev, { path, content, savedContent: content }]);
        setActiveTab(path);
    }, [tabs, space.id]);

    // Open main file on mount
    useEffect(() => {
        if (files.length > 0 && tabs.length === 0) {
            openFile(space.main_file);
        }
    }, []);

    // ── Save (debounced) ────────────────────────────────────────────────────

    const saveFile = useCallback(async (path: string, content: string) => {
        await fetch(`/api/space/${space.id}/files/${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        setTabs(prev => prev.map(t => t.path === path ? { ...t, savedContent: content } : t));
    }, [space.id]);

    const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});

    const handleContentChange = (path: string, value: string) => {
        setTabs(prev => prev.map(t => t.path === path ? { ...t, content: value } : t));
        if (readOnly) return;

        // Debounced save
        if (saveTimers.current[path]) clearTimeout(saveTimers.current[path]);
        saveTimers.current[path] = setTimeout(() => {
            saveFile(path, value);
            // Auto-compile after save
            if (autoCompile) {
                if (autoCompileTimer.current) clearTimeout(autoCompileTimer.current);
                autoCompileTimer.current = setTimeout(handleCompile, 2000);
            }
        }, 800);
    };

    // Ctrl+S handler
    useEffect(() => {
        if (readOnly) return;
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (!activeTab) return;
                const tab = tabs.find(t => t.path === activeTab);
                if (tab) saveFile(tab.path, tab.content);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [activeTab, tabs, saveFile, readOnly]);

    // ── Compile ─────────────────────────────────────────────────────────────

    const handleCompile = useCallback(async () => {
        if (compileStatus === 'compiling') return;
        setCompileStatus('compiling');
        setLogOpen(false);

        // Save all dirty tabs before compiling
        const dirty = tabs.filter(t => t.content !== t.savedContent);
        if (dirty.length > 0) {
            await Promise.all(dirty.map((t: EditorTab) => saveFile(t.path, t.content)));
        }

        try {
            const res = await fetch(`/api/space/${space.id}/compile`, { method: 'POST' });
            const ct = res.headers.get('content-type') ?? '';

            if (ct.includes('application/pdf')) {
                const blob = await res.blob();
                if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                setPdfUrl(URL.createObjectURL(blob));
                setCompileLog(null);
                setCompileStatus('success');
                // Auto-snapshot after successful compile (non-blocking)
                if (!readOnly) {
                    fetch(`/api/space/${space.id}/versions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ label: `Compiled – ${new Date().toLocaleTimeString()}` }),
                    }).catch(() => {});
                }
            } else {
                const data = await res.json();
                setCompileLog(data.log ?? 'Unknown error');
                setCompileStatus('error');
                setLogOpen(true);
            }
        } catch (e: any) {
            setCompileLog(String(e?.message ?? e));
            setCompileStatus('error');
            setLogOpen(true);
        }
    }, [compileStatus, activeTab, tabs, space.id, pdfUrl, saveFile]);

    // Ctrl+Enter → compile
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleCompile();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleCompile]);

    // ── File ops ────────────────────────────────────────────────────────────

    const handleNewFile = async (parent = '') => {
        setNewFileName(parent ? `${parent}/` : '');
        setNewFilePrompt({ parent });
    };

    const confirmNewFile = async () => {
        const path = newFileName.trim();
        if (!path) return;
        await fetch(`/api/space/${space.id}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content: '' }),
        });
        setFiles(prev => [...prev, { path, mime_type: 'text/plain', size_bytes: 0, updated_at: new Date().toISOString(), is_binary: false }]);
        setNewFilePrompt(null);
        await openFile(path);
    };

    const handleRename = async (oldPath: string, newPath: string) => {
        if (!newPath || newPath === oldPath) return;
        await fetch(`/api/space/${space.id}/files/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: oldPath, to: newPath }),
        });
        setFiles(prev => prev.map(f => f.path === oldPath ? { ...f, path: newPath } : f));
        setTabs(prev => prev.map(t => t.path === oldPath ? { ...t, path: newPath } : t));
        if (activeTab === oldPath) setActiveTab(newPath);
    };

    const handleDelete = async (path: string) => {
        if (!confirm(`Delete "${path}"?`)) return;
        await fetch(`/api/space/${space.id}/files/${path}`, { method: 'DELETE' });
        setFiles(prev => prev.filter(f => f.path !== path));
        setTabs(prev => prev.filter(t => t.path !== path));
        if (activeTab === path) setActiveTab(tabs.find(t => t.path !== path)?.path ?? null);
    };

    const [uploading, setUploading] = useState<string[]>([]);

    const handleUploadFiles = async (fileList: FileList) => {
        const items = Array.from(fileList);
        setUploading(items.map(f => f.name));
        await Promise.all(items.map(async (file) => {
            const form = new FormData();
            form.append('file', file);
            const res = await fetch(`/api/space/${space.id}/files/upload`, { method: 'POST', body: form });
            if (res.ok) {
                const data = await res.json();
                setFiles(prev => {
                    if (prev.find(f => f.path === data.path)) return prev;
                    return [...prev, { path: data.path, mime_type: file.type || 'application/octet-stream', size_bytes: file.size, updated_at: new Date().toISOString(), is_binary: true }];
                });
            }
        }));
        setUploading([]);
    };

    const handleCloseTab = (path: string) => {
        const remaining = tabs.filter(t => t.path !== path);
        setTabs(remaining);
        if (activeTab === path) setActiveTab(remaining[remaining.length - 1]?.path ?? null);
    };

    const handleSaveSnapshot = async () => {
        if (savingSnapshot || readOnly) return;
        const msg = window.prompt('Snapshot message (optional):') ?? '';
        setSavingSnapshot(true);
        await fetch(`/api/space/${space.id}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: `Checkpoint – ${new Date().toLocaleTimeString()}`, message: msg || undefined }),
        });
        setSavingSnapshot(false);
    };

    const handleExport = () => {
        const a = document.createElement('a');
        a.href = `/api/space/${space.id}/export`;
        a.click();
    };

    const handleChangeCompiler = async (compiler: Compiler) => {
        await fetch(`/api/space/${space.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ compiler }),
        });
        setSpace(s => ({ ...s, compiler }));
    };

    const handleToggleAutoCompile = async () => {
        const next = !autoCompile;
        setAutoCompile(next);
        await fetch(`/api/space/${space.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auto_compile: next }),
        });
    };

    // ── Derived state ───────────────────────────────────────────────────────

    const activeTabData = tabs.find(t => t.path === activeTab);
    const isDirty = !!activeTabData && activeTabData.content !== activeTabData.savedContent;
    const previewStatus = compileStatus === 'compiling' ? 'loading'
        : compileStatus === 'error' ? 'error'
        : pdfUrl ? 'ready' : 'empty';

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-screen w-screen bg-[#141414] overflow-hidden">
            <TopBar
                space={space}
                compileStatus={compileStatus}
                autoCompile={autoCompile}
                onCompile={handleCompile}
                onToggleAutoCompile={handleToggleAutoCompile}
                onChangeCompiler={handleChangeCompiler}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenHistory={() => router.push(`/space/${space.id}/history`)}
                onOpenShare={() => setShareOpen(true)}
                onOpenInvite={() => setInviteOpen(true)}
                onExport={handleExport}
                onSaveSnapshot={handleSaveSnapshot}
                savingSnapshot={savingSnapshot}
                dirty={isDirty}
                readOnly={readOnly}
            />

            {/* Main workspace */}
            <div className="flex flex-1 overflow-hidden">
                {/* File tree */}
                <div style={{ width: treeWidth, minWidth: 160, maxWidth: 400 }} className="shrink-0">
                    <FileTree
                        files={files}
                        activeFile={activeTab}
                        mainFile={space.main_file}
                        onOpenFile={openFile}
                        onNewFile={handleNewFile}
                        onRename={handleRename}
                        onDelete={handleDelete}
                        onUploadFiles={handleUploadFiles}
                        readOnly={readOnly}
                    />
                </div>

                <Splitter onDrag={dx => setTreeWidth(w => Math.max(160, Math.min(400, w + dx)))} />

                {/* Editor + log column */}
                <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Tabs bar */}
                    <div className="flex items-end gap-0 bg-[#1a1a1a] border-b border-[#2a2a2a] overflow-x-auto shrink-0">
                        {tabs.map(tab => {
                            const dirty = tab.content !== tab.savedContent;
                            const active = tab.path === activeTab;
                            return (
                                <button
                                    key={tab.path}
                                    onClick={() => setActiveTab(tab.path)}
                                    className={`flex items-center gap-2 px-4 py-2 text-[12px] font-medium border-r border-[#2a2a2a] shrink-0 transition-colors group/tab ${
                                        active ? 'bg-[#141414] text-white border-t-2 border-t-blue-500' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e1e1e]'
                                    }`}
                                >
                                    <span className="truncate max-w-[120px]">
                                        {dirty && <span className="mr-1 text-amber-400">•</span>}
                                        {tab.path.split('/').pop()}
                                    </span>
                                    <span
                                        onClick={e => { e.stopPropagation(); handleCloseTab(tab.path); }}
                                        className="text-gray-700 hover:text-white opacity-0 group-hover/tab:opacity-100 transition-all rounded p-0.5 hover:bg-white/10 ml-1"
                                    >
                                        <IconX className="w-3 h-3" />
                                    </span>
                                </button>
                            );
                        })}
                        {tabs.length === 0 && (
                            <span className="px-4 py-2 text-[11px] text-gray-700 italic">No file open</span>
                        )}
                    </div>

                    {/* Editor */}
                    <div className="flex-1 overflow-hidden">
                        {activeTabData ? (
                            <div className="flex flex-col h-full">
                                <div className="flex-1 overflow-hidden">
                                    <LatexEditor
                                        content={activeTabData.content}
                                        onChange={val => handleContentChange(activeTabData.path, val)}
                                        goToLine={goToLine}
                                        readOnly={readOnly}
                                        onCursorChange={setCursorInfo}
                                    />
                                </div>
                                {/* Status bar */}
                                <div className="flex items-center gap-3 px-3 py-0.5 bg-[#1a1a1a] border-t border-[#2a2a2a] shrink-0">
                                    <span className="text-[10px] text-gray-600 font-mono">
                                        Ln {cursorInfo.line}, Col {cursorInfo.col}
                                    </span>
                                    <span className="text-[10px] text-gray-700">·</span>
                                    <span className="text-[10px] text-gray-600 font-mono">
                                        {cursorInfo.words.toLocaleString()} words
                                    </span>
                                    <span className="text-[10px] text-gray-700">·</span>
                                    <span className="text-[10px] text-gray-600 font-mono">
                                        {cursorInfo.chars.toLocaleString()} chars
                                    </span>
                                    {readOnly && (
                                        <>
                                            <span className="text-[10px] text-gray-700">·</span>
                                            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wide">read-only</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-700 text-[13px]">
                                Open a file from the sidebar
                            </div>
                        )}
                    </div>

                    {/* Compiler log panel */}
                    <AnimatePresence>
                        {logOpen && compileLog && (
                            <motion.div
                                key="log"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 220, opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                className="shrink-0 overflow-hidden"
                            >
                                <CompilerLog
                                    log={compileLog}
                                    spaceId={space.id}
                                    activeFile={activeTab ?? undefined}
                                    activeCode={activeTabData?.content}
                                    onJumpToLine={(file, line) => {
                                        const tabPath = tabs.find(t => t.path === file || t.path.endsWith(file))?.path;
                                        if (tabPath) { setActiveTab(tabPath); setGoToLine(line); setTimeout(() => setGoToLine(null), 500); }
                                        else { openFile(file).then(() => { setGoToLine(line); setTimeout(() => setGoToLine(null), 500); }); }
                                    }}
                                    onClose={() => setLogOpen(false)}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <Splitter onDrag={dx => setPreviewWidth(w => Math.max(280, Math.min(900, w - dx)))} />

                {/* PDF Preview */}
                <div style={{ width: previewWidth, minWidth: 280 }} className="shrink-0">
                    <PdfPreview
                        pdfUrl={pdfUrl}
                        status={previewStatus}
                        errorLog={compileLog}
                        onGoToLine={line => setGoToLine(line)}
                    />
                </div>
            </div>

            {/* Upload progress toast */}
            <AnimatePresence>
                {uploading.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-2xl"
                    >
                        <IconLoader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span className="text-[12px] text-white">Uploading {uploading.length} file{uploading.length > 1 ? 's' : ''}…</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* New file prompt */}
            <AnimatePresence>
                {newFilePrompt !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
                        onClick={e => { if (e.target === e.currentTarget) setNewFilePrompt(null); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ duration: 0.15 }}
                            className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-5 w-80 shadow-2xl"
                        >
                            <h3 className="text-[13px] font-bold text-white mb-3">New file</h3>
                            <input
                                autoFocus
                                value={newFileName}
                                onChange={e => setNewFileName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') confirmNewFile(); if (e.key === 'Escape') setNewFilePrompt(null); }}
                                placeholder="filename.tex"
                                className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-[13px] text-white outline-none focus:border-blue-500 transition-colors font-mono"
                            />
                            <div className="flex gap-2 mt-3 justify-end">
                                <button onClick={() => setNewFilePrompt(null)} className="px-3 py-1.5 rounded-lg text-[12px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                                <button onClick={confirmNewFile} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-bold transition-colors">Create</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Settings modal */}
            <AnimatePresence>
                {settingsOpen && (
                    <ProjectSettingsModal
                        space={space}
                        userId={userId}
                        onClose={() => setSettingsOpen(false)}
                        onOpenInvite={() => { setSettingsOpen(false); setInviteOpen(true); }}
                        onSave={async (patch) => {
                            await fetch(`/api/space/${space.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
                            setSpace(s => ({ ...s, ...patch }));
                            setSettingsOpen(false);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Share modal */}
            <AnimatePresence>
                {shareOpen && (
                    <ShareModal
                        space={space}
                        onClose={() => setShareOpen(false)}
                        onTogglePublic={async (enable) => {
                            const res = await fetch(`/api/space/${space.id}/share`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ enabled: enable }),
                            });
                            const data = await res.json();
                            setSpace(s => ({ ...s, is_public: enable, share_id: data.shareId ?? s.share_id }));
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Invite modal */}
            <AnimatePresence>
                {inviteOpen && (
                    <InviteModal
                        spaceId={space.id}
                        onClose={() => setInviteOpen(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Project Settings Modal ─────────────────────────────────────────────────

interface Collaborator {
    user_id: number;
    role: string;
    first_name?: string | null;
    username?: string | null;
    photo_url?: string | null;
}

const ROLE_COLORS: Record<string, string> = {
    owner:  'bg-amber-500/15 text-amber-400',
    editor: 'bg-blue-500/15 text-blue-400',
    viewer: 'bg-gray-500/15 text-gray-400',
};

function ProjectSettingsModal({ space, userId, onClose, onSave, onOpenInvite }: {
    space: Space;
    userId: number;
    onClose: () => void;
    onSave: (patch: Partial<Space>) => Promise<void>;
    onOpenInvite: () => void;
}) {
    const [tab, setTab]           = useState<'general' | 'people'>('general');
    const [title, setTitle]       = useState(space.title);
    const [mainFile, setMainFile] = useState(space.main_file);
    const [saving, setSaving]     = useState(false);

    // People tab state
    const [collabs, setCollabs]       = useState<Collaborator[]>([]);
    const [collabsLoaded, setCollabsLoaded] = useState(false);
    const [removing, setRemoving]     = useState<number | null>(null);

    useEffect(() => {
        if (tab !== 'people' || collabsLoaded) return;
        fetch(`/api/space/${space.id}/collaborators`)
            .then(r => r.json())
            .then(d => { setCollabs(d.collaborators ?? []); setCollabsLoaded(true); });
    }, [tab, collabsLoaded, space.id]);

    const removeCollab = async (targetId: number) => {
        setRemoving(targetId);
        await fetch(`/api/space/${space.id}/collaborators/${targetId}`, { method: 'DELETE' });
        setCollabs((prev: Collaborator[]) => prev.filter((c: Collaborator) => c.user_id !== targetId));
        setRemoving(null);
    };

    const isOwner = collabs.find((c: Collaborator) => c.user_id === userId)?.role === 'owner';

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md bg-[#1e1e1e] border border-[#333] rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
                    <h2 className="text-[13px] font-black text-white uppercase tracking-widest">Project Settings</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                        <IconX className="w-4 h-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#2a2a2a]">
                    {(['general', 'people'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-5 py-2.5 text-[12px] font-bold capitalize transition-colors relative ${
                                tab === t ? 'text-white' : 'text-gray-600 hover:text-gray-400'
                            }`}
                        >
                            {t}
                            {tab === t && (
                                <motion.div layoutId="settings-tab-indicator"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                                    transition={{ duration: 0.18 }}
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* General tab */}
                {tab === 'general' && (
                    <>
                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Title</label>
                                <input value={title} onChange={e => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl text-[13px] text-white outline-none focus:border-blue-500 transition-colors" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Main file</label>
                                <input value={mainFile} onChange={e => setMainFile(e.target.value)}
                                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl text-[13px] text-white font-mono outline-none focus:border-blue-500 transition-colors"
                                    placeholder="main.tex" />
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t border-[#2a2a2a] flex justify-end gap-2">
                            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                            <button
                                disabled={saving}
                                onClick={async () => { setSaving(true); await onSave({ title, main_file: mainFile }); setSaving(false); }}
                                className="px-4 py-2 rounded-xl bg-white text-black text-[12px] font-bold hover:bg-gray-100 transition-colors flex items-center gap-2 disabled:opacity-50">
                                {saving && <IconLoader2 className="w-3.5 h-3.5 animate-spin" />} Save
                            </button>
                        </div>
                    </>
                )}

                {/* People tab */}
                {tab === 'people' && (
                    <div className="flex flex-col" style={{ minHeight: 220 }}>
                        {!collabsLoaded ? (
                            <div className="flex items-center justify-center flex-1 py-10">
                                <IconLoader2 className="w-4 h-4 animate-spin text-gray-600" />
                            </div>
                        ) : (
                            <>
                                <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
                                    {collabs.length === 0 ? (
                                        <p className="text-[12px] text-gray-600 text-center py-8">No collaborators</p>
                                    ) : (
                                        <div className="py-2">
                                            {collabs.map(c => {
                                                const name = c.first_name || c.username || `User #${c.user_id}`;
                                                const initials = name.slice(0, 2).toUpperCase();
                                                const isSelf = c.user_id === userId;
                                                const canRemove = isOwner ? !isSelf : isSelf;
                                                const removeLabel = isSelf ? 'Leave' : 'Remove';
                                                return (
                                                    <div key={c.user_id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/3 transition-colors group">
                                                        {/* Avatar */}
                                                        <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center shrink-0 overflow-hidden border border-[#3a3a3a]">
                                                            {c.photo_url
                                                                ? <img src={c.photo_url} alt={name} className="w-full h-full object-cover" />
                                                                : <span className="text-[11px] font-bold text-gray-400">{initials}</span>
                                                            }
                                                        </div>

                                                        {/* Name + role */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[13px] font-semibold text-white truncate leading-tight">
                                                                {name}
                                                                {isSelf && <span className="ml-1.5 text-[10px] text-gray-600">(you)</span>}
                                                            </p>
                                                            {c.username && <p className="text-[11px] text-gray-600 truncate">@{c.username}</p>}
                                                        </div>

                                                        {/* Role badge */}
                                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${ROLE_COLORS[c.role] ?? ROLE_COLORS.viewer}`}>
                                                            {c.role}
                                                        </span>

                                                        {/* Remove/Leave */}
                                                        {canRemove && (
                                                            <button
                                                                onClick={() => removeCollab(c.user_id)}
                                                                disabled={removing === c.user_id}
                                                                className="opacity-0 group-hover:opacity-100 ml-1 px-2 py-1 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-40"
                                                            >
                                                                {removing === c.user_id
                                                                    ? <IconLoader2 className="w-3 h-3 animate-spin" />
                                                                    : removeLabel
                                                                }
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Invite CTA */}
                                {isOwner && (
                                    <div className="px-5 py-3 border-t border-[#2a2a2a] mt-auto">
                                        <button
                                            onClick={() => { onClose(); onOpenInvite(); }}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-[#3a3a3a] text-[12px] text-gray-500 hover:text-white hover:border-gray-500 transition-all"
                                        >
                                            <IconUserPlus className="w-3.5 h-3.5" />
                                            Invite collaborator
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

// ── Share Modal ────────────────────────────────────────────────────────────

function ShareModal({ space, onClose, onTogglePublic }: {
    space: Space;
    onClose: () => void;
    onTogglePublic: (enable: boolean) => Promise<void>;
}) {
    const [loading, setLoading] = useState(false);
    const [copied, setCopied]   = useState(false);
    const shareUrl = space.share_id
        ? `${typeof window !== 'undefined' ? window.location.origin : 'https://perricheno.ru'}/space/pub/${space.share_id}`
        : null;

    const copy = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md bg-[#1e1e1e] border border-[#333] rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
                    <h2 className="text-[13px] font-black text-white uppercase tracking-widest">Share Project</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"><IconX className="w-4 h-4" /></button>
                </div>
                <div className="px-5 py-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[13px] font-semibold text-white">Public link</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Anyone with the link can view (read-only)</p>
                        </div>
                        <button
                            onClick={async () => { setLoading(true); await onTogglePublic(!space.is_public); setLoading(false); }}
                            disabled={loading}
                            className={`w-11 h-6 rounded-full relative transition-colors ${space.is_public ? 'bg-emerald-500' : 'bg-[#3a3a3a]'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${space.is_public ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                    {space.is_public && shareUrl && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            className="flex items-center gap-2 bg-[#2a2a2a] rounded-xl px-3 py-2">
                            <span className="flex-1 text-[12px] text-gray-400 font-mono truncate">{shareUrl}</span>
                            <button onClick={copy} className="text-[11px] font-bold text-blue-400 hover:text-blue-300 shrink-0 transition-colors">
                                {copied ? '✓ Copied' : 'Copy'}
                            </button>
                        </motion.div>
                    )}
                </div>
                <div className="px-5 py-4 border-t border-[#2a2a2a] flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Done</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Invite Modal ───────────────────────────────────────────────────────────

function InviteModal({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
    const [email, setEmail]     = useState('');
    const [role, setRole]       = useState<'editor' | 'viewer'>('editor');
    const [loading, setLoading] = useState(false);
    const [done, setDone]       = useState<string | null>(null);
    const [error, setError]     = useState<string | null>(null);

    const send = async () => {
        if (!email.includes('@')) { setError('Enter a valid email'); return; }
        setLoading(true); setError(null);
        const res = await fetch(`/api/space/${spaceId}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, role }),
        });
        const data = await res.json();
        if (res.ok) { setDone(data.inviteUrl); }
        else { setError(data.error ?? 'Failed to create invite'); }
        setLoading(false);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md bg-[#1e1e1e] border border-[#333] rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
                    <h2 className="text-[13px] font-black text-white uppercase tracking-widest">Invite Collaborator</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"><IconX className="w-4 h-4" /></button>
                </div>

                {done ? (
                    <div className="px-5 py-6 space-y-3">
                        <p className="text-[12px] text-emerald-400 font-bold">Invite link created!</p>
                        <p className="text-[11px] text-gray-500">Share this link with the collaborator:</p>
                        <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-xl px-3 py-2">
                            <span className="flex-1 text-[11px] text-gray-400 font-mono truncate">{done}</span>
                            <button
                                onClick={() => navigator.clipboard.writeText(done)}
                                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 shrink-0 transition-colors"
                            >Copy</button>
                        </div>
                        <div className="flex justify-end pt-1">
                            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Done</button>
                        </div>
                    </div>
                ) : (
                    <div className="px-5 py-4 space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Email</label>
                            <input
                                autoFocus
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && send()}
                                placeholder="collaborator@email.com"
                                className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl text-[13px] text-white outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Role</label>
                            <div className="flex gap-2">
                                {(['editor', 'viewer'] as const).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRole(r)}
                                        className={`flex-1 py-2 rounded-xl text-[12px] font-bold capitalize transition-colors ${
                                            role === r ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                        }`}
                                    >{r}</button>
                                ))}
                            </div>
                        </div>
                        {error && <p className="text-[11px] text-red-400">{error}</p>}
                        <div className="flex justify-end gap-2 pt-1">
                            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                            <button
                                onClick={send}
                                disabled={loading}
                                className="px-4 py-2 rounded-xl bg-white text-black text-[12px] font-bold hover:bg-gray-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading && <IconLoader2 className="w-3.5 h-3.5 animate-spin" />}
                                Generate link
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
