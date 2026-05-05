"use client";

import React, { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { apiService } from "@/services/apiService";
import {
    Settings, Activity, Server, Radio, Zap,
    Database, Network, Cpu, HardDrive, RefreshCw, UploadCloud
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { SystemStatus, Master, Agent } from "@/types";

export default function SystemPage() {
    const { masters, agents, systemStatus, setSystemStatus } = useStore();
    const [isLoading, setIsLoading] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isRebalancing, setIsRebalancing] = useState<string | null>(null);

    // Global Config State
    const [audioThreshold, setAudioThreshold] = useState(310);
    const [motionSensitivity, setMotionSensitivity] = useState(8);
    const [heartbeatInterval, setHeartbeatInterval] = useState(30);
    const [isApplyingConfig, setIsApplyingConfig] = useState(false);

    // Firmware Update State
    const [updatingAgents, setUpdatingAgents] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchSystemStatus = async () => {
            const status = await apiService.getSystemStatus();
            if (status) setSystemStatus(status);
        };
        fetchSystemStatus();

        // Refresh status every 30s
        const interval = setInterval(fetchSystemStatus, 30000);
        return () => clearInterval(interval);
    }, [setSystemStatus]);

    const handleOptimizeTopology = async () => {
        setIsOptimizing(true);
        try {
            await apiService.optimizeTopology();
            // In a real app we'd refresh the topology graph here
        } finally {
            setTimeout(() => setIsOptimizing(false), 1500); // Fake delay for UX
        }
    };

    const handleRebalanceMaster = async (masterId: string) => {
        setIsRebalancing(masterId);
        try {
            await apiService.rebalanceMaster(masterId);
        } finally {
            setTimeout(() => setIsRebalancing(null), 1000); // Fake delay for UX
        }
    };

    const handleApplyGlobalConfig = async () => {
        setIsApplyingConfig(true);
        try {
            const configPayload = {
                audioThreshold,
                motionSensitivity,
                heartbeatInterval
            };
            
            // Push config to all active agents concurrently
            const activeAgents = agents.filter(a => a.status === 'active');
            await Promise.all(
                activeAgents.map(agent => 
                    apiService.updateAgentConfig(agent.id, configPayload)
                )
            );
            console.log("Global config applied to", activeAgents.length, "agents");
        } catch (error) {
            console.error("Failed to apply global config", error);
        } finally {
            setTimeout(() => setIsApplyingConfig(false), 1000);
        }
    };

    const handleUpdateFirmware = async (agentId: string) => {
        setUpdatingAgents(prev => ({ ...prev, [agentId]: true }));
        try {
            await apiService.sendAgentCommand(agentId, "UPDATE_FIRMWARE", { targetVersion: "v1.2.4" });
            // In reality we'd wait for WebSocket status change to update firmware string
        } catch (error) {
            console.error(`Failed to trigger firmware update for ${agentId}`, error);
        } finally {
            setTimeout(() => setUpdatingAgents(prev => ({ ...prev, [agentId]: false })), 2000);
        }
    };

    // Use fetched status if available, otherwise fallback to store counts
    const fallbackStatus: SystemStatus = {
        status: "operational",
        timestamp: new Date().toISOString(),
        agents: {
            total: agents.length || 0,
            active: agents.filter(a => a.status === 'active').length || 0,
            offline: agents.filter(a => a.status === 'offline').length || 0,
            degraded: agents.filter(a => a.status === 'degraded').length || 0,
        },
        masters: {
            total: masters.length || 0,
            online: masters.filter(m => m.status === 'online').length || 0,
        },
        websocket_connections: 0
    };

    const status = (systemStatus && systemStatus.agents) ? systemStatus : fallbackStatus;

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-display text-foreground uppercase tracking-wider flex items-center gap-2">
                        <Settings className="text-foreground" /> System Management
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Infrastructure health, master nodes, and global configuration.
                    </p>
                </div>
            </div>

            {/* System Status Banner */}
            <div className={cn(
                "rounded-xl border p-5 flex flex-col md:flex-row items-center justify-between gap-6 transition-colors",
                status.status === "operational" ? "bg-emerald-500/5 border-emerald-500/20" :
                    status.status === "degraded" ? "bg-amber-500/5 border-amber-500/20" :
                        "bg-red-500/5 border-red-500/20"
            )}>
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "p-3 rounded-full",
                        status.status === "operational" ? "bg-emerald-500/20 text-emerald-500" :
                            status.status === "degraded" ? "bg-amber-500/20 text-amber-500" :
                                "bg-red-500/20 text-red-500"
                    )}>
                        <Activity size={24} className={status.status === "operational" ? "animate-pulse" : ""} />
                    </div>
                    <div>
                        <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-1">Global System Status</div>
                        <div className="text-2xl font-display text-foreground capitalize">{status.status}</div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-x-8 gap-y-4">
                    <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1 mb-1">
                            <Server size={10} /> API Server
                        </div>
                        <div className="text-sm font-mono text-foreground">99.9% / 42ms</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1 mb-1">
                            <Database size={10} /> Database
                        </div>
                        <div className="text-sm font-mono text-foreground">Connected</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1 mb-1">
                            <Network size={10} /> WebSockets
                        </div>
                        <div className="text-sm font-mono text-foreground">{status.websocket_connections} Active</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1 mb-1">
                            <Activity size={10} /> Last Update
                        </div>
                        <div className="text-sm font-mono text-foreground">{new Date(status.timestamp).toLocaleTimeString()}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Master Management */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-mono uppercase tracking-widest text-foreground flex items-center gap-2">
                            <Server size={16} /> Master Nodes
                        </h3>
                        <Badge variant="outline">{masters.length} Deployed</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {masters.map(master => (
                            <div key={master.id} className="bg-surface/50 border border-foreground/5 rounded-xl p-4 flex flex-col relative overflow-hidden group hover:border-foreground/20 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "w-2 h-2 rounded-full",
                                                master.status === "online" ? "bg-emerald-500 animate-pulse" :
                                                    master.status === "degraded" ? "bg-amber-500" : "bg-red-500"
                                            )} />
                                            <h4 className="font-display text-foreground">{master.name}</h4>
                                        </div>
                                        <div className="text-[10px] font-mono text-muted-foreground mt-1">ID: {master.id} | IP: {master.ip}</div>
                                    </div>
                                    <button
                                        onClick={() => handleRebalanceMaster(master.id)}
                                        disabled={isRebalancing === master.id || master.status === "offline"}
                                        className="p-1.5 bg-surface border border-foreground/10 hover:border-foreground/30 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                        title="Rebalance Agents"
                                    >
                                        <RefreshCw size={14} className={isRebalancing === master.id ? "animate-spin" : ""} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                                    <div>
                                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground uppercase mb-1">
                                            <span className="flex items-center gap-1"><Cpu size={10} /> CPU</span>
                                            <span>{master.cpuUsage}%</span>
                                        </div>
                                        <div className="h-1 bg-foreground/10 rounded-full overflow-hidden">
                                            <div className={cn("h-full", master.cpuUsage > 80 ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${master.cpuUsage}%` }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground uppercase mb-1">
                                            <span className="flex items-center gap-1"><HardDrive size={10} /> RAM</span>
                                            <span>{master.ramUsage}%</span>
                                        </div>
                                        <div className="h-1 bg-foreground/10 rounded-full overflow-hidden">
                                            <div className={cn("h-full", master.ramUsage > 80 ? "bg-red-500" : "bg-amber-500")} style={{ width: `${master.ramUsage}%` }} />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-3 border-t border-foreground/5 flex justify-between items-center text-xs">
                                    <div className="text-muted-foreground font-mono">
                                        <span className="text-foreground">{master.agentCount}</span> Agents
                                    </div>
                                    <div className="text-muted-foreground font-mono text-[10px]">
                                        Uptime: {master.uptime}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Topology Controls */}
                    <div className="bg-surface/50 border border-foreground/5 rounded-xl p-5">
                        <h3 className="text-sm font-mono uppercase tracking-widest text-foreground flex items-center gap-2 mb-4">
                            <Network size={16} /> Mesh Topology
                        </h3>

                        <div className="space-y-3 mb-5">
                            <div className="flex justify-between text-xs border-b border-foreground/5 pb-2">
                                <span className="text-muted-foreground">Total Nodes</span>
                                <span className="font-mono text-foreground">
                                    {(status?.agents?.total || 0) + (status?.masters?.total || 0)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs border-b border-foreground/5 pb-2">
                                <span className="text-muted-foreground">Mesh Health</span>
                                <span className="font-mono text-emerald-500">Optimal (94%)</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Avg Signal Strength</span>
                                <span className="font-mono text-foreground">-62 dBm</span>
                            </div>
                        </div>

                        <button
                            onClick={handleOptimizeTopology}
                            disabled={isOptimizing}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-foreground/10 hover:bg-foreground/20 border border-foreground/20 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                            <Zap size={14} className={cn("text-amber-500", isOptimizing && "animate-pulse")} />
                            {isOptimizing ? "Optimizing Routes..." : "Optimize Routing"}
                        </button>
                    </div>

                    {/* Global Config */}
                    <div className="bg-surface/50 border border-foreground/5 rounded-xl p-5">
                        <h3 className="text-sm font-mono uppercase tracking-widest text-foreground flex items-center gap-2 mb-4">
                            <Settings size={16} /> Global Config
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-mono text-muted-foreground uppercase flex justify-between mb-1">
                                    Audio Threshold <span>{audioThreshold} dB</span>
                                </label>
                                <input 
                                    type="range" min="100" max="800" 
                                    value={audioThreshold}
                                    onChange={(e) => setAudioThreshold(Number(e.target.value))}
                                    className="w-full h-1 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-foreground" 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-mono text-muted-foreground uppercase flex justify-between mb-1">
                                    Motion Sensitivity <span>{motionSensitivity >= 8 ? 'High' : motionSensitivity >= 4 ? 'Medium' : 'Low'} ({motionSensitivity}/10)</span>
                                </label>
                                <input 
                                    type="range" min="1" max="10" 
                                    value={motionSensitivity}
                                    onChange={(e) => setMotionSensitivity(Number(e.target.value))}
                                    className="w-full h-1 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-foreground" 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-mono text-muted-foreground uppercase flex justify-between mb-1">
                                    Heartbeat Interval <span>{heartbeatInterval}s</span>
                                </label>
                                <input 
                                    type="range" min="5" max="120" step="5"
                                    value={heartbeatInterval}
                                    onChange={(e) => setHeartbeatInterval(Number(e.target.value))}
                                    className="w-full h-1 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-foreground" 
                                />
                            </div>

                            <button 
                                onClick={handleApplyGlobalConfig}
                                disabled={isApplyingConfig || agents.length === 0}
                                className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-md text-xs font-mono uppercase transition-colors mt-2 disabled:opacity-50"
                            >
                                {isApplyingConfig ? "Syncing..." : "Apply to All Agents"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Firmware Table */}
            <div className="bg-surface/50 rounded-xl overflow-hidden border border-foreground/5">
                <div className="p-4 border-b border-foreground/5 flex justify-between items-center bg-surface/80">
                    <h3 className="text-sm font-mono uppercase tracking-widest text-foreground flex items-center gap-2">
                        <UploadCloud size={16} /> Firmware Management
                    </h3>
                    <div className="text-[10px] font-mono text-muted-foreground bg-foreground/5 px-2 py-1 rounded border border-foreground/10">
                        Latest: v1.2.4
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-foreground/5 border-b border-foreground/5 text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em]">
                                <th className="px-6 py-4">Agent ID</th>
                                <th className="px-6 py-4">Hardware</th>
                                <th className="px-6 py-4">Current FW</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                            {agents.slice(0, 5).map((agent) => (
                                <tr key={agent.id} className="group hover:bg-foreground/5 transition-colors">
                                    <td className="px-6 py-3">
                                        <div className="text-xs font-medium text-foreground">{agent.name}</div>
                                        <div className="text-[10px] text-muted-foreground font-mono">{agent.id}</div>
                                    </td>
                                    <td className="px-6 py-3 text-xs text-muted-foreground font-mono">{agent.hardware}</td>
                                    <td className="px-6 py-3">
                                        <span className={cn(
                                            "text-xs font-mono px-2 py-0.5 rounded",
                                            agent.firmware === "v1.2.4" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                        )}>
                                            {agent.firmware}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-xs">
                                        {agent.firmware === "v1.2.4" ? (
                                            <span className="text-muted-foreground">Up to date</span>
                                        ) : (
                                            <span className="text-amber-500">Update available</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        {agent.firmware !== "v1.2.4" && (
                                            <button 
                                                onClick={() => handleUpdateFirmware(agent.id)}
                                                disabled={updatingAgents[agent.id] || agent.status === 'offline'}
                                                className="text-[10px] font-mono bg-foreground text-background px-3 py-1.5 rounded uppercase font-bold hover:opacity-90 disabled:opacity-50"
                                            >
                                                {updatingAgents[agent.id] ? "Pushing..." : "Update"}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}