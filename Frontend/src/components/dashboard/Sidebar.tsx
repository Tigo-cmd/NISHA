"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Settings,
    ShieldAlert,
    Radio,
    BarChart3,
    Lock,
    ChevronLeft,
    ChevronRight,
    Camera,
    MapPin,
    Terminal,
    Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { name: "Overview", icon: LayoutDashboard, href: "/dashboard" },
    { name: "Agents", icon: Radio, href: "/dashboard/agents" },
    { name: "Audio Analysis", icon: Mic, href: "/dashboard/audio" },
    { name: "Maps", icon: MapPin, href: "/dashboard/maps" },
    { name: "Perimeter", icon: Camera, href: "/dashboard/perimeter" },
    { name: "Alerts", icon: ShieldAlert, href: "/dashboard/alerts" },
    { name: "Analytics", icon: BarChart3, href: "/dashboard/analytics" },
    { name: "Terminal", icon: Terminal, href: "/dashboard/terminal" },
    { name: "System", icon: Settings, href: "/dashboard/system" },
    { name: "Security", icon: Lock, href: "/dashboard/security" },
];

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

export const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
    const pathname = usePathname();

    return (
        <aside
            className={cn(
                "bg-surface border-r border-foreground/5 flex flex-col transition-all duration-300 relative z-30",
                isOpen ? "w-[240px]" : "w-[80px]"
            )}
        >
            <div className="h-[80px] border-b border-foreground/5 flex items-center px-4">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-12 h-12 shrink-0 relative">
                        <img
                            src="/assets/logo-icon.png"
                            alt="NISHA"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    {isOpen && (
                        <span className="text-lg font-display font-bold tracking-tighter text-foreground">NISHA</span>
                    )}
                </Link>
            </div>

            <nav className="flex-1 py-6 px-4 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-4 px-3 py-2.5 rounded-md transition-all duration-200 group relative",
                                isActive
                                    ? "bg-foreground/10 text-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                            )}
                        >
                            <item.icon size={20} className="shrink-0" />
                            {isOpen && <span className="text-sm font-medium">{item.name}</span>}

                            {!isOpen && (
                                <div className="absolute left-[70px] bg-elevated border border-foreground/10 px-2 py-1 rounded text-[10px] invisible group-hover:visible whitespace-nowrap z-50">
                                    {item.name}
                                </div>
                            )}

                            {isActive && (
                                <div className="absolute left-0 w-[2px] h-3/5 bg-foreground top-1/2 -translate-y-1/2" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {isOpen && (
                <div className="px-6 py-6 border-t border-foreground/5 space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-muted-foreground">ONLINE AGENTS</span>
                        <span className="text-foreground">12</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-muted-foreground">ACTIVE ALERTS</span>
                        <span className="text-red-500">03</span>
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="h-10 hover:bg-foreground/5 flex items-center justify-center border-t border-foreground/5 text-muted-foreground"
            >
                {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
        </aside>
    );
};
