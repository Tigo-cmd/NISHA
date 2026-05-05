"use client";

import React from "react";
import { Search, Bell, User, Activity } from "lucide-react";

export const DashboardHeader = () => {
    return (
        <header className="h-[60px] border-b border-foreground/5 bg-surface/50 backdrop-blur-md flex items-center justify-between px-6 z-20">
            <div className="flex items-center gap-4">
                <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                    System / Dashboard / <span className="text-foreground">Overview</span>
                </div>
            </div>

            <div className="hidden md:flex items-center w-full max-w-md px-4 py-1.5 bg-background/50 border border-foreground/5 rounded-md focus-within:border-foreground/20 transition-colors">
                <Search size={16} className="text-muted-foreground mr-3" />
                <input
                    type="text"
                    placeholder="SEARCH (CMD+K)"
                    className="bg-transparent border-none outline-none text-xs text-foreground w-full font-mono placeholder:text-muted-foreground/50"
                />
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/5 rounded-full border border-emerald-500/10">
                    <Activity size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-tighter">System Healthy</span>
                </div>

                <button className="relative text-muted-foreground hover:text-foreground transition-colors">
                    <Bell size={20} />
                    <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-surface" />
                </button>

                <button className="flex items-center gap-3 p-1 hover:bg-foreground/5 rounded-md transition-colors group">
                    <div className="w-8 h-8 rounded bg-foreground/10 flex items-center justify-center text-foreground border border-foreground/10 group-hover:bg-foreground group-hover:text-background transition-colors">
                        <User size={18} />
                    </div>
                </button>
            </div>
        </header>
    );
};
