"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface JuicyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    intensity?: "low" | "medium" | "high";
}

export const JuicyButton = ({
    children,
    className,
    onClick,
    intensity = "medium",
    ...props
}: JuicyButtonProps) => {
    const [isPressed, setIsPressed] = useState(false);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        setIsPressed(true);
        setTimeout(() => setIsPressed(false), 200);

        // Screen shake logic (basic CSS transform on body for a moment, or just specific element)
        // For this demo, we can just shake the button itself vigorously

        if (onClick) onClick(e);
    };

    const shakeVariants = {
        idle: { x: 0, scale: 1 },
        pressed: {
            scale: 0.9,
            x: [0, -2, 2, -2, 0],
            y: [0, 2, -2, 0],
            transition: { duration: 0.1 }
        },
        hover: {
            scale: 1.05,
            rotate: [-1, 1, -1, 0],
            transition: { duration: 0.2 }
        }
    };

    return (
        <motion.button
            className={cn(
                "relative font-bold uppercase tracking-widest transition-colors select-none",
                // Balatro style: thick borders, contrasting colors (adjusted for site theme)
                "bg-white text-black border-2 border-transparent hover:border-emerald-400 hover:text-emerald-400 hover:bg-black",
                className
            )}
            onClick={handleClick}
            variants={shakeVariants}
            initial="idle"
            whileHover="hover"
            animate={isPressed ? "pressed" : "idle"}
            {...(props as any)}
        >
            {children}
        </motion.button>
    );
};
