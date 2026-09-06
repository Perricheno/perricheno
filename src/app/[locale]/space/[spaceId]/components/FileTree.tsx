"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Image, BookOpen, ChevronRight, Plus, Trash2, Pencil, Ellipsis } from "lucide-react";

export interface FileEntry {
    path: string;
    mime_type: string;
    size_bytes: number;
    updated_at: string;
    is_binary: boolean;
}

interface TreeNode {
    name: string;
    path: string;
    isDir: boolean;
    children: TreeNode[];
    file?: FileEntry;
}

function buildTree(files: FileEntry[]): TreeNode[] {
    const root: TreeNode[] = [];
    const dirs = new Map<string, TreeNode>();

    const getOrCreateDir = (segments: string[]): TreeNode[] => {
        if (segments.length === 0) return root;
        const fullPath = segments.join('/');
        if (dirs.has(fullPath)) return dirs.get(fullPath)!.children;
        const parent = getOrCreateDir(segments.slice(0, -1));
        const node: TreeNode = { name: segments[segments.length - 1], path: fullPath, isDir: true, children: [] };
        dirs.set(fullPath, node);
        parent.push(node);
        return node.children;
    };

    for (const file of files) {
        const parts = file.path.split('/');
        if (parts.length === 1) {
            root.push({ name: parts[0], path: file.path, isDir: false, children: [], file });
        } else {
            const dirSegments = parts.slice(0, -1);
            const container = getOrCreateDir(dirSegments);
            container.push({ name: parts[parts.length - 1], path: file.path, isDir: false, children: [], file });
        }
    }

    // Sort: dirs first, then files, alphabetically
    const sort = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(n => n.isDir && sort(n.children));
    };
    sort(root);
    return root;
}

function fileIcon(node: TreeNode) {
    if (node.isDir) return null;
    const ext = node.name.split('.').pop()?.toLowerCase();
    if (ext === 'bib') return <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    if (['png', 'jpg', 'jpeg', 'pdf', 'svg'].includes(ext ?? ''))
        return <Image className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    return <FileText className="w-3.5 h-3.5 text-gray-500 shrink-0" />;
}

interface NodeProps {
    node: TreeNode;
    depth: number;
    activeFile: string | null;
    onOpenFile: (path: string) => void;
    onNewFile: (parent: string) => void;
    onRename: (oldPath: string, newPath: string) => void;
    onDelete: (path: string) => void;
    mainFile: string;
    readOnly?: boolean;
}

