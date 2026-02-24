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
import { IconPlus, IconLink, IconExternalLink, IconTrash, IconCopy, IconCut, IconTypography } from "@tabler/icons-react";
import { useFloating, shift, flip, offset } from '@floating-ui/react';
import { ObsidianNode } from "@/components/canvas/ObsidianNode";
import { ObsidianEdge } from "@/components/canvas/ObsidianEdge";

// Node & Edge types must be defined outside component to prevent re-renders
const nodeTypes = { obsidian: ObsidianNode };
const edgeTypes = { obsidian: ObsidianEdge };

// --- CONTEXT MENU USING FLOATING-UI ---
const ContextMenu = ({ x, y, onAction, closeMenu }: { x: number, y: number, onAction: (a: string) => void, closeMenu: () => void }) => {
    // We use a virtual reference to position the floating UI exactly at x, y
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
    { id: "1", type: "obsidian", position: { x: 200, y: 150 }, data: { text: "### Welcome to Canvas\nDouble click anywhere to edit me." }, style: { width: 220, height: 100 } },
    { id: "2", type: "obsidian", position: { x: 550, y: 150 }, data: { text: "Idea 1" }, style: { width: 160, height: 60 } },
    { id: "3", type: "obsidian", position: { x: 550, y: 350 }, data: { text: "Follow-up" }, style: { width: 160, height: 60 } },
];

const initialEdges: Edge[] = [
    { id: "e1-2", source: "1", target: "2", type: "obsidian", sourceHandle: "right", targetHandle: "left", markerEnd: { type: MarkerType.ArrowClosed, color: '#666' } },
    { id: "e1-3", source: "1", target: "3", type: "obsidian", sourceHandle: "bottom", targetHandle: "left", markerEnd: { type: MarkerType.ArrowClosed, color: '#666' } },
    { id: "e2-3", source: "2", target: "3", type: "obsidian", sourceHandle: "bottom", targetHandle: "top", markerEnd: { type: MarkerType.ArrowClosed, color: '#666' } },
];

function CanvasApp() {
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [menu, setMenu] = useState<{ x: number, y: number, nodeId?: string } | null>(null);
    
    // Quick Add state ref
    const connectingNodeId = useRef<string | null>(null);
    const connectingHandleId = useRef<string | null>(null);

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    // Callback handlers mapped strictly
    const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
    
    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({ 
        ...params, 
        type: 'obsidian',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#666' }
    }, eds)), []);

    // Method passed into node.data so nodes can update their own text
    const onNodeDataChange = useCallback((id: string, text: string) => {
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, text } } : n));
    }, []);

    // Ensure data object gets the onChange callback for strict syncing
    const nodesWithCallbacks = useMemo(() => {
        return nodes.map(n => ({ ...n, data: { ...n.data, onChange: onNodeDataChange } }));
    }, [nodes, onNodeDataChange]);

    const createNodeAt = useCallback((x: number, y: number) => {
        const id = `node_${Date.now()}`;
        const newNode: Node = {
            id,
            type: "obsidian",
            position: { x, y },
            data: { text: "" },
            style: { width: 160, height: 60 },
        };
        setNodes((nds) => nds.concat(newNode));
        return id;
    }, []);

    const onAddNodeClick = useCallback(() => {
        // Place it somewhere visible, we'll just put it near center roughly
        createNodeAt(100 + Math.random()*200, 100 + Math.random()*200);
    }, [createNodeAt]);

    // Quick Add (Connecting to empty pane)
    const onConnectStart = useCallback((_: any, { nodeId, handleId }: { nodeId: string | null, handleId: string | null }) => {
        connectingNodeId.current = nodeId;
        connectingHandleId.current = handleId;
    }, []);

    const onConnectEnd = useCallback(
        (event: any) => {
            if (!connectingNodeId.current) return;
            // Target is the DOM element where drop happened. In React Flow, the pane has the class 'react-flow__pane'
            const targetIsPane = event.target.classList.contains('react-flow__pane');
            if (targetIsPane) {
                // Calculate position in the canvas from screen coordinates
                const position = screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });
                
                const newNodeId = createNodeAt(position.x, position.y);
                setEdges((eds) => addEdge({ 
                    id: `e_${Date.now()}`,
                    source: connectingNodeId.current!,
                    target: newNodeId,
                    sourceHandle: connectingHandleId.current,
                    targetHandle: "left", // Default target port
                    type: 'obsidian',
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#666' }
                }, eds));
            }
        },
        [screenToFlowPosition, createNodeAt]
    );

    // Context Menu Handlers
    const onNodeContextMenu = useCallback((event: React.MouseEvent | MouseEvent, node: Node) => {
        event.preventDefault();
        setMenu({ 
            x: (event as React.MouseEvent).clientX || (event as MouseEvent).clientX, 
            y: (event as React.MouseEvent).clientY || (event as MouseEvent).clientY, 
            nodeId: node.id 
        });
    }, []);

    const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();
        setMenu({ 
            x: (event as React.MouseEvent).clientX || (event as MouseEvent).clientX, 
            y: (event as React.MouseEvent).clientY || (event as MouseEvent).clientY 
        });
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

    return (
        <div className="w-full h-screen bg-[#111111] flex relative" ref={reactFlowWrapper} onClick={closeMenu}>
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
                snapGrid={[20, 20]} // 20px grid
            >
                {/* Obsidian uses a subtle dark dotted grid */}
                <Background color="#333" variant={BackgroundVariant.Dots} gap={20} size={1} />
                
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={onAddNodeClick} className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-sm font-semibold shadow-md hover:bg-gray-100 transition-colors">
                        <IconPlus size={16} /> Add Note
                    </button>
                </div>
            </ReactFlow>

            {menu && <ContextMenu x={menu.x} y={menu.y} onAction={handleMenuAction} closeMenu={closeMenu} />}
        </div>
    );
}

export default function CanvasPage() {
    return (
        <div className="min-h-screen bg-[#111111] flex font-sans">
            <MinimalSidebar />
            
            <main className="flex-1 ml-0 md:ml-20 transition-all overflow-hidden h-screen relative">
                <ReactFlowProvider>
                    <CanvasApp />
                </ReactFlowProvider>
            </main>
        </div>
    );
}
