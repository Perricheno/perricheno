"use client";

import { useState, useCallback, useRef } from "react";
import {
    ReactFlow,
    Controls,
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
    MiniMap,
    Panel,
    useReactFlow,
    ReactFlowProvider
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAdmin } from "@/components/AdminContext";
import MinimalSidebar from "@/components/MinimalSidebar";
import { IconPlus, IconDownload, IconTrash } from "@tabler/icons-react";
import { useTheme } from "next-themes";

// Define a custom TextNode
const TextNode = ({ data, id }: { data: any, id: string }) => {
    return (
        <div className="bg-[var(--card)] border shadow-sm rounded-xl min-w-[200px] group transition-shadow hover:shadow-md border-[var(--border)] dark:border-[#3f3f46]">
            {/* Top Drag Handle Area */}
            <div className="bg-black/5 dark:bg-white/5 px-3 py-1.5 border-b border-[var(--border)] rounded-t-xl text-[10px] text-gray-400 font-medium uppercase tracking-wider flex justify-between items-center custom-drag-handle cursor-grab active:cursor-grabbing">
                <span>Note</span>
                <button onClick={() => data.onDelete(id)} className="text-red-400/50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <IconTrash size={12} />
                </button>
            </div>
            {/* Text Input Area */}
            <div className="p-3">
                <textarea
                    className="w-full bg-transparent outline-none resize-none text-sm text-[var(--foreground)] placeholder:text-gray-400 min-h-[60px]"
                    placeholder="Type something..."
                    defaultValue={data.text}
                    onChange={(evt) => data.onChange(evt.target.value, id)}
                />
            </div>
            {/* Interaction handles are automatically injected by ReactFlow if we use standard Handle components, but for simplicity we'll just use the default node first, or build a custom Handle. Actually, let's keep it simple first. */}
        </div>
    );
};

const initialNodes: Node[] = [
    {
        id: "1",
        position: { x: 250, y: 150 },
        data: { label: "Idea 1" },
        className: "bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm text-[var(--foreground)] p-4 font-medium",
    },
    {
        id: "2",
        position: { x: 550, y: 250 },
        data: { label: "Follow-up" },
        className: "bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm text-[var(--foreground)] p-4 font-medium",
    },
];

const initialEdges: Edge[] = [
    { id: "e1-2", source: "1", target: "2", animated: true, style: { stroke: '#888', strokeWidth: 2 } },
];

function CanvasApp() {
    const { theme } = useTheme();
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#888', strokeWidth: 2 } }, eds)),
        []
    );

    const onAddNode = () => {
        const newNode: Node = {
            id: `node_${Date.now()}`,
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: { label: "New Idea" },
            className: "bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm text-[var(--foreground)] p-4 font-medium",
        };
        setNodes((nds) => nds.concat(newNode));
    };

    return (
        <div className="w-full h-screen bg-[var(--background)] flex relative" ref={reactFlowWrapper}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                colorMode={theme === 'dark' ? 'dark' : 'light'}
            >
                {/* Background Grid */}
                <Background 
                    color={theme === 'dark' ? '#333' : '#ccc'} 
                    variant={BackgroundVariant.Dots} 
                    gap={20} 
                    size={2} 
                />
                <Controls className="bg-[var(--card)] border border-[var(--border)] fill-[var(--foreground)] shadow-sm rounded-lg overflow-hidden" />
                
                <Panel position="top-right" className="m-4">
                    <button onClick={onAddNode} className="flex items-center gap-2 bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-xl text-sm font-semibold shadow-md hover:opacity-90 transition-opacity">
                        <IconPlus size={16} /> Add Note
                    </button>
                </Panel>
            </ReactFlow>
        </div>
    );
}

export default function CanvasPage() {
    return (
        <div className="min-h-screen bg-[var(--background)] flex font-sans">
            <MinimalSidebar />
            
            <main className="flex-1 ml-0 md:ml-20 transition-all overflow-hidden h-screen relative">
                <ReactFlowProvider>
                    <CanvasApp />
                </ReactFlowProvider>
            </main>
        </div>
    );
}
