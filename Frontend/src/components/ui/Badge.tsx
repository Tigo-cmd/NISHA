import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
    children: React.ReactNode;
    variant?: "default" | "success" | "warning" | "danger" | "outline";
    className?: string;
    pulse?: boolean;
}

export const Badge = ({
    children,
    variant = "default",
    className,
    pulse = false,
}: BadgeProps) => {
    const variants = {
        default: "bg-foreground/10 text-foreground border-foreground/20",
        success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        danger: "bg-red-500/10 text-red-500 border-red-500/20",
        outline: "bg-transparent text-muted-foreground border-foreground/10",
    };

    const pulseColors: Record<string, string> = {
        default: "bg-foreground",
        success: "bg-emerald-500",
        warning: "bg-amber-500",
        danger: "bg-red-500",
    };

    return (
        <span
            className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-tighter border flex items-center gap-1.5 w-fit",
                variants[variant],
                className
            )}
        >
            {pulse && (
                <span className={cn(
                    "w-1.5 h-1.5 rounded-full animate-pulse",
                    pulseColors[variant] ?? "bg-foreground",
                )} />
            )}
            {children}
        </span>
    );
};
