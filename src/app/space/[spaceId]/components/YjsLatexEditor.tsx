"use client";

import { useEffect, useRef } from "react";
import {
    EditorView, keymap, lineNumbers,
    highlightActiveLineGutter, highlightActiveLine,
    type ViewUpdate,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { markdown } from "@codemirror/lang-markdown";
import { indentUnit, foldGutter, bracketMatching, indentOnInput } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import type { SelectionInfo } from "./LatexEditor";

interface CursorInfo {
    line: number;
    col: number;
    words: number;
    chars: number;
}

interface Props {
    yText:             Y.Text;
    provider:          WebsocketProvider;
    readOnly?:         boolean;
    onCursorChange?:   (info: CursorInfo) => void;
    onSelectionChange?: (sel: SelectionInfo | null) => void;
    goToLine?:         number | null;
}

// Same visual theme as LatexEditor so the switch is seamless
const perrichenoTheme = EditorView.theme({
    "&":                     { background: "#141414", color: "#e0e0e0", height: "100%" },
    ".cm-scroller":          { fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace', fontSize: "13px", lineHeight: "1.6" },
    ".cm-content":           { padding: "12px 0", caretColor: "#fff" },
    ".cm-line":              { padding: "0 16px" },
    ".cm-gutters":           { background: "#1a1a1a", color: "#555", border: "none", borderRight: "1px solid #2a2a2a" },
    ".cm-activeLineGutter":  { background: "#222" },
    ".cm-activeLine":        { background: "#1e1e1e" },
    ".cm-selectionBackground": { background: "#264f78 !important" },
    ".cm-cursor":            { borderLeftColor: "#fff", borderLeftWidth: "2px", transition: "top 60ms ease, left 60ms ease" },
    ".cm-matchingBracket":   { background: "#3a3a3a", outline: "1px solid #555" },
    ".cm-searchMatch":       { background: "#523f00" },
    ".cm-searchMatch.cm-searchMatch-selected": { background: "#9e6a03" },
    ".cm-foldPlaceholder":   { background: "#2a2a2a", color: "#888", border: "1px solid #444", borderRadius: "3px" },
    // Remote cursor labels (y-codemirror.next injects these)
    ".cm-ySelectionInfo":    { fontFamily: "sans-serif", fontSize: "10px", color: "#fff", padding: "1px 4px", borderRadius: "3px", opacity: "0.9", whiteSpace: "nowrap", pointerEvents: "none" },
}, { dark: true });

export default function YjsLatexEditor({ yText, provider, readOnly, onCursorChange, onSelectionChange, goToLine }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef      = useRef<EditorView | null>(null);

    // Build the editor once per (yText, provider) pair - i.e. once per opened file
    useEffect(() => {
        if (!containerRef.current) return;

        const undoManager = new Y.UndoManager(yText);

        const state = EditorState.create({
            extensions: [
                // Core Yjs binding - content + remote cursors
                yCollab(yText, provider.awareness, { undoManager }),

                markdown(),
                oneDark,
                perrichenoTheme,
                lineNumbers(),
                highlightActiveLineGutter(),
                highlightActiveLine(),
                foldGutter(),
                history(),
                bracketMatching(),
                indentOnInput(),
                indentUnit.of("  "),
                highlightSelectionMatches(),
                keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
                EditorView.lineWrapping,
                EditorView.editable.of(!readOnly),

                // Cursor + selection tracking (same as LatexEditor)
                EditorView.updateListener.of((update: ViewUpdate) => {
                    if (!update.docChanged && !update.selectionSet) return;

                    const sel  = update.state.selection.main;
                    const line = update.state.doc.lineAt(sel.head);
                    const col  = sel.head - line.from + 1;
                    const content = update.state.doc.toString();
                    const words   = content.trim() ? content.trim().split(/\s+/).length : 0;
                    onCursorChange?.({ line: line.number, col, words, chars: content.length });

                    if (!sel.empty) {
                        const text   = update.state.sliceDoc(sel.from, sel.to);
                        const coords = update.view.coordsAtPos(sel.head);
                        if (text.trim()) {
                            onSelectionChange?.({ text, from: sel.from, to: sel.to, x: coords?.left ?? 0, y: coords?.top ?? 0 });
                        } else {
                            onSelectionChange?.(null);
                        }
                    } else {
                        onSelectionChange?.(null);
                    }
                }),
            ],
        });

        const view = new EditorView({ state, parent: containerRef.current });
        viewRef.current = view;

        return () => {
            view.destroy();
            undoManager.destroy();
            viewRef.current = null;
        };
    }, [yText, provider]); // recreate when the file changes

    // Jump to line (from compiler log click)
    useEffect(() => {
        if (!goToLine || !viewRef.current) return;
        const view = viewRef.current;
        const line = Math.max(1, Math.min(goToLine, view.state.doc.lines));
        const pos  = view.state.doc.line(line).from;
        view.dispatch({
            selection: { anchor: pos },
            effects:   EditorView.scrollIntoView(pos, { y: "center" }),
        });
        view.focus();
    }, [goToLine]);

    return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}
