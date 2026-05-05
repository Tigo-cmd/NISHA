"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { Badge } from "@/components/ui/Badge";
import { VideoStream } from "@/components/dashboard/VideoStream";
import {
    Camera,
    Grid3X3,
    Maximize2,
    Wifi,
    Battery,
    MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function PerimeterPage() {
    const { agents } = useStore();
    const videoAgents = agents.filter((a) => a.capabilities.includes("video"));
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
        videoAgents.find((a) => a.status === "active")?.id ?? null
    );
    const [viewMode, setViewMode] = useState<"single" | "grid">("single");

    const selectedAgent = videoAgents.find((a) => a.id === selectedAgentId);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-display text-foreground uppercase tracking-wider">
                        Perimeter Intelligence
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Monitor video feeds from camera-equipped agents.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode("single")}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono uppercase tracking-widest transition-all border",
                            viewMode === "single"
                                ? "bg-foreground text-background border-foreground"
                                : "bg-surface border-foreground/5 text-muted-foreground hover:border-foreground/20"
                        )}
                    >
                        <Maximize2 size={14} /> Single
                    </button>
                    <button
                        onClick={() => setViewMode("grid")}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono uppercase tracking-widest transition-all border",
                            viewMode === "grid"
                                ? "bg-foreground text-background border-foreground"
                                : "bg-surface border-foreground/5 text-muted-foreground hover:border-foreground/20"
                        )}
                    >
                        <Grid3X3 size={14} /> Grid
                    </button>
                </div>
            </div>

            <div className="flex gap-2 pb-2 overflow-x-auto">
                {videoAgents.map((agent) => (
                    <button
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg border transition-all shrink-0",
                            selectedAgentId === agent.id
                                ? "bg-foreground/10 border-foreground/20"
                                : "bg-surface/70 border-foreground/5 hover:border-foreground/10"
                        )}
                    >
                        <Camera
                            size={16}
                            className={cn(
                                agent.status === "active"
                                    ? "text-emerald-500"
                                    : agent.status === "degraded"
                                    ? "text-amber-500"
                                    : "text-muted-foreground opacity-30"
                            )}
                        />
                        <div className="text-left">
                            <div className="text-xs font-medium text-foreground">
                                {agent.name}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground">
                                {agent.id}
                            </div>
                        </div>
                        <Badge
                            variant={
                                agent.status === "active"
                                    ? "success"
                                    : agent.status === "degraded"
                                    ? "warning"
                                    : "danger"
                            }
                            pulse={agent.status !== "offline"}
                        >
                            {agent.status}
                        </Badge>
                    </button>
                ))}
            </div>

            {viewMode === "single" && selectedAgent ? (
                <div className="space-y-4">
                    <VideoStream
                        title={selectedAgent.name}
                        nodeId={selectedAgent.id}
                    />

                    <div className="bg-surface/70 p-4 rounded-lg border border-foreground/5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex items-center gap-2">
                                <Wifi
                                    size={14}
                                    className={cn(
                                        selectedAgent.signal > -60
                                            ? "text-emerald-500"
                                            : selectedAgent.signal > -80
                                            ? "text-amber-500"
                                            : "text-red-500"
                                    )}
                                />
                                <div>
                                    <div className="text-[9px] font-mono text-muted-foreground uppercase">
                                        Signal
                                    </div>
                                    <div className="text-sm font-mono text-foreground">
                                        {selectedAgent.signal} dBm
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Battery
                                    size={14}
                                    className={cn(
                                        selectedAgent.battery > 50
                                            ? "text-emerald-500"
                                            : selectedAgent.battery > 20
                                            ? "text-amber-500"
                                            : "text-red-500"
                                    )}
                                />
                                <div>
                                    <div className="text-[9px] font-mono text-muted-foreground uppercase">
                                        Battery
                                    </div>
                                    <div className="text-sm font-mono text-foreground">
                                        {selectedAgent.battery}%
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-muted-foreground" />
                                <div>
                                    <div className="text-[9px] font-mono text-muted-foreground uppercase">
                                        Zone
                                    </div>
                                    <div className="text-sm font-mono text-foreground">
                                        {selectedAgent.zone}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Camera size={14} className="text-muted-foreground" />
                                <div>
                                    <div className="text-[9px] font-mono text-muted-foreground uppercase">
                                        Hardware
                                    </div>
                                    <div className="text-sm font-mono text-foreground">
                                        {selectedAgent.hardware}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : viewMode === "single" ? (
                <div className="bg-surface/70 rounded-lg border border-foreground/5 py-20 text-center">
                    <Camera size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-mono text-sm">
                        SELECT A CAMERA AGENT TO BEGIN MONITORING
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {videoAgents
                        .filter((a) => a.status !== "offline")
                        .map((agent) => (
                            <div key={agent.id} className="space-y-2">
                                <VideoStream
                                    title={agent.name}
                                    nodeId={agent.id}
                                />
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}
