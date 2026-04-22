"use client";

import { useEffect, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef, type Statistics } from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { markdown } from "@codemirror/lang-markdown";
import { indentUnit, foldGutter } from "@codemirror/language";
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine, keymap, type ViewUpdate } from "@codemirror/view";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { EditorView } from "@codemirror/view";

// Custom dark theme that matches Perricheno design
const perrichenoTheme = EditorView.theme({
    '&': { background: '#141414', color: '#e0e0e0', height: '100%' },
    '.cm-scroller': { fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace', fontSize: '13px', lineHeight: '1.6' },
    '.cm-content': { padding: '12px 0', caretColor: '#fff' },
    '.cm-line': { padding: '0 16px' },
    '.cm-gutters': { background: '#1a1a1a', color: '#555', border: 'none', borderRight: '1px solid #2a2a2a' },
    '.cm-activeLineGutter': { background: '#222' },
    '.cm-activeLine': { background: '#1e1e1e' },
    '.cm-selectionBackground': { background: '#264f78 !important' },
    '.cm-cursor': { borderLeftColor: '#fff', borderLeftWidth: '2px', transition: 'top 60ms ease, left 60ms ease' },
    '.cm-matchingBracket': { background: '#3a3a3a', outline: '1px solid #555' },
    '.cm-searchMatch': { background: '#523f00' },
    '.cm-searchMatch.cm-searchMatch-selected': { background: '#9e6a03' },
    '.cm-foldPlaceholder': { background: '#2a2a2a', color: '#888', border: '1px solid #444', borderRadius: '3px' },
}, { dark: true });

interface CursorInfo {
    line: number;
    col: number;
    words: number;
    chars: number;
}

export interface SelectionInfo {
    text: string;
    from: number;
    to: number;
    x: number;
    y: number;
}

interface Props {
    content: string;
    onChange: (value: string) => void;
    onCursorChange?: (info: CursorInfo) => void;
    onSelectionChange?: (sel: SelectionInfo | null) => void;
    readOnly?: boolean;
    goToLine?: number | null;
    applyReplacement?: { from: number; to: number; text: string } | null;
}

export default function LatexEditor({ content, onChange, onCursorChange, onSelectionChange, readOnly, goToLine, applyReplacement }: Props) {
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    // Jump to line when requested (e.g. from compiler log click)
    useEffect(() => {
        if (!goToLine || !editorRef.current?.view) return;
        const view = editorRef.current.view;
        const line = Math.max(1, Math.min(goToLine, view.state.doc.lines));
        const pos = view.state.doc.line(line).from;
        view.dispatch({
            selection: { anchor: pos },
            effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        });
        view.focus();
    }, [goToLine]);

    // Apply AI replacement into editor
    useEffect(() => {
        if (!applyReplacement || !editorRef.current?.view) return;
        const view = editorRef.current.view;
        const { from, to, text } = applyReplacement;
        view.dispatch({ changes: { from, to, insert: text } });
        view.focus();
    }, [applyReplacement]);

    // Selection tracker extension
    const selectionExtension = useRef(
        EditorView.updateListener.of((update: ViewUpdate) => {
            if (!update.selectionSet && !update.docChanged) return;
            const sel = update.state.selection.main;
            if (sel.empty) { onSelectionChange?.(null); return; }
            const text = update.state.sliceDoc(sel.from, sel.to);
            if (!text.trim()) { onSelectionChange?.(null); return; }
            const coords = update.view.coordsAtPos(sel.head);
            onSelectionChange?.({
                text,
                from: sel.from,
                to: sel.to,
                x: coords ? coords.left : 0,
                y: coords ? coords.top : 0,
            });
        })
    );

    return (
        <div className="h-full w-full overflow-hidden">
            <CodeMirror
                ref={editorRef}
                value={content}
                onChange={onChange}
                readOnly={readOnly}
                onStatistics={(stats: Statistics) => {
                    if (!onCursorChange) return;
                    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
                    const s = stats as any;
                    const cursorPos: number = s.cursor ?? s.indexContent ?? 0;
                    onCursorChange({ line: stats.line.number, col: cursorPos - stats.line.from + 1, words, chars: content.length });
                }}
                height="100%"
                theme={[oneDark, perrichenoTheme]}
                extensions={[
                    // Use markdown as closest public lang; LaTeX lang can be added later
                    markdown(),
                    lineNumbers(),
                    highlightActiveLineGutter(),
                    highlightActiveLine(),
                    foldGutter(),
                    history(),
                    bracketMatching(),
                    indentOnInput(),
                    indentUnit.of("  "),
                    highlightSelectionMatches(),
                    keymap.of([
                        ...defaultKeymap,
                        ...historyKeymap,
                        ...searchKeymap,
                        indentWithTab,
                    ]),
                    EditorView.lineWrapping,
                    selectionExtension.current,
                ]}
                style={{ height: '100%' }}
                basicSetup={false}
            />
        </div>
    );
}
