import { IconClock, IconTrash, IconShare, IconFileText, IconMenu2, IconX, IconLoader2 } from "@tabler/icons-react";
import { AgentSession } from "./types";

interface Props {
    sessions: AgentSession[];
    currentSessionId: string | null;
    onSelectSession: (s: AgentSession) => void;
    onDeleteSession: (id: string, e: React.MouseEvent) => void;
    onShareSession: (id: string, e: React.MouseEvent) => void;
    onNewSession: () => void;
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
}

export function AgentSidebar({
    sessions, currentSessionId, onSelectSession, onDeleteSession, onShareSession, onNewSession, isOpen, setIsOpen
}: Props) {
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="absolute top-4 left-4 z-40 p-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-gray-500 hover:text-[var(--foreground)] shadow-sm"
            >
                <IconMenu2 className="w-5 h-5" />
            </button>
        );
    }

    return (
        <div className="absolute inset-y-0 left-0 z-40 w-72 bg-[var(--card)] border-r border-[var(--border)] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                <h2 className="font-semibold text-[15px]">Session History</h2>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-[var(--foreground)]">
                    <IconX className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4">
                <button
                    onClick={onNewSession}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm font-semibold hover:border-[var(--foreground)] transition-colors"
                >
                    + New Document
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {sessions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">No previous sessions found.</div>
                ) : (
                    sessions.map(s => {
                        const isActive = s.id === currentSessionId;
                        return (
                            <div
                                key={s.id}
                                onClick={() => onSelectSession(s)}
                                className={`group p-3 rounded-xl cursor-pointer transition-colors border ${isActive ? 'bg-[var(--foreground)] text-[var(--card)] border-transparent' : 'bg-transparent border-transparent hover:bg-black/5'}`}
                            >
                                <div className="flex items-start gap-2">
                                    <IconFileText className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'opacity-80' : 'text-gray-400'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <p className={`text-sm font-medium truncate ${isActive ? 'text-[var(--card)]' : 'text-[var(--foreground)]'}`}>
                                                {s.title}
                                            </p>
                                            {s.status === 'generating' && (
                                                <IconLoader2 className={`w-3.5 h-3.5 animate-spin ${isActive ? 'text-[var(--card)]' : 'text-emerald-500'}`} />
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-2 text-[11px] mt-1 ${isActive ? 'text-[var(--card)] opacity-70' : 'text-gray-400'}`}>
                                            <IconClock className="w-3 h-3" />
                                            {s.status === 'generating' ? (
                                                <span className="animate-pulse">Generating...</span>
                                            ) : (
                                                new Date(s.updated_at).toLocaleDateString()
                                            )}
                                            {s.share_id && <span className="px-1.5 py-0.5 rounded-sm bg-blue-500/20 text-blue-100 uppercase text-[9px] font-bold tracking-wider">Shared</span>}
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-1 transition-opacity ${isActive ? 'text-[var(--card)]' : 'text-gray-500 opacity-40 hover:opacity-100'}`}>
                                        <button onClick={(e) => onShareSession(s.id, e)} className="p-1.5 hover:bg-black/10 rounded-md" title="Share Session">
                                            <IconShare className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={(e) => onDeleteSession(s.id, e)} className="p-1.5 hover:bg-red-500/20 hover:text-red-500 rounded-md" title="Delete Session">
                                            <IconTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
