"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { apiService } from "@/services/apiService";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Activity,
    Mic,
    Video,
    MapPin,
    BarChart3,
    Battery,
    Wifi,
    Cpu,
    Thermometer,
    Clock,
    Server,
    Move,
    Eye,
    Trash2,
} from "lucide-react";
import { WaveformVisualizer } from "./WaveformVisualizer";
import dynamic from 'next/dynamic';
import type { Agent } from "@/types";
import { WebSocketMessageType } from "@/types";
import { websocketService } from "@/services/websocketService";

const AgoraVideoPlayer = dynamic(() => import("./AgoraVideoPlayer").then(mod => mod.AgoraVideoPlayer), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-black/50 animate-pulse" />
});

function StatusDot({ status }: { status: string }) {
    const color =
        status === "active"
            ? "bg-emerald-500"
            : status === "degraded"
                ? "bg-amber-500"
                : "bg-neutral-500";
    return (
        <span className={cn("inline-block w-2 h-2 rounded-full", color, status !== "offline" && "animate-pulse")} />
    );
}

function TelemetryBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
    const pct = Math.min((value / max) * 100, 100);
    return (
        <div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1 uppercase">
                <span>{label}</span>
                <span className="text-foreground">{value}{unit}</span>
            </div>
            <div className="h-1 bg-foreground/5 rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all", pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500")}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function OverviewTab({ agent }: { agent: Agent }) {
    const { masters } = useStore();
    const master = masters.find((m) => m.id === agent.masterId);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface/50 p-3 rounded-lg border border-foreground/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Battery size={12} />
                        <span className="text-[10px] font-mono uppercase">Battery</span>
                    </div>
                    <div className="text-lg font-display text-foreground">{agent.battery}%</div>
                </div>
                <div className="bg-surface/50 p-3 rounded-lg border border-foreground/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Wifi size={12} />
                        <span className="text-[10px] font-mono uppercase">Signal</span>
                    </div>
                    <div className="text-lg font-display text-foreground">{agent.signal} dBm</div>
                </div>
            </div>

            <div className="space-y-3">
                <TelemetryBar label="CPU" value={agent.cpuUsage} max={100} unit="%" />
                <TelemetryBar label="RAM" value={agent.ramUsage} max={4} unit=" MB" />
                <TelemetryBar label="Temperature" value={agent.temp} max={80} unit="°C" />
                <TelemetryBar label="Battery" value={agent.battery} max={100} unit="%" />
            </div>

            {master && (
                <div className="bg-surface/50 p-4 rounded-lg border border-foreground/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-3">
                        <Server size={14} />
                        <span className="text-xs font-mono uppercase">Master Connection</span>
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Master</span>
                            <span className="text-foreground font-mono">{master.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">IP</span>
                            <span className="text-foreground font-mono">{master.ip}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <span className="flex items-center gap-1.5 text-foreground">
                                <StatusDot status={master.status} />
                                {master.status}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* AI events placeholder */}

            <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Hardware</span>
                    <span className="text-foreground font-mono">{agent.hardware}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Firmware</span>
                    <span className="text-foreground font-mono">{agent.firmware}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Zone</span>
                    <span className="text-foreground font-mono">{agent.zone}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Seen</span>
                    <span className="text-foreground font-mono">{agent.lastSeen}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Capabilities</span>
                    <span className="text-foreground font-mono">{agent.capabilities.join(", ")}</span>
                </div>
            </div>
        </div>
    );
}

function AudioTab({ agent }: { agent: Agent }) {
    const { securityEvents } = useStore();
    const agentEvents = securityEvents.filter(e => e.agentId === agent.id);
    const [latestAudio, setLatestAudio] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let audioUrl: string | null = null;
        const fetchAudio = async () => {
            try {
                const data = await apiService.getAgentMedia(agent.id, "audio");
                if (data?.base64) {
                    if (audioUrl) URL.revokeObjectURL(audioUrl);
                    
                    const byteCharacters = atob(data.base64);
                    const byteNumbers = new Uint8Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    
                    // Try to detect if it's AAC/M4A or WAV
                    const mimeType = data.base64.startsWith('UklGR') ? 'audio/wav' : 'audio/m4a';
                    const blob = new Blob([byteNumbers], { type: mimeType });
                    audioUrl = URL.createObjectURL(blob);
                    setLatestAudio(audioUrl);
                }
            } catch (err) {
                console.error("Failed to fetch audio:", err);
            }
        };

        fetchAudio();
        const interval = setInterval(fetchAudio, 10000); // Poll every 10s to match recording loop
        return () => {
            clearInterval(interval);
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [agent.id]);

    if (!agent.capabilities.includes("audio")) {
        return <div className="text-center py-12 text-muted-foreground text-sm">This agent does not have audio capability.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-muted-foreground uppercase">Live Waveform</span>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-mono text-red-500 uppercase">Live</span>
                    </div>
                </div>
                <WaveformVisualizer height={120} color="#e0e0e0" level={agent.audioLevel} />
            </div>

            {latestAudio && (
                <div className="bg-surface/50 p-4 rounded-lg border border-foreground/5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono text-muted-foreground uppercase">Latest Clip</span>
                        <Mic size={14} className="text-muted-foreground" />
                    </div>
                    <audio controls className="w-full h-8" src={latestAudio} />
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface/50 p-3 rounded-lg border border-foreground/5">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Current Level</div>
                    <div className="text-lg font-display text-foreground">{agent.audioLevel ?? 0} dB</div>
                </div>
                <div className="bg-surface/50 p-3 rounded-lg border border-foreground/5">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Threshold</div>
                    <div className="text-lg font-display text-foreground">310 dB</div>
                </div>
            </div>

            <div>
                <span className="text-xs font-mono text-muted-foreground uppercase">AI Signal Analysis</span>
                <div className="mt-2 bg-foreground/5 rounded-lg p-3 border border-foreground/5 min-h-[64px] flex items-center justify-center">
                    {agentEvents.filter(e => e.type === "Audio Trigger").length > 0 ? (
                        <div className="w-full">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-mono text-emerald-500 uppercase">Signature Match</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{agentEvents.filter(e => e.type === "Audio Trigger")[0].timestamp.split(', ')[1]}</span>
                            </div>
                            <p className="text-xs text-foreground italic">
                                {agentEvents.filter(e => e.type === "Audio Trigger")[0].description}
                            </p>
                        </div>
                    ) : (
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest text-center">
                            Awaiting Acoustic Signature...
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function VideoTab({ agent, masterUrl }: { agent: Agent, masterUrl?: string }) {
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamLoading, setStreamLoading] = useState(false);
    const [latestVideo, setLatestVideo] = useState<string | null>(null);
    const [liveFrame, setLiveFrame] = useState<string | null>(null);

    useEffect(() => {
        // Subscribe to real-time binary frames relayed via Backend WebSocket
        console.log(`[VideoTab] Subscribing to live frames for ${agent.id}`);
        const unsubLiveFrame = websocketService.subscribe(WebSocketMessageType.LIVE_FRAME, (data: any) => {
            if (data && data.agent_id === agent.id && data.frame) {
                // If it's a mobile agent, we might still receive frames for AI, 
                // but we only set liveFrame if it's explicitly identified as the primary source 
                // or if it's a hardware agent.
                const isHardware = agent.agentType === 'HARDWARE' || data.agent_type === 'HARDWARE';
                
                if (isHardware || !agent.agentType || agent.agentType === 'LEGACY') {
                    setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
                    if (!isStreaming) setIsStreaming(true);
                }
            }
        });

        let videoUrl: string | null = null;
        const fetchVideo = async () => {
            try {
                const data = await apiService.getAgentMedia(agent.id, "video");
                if (data?.base64) {
                    if (videoUrl) URL.revokeObjectURL(videoUrl);
                    
                    const byteCharacters = atob(data.base64);
                    const byteNumbers = new Uint8Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const blob = new Blob([byteNumbers], { type: 'video/mp4' });
                    videoUrl = URL.createObjectURL(blob);
                    setLatestVideo(videoUrl);
                }
            } catch (err) {
                console.error("Failed to fetch video:", err);
            }
        };

        fetchVideo();
        const interval = setInterval(fetchVideo, 10000); // Poll every 10s
        
        return () => {
            unsubLiveFrame();
            clearInterval(interval);
            if (videoUrl) URL.revokeObjectURL(videoUrl);
        };
    }, [agent.id, isStreaming]);

    if (!agent.capabilities.includes("video")) {
        return <div className="text-center py-12 text-muted-foreground text-sm">This agent does not have video capability.</div>;
    }

    const handleStartStream = async () => {
        if (isStreaming) {
            setIsStreaming(false);
            setLiveFrame(null);
            return;
        }
        
        try {
            setStreamLoading(true);
            await apiService.sendAgentCommand(agent.id, "START_STREAM");
            setIsStreaming(true);
        } catch (error) {
            console.error("Failed to start stream:", error);
        } finally {
            setStreamLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center border border-foreground/5 relative">
                {isStreaming ? (
                    // Priority 1: Live Frame from WebSocket (Best for Hardware Agents)
                    liveFrame ? (
                        <div className="relative w-full h-full">
                            <img 
                                src={liveFrame} 
                                alt="Live Relay" 
                                className="w-full h-full object-contain"
                            />
                            <div className="absolute top-4 left-4 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-mono text-white uppercase tracking-widest bg-black/50 px-2 py-1 rounded">
                                    LIVE · RELAY
                                </span>
                            </div>
                        </div>
                    ) : 
                    // Priority 2: Direct MJPEG Stream (Secondary for Hardware Agents)
                    agent.streamUrl ? (
                        <div className="relative w-full h-full group/stream">
                             <img 
                                src={agent.streamUrl} 
                                alt="Live Feed" 
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    console.error("MJPEG Stream Error");
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/640x360?text=Stream+Offline';
                                }}
                            />
                            <div className="absolute top-4 left-4 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-mono text-white uppercase tracking-widest bg-black/50 px-2 py-1 rounded">
                                    LIVE · MJPEG
                                </span>
                            </div>
                        </div>
                    ) : 
                    // Priority 3: Agora (ONLY for Mobile Agents)
                    agent.agentType === "MOBILE" ? (
                        <AgoraVideoPlayer 
                            channelName={`nisha_stream_${agent.id}`} 
                            agentId={agent.id} 
                            masterUrl={masterUrl}
                        />
                    ) : (
                        <div className="text-center text-muted-foreground animate-pulse">
                            <Clock size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-xs font-mono uppercase">Awaiting Stream...</p>
                        </div>
                    )
                ) : (
                    <div className="text-center text-muted-foreground">
                        <Video size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-mono uppercase">
                            No Live Feed
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Connect to stream to view live feed</p>
                    </div>
                )}
            </div>
            <button 
                onClick={handleStartStream}
                disabled={streamLoading}
                className={cn(
                    "w-full py-2 rounded-md text-xs font-mono uppercase tracking-wider transition-colors",
                    isStreaming ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-foreground text-background hover:opacity-90",
                    streamLoading && "opacity-50 cursor-not-allowed"
                )}
            >
                {streamLoading ? "Connecting..." : isStreaming ? "Stop Stream" : "Start Stream"}
            </button>
            <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-surface/50 p-3 rounded-lg border border-foreground/5">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Resolution</div>
                    <div className="text-foreground font-mono">1280x720</div>
                </div>
                <div className="bg-surface/50 p-3 rounded-lg border border-foreground/5">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">FPS</div>
                    <div className="text-foreground font-mono">2.5</div>
                </div>
            </div>
        </div>
    );
}

function LocationTab({ agent }: { agent: Agent }) {
    if (!agent.capabilities.includes("gps") || !agent.position) {
        return (
            <div className="space-y-4">
                <div className="text-center py-8 text-muted-foreground text-sm">
                    {!agent.capabilities.includes("gps")
                        ? "This agent does not have GPS capability."
                        : "No position data available."}
                </div>
                <div className="bg-surface/50 p-4 rounded-lg border border-foreground/5">
                    <div className="text-xs text-muted-foreground">Zone Assignment</div>
                    <div className="text-foreground font-mono mt-1">{agent.zone}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-surface/50 p-4 rounded-lg border border-foreground/5 space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin size={14} />
                    <span className="text-xs font-mono uppercase">GPS Coordinates</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <div className="text-muted-foreground">Latitude</div>
                        <div className="text-foreground font-mono text-sm">{agent.position.lat.toFixed(6)}</div>
                    </div>
                    <div>
                        <div className="text-muted-foreground">Longitude</div>
                        <div className="text-foreground font-mono text-sm">{agent.position.lng.toFixed(6)}</div>
                    </div>
                </div>
            </div>

            <div className="aspect-video bg-surface/30 rounded-lg border border-foreground/5 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                    <MapPin size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-mono">Map view</p>
                    <p className="text-[10px] mt-1">{agent.position.lat.toFixed(4)}, {agent.position.lng.toFixed(4)}</p>
                </div>
            </div>

            <div className="bg-surface/50 p-4 rounded-lg border border-foreground/5">
                <div className="text-xs text-muted-foreground">Zone</div>
                <div className="text-foreground font-mono mt-1">{agent.zone}</div>
            </div>
        </div>
    );
}

function AnalyticsTab({ agent }: { agent: Agent }) {
    const { securityEvents, alerts } = useStore();
    const agentEvents = securityEvents.filter(e => e.agentId === agent.id);
    const agentAlerts = alerts.filter(a => a.agentId === agent.id);
    const recentActivity = agentEvents.length > 0 ? "Elevated" : "Normal";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface/50 p-3 rounded-lg border border-foreground/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Move size={12} />
                        <span className="text-[10px] font-mono uppercase">Motion</span>
                    </div>
                    <div className={cn("text-sm font-display", agent.motionDetected ? "text-amber-500" : "text-foreground")}>
                        {agent.motionDetected ? "Detected" : "Clear"}
                    </div>
                </div>
                <div className="bg-surface/50 p-3 rounded-lg border border-foreground/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Eye size={12} />
                        <span className="text-[10px] font-mono uppercase">Detections (Total)</span>
                    </div>
                    <div className="text-sm font-display text-foreground">{agentEvents.length}</div>
                </div>
            </div>

            <div className="bg-surface/50 p-4 rounded-lg border border-foreground/5">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                    <Activity size={14} />
                    <span className="text-xs font-mono uppercase">AI Pattern Recognition</span>
                </div>
                <div className="space-y-2">
                    <div className="h-1.5 w-full bg-foreground/5 rounded-full overflow-hidden">
                        <div 
                            className={cn("h-full transition-all", agentEvents.length > 0 ? "bg-amber-500 w-2/3" : "bg-emerald-500 w-1/3")} 
                        />
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground uppercase text-center">
                        {agentEvents.length > 0 ? "Anomaly Pattern Detected" : "Baseline Activity Normal"}
                    </div>
                </div>
            </div>

            {agentEvents.length > 0 && (
                <div className="space-y-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Recent AI Events</span>
                    <div className="space-y-2">
                        {agentEvents.slice(0, 3).map(evt => (
                            <div key={evt.id} className="text-[10px] bg-foreground/5 p-2 rounded border border-foreground/5 flex justify-between items-center">
                                <span className="text-foreground">{evt.type}</span>
                                <span className="text-muted-foreground font-mono">{evt.timestamp.split(', ')[1]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "audio", label: "Audio", icon: Mic },
    { id: "video", label: "Video", icon: Video },
    { id: "location", label: "Location", icon: MapPin },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function AgentDrawer() {
    const { drawerOpen, selectedAgentId, agents, setDrawerOpen } = useStore();
    const [activeTab, setActiveTab] = useState<TabId>("overview");
    const agent = agents.find((a) => a.id === selectedAgentId);
    const { masters } = useStore();
    const master = agents.find(a => a.id === selectedAgentId) ? masters.find(m => m.id === agent?.masterId) : null;
    const masterUrl = master?.ip ? (master.ip.startsWith('http') ? master.ip : `https://${master.ip}`) : undefined;

    useEffect(() => {
        setActiveTab("overview");
    }, [selectedAgentId]);

    return (
        <AnimatePresence>
            {drawerOpen && agent && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/30 z-40"
                        onClick={() => setDrawerOpen(false)}
                    />
                    <motion.aside
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed right-0 top-0 h-full w-[460px] max-w-full bg-background border-l border-foreground/10 z-50 flex flex-col"
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/5">
                            <div>
                                <div className="flex items-center gap-2">
                                    <StatusDot status={agent.status} />
                                    <h2 className="text-lg font-display text-foreground">{agent.name}</h2>
                                </div>
                                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-0.5">{agent.id} · {agent.hardware}</div>
                            </div>
                            <div className="flex items-center gap-1">

                                <button
                                    onClick={() => setDrawerOpen(false)}
                                    className="p-2 rounded-md hover:bg-foreground/5 text-muted-foreground transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex border-b border-foreground/5 px-2">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                const isDisabled =
                                    (tab.id === "video" && !agent.capabilities.includes("video")) ||
                                    (tab.id === "audio" && !agent.capabilities.includes("audio")) ||
                                    (tab.id === "location" && !agent.capabilities.includes("gps"));

                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        disabled={isDisabled}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider border-b-2 transition-colors",
                                            isActive ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                                            isDisabled && "opacity-30 cursor-not-allowed hover:text-muted-foreground"
                                        )}
                                    >
                                        <Icon size={12} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex-1 overflow-y-auto p-5">
                            {activeTab === "overview" && <OverviewTab agent={agent} />}
                            {activeTab === "audio" && <AudioTab agent={agent} />}
                            {activeTab === "video" && <VideoTab agent={agent} masterUrl={masterUrl} />}
                            {activeTab === "location" && <LocationTab agent={agent} />}
                            {activeTab === "analytics" && <AnalyticsTab agent={agent} />}
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
