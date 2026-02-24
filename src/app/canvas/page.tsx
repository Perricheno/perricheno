"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import {
    ReactFlow,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    Node,
    Edge,
    NodeChange,
    EdgeChange,
    Connection,
    BackgroundVariant,
    useReactFlow,
    ReactFlowProvider,
    MarkerType
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import MinimalSidebar from "@/components/MinimalSidebar";
import { IconPlus, IconLink, IconExternalLink, IconTrash, IconCopy, IconCut, IconTypography, IconUpload, IconDownload, IconWand, IconLoader2 } from "@tabler/icons-react";
import { useFloating, shift, flip, offset } from '@floating-ui/react';
import { ObsidianNode } from "@/components/canvas/ObsidianNode";
import { ObsidianEdge } from "@/components/canvas/ObsidianEdge";
import { reactFlowToJsonCanvas, jsonCanvasToReactFlow, CanvasData } from "@/lib/json-canvas";

const nodeTypes = { obsidian: ObsidianNode };
const edgeTypes = { obsidian: ObsidianEdge };

// --- CONTEXT MENU USING FLOATING-UI ---
const ContextMenu = ({ x, y, onAction, closeMenu }: { x: number, y: number, onAction: (a: string) => void, closeMenu: () => void }) => {
    const virtualReference = useMemo(() => ({
        getBoundingClientRect: () => ({ x, y, top: y, left: x, bottom: y, right: x, width: 0, height: 0 }),
    }), [x, y]);

    const { refs, floatingStyles } = useFloating({
        placement: 'bottom-start',
        middleware: [offset(5), flip(), shift({ padding: 10 })],
        elements: { reference: virtualReference as any }
    });

    return (
        <div 
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-50 w-56 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] py-1.5 text-[13px] text-gray-300 flex flex-col font-sans"
            onMouseLeave={closeMenu}
            onClick={(e) => e.stopPropagation()}
        >
            <button className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 w-full text-left transition-colors" onClick={() => { onAction('link'); closeMenu(); }}>
                <IconLink size={15} className="text-gray-400" /> Add link
            </button>
            <button className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 w-full text-left transition-colors" onClick={() => { onAction('ext-link'); closeMenu(); }}>
                <IconExternalLink size={15} className="text-gray-400" /> Add external link
            </button>
            <div className="h-px bg-[#333] my-1 mx-2" />
            <button className="flex items-center justify-between px-4 py-2 hover:bg-white/10 w-full text-left transition-colors" onClick={() => { onAction('format'); closeMenu(); }}>
                <div className="flex items-center gap-3">
                    <IconTypography size={15} className="text-gray-400" /> Format
                </div>
                <span className="text-gray-500 text-[10px]">▶</span>
            </button>
            <div className="h-px bg-[#333] my-1 mx-2" />
            <button className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 w-full text-left transition-colors" onClick={() => { onAction('cut'); closeMenu(); }}>
                <IconCut size={15} className="text-gray-400" /> Cut
            </button>
            <button className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 w-full text-left transition-colors" onClick={() => { onAction('copy'); closeMenu(); }}>
                <IconCopy size={15} className="text-gray-400" /> Copy
            </button>
            <button className="flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 w-full text-left text-red-400 transition-colors" onClick={() => { onAction('delete'); closeMenu(); }}>
                <IconTrash size={15} /> Delete
            </button>
        </div>
    );
};

// --- INITIAL DATA ---
const initialNodes: Node[] = [
    { id: "1", type: "obsidian", position: { x: 200, y: 150 }, data: { text: "### Welcome to AI Canvas Viewer\nUpload a `.canvas` file, or click **Generate** to create a mind map with AI." }, style: { width: 340, height: 120 } },
];
const initialEdges: Edge[] = [];

