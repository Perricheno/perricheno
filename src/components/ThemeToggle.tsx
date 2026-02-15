"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { IconSun, IconMoon } from "@tabler/icons-react";

export function ThemeToggle() {
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return (
        <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="p-3 rounded-xl bg-white/10 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-emerald-500/20 hover:border-emerald-500 transition-all backdrop-blur-md"
        >
            {resolvedTheme === "dark" ? (
                <IconSun className="w-5 h-5 text-yellow-400" />
            ) : (
                <IconMoon className="w-5 h-5 text-blue-500" />
            )}
        </button>
    );
}
