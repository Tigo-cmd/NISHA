"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import {
    BarChart3, Activity, Clock, ShieldAlert, Zap,
    TrendingUp, Radio, AlertTriangle
} from "lucide-react";
import { KPICard, MiniBarChart } from "@/components/dashboard/KPICard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";

export default function AnalyticsPage() {
    const { agents, alerts } = useStore();
    const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("24h");
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const handleExportCSV = () => {
        const headers = ["Agent ID", "Name", "Zone", "Status", "Battery", "Signal", "CPU Load", "Events"];
        const rows = agents.map(a => [
            a.id,
            `"${a.name}"`,
            `"${a.zone}"`,
            a.status,
            `${a.battery}%`,
            `${a.signal}dBm`,
            `${a.cpuUsage}%`,
            alerts.filter(al => al.agentId === a.id).length
        ]);
        
        const csvContent = [
            headers.join(","),
            ...rows.map(e => e.join(","))
        ].join("\n");
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `nisha_fleet_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Compute stats
    const activeAgents = agents.filter(a => a.status === "active").length;
    const degradedAgents = agents.filter(a => a.status === "degraded").length;
    const offlineAgents = agents.filter(a => a.status === "offline").length;

    const criticalAlerts = alerts.filter(a => a.severity === "critical").length;
    const highAlerts = alerts.filter(a => a.severity === "high").length;

    // Group historical alerts into timeline points based on timeRange
    const timelineData = useMemo(() => {
        const now = new Date();
        const points = timeRange === "1h" ? 12 : timeRange === "24h" ? 24 : 14;
        const intervalMs = timeRange === "1h" ? 5 * 60 * 1000 : timeRange === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

        const data = [];
        for (let i = 0; i < points; i++) {
            const bucketStart = new Date(now.getTime() - (points - i) * intervalMs);
            const bucketEnd = new Date(bucketStart.getTime() + intervalMs);

            const timeLabel = timeRange === "1h"
                ? bucketStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : timeRange === "24h"
                    ? `${bucketStart.getHours()}:00`
                    : bucketStart.toLocaleDateString([], { month: 'short', day: 'numeric' });

            const bucketAlerts = alerts.filter(a => {
                const ts = new Date(a.timestamp).getTime();
                return ts >= bucketStart.getTime() && ts < bucketEnd.getTime();
            });

            data.push({
                time: timeLabel,
                audio: bucketAlerts.filter(a => a.type === "AUDIO").length,
                motion: bucketAlerts.filter(a => a.type === "VIDEO").length,
                system: bucketAlerts.filter(a => a.type === "SYSTEM").length,
            });
        }
        return data;
    }, [alerts, timeRange]);

    // Generate mock zone distribution data
    const zoneData = useMemo(() => {
        const zones: Record<string, number> = {};
        agents.forEach(a => {
            zones[a.zone] = (zones[a.zone] || 0) + 1;
        });
        return Object.entries(zones)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [agents]);

    const statusData = [
        { name: "Active", value: activeAgents, color: "#10b981" },
        { name: "Degraded", value: degradedAgents, color: "#f59e0b" },
        { name: "Offline", value: offlineAgents, color: "#6b7280" },
    ];

    // Custom Recharts Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-surface/90 backdrop-blur border border-foreground/10 p-3 rounded-lg shadow-xl">
                    <p className="text-xs font-mono text-muted-foreground mb-2">{label}</p>
                    <div className="space-y-1.5">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-4 text-xs">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-foreground capitalize">{entry.name}</span>
                                </span>
                                <span className="font-mono font-bold" style={{ color: entry.color }}>
                                    {entry.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    if (!mounted) return <div className="h-screen flex items-center justify-center font-mono text-xs text-muted-foreground animate-pulse">SYNCHRONIZING INTELLIGENCE...</div>;

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-display text-foreground uppercase tracking-wider flex items-center gap-2">
                        <BarChart3 className="text-foreground" /> Analytics & Intelligence
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Fleet-wide metrics, detection trends, and historical analysis.
                    </p>
                </div>

                <div className="flex bg-surface border border-foreground/5 rounded-md p-1 h-9">
                    {(["1h", "24h", "7d"] as const).map(tr => (
                        <button
                            key={tr}
                            onClick={() => setTimeRange(tr)}
                            className={cn(
                                "px-4 py-1 text-xs font-mono uppercase rounded-sm transition-colors",
                                timeRange === tr ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {tr}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    label="Active Agents"
                    value={activeAgents}
                    icon={Radio}
                    status={activeAgents > 0 ? "good" : "warning"}
                    trend={{ value: `${agents.length} total`, isUp: true }}
                    chart={<MiniBarChart values={agents.map(a => a.cpuUsage).slice(-7)} color="#3b82f6" />}
                />
                <KPICard
                    label="Agent Uptime"
                    value={agents.length > 0 ? `${((activeAgents / agents.length) * 100).toFixed(1)}%` : "0%"}
                    icon={Clock}
                    status={activeAgents === agents.length && agents.length > 0 ? "good" : "warning"}
                    chart={<MiniBarChart values={agents.map(a => 100 - (a.status === 'offline' ? 100 : 0)).slice(-7)} color="#10b981" />}
                />
                <KPICard
                    label="Critical Alerts"
                    value={criticalAlerts}
                    icon={AlertTriangle}
                    status={criticalAlerts > 0 ? "error" : "good"}
                    trend={{ value: `${highAlerts} high`, isUp: false }}
                    chart={<MiniBarChart values={alerts.map(a => a.severity === 'critical' ? 100 : 50).slice(-7)} color={criticalAlerts > 0 ? "#ef4444" : "#10b981"} />}
                />
                <KPICard
                    label="Fleet Health"
                    value={agents.length > 0 ? `${(agents.reduce((acc, a) => acc + (a.status === 'active' ? 100 : a.status === 'degraded' ? 50 : 0), 0) / agents.length).toFixed(0)}%` : "N/A"}
                    icon={Activity}
                    status={degradedAgents > 0 ? "warning" : "good"}
                    chart={<MiniBarChart values={agents.map(a => a.battery).slice(-7)} color="#f59e0b" />}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Timeline Chart */}
                <div className="lg:col-span-2 bg-surface/50 border border-foreground/5 rounded-xl p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={16} className="text-muted-foreground" />
                            <h3 className="text-sm font-mono uppercase tracking-widest text-foreground">Event Timeline</h3>
                        </div>
                    </div>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAudio" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorMotion" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorSystem" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                                <XAxis dataKey="time" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }} />
                                <Area type="monotone" dataKey="audio" name="Audio Detections" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorAudio)" />
                                <Area type="monotone" dataKey="motion" name="Motion Events" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorMotion)" />
                                <Area type="monotone" dataKey="system" name="System Alerts" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorSystem)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Fleet Status Pie */}
                <div className="bg-surface/50 border border-foreground/5 rounded-xl p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <Radio size={16} className="text-muted-foreground" />
                        <h3 className="text-sm font-mono uppercase tracking-widest text-foreground">Fleet Status</h3>
                    </div>
                    <div className="flex-1 min-h-[200px] flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-display text-foreground">{agents.length}</span>
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">Total Agents</span>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        {statusData.map(s => (
                            <div key={s.name} className="text-center bg-background/50 rounded py-2">
                                <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">{s.name}</div>
                                <div className="text-lg font-display" style={{ color: s.color }}>{s.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Zone Distribution Bar */}
                <div className="lg:col-span-3 bg-surface/50 border border-foreground/5 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-6">
                        <ShieldAlert size={16} className="text-muted-foreground" />
                        <h3 className="text-sm font-mono uppercase tracking-widest text-foreground">Deployment Zones</h3>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={zoneData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis dataKey="name" type="category" stroke="#e0e0e0" fontSize={11} width={100} tickLine={false} axisLine={false} />
                                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="value" name="Agent Count" fill="#10b981" radius={[0, 4, 4, 0]}>
                                    {zoneData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? "#10b981" : index < 3 ? "#3b82f6" : "#6b7280"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Performance Table */}
            <div className="bg-surface/50 rounded-xl overflow-hidden border border-foreground/5">
                <div className="p-4 border-b border-foreground/5 flex justify-between items-center bg-surface/80">
                    <h3 className="text-sm font-mono uppercase tracking-widest text-foreground">Agent Performance</h3>
                    <button 
                        onClick={handleExportCSV}
                        className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors uppercase"
                    >
                        Export CSV
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-foreground/5 border-b border-foreground/5 text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em]">
                                <th className="px-6 py-4">Agent</th>
                                <th className="px-6 py-4">Zone</th>
                                <th className="px-6 py-4">Health Score</th>
                                <th className="px-6 py-4">Events (24h)</th>
                                <th className="px-6 py-4">CPU Load</th>
                                <th className="px-6 py-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/5">
                            {agents.slice(0, 15).map((agent) => {
                                // Derive health from status and battery
                                const healthScore = agent.status === 'active' ? (agent.battery * 0.8 + 20) :
                                    agent.status === 'degraded' ? agent.battery * 0.5 : 0;

                                // Count real alerts for this agent
                                const agentAlerts = alerts.filter(a => a.agentId === agent.id).length;

                                return (
                                    <tr key={agent.id} className="group hover:bg-foreground/5 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="text-sm font-medium text-foreground">{agent.name}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono">{agent.id}</div>
                                        </td>
                                        <td className="px-6 py-3 text-sm text-muted-foreground">{agent.zone}</td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-16 bg-foreground/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn("h-full", healthScore > 80 ? "bg-emerald-500" : healthScore > 50 ? "bg-amber-500" : "bg-red-500")}
                                                        style={{ width: `${healthScore}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-mono text-foreground">{healthScore.toFixed(0)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-xs font-mono text-foreground">{agentAlerts}</td>
                                        <td className="px-6 py-3 text-xs font-mono text-muted-foreground">{agent.cpuUsage}%</td>
                                        <td className="px-6 py-3 text-right">
                                            <Badge
                                                variant={agent.status === "active" ? "success" : agent.status === "degraded" ? "warning" : "danger"}
                                                pulse={agent.status !== "offline"}
                                            >
                                                {agent.status}
                                            </Badge>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}