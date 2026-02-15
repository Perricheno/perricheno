"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const CRTOverlay = () => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
            {/* Scanlines */}
            <div
                className="absolute inset-0 z-50 pointer-events-none opacity-[0.03]"
                style={{
                    background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))",
                    backgroundSize: "100% 2px, 3px 100%"
                }}
            />

            {/* Flicker Animation */}
            <motion.div
                animate={{ opacity: [0.01, 0.02, 0.01] }}
                transition={{ duration: 0.2, repeat: Infinity, repeatType: "reverse" }}
                className="absolute inset-0 bg-white pointer-events-none z-50 mix-blend-overlay"
            />

            {/* Vignette */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: "radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 100%)"
                }}
            />
        </div>
    );
};
