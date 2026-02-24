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