function CanvasApp() {
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [menu, setMenu] = useState<{ x: number, y: number, nodeId?: string } | null>(null);
    const [aiPrompt, setAiPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    
    // Quick Add state ref
    const connectingNodeId = useRef<string | null>(null);
    const connectingHandleId = useRef<string | null>(null);

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { screenToFlowPosition, fitView } = useReactFlow();

    // Mapping changes
    const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ 
        ...params, type: 'obsidian', markerEnd: { type: MarkerType.ArrowClosed, color: '#666' }
    }, eds)), []);

    // Sync node text
    const onNodeDataChange = useCallback((id: string, text: string) => {
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, text } } : n));
    }, []);

    const nodesWithCallbacks = useMemo(() => {
        return nodes.map(n => ({ ...n, data: { ...n.data, onChange: onNodeDataChange } }));
    }, [nodes, onNodeDataChange]);

    const createNodeAt = useCallback((x: number, y: number) => {
        const id = `node_${Date.now()}`;
        const newNode: Node = {
            id, type: "obsidian",
            position: { x, y },
            data: { text: "" },
            style: { width: 160, height: 60 },
        };
        setNodes((nds) => nds.concat(newNode));
        return id;
    }, []);

    const onAddNodeClick = useCallback(() => {
        createNodeAt(100 + Math.random()*200, 100 + Math.random()*200);
    }, [createNodeAt]);

    // Quick Add (Connecting to empty pane)
    const onConnectStart = useCallback((_: any, { nodeId, handleId }: { nodeId: string | null, handleId: string | null }) => {
        connectingNodeId.current = nodeId;
        connectingHandleId.current = handleId;
    }, []);

    const onConnectEnd = useCallback((event: any) => {
        if (!connectingNodeId.current) return;
        if (event.target.classList.contains('react-flow__pane')) {
            const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const newNodeId = createNodeAt(position.x, position.y);
            setEdges((eds) => addEdge({ 
                id: `e_${Date.now()}`, source: connectingNodeId.current!, target: newNodeId,
                sourceHandle: connectingHandleId.current, targetHandle: "left", type: 'obsidian',
                markerEnd: { type: MarkerType.ArrowClosed, color: '#666' }
            }, eds));
        }
    }, [screenToFlowPosition, createNodeAt]);

    // Context Menus
    const onNodeContextMenu = useCallback((event: React.MouseEvent | MouseEvent, node: Node) => {
        event.preventDefault();
        setMenu({ x: (event as React.MouseEvent).clientX || (event as MouseEvent).clientX, y: (event as React.MouseEvent).clientY || (event as MouseEvent).clientY, nodeId: node.id });
    }, []);

    const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();
        setMenu({ x: (event as React.MouseEvent).clientX || (event as MouseEvent).clientX, y: (event as React.MouseEvent).clientY || (event as MouseEvent).clientY });
    }, []);

    const closeMenu = useCallback(() => setMenu(null), []);

    const handleMenuAction = useCallback((action: string) => {
        if (action === 'delete' && menu?.nodeId) {
            setNodes((nds) => nds.filter((n) => n.id !== menu.nodeId));
            setEdges((eds) => eds.filter((e) => e.source !== menu.nodeId && e.target !== menu.nodeId));
        }
        if (action === 'copy' && menu?.nodeId) {
            const nodeToCopy = nodes.find(n => n.id === menu.nodeId);
            if (nodeToCopy) {
                const newNode = { ...nodeToCopy, id: `node_${Date.now()}`, position: { x: nodeToCopy.position.x + 20, y: nodeToCopy.position.y + 20 } };
                setNodes((nds) => nds.concat(newNode));
            }
        }
    }, [menu, nodes]);

    // --- JSON CANVAS IMPLEMENTATION ---

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json: CanvasData = JSON.parse(event.target?.result as string);
                if (!json.nodes) throw new Error("Invalid Canvas file: missing nodes array");
                
                const { nodes: parsedNodes, edges: parsedEdges } = jsonCanvasToReactFlow(json);
                setNodes(parsedNodes);
                setEdges(parsedEdges);
                setTimeout(() => fitView({ duration: 800 }), 100);
            } catch (err) {
                alert("Failed to parse .canvas file. Ensure it is a valid Obsidian Canvas.");
                console.error(err);
            }
        };
        reader.readAsText(file);
        
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExportDesktop = () => {
        const jsonCanvasFormat = reactFlowToJsonCanvas(nodes, edges);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonCanvasFormat, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `perricheno_export_${Date.now()}.canvas`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        try {
            const res = await fetch('/api/canvas/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || "Failed to generate");
            
            const { nodes: generatedNodes, edges: generatedEdges } = jsonCanvasToReactFlow(data.canvas);
            setNodes(generatedNodes);
            setEdges(generatedEdges);
            setShowAiModal(false);
            setAiPrompt("");
            
            setTimeout(() => fitView({ duration: 800 }), 100);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="w-full h-screen bg-[#111111] flex flex-col relative" onClick={closeMenu}>
            
            {/* TOP BAR / VAULT HEADER */}
            <div className="absolute top-4 right-4 z-40 flex items-center gap-3 bg-[#1e1e1e]/80 backdrop-blur-md border border-[#333] p-1.5 rounded-xl shadow-lg">
                <input type="file" accept=".canvas" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                
                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="flex items-center gap-2 text-gray-300 hover:text-white px-3 py-1.5 rounded-[var(--radius)] hover:bg-white/10 transition-colors text-sm font-medium"
                    title="Upload .canvas file"
                >
                    <IconUpload size={16} /> <span className="hidden sm:inline">Open</span>
                </button>

                <button 
                    onClick={handleExportDesktop} 
                    className="flex items-center gap-2 text-gray-300 hover:text-white px-3 py-1.5 rounded-[var(--radius)] hover:bg-white/10 transition-colors text-sm font-medium"
                    title="Export as .canvas for Obsidian"
                >
                    <IconDownload size={16} /> <span className="hidden sm:inline">Export</span>
                </button>

                <div className="w-px h-5 bg-[#444] mx-1"></div>

                <button 
                    onClick={() => setShowAiModal(true)} 
                    className="flex items-center gap-2 px-4 py-1.5 rounded-[var(--radius)] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all shadow-md text-sm font-semibold"
                >
                    <IconWand size={16} /> Generate AI
                </button>
            </div>

            {/* AI MODAL */}
            {showAiModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                                <IconWand className="text-purple-400" /> AI Canvas Generator
                            </h3>
                            <p className="text-sm text-gray-400 mb-6">Describe the mind map or architecture you want to build. AI will generate a strict JSON Canvas structure.</p>
                            
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="e.g. Map out the architecture of a Next.js e-commerce app..."
                                className="w-full h-32 bg-[#111] border border-[#333] rounded-xl p-4 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none mb-6"
                                autoFocus
                            />

                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={() => setShowAiModal(false)}
                                    className="px-5 py-2 rounded-xl text-gray-400 font-medium hover:bg-white/5 transition-colors"
                                    disabled={isGenerating}
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleAIGenerate}
                                    disabled={isGenerating || !aiPrompt.trim()}
                                    className="px-5 py-2 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isGenerating ? <><IconLoader2 className="animate-spin" size={18} /> Generating...</> : "Generate"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CANVAS RENDERER */}
            <div className="flex-1 w-full relative" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodesWithCallbacks}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onConnectStart={onConnectStart}
                    onConnectEnd={onConnectEnd}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodeContextMenu={onNodeContextMenu}
                    onPaneContextMenu={onPaneContextMenu}
                    fitView
                    colorMode="dark"
                    snapToGrid={true}
                    snapGrid={[20, 20]}
                >
                    <Background color="#333" variant={BackgroundVariant.Dots} gap={20} size={1} />
                </ReactFlow>
                {menu && <ContextMenu x={menu.x} y={menu.y} onAction={handleMenuAction} closeMenu={closeMenu} />}
            </div>
        </div>
    );
}

export default function CanvasPage() {
    return (
        <div className="h-screen w-full bg-[#111111] flex font-sans overflow-hidden">
            {/* Minimal Sidebar still on the left */}
            <div className="z-50 border-r border-[#222]">
                 <MinimalSidebar />
            </div>
            
            <main className="flex-1 h-screen relative flex">
                <ReactFlowProvider>
                    <CanvasApp />
                </ReactFlowProvider>
            </main>
        </div>
    );
}
