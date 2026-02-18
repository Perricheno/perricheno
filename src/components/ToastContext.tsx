"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconX, IconCheck, IconInfoCircle, IconAlertTriangle } from "@tabler/icons-react";

type ToastType = "success" | "error" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => { } });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 4000);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const icons = {
        success: <IconCheck className="w-5 h-5 text-green-500" />,
        error: <IconAlertTriangle className="w-5 h-5 text-red-500" />,
        info: <IconInfoCircle className="w-5 h-5 text-blue-500" />,
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: -20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            className="pointer-events-auto min-w-[300px] max-w-sm bg-[var(--background)] border border-[var(--border)] shadow-2xl rounded-xl p-4 flex items-start gap-4"
                        >
                            <div className="mt-0.5 shrink-0">{icons[toast.type]}</div>
                            <div className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</div>
                            <button onClick={() => removeToast(toast.id)} className="opacity-40 hover:opacity-100 transition-opacity">
                                <IconX className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}
