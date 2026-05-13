"use client";

import React from "react";
import { AudioIntelligence } from "@/components/dashboard/AudioIntelligence";
import { Mic, Shield, Radio } from "lucide-react";

export default function AudioAnalysisPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-140px)] space-y-4">
            {/* Header Section */}
            <div className="flex justify-between items-end px-2">
                <div>
                    <h2 className="text-3xl font-display text-foreground uppercase tracking-tight flex items-center gap-3">
                        <Mic className="text-emerald-500" size={28} /> 
                        Acoustic Perimeter
                    </h2>
                    <p className="text-muted-foreground text-sm font-mono uppercase tracking-widest mt-1">
                        Signal Intelligence & Autonomous Transcription Node
                    </p>
                </div>
                
                <div className="flex items-center gap-6 pb-1">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">Neural Engine</span>
                        <span className="text-xs font-mono text-emerald-500 font-bold">VAD ACTIVE</span>
                    </div>
                    <div className="flex flex-col items-end border-l border-foreground/10 pl-6">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">Network Mode</span>
                        <span className="text-xs font-mono text-foreground font-bold uppercase tracking-tighter">Local WiFi</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-surface/30 border border-foreground/5 rounded-2xl overflow-hidden shadow-2xl">
                <AudioIntelligence />
            </div>

            {/* Footer Stats */}
            <div className="grid grid-cols-3 gap-4 px-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5 border border-foreground/5">
                    <Radio size={16} className="text-muted-foreground" />
                    <div>
                        <div className="text-[9px] font-mono text-muted-foreground uppercase">Active Streams</div>
                        <div className="text-sm font-mono font-bold">04 SENSORS</div>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5 border border-foreground/5">
                    <Shield size={16} className="text-muted-foreground" />
                    <div>
                        <div className="text-[9px] font-mono text-muted-foreground uppercase">Privacy Masking</div>
                        <div className="text-sm font-mono font-bold text-emerald-500">ON-DEVICE</div>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5 border border-foreground/5">
                    <Mic size={16} className="text-muted-foreground" />
                    <div>
                        <div className="text-[9px] font-mono text-muted-foreground uppercase">Latency</div>
                        <div className="text-sm font-mono font-bold text-emerald-500">~24MS</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
