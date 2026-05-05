"use client";

import React, { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { apiService } from "@/services/apiService";
import {
    Lock, Shield, AlertTriangle, Key, Users,
    Radio, Activity, AlertOctagon, EyeOff, FileText, CheckCircle
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function SecurityPage() {
    const { agents, alerts, threatLevel, setThreatLevel } = useStore();
    const [isEmergencyProtocolActive, setIsEmergencyProtocolActive] = useState(false);
    const [isSilentModeActive, setIsSilentModeActive] = useState(false);
    const [lockedZones, setLockedZones] = useState<string[]>([]);

    // Calculate dynamic threat level based on active alerts
    const activeCriticals = alerts.filter(a => a.severity === "critical" && !a.acknowledged).length;
    const activeHighs = alerts.filter(a => a.severity === "high" && !a.acknowledged).length;

    const currentThreat = useMemo(() => {
        if (isEmergencyProtocolActive) return "critical";
        if (activeCriticals > 0) return "high";
        if (activeHighs > 2) return "moderate";
        return "low";
    }, [activeCriticals, activeHighs, isEmergencyProtocolActive]);

    const threatColors = {
        low: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        moderate: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        high: "text-orange-500 bg-orange-500/10 border-orange-500/20",
        critical: "text-red-500 bg-red-500/10 border-red-500/20 animate-pulse"
    };

    // Calculate zone metrics
    const zoneMetrics = useMemo(() => {
        const zones: Record<string, { total: number; active: number; alerts: number }> = {};
        agents.forEach(a => {
            if (!zones[a.zone]) zones[a.zone] = { total: 0, active: 0, alerts: 0 };
            zones[a.zone].total++;
            if (a.status === 'active') zones[a.zone].active++;
        });

        alerts.forEach(alert => {
            const agent = agents.find(a => a.id === alert.agentId);
            if (agent && zones[agent.zone]) {
                zones[agent.zone].alerts++;
            }
        });

        return zones;
    }, [agents, alerts]);

    const toggleZoneLock = async (zone: string) => {
        const isLocking = !lockedZones.includes(zone);
        setLockedZones(prev =>
            prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]
        );

        try {
            const zoneAgents = agents.filter(a => a.zone === zone);
            await Promise.all(
                zoneAgents.map(a => 
                    apiService.sendAgentCommand(a.id, isLocking ? "LOCK_ZONE" : "UNLOCK_ZONE")
                )
            );
        } catch (error) {
            console.error(`Failed to toggle lock for zone ${zone}`, error);
        }
    };

    const handleEmergencyProtocol = async () => {
        const newState = !isEmergencyProtocolActive;
        setIsEmergencyProtocolActive(newState);

        try {
            if (newState) {
                setThreatLevel("critical");
                const activeAgents = agents.filter(a => a.status === 'active');
                await Promise.all(activeAgents.map(a => apiService.sendAgentCommand(a.id, "EMERGENCY_LOCKDOWN")));
            } else {
                setThreatLevel("low");
                const activeAgents = agents.filter(a => a.status === 'active');
                await Promise.all(activeAgents.map(a => apiService.sendAgentCommand(a.id, "CANCEL_LOCKDOWN")));
            }
        } catch (error) {
            console.error("Failed to execute emergency protocol", error);
        }
    };

    const displayLogs = useMemo(() => {
        return alerts.slice(0, 5).map(alert => {
            const agent = agents.find(a => a.id === alert.agentId);
            return {
                id: alert.id,
                time: new Date(alert.timestamp).toLocaleTimeString(),
                type: alert.type,
                zone: agent?.zone || "Unknown",
                severity: alert.severity,
                desc: alert.description
            };
        });
    }, [alerts, agents]);

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-display text-foreground uppercase tracking-wider flex items-center gap-2">
                        <Lock className="text-foreground" /> Security Operations
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Threat monitoring, access control, and emergency protocols.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setIsSilentModeActive(!isSilentModeActive)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 border rounded-md text-xs font-mono uppercase tracking-widest transition-all",
                            isSilentModeActive
                                ? "bg-foreground/20 text-foreground border-foreground/30"
                                : "bg-surface text-muted-foreground border-foreground/5 hover:text-foreground"
                        )}
                    >
                        <EyeOff size={14} /> Silent Mode {isSilentModeActive && "ON"}
                    </button>
                    <button
                        onClick={handleEmergencyProtocol}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 border rounded-md text-xs font-mono uppercase tracking-widest font-bold transition-all",
                            isEmergencyProtocolActive
                                ? "bg-red-500 text-background border-red-500 animate-pulse"
                                : "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-background"
                        )}
                    >
                        <AlertOctagon size={14} /> {isEmergencyProtocolActive ? "Cancel Emergency" : "Emergency Protocol"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Threat Level Indicator */}
                <div className={cn(
                    "md:col-span-1 rounded-xl border p-6 flex flex-col items-center justify-center text-center transition-colors duration-500",
                    threatColors[currentThreat]
                )}>
                    <Shield size={48} className="mb-4" />
                    <div className="text-xs font-mono uppercase tracking-widest mb-2 opacity-80">Current Threat Level</div>
                    <div className="text-4xl font-display uppercase tracking-wider">{currentThreat}</div>
                    <p className="text-xs mt-4 opacity-80 max-w-[200px]">
                        {currentThreat === "low" ? "System operating normally. No active threats detected." :
                            currentThreat === "moderate" ? "Elevated activity. Routine monitoring advised." :
                                currentThreat === "high" ? "Active threats detected. Immediate attention required." :
                                    "CRITICAL EMERGENCY. ALL PROTOCOLS ACTIVE."}
                    </p>
                </div>

                {/* Quick Security KPIs */}
                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="bg-surface/50 border border-foreground/5 rounded-xl p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-4">
                            <Key size={16} />
                            <Badge variant="success">Secure</Badge>
                        </div>
                        <div>
                            <div className="text-2xl font-display text-foreground">100%</div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">mTLS Authentication</div>
                        </div>
                    </div>
                    <div className="bg-surface/50 border border-foreground/5 rounded-xl p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-4">
                            <Users size={16} />
                            <Badge variant="outline">3 Active</Badge>
                        </div>
                        <div>
                            <div className="text-2xl font-display text-foreground">Admin</div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Current Access Level</div>
                        </div>
                    </div>
                    <div className="bg-surface/50 border border-foreground/5 rounded-xl p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-4">
                            <Activity size={16} />
                            <Badge variant="outline">Auto-renew</Badge>
                        </div>
                        <div>
                            <div className="text-2xl font-display text-foreground">14 Days</div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Next Key Rotation</div>
                        </div>
                    </div>
                    <div className="bg-surface/50 border border-foreground/5 rounded-xl p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-muted-foreground mb-4">
                            <AlertTriangle size={16} />
                            <Badge variant={activeCriticals > 0 ? "danger" : "outline"}>{activeCriticals} Unresolved</Badge>
                        </div>
                        <div>
                            <div className="text-2xl font-display text-foreground">{alerts.length}</div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Active Security Incidents</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Zone Security Overview */}
            <div className="bg-surface/50 border border-foreground/5 rounded-xl p-5">
                <h3 className="text-sm font-mono uppercase tracking-widest text-foreground flex items-center gap-2 mb-4">
                    <Radio size={16} /> Zone Security Control
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(zoneMetrics).map(([zone, metrics]) => {
                        const isLocked = lockedZones.includes(zone);
                        return (
                            <div key={zone} className={cn(
                                "border rounded-lg p-4 transition-colors",
                                isLocked ? "bg-red-500/5 border-red-500/20" : "bg-background border-foreground/5"
                            )}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="text-sm font-medium text-foreground">{zone}</div>
                                    {metrics.alerts > 0 && (
                                        <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                    )}
                                </div>
                                <div className="flex justify-between text-xs mb-3">
                                    <span className="text-muted-foreground">Agents:</span>
                                    <span className="font-mono">{metrics.active}/{metrics.total} Active</span>
                                </div>
                                <button
                                    onClick={() => toggleZoneLock(zone)}
                                    className={cn(
                                        "w-full py-1.5 rounded text-xs font-mono uppercase transition-colors flex items-center justify-center gap-2",
                                        isLocked
                                            ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                                            : "bg-surface border border-foreground/10 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                    )}
                                >
                                    {isLocked ? <Lock size={12} /> : <CheckCircle size={12} />}
                                    {isLocked ? "Zone Locked" : "Lock Zone"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Security Logs */}
            <div className="bg-surface/50 border border-foreground/5 rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-mono uppercase tracking-widest text-foreground flex items-center gap-2">
                        <FileText size={16} /> Security Audit Log
                    </h3>
                    <button className="text-xs text-muted-foreground hover:text-foreground font-mono uppercase transition-colors">
                        View Full Log
                    </button>
                </div>
                <div className="space-y-2">
                    {displayLogs.map(log => (
                        <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-background rounded-lg border border-foreground/5 gap-3">
                            <div className="flex items-center gap-3">
                                <Badge variant={log.severity === "high" || log.severity === "critical" ? "danger" : log.severity === "medium" ? "warning" : "default"}>
                                    {log.type}
                                </Badge>
                                <div>
                                    <div className="text-sm text-foreground">{log.desc}</div>
                                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">ID: {log.id} · Zone: {log.zone}</div>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-muted-foreground sm:text-right shrink-0">
                                {log.time}
                            </div>
                        </div>
                    ))}
                    {displayLogs.length === 0 && (
                        <div className="p-4 text-center text-xs font-mono text-muted-foreground border border-foreground/5 rounded-lg">
                            NO SECURITY LOGS AVAILABLE
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}