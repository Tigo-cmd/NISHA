"use client";

import React from "react";
import { motion } from "framer-motion";

interface TerminalWindowProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

export const TerminalWindow: React.FC<TerminalWindowProps> = ({
    title,
    children,
    className = "",
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-surface/70 backdrop-blur-xl border border-foreground/10 rounded-lg overflow-hidden flex flex-col ${className}`}
        >
            <div className="bg-foreground/5 border-b border-foreground/10 px-4 py-2 flex items-center justify-between">
                <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                </div>
                <div className="text-xs font-mono text-muted-foreground select-none">
                    {title}
                </div>
                <div className="w-12" />
            </div>

            <div className="p-6 font-mono text-sm relative overflow-hidden flex-1">
                <div className="relative z-10">
                    {children}
                </div>
            </div>
        </motion.div>
    );
};

export const TerminalLine: React.FC<{ children: React.ReactNode; delay?: number }> = ({
    children,
    delay = 0,
}) => (
    <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay }}
        className="mb-1 flex"
    >
        <span className="text-muted-foreground mr-2 select-none">{">"}</span>
        <div className="text-foreground whitespace-pre-wrap">{children}</div>
    </motion.div>
);
