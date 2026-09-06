"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { MorphIcon } from "morphicons/react";
import { Sun, Moon } from "lucide";

export function ThemeToggle() {
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const isDark = resolvedTheme === "dark";

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="p-3 rounded-xl bg-white/10 border border-black/10 hover:bg-emerald-500/20 hover:border-emerald-500 transition-all backdrop-blur-md"
        >
            <MorphIcon
                icon={isDark ? Sun : Moon}
                size={20}
                className={isDark ? "text-yellow-400" : "text-blue-500"}
            />
        </button>
    );
}
