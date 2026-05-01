import React from 'react';
import { IconLoader2 } from "@tabler/icons-react";

export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--card)] space-y-4">
            <div className="relative">
                <IconLoader2 className="w-10 h-10 text-[var(--foreground)] animate-spin opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-[var(--foreground)] rounded-full animate-pulse" />
                </div>
            </div>
            <div className="flex flex-col items-center space-y-1">
                <p className="text-sm font-medium animate-pulse">Loading chat...</p>
                <p className="text-xs text-gray-400">Fetching messages and context</p>
            </div>
        </div>
    );
}
