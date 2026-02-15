"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface AdminContextType {
    isEditing: boolean;
    setIsEditing: (v: boolean) => void;
    showLogin: boolean;
    setShowLogin: (v: boolean) => void;
}

const AdminContext = createContext<AdminContextType>({
    isEditing: false,
    setIsEditing: () => { },
    showLogin: false,
    setShowLogin: () => { },
});

export const useAdmin = () => useContext(AdminContext);

export function AdminProvider({ children }: { children: ReactNode }) {
    const [isEditing, setIsEditing] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    return (
        <AdminContext.Provider value={{ isEditing, setIsEditing, showLogin, setShowLogin }}>
            {children}
        </AdminContext.Provider>
    );
}
