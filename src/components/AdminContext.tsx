"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/types/user";

interface AdminContextType {
    isEditing: boolean;
    setIsEditing: (v: boolean) => void;
    showLogin: boolean;
    setShowLogin: (v: boolean) => void;
    user: User | null;
    login: (userData: any) => Promise<void>;
    logout: () => Promise<void>;
    deleteAccount: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType>({
    isEditing: false,
    setIsEditing: () => { },
    showLogin: false,
    setShowLogin: () => { },
    user: null,
    login: async () => { },
    logout: async () => { },
    deleteAccount: async () => { },
});

export const useAdmin = () => useContext(AdminContext);

export function AdminProvider({ children }: { children: ReactNode }) {
    const [isEditing, setIsEditing] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const res = await fetch("/api/auth/me", { cache: 'no-store' }); // Ensure no cache
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Auth check failed", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = async (telegramData: any) => {
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(telegramData),
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                // Also trigger guest success if needed elsewhere?
                // For now, setting user is enough.
                window.location.reload();
            } else {
                const errorData = await res.json().catch(() => ({ error: res.statusText }));
                console.error("Server Login Error Details:", errorData);
                throw new Error(errorData.error || errorData.details || "Login failed");
            }
        } catch (e) {
            console.error("Login Exception:", e);
            throw e;
        }
    };

    const logout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        window.location.reload(); // clear state fully
    };

    const deleteAccount = async () => {
        if (!confirm("Are you sure? This will delete all your data permanently.")) return;

        await fetch("/api/auth/delete", { method: "DELETE" });
        setUser(null);
        window.location.reload();
    };

    return (
        <AdminContext.Provider value={{ isEditing, setIsEditing, showLogin, setShowLogin, user, login, logout, deleteAccount }}>
            {children}
        </AdminContext.Provider>
    );
}
