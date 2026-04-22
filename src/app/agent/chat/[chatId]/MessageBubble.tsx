"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { IconCopy, IconCheck, IconUser, IconRobot } from "@tabler/icons-react";

interface MessageBubbleProps {
    role: "user" | "assistant";
    content: string;
    isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    if (role === "user") {
        return (
            <div className="flex items-start gap-3 px-4 py-4">
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0">
                    <IconUser className="w-4 h-4 text-white" stroke={2} />
                </div>
                <div className="flex-1 pt-1">
                    <div className="text-[15px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
                        {content}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-3 px-4 py-4 bg-[#FAFAFA]">
            <div className="w-8 h-8 rounded-full bg-[#666] flex items-center justify-center shrink-0">
                <IconRobot className="w-4 h-4 text-white" stroke={2} />
            </div>
            <div className="flex-1 pt-1">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        // Paragraphs
                        p: ({ children }) => (
                            <p className="text-[15px] text-[#1a1a1a] leading-relaxed mb-4 last:mb-0">
                                {children}
                            </p>
                        ),
                        
                        // Headings
                        h1: ({ children }) => (
                            <h1 className="text-2xl font-bold text-[#1a1a1a] mt-6 mb-3 first:mt-0">
                                {children}
                            </h1>
                        ),
                        h2: ({ children }) => (
                            <h2 className="text-xl font-bold text-[#1a1a1a] mt-5 mb-2 first:mt-0">
                                {children}
                            </h2>
                        ),
                        h3: ({ children }) => (
                            <h3 className="text-lg font-bold text-[#1a1a1a] mt-4 mb-2 first:mt-0">
                                {children}
                            </h3>
                        ),
                        
                        // Lists
                        ul: ({ children }) => (
                            <ul className="list-disc list-inside space-y-1 mb-4 text-[15px] text-[#1a1a1a]">
                                {children}
                            </ul>
                        ),
                        ol: ({ children }) => (
                            <ol className="list-decimal list-inside space-y-1 mb-4 text-[15px] text-[#1a1a1a]">
                                {children}
                            </ol>
                        ),
                        li: ({ children }) => (
                            <li className="leading-relaxed">{children}</li>
                        ),
                        
                        // Inline code
                        code: ({ inline, className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const language = match ? match[1] : '';
                            const codeString = String(children).replace(/\n$/, '');
                            
                            if (!inline && language) {
                                // Code block with syntax highlighting
                                return (
                                    <div className="relative group my-4">
                                        <div className="absolute right-2 top-2 z-10">
                                            <button
                                                onClick={() => copyCode(codeString)}
                                                className="px-2 py-1 bg-[#282c34] hover:bg-[#3e4451] text-white text-xs rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                {copiedCode === codeString ? (
                                                    <>
                                                        <IconCheck className="w-3 h-3" />
                                                        Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <IconCopy className="w-3 h-3" />
                                                        Copy
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        <SyntaxHighlighter
                                            style={oneDark}
                                            language={language}
                                            PreTag="div"
                                            className="!rounded-xl !my-0 !text-sm"
                                            {...props}
                                        >
                                            {codeString}
                                        </SyntaxHighlighter>
                                    </div>
                                );
                            }
                            
                            // Inline code
                            return (
                                <code className="px-1.5 py-0.5 bg-[#f0f0f0] text-[#1a1a1a] rounded text-sm font-mono">
                                    {children}
                                </code>
                            );
                        },
                        
                        // Blockquotes
                        blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-gray-300 pl-4 py-2 my-4 text-gray-600 italic">
                                {children}
                            </blockquote>
                        ),
                        
        // Links
        a: ({ href, children }) => (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1a1a1a] hover:text-[#666] underline"
            >
                {children}
            </a>
        ),
                        
                        // Tables
                        table: ({ children }) => (
                            <div className="overflow-x-auto my-4">
                                <table className="min-w-full border border-gray-200 rounded-lg">
                                    {children}
                                </table>
                            </div>
                        ),
                        thead: ({ children }) => (
                            <thead className="bg-gray-50">{children}</thead>
                        ),
                        th: ({ children }) => (
                            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b border-gray-200">
                                {children}
                            </th>
                        ),
                        td: ({ children }) => (
                            <td className="px-4 py-2 text-sm text-gray-600 border-b border-gray-100">
                                {children}
                            </td>
                        ),
                        
                        // Horizontal rule
                        hr: () => (
                            <hr className="my-6 border-t border-gray-200" />
                        ),
                    }}
                >
                    {content}
                </ReactMarkdown>
                
                {isStreaming && (
                    <span className="inline-block w-2 h-4 bg-black animate-pulse ml-1" />
                )}
            </div>
        </div>
    );
}
