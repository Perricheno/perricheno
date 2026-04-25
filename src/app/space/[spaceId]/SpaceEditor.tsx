"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconLoader2, IconUserPlus, IconSparkles, IconCheck, IconCopy } from "@tabler/icons-react";
import type { Space, SpaceFile, Compiler } from "@/lib/space-db";

import TopBar from "./components/TopBar";
import FileTree, { type FileEntry } from "./components/FileTree";
import LatexEditor, { type SelectionInfo } from "./components/LatexEditor";
import YjsLatexEditor from "./components/YjsLatexEditor";
import PdfPreview from "./components/PdfPreview";
import CompilerLog from "./components/CompilerLog";
import { useYjsSpace } from "./hooks/useYjsSpace";

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
    const [files, setFiles]  = useState<FileEntry[]>(() => {
        const seen = new Set<string>();
        return initialFiles
            .map(f => ({ path: f.path, mime_type: f.mime_type, size_bytes: f.size_bytes, updated_at: f.updated_at, is_binary: f.is_binary }))
            .filter(f => { if (seen.has(f.path)) return false; seen.add(f.path); return true; });
    });

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

    // Delete confirmation modal
    const [deleteConfirmPath, setDeleteConfirmPath] = useState<string | null>(null);

    // Snapshot message modal
    const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
    const [snapshotMessage, setSnapshotMessage]     = useState('');

    // New-file prompt
    const [newFilePrompt, setNewFilePrompt] = useState<{ parent: string } | null>(null);
    const [newFileName, setNewFileName]     = useState("");

    // AI inline edit menu
    const [aiSelection, setAiSelection]           = useState<SelectionInfo | null>(null);
    const [aiReplacement, setAiReplacement]       = useState<{ from: number; to: number; text: string } | null>(null);

    // Auto-compile timer
    const autoCompileTimer = useRef<NodeJS.Timeout | null>(null);
    const [autoCompile, setAutoCompile] = useState(space.auto_compile);

    // Yjs real-time collaboration
    const { ydoc, provider, status: yjsStatus, synced } = useYjsSpace(space.id);

    // Cleanup timers and object URLs on unmount
    useEffect(() => {
        return () => {
            if (autoCompileTimer.current) clearTimeout(autoCompileTimer.current);
            (Object.values(saveTimers.current) as ReturnType<typeof setTimeout>[]).forEach(clearTimeout);
            setPdfUrl((prev: string | null) => { if (prev) URL.revokeObjectURL(prev); return null; });
        };
    }, []);

    // ── Open file ───────────────────────────────────────────────────────────

    const openFile = useCallback(async (path: string) => {
        // Already open?
        if (tabs.find(t => t.path === path)) { setActiveTab(path); return; }
        // Don't open binary files in text editor - they can't be edited and
        // an accidental save would corrupt the binary data in the DB.
        const meta = files.find((f: FileEntry) => f.path === path);
        if (meta?.is_binary) return;
        const res = await fetch(`/api/space/${space.id}/files/${path}`);
        if (!res.ok) return;
        const { file } = await res.json() as { file: SpaceFile };
        if (file.is_binary) return;
        const content = file.content ?? '';
        setTabs(prev => [...prev, { path, content, savedContent: content }]);
        setActiveTab(path);
        // Seed Yjs text if already synced (first opener initializes from Supabase)
        if (ydoc && synced) {
            const yText = ydoc.getText(path);
            if (yText.length === 0 && content) {
                ydoc.transact(() => { yText.insert(0, content); });
            }
        }
    }, [tabs, files, space.id, ydoc, synced]);

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

    // Seed Yjs text when sync completes (handles files opened before sync was ready)
    useEffect(() => {
        if (!ydoc || !activeTab || !synced) return;
        const yText = ydoc.getText(activeTab);
        if (yText.length > 0) return;
        const tab = tabs.find((t: EditorTab) => t.path === activeTab);
        if (tab?.content) {
            ydoc.transact(() => { yText.insert(0, tab.content); });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ydoc, synced, activeTab]);

    // Observe Yjs changes → keep React tab state + Supabase in sync
    useEffect(() => {
        if (!ydoc || !activeTab || readOnly) return;
        const yText = ydoc.getText(activeTab);
        const handler = () => {
            const content = yText.toString();
            setTabs((prev: EditorTab[]) => prev.map((t: EditorTab) => t.path === activeTab ? { ...t, content } : t));
            if (saveTimers.current[activeTab]) clearTimeout(saveTimers.current[activeTab]);
            saveTimers.current[activeTab] = setTimeout(() => {
                saveFile(activeTab, content);
            }, 800);
        };
        yText.observe(handler);
        return () => yText.unobserve(handler);
    }, [ydoc, activeTab, readOnly, saveFile]);

    // ── File ops ────────────────────────────────────────────────────────────

    const handleNewFile = async (parent = '') => {
        setNewFileName(parent ? `${parent}/` : '');
        setNewFilePrompt({ parent });
    };

    const confirmNewFile = async () => {
        const path = newFileName.trim();
        if (!path) return;
        if (files.find((f: FileEntry) => f.path === path)) { setNewFilePrompt(null); await openFile(path); return; }
        await fetch(`/api/space/${space.id}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content: '' }),
        });
        setFiles(prev => prev.find((f: FileEntry) => f.path === path) ? prev : [...prev, { path, mime_type: 'text/plain', size_bytes: 0, updated_at: new Date().toISOString(), is_binary: false }]);
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

    const handleDelete = (path: string) => {
        setDeleteConfirmPath(path);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmPath) return;
        const path = deleteConfirmPath;
        setDeleteConfirmPath(null);
        await fetch(`/api/space/${space.id}/files/${path}`, { method: 'DELETE' });
        setFiles(prev => prev.filter(f => f.path !== path));
        setTabs(prev => prev.filter(t => t.path !== path));
        if (activeTab === path) setActiveTab(tabs.find(t => t.path !== path)?.path ?? null);
    };

    const [uploading, setUploading] = useState<string | null>(null);

    const handleUploadFiles = async (fileList: FileList) => {
        const items = Array.from(fileList);
        for (const file of items) {
            // ZIP import - extract whole project (e.g. Overleaf export)
            if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
                setUploading(`Importing ${file.name}…`);
                const form = new FormData();
                form.append('file', file);
                const res = await fetch(`/api/space/${space.id}/files/import-zip`, { method: 'POST', body: form });
                if (res.ok) {
                    const data = await res.json() as { imported: string[]; skipped: string[] };
                    setFiles((prev: FileEntry[]) => {
                        const seen = new Set(prev.map((f: FileEntry) => f.path));
                        const added = data.imported
                            .filter(p => !seen.has(p))
                            .map(p => {
                                const ext = p.split('.').pop()?.toLowerCase() ?? '';
                                const textExts = new Set(['tex','bib','txt','md','cls','sty','cfg','bst','lua']);
                                const isText = textExts.has(ext);
                                return { path: p, mime_type: isText ? 'text/plain' : 'application/octet-stream', size_bytes: 0, updated_at: new Date().toISOString(), is_binary: !isText };
                            });
                        return [...prev, ...added];
                    });
                }
                setUploading(null);
                continue;
            }

            // Regular binary file upload
            setUploading(`Uploading ${file.name}…`);
            const form = new FormData();
            form.append('file', file);
            const res = await fetch(`/api/space/${space.id}/files/upload`, { method: 'POST', body: form });
            if (res.ok) {
                const data = await res.json();
                setFiles(prev => {
                    if (prev.find((f: FileEntry) => f.path === data.path)) return prev;
                    return [...prev, { path: data.path, mime_type: file.type || 'application/octet-stream', size_bytes: file.size, updated_at: new Date().toISOString(), is_binary: true }];
                });
            }
        }
        setUploading(null);
    };

    const handleCloseTab = (path: string) => {
        const remaining = tabs.filter(t => t.path !== path);
        setTabs(remaining);
        if (activeTab === path) setActiveTab(remaining[remaining.length - 1]?.path ?? null);
    };

    const handleSaveSnapshot = () => {
        if (savingSnapshot || readOnly) return;
        setSnapshotMessage('');
        setSnapshotModalOpen(true);
    };

    const confirmSaveSnapshot = async () => {
        setSnapshotModalOpen(false);
        setSavingSnapshot(true);
        await fetch(`/api/space/${space.id}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: `Checkpoint – ${new Date().toLocaleTimeString()}`, message: snapshotMessage || undefined }),
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
                                    {ydoc && provider && synced ? (
                                        <YjsLatexEditor
                                            yText={ydoc.getText(activeTabData.path)}
                                            provider={provider}
                                            readOnly={readOnly}
                                            onCursorChange={setCursorInfo}
                                            onSelectionChange={setAiSelection}
                                            goToLine={goToLine}
                                        />
                                    ) : (
                                        <LatexEditor
                                            content={activeTabData.content}
                                            onChange={val => handleContentChange(activeTabData.path, val)}
                                            goToLine={goToLine}
                                            readOnly={readOnly}
                                            onCursorChange={setCursorInfo}
                                            onSelectionChange={setAiSelection}
                                            applyReplacement={aiReplacement}
                                        />
                                    )}
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
                                    <span className="text-[10px] text-gray-700">·</span>
                                    {yjsStatus === 'connected' && synced && (
                                        <span className="text-[10px] text-emerald-500 font-mono">● live</span>
                                    )}
                                    {yjsStatus === 'connecting' && (
                                        <span className="text-[10px] text-amber-500 font-mono">● sync…</span>
                                    )}
                                    {yjsStatus === 'disconnected' && (
                                        <span className="text-[10px] text-red-400 font-mono">● offline</span>
                                    )}
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
                {uploading && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-2xl"
                    >
                        <IconLoader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span className="text-[12px] text-white">{uploading}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* New file prompt */}
            <AnimatePresence>
                {newFilePrompt !== null && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
                        onClick={e => { if (e.target === e.currentTarget) setNewFilePrompt(null); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.97, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.15 }}
                            className="bg-white border border-gray-200 rounded-2xl p-5 w-80 shadow-xl"
                        >
                            <h3 className="text-[13px] font-bold text-gray-900 mb-3">New file</h3>
                            <input
                                autoFocus
                                value={newFileName}
                                onChange={e => setNewFileName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') confirmNewFile(); if (e.key === 'Escape') setNewFilePrompt(null); }}
                                placeholder="filename.tex"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] text-gray-900 outline-none focus:border-gray-400 transition-colors font-mono"
                            />
                            <div className="flex gap-2 mt-3 justify-end">
                                <button onClick={() => setNewFilePrompt(null)} className="px-3 py-1.5 rounded-lg text-[12px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Cancel</button>
                                <button onClick={confirmNewFile} className="px-4 py-1.5 rounded-lg bg-black hover:bg-gray-800 text-white text-[12px] font-bold transition-colors">Create</button>
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

            {/* Delete confirmation modal */}
            <AnimatePresence>
                {deleteConfirmPath !== null && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
                        onClick={e => { if (e.target === e.currentTarget) setDeleteConfirmPath(null); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.97, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.15 }}
                            className="bg-white border border-gray-200 rounded-2xl p-5 w-80 shadow-xl"
                        >
                            <h3 className="text-[13px] font-bold text-gray-900 mb-1">Delete file?</h3>
                            <p className="text-[12px] text-gray-500 font-mono mb-1 truncate">"{deleteConfirmPath}"</p>
                            <p className="text-[11px] text-gray-400 mb-4">This cannot be undone.</p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setDeleteConfirmPath(null)} className="px-3 py-1.5 rounded-lg text-[12px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Cancel</button>
                                <button onClick={confirmDelete} className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[12px] font-bold transition-colors">Delete</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Snapshot message modal */}
            <AnimatePresence>
                {snapshotModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
                        onClick={e => { if (e.target === e.currentTarget) setSnapshotModalOpen(false); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.97, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.15 }}
                            className="bg-white border border-gray-200 rounded-2xl p-5 w-80 shadow-xl"
                        >
                            <h3 className="text-[13px] font-bold text-gray-900 mb-3">Save snapshot</h3>
                            <input
                                autoFocus
                                value={snapshotMessage}
                                onChange={e => setSnapshotMessage(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') confirmSaveSnapshot(); if (e.key === 'Escape') setSnapshotModalOpen(false); }}
                                placeholder="Message (optional)"
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] text-gray-900 outline-none focus:border-gray-400 transition-colors"
                            />
                            <div className="flex gap-2 mt-3 justify-end">
                                <button onClick={() => setSnapshotModalOpen(false)} className="px-3 py-1.5 rounded-lg text-[12px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Cancel</button>
                                <button onClick={confirmSaveSnapshot} className="px-4 py-1.5 rounded-lg bg-black hover:bg-gray-800 text-white text-[12px] font-bold transition-colors">Save</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI inline edit menu */}
            <AnimatePresence>
                {aiSelection && !readOnly && (
                    <AiEditMenu
                        selection={aiSelection}
                        spaceId={space.id}
                        onApply={(text) => {
                            if (ydoc && activeTab && synced) {
                                // Apply through Yjs so all peers see the change
                                const yText = ydoc.getText(activeTab);
                                ydoc.transact(() => {
                                    yText.delete(aiSelection.from, aiSelection.to - aiSelection.from);
                                    yText.insert(aiSelection.from, text);
                                });
                                setAiSelection(null);
                            } else {
                                setAiReplacement({ from: aiSelection.from, to: aiSelection.to, text });
                                setAiSelection(null);
                                setTimeout(() => setAiReplacement(null), 100);
                            }
                        }}
                        onClose={() => setAiSelection(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ── AI Inline Edit Menu ────────────────────────────────────────────────────

const AI_ACTIONS = [
    { id: 'fix',       label: 'Fix errors' },
    { id: 'rewrite',   label: 'Rewrite' },
    { id: 'shorten',   label: 'Shorten' },
    { id: 'expand',    label: 'Expand' },
    { id: 'translate', label: 'Translate' },
    { id: 'explain',   label: 'Explain' },
] as const;

function AiEditMenu({ selection, spaceId, onApply, onClose }: {
    selection: SelectionInfo;
    spaceId: string;
    onApply: (text: string) => void;
    onClose: () => void;
}) {
    const [loading, setLoading]       = useState<string | null>(null);
    const [result, setResult]         = useState<string | null>(null);
    const [activeAction, setActive]   = useState<string | null>(null);
    const [custom, setCustom]         = useState('');
    const [showCustom, setShowCustom] = useState(false);
    const [copied, setCopied]         = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Position: float above the cursor, anchored to viewport
    const MENU_W = 280;
    const MENU_H = 200; // approx
    const left = Math.min(Math.max(8, selection.x - MENU_W / 2), window.innerWidth - MENU_W - 8);
    const top  = selection.y - MENU_H - 12 < 8
        ? selection.y + 24   // below cursor if no room above
        : selection.y - MENU_H - 12;

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const run = async (action: string, prompt?: string) => {
        setLoading(action); setResult(null); setActive(action);
        const res = await fetch(`/api/space/${spaceId}/ai-edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, text: selection.text, customPrompt: prompt }),
        });
        const data = await res.json();
        setResult(data.result ?? data.error ?? 'No result');
        setLoading(null);
    };

    const copy = () => {
        if (!result) return;
        navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'fixed', left, top, width: MENU_W, zIndex: 60 }}
            className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <div className="flex items-center gap-1.5">
                    <IconSparkles className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-[11px] font-bold text-gray-700">AI Edit</span>
                </div>
                <button onClick={onClose} className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <IconX className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Action buttons */}
            {!result && (
                <div className="p-2 space-y-1">
                    <div className="grid grid-cols-3 gap-1">
                        {AI_ACTIONS.map(a => (
                            <button
                                key={a.id}
                                onClick={() => run(a.id)}
                                disabled={loading !== null}
                                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                                    activeAction === a.id && loading
                                        ? 'bg-violet-50 text-violet-600'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                } disabled:opacity-50`}
                            >
                                {loading === a.id
                                    ? <IconLoader2 className="w-3 h-3 animate-spin" />
                                    : a.label
                                }
                            </button>
                        ))}
                    </div>

                    {/* Custom prompt */}
                    {showCustom ? (
                        <div className="flex gap-1 mt-1">
                            <input
                                autoFocus
                                value={custom}
                                onChange={e => setCustom(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) run('custom', custom.trim()); if (e.key === 'Escape') setShowCustom(false); }}
                                placeholder="Custom instruction…"
                                className="flex-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-900 outline-none focus:border-violet-400 transition-colors"
                            />
                            <button
                                onClick={() => custom.trim() && run('custom', custom.trim())}
                                disabled={!custom.trim() || loading !== null}
                                className="px-2 py-1 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[11px] font-bold transition-colors disabled:opacity-40"
                            >Go</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowCustom(true)}
                            className="w-full text-left px-2 py-1 text-[11px] text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        >+ Custom…</button>
                    )}
                </div>
            )}

            {/* Result */}
            {result && (
                <div className="p-2 space-y-2">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 max-h-32 overflow-y-auto">
                        <p className="text-[11px] text-gray-800 whitespace-pre-wrap leading-relaxed">{result}</p>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => onApply(result)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-black hover:bg-gray-800 text-white text-[11px] font-bold transition-colors"
                        >
                            <IconCheck className="w-3 h-3" /> Apply
                        </button>
                        <button
                            onClick={copy}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 text-[11px] transition-colors"
                        >
                            {copied ? <IconCheck className="w-3 h-3 text-emerald-500" /> : <IconCopy className="w-3 h-3" />}
                        </button>
                        <button
                            onClick={() => { setResult(null); setActive(null); }}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 text-[11px] transition-colors"
                        >Back</button>
                    </div>
                </div>
            )}
        </motion.div>
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
    owner:  'bg-amber-50 text-amber-600',
    editor: 'bg-blue-50 text-blue-600',
    viewer: 'bg-gray-100 text-gray-500',
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
            className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">Project Settings</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                        <IconX className="w-4 h-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    {(['general', 'people'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-5 py-2.5 text-[12px] font-bold capitalize transition-colors relative ${
                                tab === t ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            {t}
                            {tab === t && (
                                <motion.div layoutId="settings-tab-indicator"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"
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
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Title</label>
                                <input value={title} onChange={e => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-900 outline-none focus:border-gray-400 transition-colors" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Main file</label>
                                <input value={mainFile} onChange={e => setMainFile(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-900 font-mono outline-none focus:border-gray-400 transition-colors"
                                    placeholder="main.tex" />
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
                            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Cancel</button>
                            <button
                                disabled={saving}
                                onClick={async () => { setSaving(true); await onSave({ title, main_file: mainFile }); setSaving(false); }}
                                className="px-4 py-2 rounded-xl bg-black text-white text-[12px] font-bold hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-50">
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
                                <IconLoader2 className="w-4 h-4 animate-spin text-gray-300" />
                            </div>
                        ) : (
                            <>
                                <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
                                    {collabs.length === 0 ? (
                                        <p className="text-[12px] text-gray-400 text-center py-8">No collaborators</p>
                                    ) : (
                                        <div className="py-2">
                                            {collabs.map(c => {
                                                const name = c.first_name || c.username || `User #${c.user_id}`;
                                                const initials = name.slice(0, 2).toUpperCase();
                                                const isSelf = c.user_id === userId;
                                                const canRemove = isOwner ? !isSelf : isSelf;
                                                const removeLabel = isSelf ? 'Leave' : 'Remove';
                                                return (
                                                    <div key={c.user_id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors group">
                                                        {/* Avatar */}
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200">
                                                            {c.photo_url
                                                                ? <img src={c.photo_url} alt={name} className="w-full h-full object-cover" />
                                                                : <span className="text-[11px] font-bold text-gray-500">{initials}</span>
                                                            }
                                                        </div>

                                                        {/* Name + role */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
                                                                {name}
                                                                {isSelf && <span className="ml-1.5 text-[10px] text-gray-400">(you)</span>}
                                                            </p>
                                                            {c.username && <p className="text-[11px] text-gray-400 truncate">@{c.username}</p>}
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
                                                                className="opacity-0 group-hover:opacity-100 ml-1 px-2 py-1 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
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
                                    <div className="px-5 py-3 border-t border-gray-100 mt-auto">
                                        <button
                                            onClick={() => { onClose(); onOpenInvite(); }}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gray-200 text-[12px] text-gray-400 hover:text-gray-900 hover:border-gray-400 transition-all"
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
            className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">Share Project</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"><IconX className="w-4 h-4" /></button>
                </div>
                <div className="px-5 py-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[13px] font-semibold text-gray-900">Public link</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">Anyone with the link can view (read-only)</p>
                        </div>
                        <button
                            onClick={async () => { setLoading(true); await onTogglePublic(!space.is_public); setLoading(false); }}
                            disabled={loading}
                            className={`w-11 h-6 rounded-full relative transition-colors ${space.is_public ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${space.is_public ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                    {space.is_public && shareUrl && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                            <span className="flex-1 text-[12px] text-gray-700 font-mono truncate">{shareUrl}</span>
                            <button onClick={copy} className="text-[11px] font-bold text-blue-500 hover:text-blue-700 shrink-0 transition-colors">
                                {copied ? '✓ Copied' : 'Copy'}
                            </button>
                        </motion.div>
                    )}
                </div>
                <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Done</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ── Invite Modal ───────────────────────────────────────────────────────────

function InviteModal({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
    const [role, setRole]       = useState<'editor' | 'viewer'>('editor');
    const [loading, setLoading] = useState(false);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [copied, setCopied]   = useState(false);
    const [error, setError]     = useState<string | null>(null);

    const generate = async () => {
        setLoading(true); setError(null);
        const res = await fetch(`/api/space/${spaceId}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
        });
        const data = await res.json();
        if (res.ok) { setInviteUrl(data.inviteUrl); }
        else { setError(data.error ?? 'Failed to create invite'); }
        setLoading(false);
    };

    const copy = () => {
        if (!inviteUrl) return;
        navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareViaTelegram = () => {
        if (!inviteUrl) return;
        const text = encodeURIComponent('You are invited to collaborate on a LaTeX project on Perricheno Space');
        const url = encodeURIComponent(inviteUrl);
        window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-[13px] font-black text-gray-900 uppercase tracking-widest">Invite Collaborator</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"><IconX className="w-4 h-4" /></button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Role</label>
                        <div className="flex gap-2">
                            {(['editor', 'viewer'] as const).map(r => (
                                <button
                                    key={r}
                                    onClick={() => { setRole(r); setInviteUrl(null); }}
                                    className={`flex-1 py-2 rounded-xl text-[12px] font-bold capitalize transition-colors border ${
                                        role === r ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-400'
                                    }`}
                                >{r}</button>
                            ))}
                        </div>
                    </div>

                    {!inviteUrl ? (
                        <>
                            {error && <p className="text-[11px] text-red-500">{error}</p>}
                            <div className="flex gap-2 pt-1">
                                <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Cancel</button>
                                <button
                                    onClick={generate}
                                    disabled={loading}
                                    className="flex-1 py-2 rounded-xl bg-black text-white text-[12px] font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading && <IconLoader2 className="w-3.5 h-3.5 animate-spin" />}
                                    Generate link
                                </button>
                            </div>
                        </>
                    ) : (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                                <span className="flex-1 text-[11px] text-gray-700 font-mono truncate">{inviteUrl}</span>
                                <button onClick={copy} className="text-[11px] font-bold text-blue-500 hover:text-blue-700 shrink-0 transition-colors">
                                    {copied ? '✓' : 'Copy'}
                                </button>
                            </div>
                            <button
                                onClick={shareViaTelegram}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2AABEE] hover:bg-[#229ED9] text-white text-[12px] font-bold transition-colors"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.915l-2.965-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.983.644z"/>
                                </svg>
                                Share via Telegram
                            </button>
                            <div className="flex justify-end">
                                <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">Done</button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
