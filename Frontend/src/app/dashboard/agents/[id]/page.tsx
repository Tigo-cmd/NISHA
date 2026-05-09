"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useStore } from "@/store/useStore";
import { Badge } from "@/components/ui/Badge";
import { apiService } from "@/services/apiService";
import { cn } from "@/lib/utils";
import { WaveformVisualizer } from "@/components/dashboard/WaveformVisualizer";
import { AgoraVideoPlayer } from "@/components/dashboard/AgoraVideoPlayer";
import {
    ArrowLeft,
    Settings,
    Shield,
    Cpu,
    Activity,
    Clock,
    History,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AgentDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const { agents, masters, securityEvents } = useStore();
    const agent = agents.find((a) => a.id === id);
    const master = agent ? masters.find((m) => m.id === agent.masterId) : null;
    const agentEvents = securityEvents.filter((e) => e.agentId === id).slice(0, 5);

    const [emergencyLoading, setEmergencyLoading] = React.useState(false);

    const handleEmergencyProtocol = async () => {
        try {
            setEmergencyLoading(true);
            await apiService.sendAgentCommand(id, "EMERGENCY_PROTOCOL");
            alert("Emergency Protocol Initiated!");
        } catch (error) {
            console.error("Failed to initiate emergency protocol", error);
        } finally {
            setEmergencyLoading(false);
        }
    };

    const displayAgent = agent ?? {
        id,
        name: "Unknown Agent",
        status: "offline" as const,
        battery: 0,
        signal: 0,
        zone: "Unknown",
        hardware: "ESP32-CAM",
        firmware: "v1.2.4",
        lastSeen: "Unknown",
        cpuUsage: 0,
        ramUsage: 0,
        temp: 0,
        masterId: "",
        capabilities: [] as string[],
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/agents" className="p-2 hover:bg-foreground/5 rounded-md text-muted-foreground transition-colors">
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-display text-foreground uppercase">{displayAgent.name}</h2>
                            <Badge
                                variant={displayAgent.status === "active" ? "success" : displayAgent.status === "degraded" ? "warning" : "danger"}
                                pulse={displayAgent.status !== "offline"}
                            >
                                {displayAgent.status}
                            </Badge>
                        </div>
                        <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{displayAgent.id}</div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-foreground/5 rounded-md text-xs font-mono hover:bg-foreground/10 transition-all uppercase tracking-widest">
                        <Settings size={14} /> Configure
                    </button>
                    <button 
                        onClick={handleEmergencyProtocol}
                        disabled={emergencyLoading}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 text-background font-mono text-xs font-bold rounded-md transition-all uppercase tracking-widest",
                            emergencyLoading ? "bg-red-500 opacity-70 cursor-not-allowed" : "bg-red-500 hover:bg-red-600"
                        )}
                    >
                        <Shield size={14} /> {emergencyLoading ? "INITIATING..." : "Emergency Protocol"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-surface/70 p-6 rounded-lg border border-foreground/5">
                        <div className="flex items-center gap-2 mb-6">
                            <Activity size={16} className="text-foreground" />
                            <h3 className="text-foreground font-display text-sm uppercase tracking-widest">Live Visual Surveillance</h3>
                        </div>
                        <AgoraVideoPlayer 
                            channelName={`nisha_stream_${id}`} 
                            agentId={id} 
                        />
                    </div>

                    <div className="bg-surface/70 p-6 rounded-lg border border-foreground/5">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <Activity size={16} className="text-foreground" />
                                <h3 className="text-foreground font-display text-sm uppercase tracking-widest">Live Audio Signal</h3>
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground">BUFFERING: 12ms | GAIN: +6dB</div>
                        </div>
                        <WaveformVisualizer height={160} />
                        <div className="mt-4 flex justify-between text-[10px] font-mono text-muted-foreground/50">
                            <span>0Hz</span>
                            <span>44.1kHz</span>
                        </div>
                    </div>

                    <div className="bg-surface/70 p-6 rounded-lg border border-foreground/5">
                        <div className="flex items-center gap-2 mb-6">
                            <History size={16} className="text-foreground" />
                            <h3 className="text-foreground font-display text-sm uppercase tracking-widest">Detection Stream</h3>
                        </div>

                        <div className="space-y-3">
                            {agentEvents.length > 0 ? agentEvents.map((event, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-foreground/5 rounded border border-foreground/5 hover:border-foreground/10 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="text-[10px] font-mono text-muted-foreground">{event.timestamp.split(' ')[1] || event.timestamp}</div>
                                        <div className="text-sm text-foreground font-medium">{event.type}</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[150px]">{event.description}</div>
                                        <Badge variant={event.severity === "critical" ? "danger" : event.severity === "high" ? "warning" : "outline"}>
                                            {event.severity}
                                        </Badge>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-muted-foreground text-xs font-mono uppercase">
                                    No recent detections
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-surface/70 p-6 rounded-lg border border-foreground/5">
                        <div className="flex items-center gap-2 mb-6">
                            <Cpu size={16} className="text-foreground" />
                            <h3 className="text-foreground font-display text-sm uppercase tracking-widest">Hardware Analytics</h3>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-2 uppercase">
                                    <span>CPU Load</span>
                                    <span className="text-foreground">{displayAgent.cpuUsage}%</span>
                                </div>
                                <div className="h-1 bg-foreground/5 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${displayAgent.cpuUsage}%` }} className="h-full bg-foreground/60" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-2 uppercase">
                                    <span>Battery Level</span>
                                    <span className="text-emerald-500">{displayAgent.battery}%</span>
                                </div>
                                <div className="h-1 bg-foreground/5 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${displayAgent.battery}%` }} className="h-full bg-emerald-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-foreground/5">
                                <div className="space-y-1">
                                    <div className="text-[9px] font-mono text-muted-foreground uppercase">Temp</div>
                                    <div className="text-sm font-mono text-foreground">{displayAgent.temp}°C</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[9px] font-mono text-muted-foreground uppercase">RAM</div>
                                    <div className="text-sm font-mono text-foreground">{displayAgent.ramUsage} MB</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-surface/70 p-6 rounded-lg border border-foreground/5">
                        <div className="flex items-center gap-2 mb-6">
                            <Clock size={16} className="text-foreground" />
                            <h3 className="text-foreground font-display text-sm uppercase tracking-widest">Network Info</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Firmware</span>
                                <span className="text-foreground font-mono">{displayAgent.firmware}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Signal</span>
                                <span className="text-foreground font-mono">{displayAgent.signal} dBm</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Last Pulse</span>
                                <span className="text-foreground font-mono">{displayAgent.lastSeen}</span>
                            </div>
                            {master && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Master</span>
                                    <span className="text-foreground font-mono">{master.name}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
