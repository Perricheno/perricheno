// JSON Canvas 1.0 Specification Interfaces
// Based on https://jsoncanvas.org/

export type CanvasColor = 
    | "1" | "2" | "3" | "4" | "5" | "6"
    | string; // Hex color like "#ff0000"

export interface CanvasNodeBase {
    id: string; // Unique target ID
    x: number;
    y: number;
    width: number;
    height: number;
    color?: CanvasColor;
}

export interface CanvasTextNode extends CanvasNodeBase {
    type: "text";
    text: string;
}

export interface CanvasFileNode extends CanvasNodeBase {
    type: "file";
    file: string; // The path to the file within the system
    subpath?: string; // Optional subpath (e.g., "#heading")
}

export interface CanvasLinkNode extends CanvasNodeBase {
    type: "link";
    url: string; // Web URL
}

export interface CanvasGroupNode extends CanvasNodeBase {
    type: "group";
    label?: string; // Text overlay
    background?: string; // Image path
    backgroundStyle?: "cover" | "ratio" | "repeat"; 
}

export type CanvasNode = CanvasTextNode | CanvasFileNode | CanvasLinkNode | CanvasGroupNode;

export type EdgeEnd = "none" | "arrow";
export type EdgeSide = "top" | "right" | "bottom" | "left";

export interface CanvasEdge {
    id: string;
    fromNode: string;
    fromSide?: EdgeSide;
    fromEnd?: EdgeEnd;
    toNode: string;
    toSide?: EdgeSide;
    toEnd?: EdgeEnd;
    color?: CanvasColor;
    label?: string; // Text label on the edge
}

export interface CanvasData {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
}

import { Node, Edge } from '@xyflow/react';

/**
 * Transforms standard React Flow nodes and edges into the strict JSON Canvas 1.0 specification.
 */
export function reactFlowToJsonCanvas(nodes: Node[], edges: Edge[]): CanvasData {
    const canvasNodes: CanvasNode[] = nodes.map(node => {
        // Enforce Math.round to avoid subpixel rendering artifacts in JSON
        const x = Math.round(node.position.x);
        const y = Math.round(node.position.y);
        const width = node.measured?.width ? Math.round(node.measured.width) : (node.style?.width ? Number(node.style.width) : 250);
        const height = node.measured?.height ? Math.round(node.measured.height) : (node.style?.height ? Number(node.style.height) : 250);
        
        // Base mapping
        // We assume 'type' is set on the React Flow node. If it's a generic obsidian node, we map it to text by default.
        // In our implementation we use type: 'obsidian', but data dictates its JSON Canvas role.
        const base = {
            id: node.id,
            x,
            y,
            width,
            height,
            color: node.data.color as CanvasColor | undefined,
        };

        const canvasType = node.data.canvasType || "text";

        if (canvasType === "file") {
            return { ...base, type: "file", file: node.data.file, subpath: node.data.subpath } as CanvasFileNode;
        } else if (canvasType === "link") {
            return { ...base, type: "link", url: node.data.url } as CanvasLinkNode;
        } else if (canvasType === "group") {
            return { ...base, type: "group", label: node.data.label, background: node.data.background, backgroundStyle: node.data.backgroundStyle } as CanvasGroupNode;
        }

        // Default to text
        return { ...base, type: "text", text: (node.data.text as string) || "" } as CanvasTextNode;
    });

    const canvasEdges: CanvasEdge[] = edges.map(edge => {
        return {
            id: edge.id,
            fromNode: edge.source,
            toNode: edge.target,
            // Fallback to "right" and "left" if handles are missing 
            fromSide: (edge.sourceHandle as EdgeSide) || "right",
            toSide: (edge.targetHandle as EdgeSide) || "left",
            fromEnd: "none",
            toEnd: (edge.markerEnd ? "arrow" : "none") as EdgeEnd,
            color: edge.data?.color as CanvasColor | undefined,
            label: edge.label as string | undefined,
        };
    });

    return { nodes: canvasNodes, edges: canvasEdges };
}

/**
 * Transforms JSON Canvas 1.0 data into React Flow nodes and edges.
 */
export function jsonCanvasToReactFlow(data: CanvasData): { nodes: Node[], edges: Edge[] } {
    const nodes: Node[] = data.nodes.map(node => {
        return {
            id: node.id,
            type: "obsidian", // We route everything through our custom ObsidianNode
            position: { x: node.x, y: node.y },
            data: {
                canvasType: node.type,
                // Spread the rest of the properties into data
                text: (node as CanvasTextNode).text || "",
                file: (node as CanvasFileNode).file,
                url: (node as CanvasLinkNode).url,
                label: (node as CanvasGroupNode).label,
                color: node.color,
            },
            style: { width: node.width, height: node.height },
        };
    });

    const edges: Edge[] = data.edges.map(edge => {
        return {
            id: edge.id,
            source: edge.fromNode,
            target: edge.toNode,
            sourceHandle: edge.fromSide,
            targetHandle: edge.toSide,
            // Depending on toEnd, we attach a marker in the component
            markerEnd: edge.toEnd === 'arrow' ? 'url(#arrow)' : undefined, 
            type: 'smoothstep', // Default for obsidian S-curves
            data: { 
                color: edge.color, 
                label: edge.label 
            }
        };
    });

    return { nodes, edges };
}
