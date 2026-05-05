"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface NeonButtonProps {
    variant?: "cyan" | "green" | "red" | "purple" | "ghost";
    glow?: boolean;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    disabled?: boolean;
}

export const NeonButton: React.FC<NeonButtonProps> = ({
    children,
    className,
    variant = "cyan",
    glow = true,
    onClick,
    disabled,
}) => {
    const variants = {
        cyan: "bg-cyan-neon/10 border-cyan-neon text-cyan-neon hover:bg-cyan-neon hover:text-background",
        green: "bg-green-acid/10 border-green-acid text-green-acid hover:bg-green-acid hover:text-background",
        red: "bg-red-alert/10 border-red-alert text-red-alert hover:bg-red-alert hover:text-background",
        purple: "bg-purple-electric/10 border-purple-electric text-purple-electric hover:bg-purple-electric hover:text-background",
        ghost: "bg-transparent border-white/20 text-text-secondary hover:border-cyan-neon hover:text-cyan-neon",
    };

    const glows = {
        cyan: "shadow-[0_0_15px_rgba(0,240,255,0.3)]",
        green: "shadow-[0_0_15px_rgba(57,255,20,0.3)]",
        red: "shadow-[0_0_15px_rgba(255,42,109,0.3)]",
        purple: "shadow-[0_0_15px_rgba(189,0,255,0.3)]",
        ghost: "hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]",
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "px-6 py-2.5 rounded-md border font-display font-medium uppercase tracking-wider transition-all duration-300",
                variants[variant],
                glow && glows[variant],
                className
            )}
        >
            {children}
        </motion.button>
    );
};
