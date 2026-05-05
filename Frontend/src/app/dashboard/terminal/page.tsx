"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { Terminal as TerminalIcon, Globe, MapPin, Radio, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TerminalPage() {
    const { alerts, agents, telemetryLogs } = useStore();
    const bottomRef = useRef<HTMLDivElement>(null);
    const [filter, setFilter] = useState<"ALL" | "AUDIO" | "SYSTEM" | "VIDEO" | "TELEMETRY">("ALL");

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [alerts, telemetryLogs]);

    // Combine and sort logs
    const combinedLogs = useMemo(() => {
        const all = [
            ...alerts.map(a => ({ ...a, logType: "ALERT" })),
            ...telemetryLogs.map(t => ({ ...t, logType: "TELEMETRY", severity: "low" }))
        ];
        return all
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .filter(l => filter === "ALL" || l.type === filter);
    }, [alerts, telemetryLogs, filter]);

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] space-y-4">
            <div className="flex flex-col md:flex-row justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-display text-foreground uppercase tracking-wider flex items-center gap-2">
                        <TerminalIcon className="text-foreground" /> Transcription Terminal
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Live command-line interface for incoming audio transcripts and system telemetry.
                    </p>
                </div>

                <div className="flex gap-2">
                    {(["ALL", "AUDIO", "VIDEO", "SYSTEM", "TELEMETRY"] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-4 py-1.5 border rounded-md text-[10px] font-mono uppercase tracking-widest transition-all",
                                filter === f 
                                    ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/50 font-bold" 
                                    : "bg-surface text-muted-foreground border-foreground/5 hover:text-foreground"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Terminal Window */}
            <div className="flex-1 bg-black border border-foreground/10 rounded-xl overflow-hidden flex flex-col relative shadow-2xl">
                {/* Terminal Header */}
                <div className="bg-[#1a1a24] border-b border-foreground/10 p-3 flex items-center justify-between shrink-0">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground tracking-widest">
                        root@nisha-master:~# tail -f /var/log/nisha_combined.log
                    </div>
                    <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-mono animate-pulse">
                        <Activity size={12} />
                        LIVE DATA STREAM
                    </div>
                </div>

                {/* Terminal Body */}
                <div className="flex-1 overflow-y-auto p-6 font-mono text-xs sm:text-sm space-y-3">
                    {combinedLogs.length === 0 ? (
                        <div className="text-muted-foreground italic opacity-50">Waiting for incoming transmission...</div>
                    ) : (
                        combinedLogs.map((log) => {
                            const agent = agents.find(a => a.id === log.agentId);
                            const location = agent?.zone || "Unknown Vector";
                            
                            // Color coding based on type
                            const textColor = log.type === "AUDIO" ? "text-emerald-400" :
                                              log.type === "VIDEO" ? "text-amber-400" :
                                              log.type === "TELEMETRY" ? "text-purple-400" :
                                              log.type === "SYSTEM" ? "text-blue-400" : "text-gray-400";

                            return (
                                <div key={log.id} className="flex flex-col sm:flex-row gap-2 sm:gap-6 hover:bg-white/5 p-1 -mx-1 rounded transition-colors group">
                                    {/* Left side: Metadata block */}
                                    <div className="flex sm:flex-col sm:w-48 shrink-0 gap-2 sm:gap-1 border-b sm:border-b-0 sm:border-r border-white/10 pb-2 sm:pb-0 sm:pr-4">
                                        <div className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</div>
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                            <Radio size={10} /> {log.agentId}
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-auto">
                                            <span className="flex items-center gap-1 text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                                                <Globe size={8} /> {log.type === "TELEMETRY" ? "RAW" : "EN-US"}
                                            </span>
                                            <span className="flex items-center gap-1 text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                                                <MapPin size={8} /> {location}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Right side: Transcription / Log output */}
                                    <div className="flex-1">
                                        <div className="text-[10px] text-gray-500 mb-1">
                                            <span className={textColor}>[{log.type}]</span> {log.severity?.toUpperCase() || "INFO"}
                                        </div>
                                        <div className={cn("leading-relaxed break-all", textColor)}>
                                            {log.type === "AUDIO" ? `> "${log.description}"` : `> ${log.description}`}
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-600 mt-2 transition-opacity">
                                            EVENT_ID: {log.id}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* Blinking cursor at the end */}
                    <div className="flex items-center text-emerald-500 mt-4">
                        <span>nisha-master:~#</span>
                        <span className="w-2 h-4 bg-emerald-500 ml-2 animate-pulse"></span>
                    </div>
                    <div ref={bottomRef} />
                </div>
            </div>
        </div>
    );
}
