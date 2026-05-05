"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: string;
        isUp: boolean;
    };
    status?: "good" | "warning" | "error";
    className?: string;
    chart?: React.ReactNode;
}

export const KPICard = ({
    label,
    value,
    icon: Icon,
    trend,
    status = "good",
    className,
    chart,
}: KPICardProps) => {
    const borderColors = {
        good: "border-l-emerald-500",
        warning: "border-l-amber-500",
        error: "border-l-red-500",
    };

    const iconColors = {
        good: "text-emerald-500 bg-emerald-500/5 border-emerald-500/10",
        warning: "text-amber-500 bg-amber-500/5 border-amber-500/10",
        error: "text-red-500 bg-red-500/5 border-red-500/10",
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className={cn(
                "bg-surface/70 backdrop-blur-xl p-6 rounded-lg border border-foreground/5 border-l-2 flex flex-col relative overflow-hidden",
                borderColors[status],
                className
            )}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{label}</div>
                <div className={cn("p-2 rounded-md border", iconColors[status])}>
                    <Icon size={16} />
                </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-display text-foreground select-none">{value}</span>
                {trend && (
                    <span className={cn(
                        "text-[10px] font-mono",
                        trend.isUp ? "text-emerald-500" : "text-red-500"
                    )}>
                        {trend.isUp ? "↑" : "↓"} {trend.value}
                    </span>
                )}
            </div>

            {chart && (
                <div className="mt-4 h-12 w-full flex items-end gap-[2px]">
                    {chart}
                </div>
            )}
        </motion.div>
    );
};

export const MiniBarChart = ({ values, color = "#e0e0e0" }: { values: number[]; color?: string }) => (
    <div className="flex items-end gap-[2px] h-full w-full">
        {values.map((v, i) => {
            const safeValue = isNaN(v) || v === null ? 0 : v;
            return (
                <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${safeValue}%` }}
                    className="flex-1 min-w-[2px] rounded-t-sm"
                    style={{ backgroundColor: color, opacity: 0.3 + (safeValue / 100) * 0.7 }}
                />
            );
        })}
    </div>
);
