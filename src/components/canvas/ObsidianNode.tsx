import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer, useStore } from '@xyflow/react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { languages } from '@codemirror/language-data';

export const ObsidianNode = ({ data, selected, id }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(data.text || "");
    const zoom = useStore((s) => s.transform[2]);
    const inputRef = useRef<HTMLDivElement>(null);

    // Sync external data changes
    useEffect(() => {
        if (data.text !== undefined && data.text !== text) {
            setText(data.text);
        }
    }, [data.text]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (data.onChange) {
            data.onChange(id, text);
        }
    };

    const handleChange = (val: string) => {
        setText(val);
        // We defer calling data.onChange to onBlur for performance, 
        // to avoid triggering React Flow state updates on every keystroke.
    };

    // LOD: If zoomed out further than 0.4, simplify rendering drastically to save GPU/CPU
    const isZoomedOut = zoom < 0.4;

    return (
        <div 
            className={cn(
                "group w-full h-full bg-[#1e1e1e] rounded-xl flex flex-col transition-all shadow-lg overflow-hidden",
                selected ? "shadow-[0_0_0_2px_#a855f7,0_0_15px_rgba(168,85,247,0.15)]" : "shadow-[0_0_0_1px_#333] hover:shadow-[0_0_0_1px_#555]"
            )}
            onDoubleClick={handleDoubleClick}
        >
            {/* Resizer */}
            <NodeResizer 
                color="#a855f7" 
                isVisible={selected} 
                minWidth={120} 
                minHeight={50} 
                handleStyle={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#a855f7', border: 'none' }} 
                lineStyle={{ borderWidth: 1, borderColor: '#a855f7' }}
            />
            
            {/* Connection Handles */}
            <Handle id="top" type="target" position={Position.Top} className="w-3 h-3 bg-[#a855f7] border-none opacity-0 group-hover:opacity-100 transition-opacity z-10" />
            <Handle id="bottom" type="source" position={Position.Bottom} className="w-3 h-3 bg-[#a855f7] border-none opacity-0 group-hover:opacity-100 transition-opacity z-10" />
            <Handle id="left" type="target" position={Position.Left} className="w-3 h-3 bg-[#a855f7] border-none opacity-0 group-hover:opacity-100 transition-opacity z-10" />
            <Handle id="right" type="source" position={Position.Right} className="w-3 h-3 bg-[#a855f7] border-none opacity-0 group-hover:opacity-100 transition-opacity z-10" />

            {/* Drag Handle Top Bar */}
            <div className="h-4 w-full cursor-grab active:cursor-grabbing bg-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-1 pointer-events-auto custom-drag-handle">
                 <div className="w-8 h-1 rounded-full bg-gray-600"></div>
            </div>
            
            {/* Content View */}
            <div className="flex-1 px-4 pb-4 pt-1 flex flex-col overflow-hidden">
                {isZoomedOut ? (
                    <div className="w-full h-full flex items-start text-xs text-gray-500 overflow-hidden line-clamp-3">
                        {text ? text.slice(0, 50) + '...' : 'Empty Node'}
                    </div>
                ) : isEditing ? (
                    <div className="w-full h-full nodrag cursor-text" onWheel={(e) => e.stopPropagation()}>
                        <CodeMirror
                            value={text}
                            height="100%"
                            theme={oneDark}
                            extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            autoFocus
                            className="text-[13px] h-full overflow-y-auto minimal-scrollbar"
                            basicSetup={{
                                lineNumbers: false,
                                foldGutter: false,
                                highlightActiveLine: false,
                                highlightActiveLineGutter: false,
                            }}
                            style={{ backgroundColor: 'transparent' }}
                        />
                    </div>
                ) : (
                    <div className="w-full h-full text-gray-300 font-sans text-[13px] overflow-y-auto minimal-scrollbar prose prose-invert prose-sm max-w-none cursor-default">
                         {text ? (
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]} 
                                rehypePlugins={[rehypeRaw]}
                            >
                                {text}
                            </ReactMarkdown>
                         ) : (
                            <span className="text-gray-500 italic">Double click to edit...</span>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
};