function TreeNodeRow({ node, depth, activeFile, onOpenFile, onNewFile, onRename, onDelete, mainFile, readOnly }: NodeProps) {
    const [expanded, setExpanded] = useState(depth === 0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameVal, setRenameVal] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    useEffect(() => {
        if (renaming) inputRef.current?.select();
    }, [renaming]);

    const startRename = () => {
        setRenameVal(node.name);
        setRenaming(true);
        setMenuOpen(false);
    };

    const confirmRename = () => {
        const trimmed = renameVal.trim();
        if (trimmed && trimmed !== node.name) {
            const dir = node.path.includes('/')
                ? node.path.slice(0, node.path.lastIndexOf('/') + 1)
                : '';
            onRename(node.path, dir + trimmed);
        }
        setRenaming(false);
    };

    const indent = depth * 12 + 8;
    const isActive = !node.isDir && activeFile === node.path;
    const isMain = !node.isDir && node.path === mainFile;

    return (
        <>
            <div
                className={`group flex items-center gap-1.5 py-[3px] pr-2 rounded-md transition-colors text-[12px] select-none ${
                    renaming ? 'bg-white/5' :
                    isActive ? 'bg-white/10 text-white cursor-pointer' : 'text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer'
                }`}
                style={{ paddingLeft: indent }}
                onClick={() => { if (renaming) return; node.isDir ? setExpanded(v => !v) : onOpenFile(node.path); }}
            >
                {/* Expand chevron for dirs */}
                {node.isDir ? (
                    <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                        <ChevronRight className="w-3 h-3 shrink-0" />
                    </motion.div>
                ) : (
                    fileIcon(node)
                )}

                {renaming ? (
                    <input
                        ref={inputRef}
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); confirmRename(); }
                            if (e.key === 'Escape') setRenaming(false);
                        }}
                        onBlur={confirmRename}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 bg-[#333] text-white text-[12px] px-1.5 py-0.5 rounded outline-none border border-blue-500 font-mono min-w-0"
                    />
                ) : (
                    <span className="flex-1 truncate leading-tight">
                        {node.name}
                        {isMain && <span className="ml-1 text-[9px] font-bold text-emerald-500 uppercase">main</span>}
                    </span>
                )}

                {/* Context menu trigger */}
                {!readOnly && !renaming && <div ref={menuRef} className="relative" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => setMenuOpen(v => !v)}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                    >
                        <Ellipsis className="w-3.5 h-3.5" />
                    </button>
                    <AnimatePresence>
                        {menuOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                                className="absolute left-full top-0 ml-1 w-36 bg-[#2a2a2a] border border-white/10 rounded-xl py-1 z-50 shadow-xl"
                            >
                                {node.isDir && (
                                    <button onClick={() => { onNewFile(node.path); setMenuOpen(false); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white transition-colors">
                                        <Plus className="w-3.5 h-3.5" /> New File
                                    </button>
                                )}
                                <button onClick={startRename}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white transition-colors">
                                    <Pencil className="w-3.5 h-3.5" /> Rename
                                </button>
                                <div className="my-1 border-t border-white/5" />
                                <button onClick={() => { onDelete(node.path); setMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>}
            </div>

            {/* Children */}
            {node.isDir && expanded && (
                <div>
                    {node.children.map(child => (
                        <TreeNodeRow
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            activeFile={activeFile}
                            onOpenFile={onOpenFile}
                            onNewFile={onNewFile}
                            onRename={onRename}
                            onDelete={onDelete}
                            mainFile={mainFile}
                            readOnly={readOnly}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

interface Props {
    files: FileEntry[];
    activeFile: string | null;
    mainFile: string;
    onOpenFile: (path: string) => void;
    onNewFile: (parentDir?: string) => void;
    onRename: (oldPath: string, newPath: string) => void;
    onDelete: (path: string) => void;
    onUploadFiles: (files: FileList) => void;
    readOnly?: boolean;
}

export default function FileTree({ files, activeFile, mainFile, onOpenFile, onNewFile, onRename, onDelete, onUploadFiles, readOnly }: Props) {
    const tree = buildTree(files);
    const [draggingOver, setDraggingOver] = useState(false);
    const dragCounter = useRef(0);

    const handleDragEnter = (e: React.DragEvent) => {
        if (readOnly) return;
        e.preventDefault();
        dragCounter.current++;
        if (e.dataTransfer.types.includes('Files')) setDraggingOver(true);
    };
    const handleDragLeave = () => {
        if (readOnly) return;
        dragCounter.current--;
        if (dragCounter.current === 0) setDraggingOver(false);
    };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        dragCounter.current = 0;
        setDraggingOver(false);
        if (readOnly || !e.dataTransfer.files.length) return;
        onUploadFiles(e.dataTransfer.files);
    };

    return (
        <div
            className="flex flex-col h-full bg-[#1e1e1e] border-r border-[#2a2a2a] relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Drag-drop overlay */}
            <AnimatePresence>
                {draggingOver && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="absolute inset-0 z-20 bg-blue-500/15 border-2 border-dashed border-blue-500/60 rounded-md flex items-center justify-center pointer-events-none"
                    >
                        <p className="text-[12px] font-bold text-blue-400">Drop files or ZIP to import</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a]">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Files</span>
                {!readOnly && (
                    <div className="flex items-center gap-0.5">
                        <label title="Upload files or ZIP project" className="p-1 rounded text-gray-600 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                            <input type="file" multiple accept="image/*,.pdf,.zip,.tex,.bib,.cls,.sty" className="hidden" onChange={e => e.target.files && onUploadFiles(e.target.files)} />
                            <Image className="w-3.5 h-3.5" />
                        </label>
                        <button onClick={() => onNewFile()} title="New file"
                            className="p-1 rounded text-gray-600 hover:text-white hover:bg-white/5 transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-1 px-1">
                {tree.length === 0 ? (
                    <p className="text-[11px] text-gray-600 px-3 py-4 text-center">No files yet<br/>{!readOnly && <span className="text-[10px] opacity-60">Drop files to upload</span>}</p>
                ) : (
                    tree.map(node => (
                        <TreeNodeRow
                            key={node.path}
                            node={node}
                            depth={0}
                            activeFile={activeFile}
                            onOpenFile={onOpenFile}
                            onNewFile={onNewFile}
                            onRename={onRename}
                            onDelete={onDelete}
                            mainFile={mainFile}
                            readOnly={readOnly}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
