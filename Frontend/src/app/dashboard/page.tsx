"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { Radio, ShieldAlert, Target, Mic } from "lucide-react";
import { KPICard, MiniBarChart } from "@/components/dashboard/KPICard";
import NetworkTopology from "@/components/dashboard/NetworkTopology";
import AgentDrawer from "@/components/dashboard/AgentDrawer";

export default function DashboardOverview() {
    const { agents, masters, alerts, securityEvents } = useStore();
    const activeAgents = agents.filter((a) => a.status === "active").length;
    const healthyMasters = masters.filter((m) => m.status === "online").length;
    const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged).length;
    const totalEvents = securityEvents.length;

    return (
        <div className="space-y-8 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    label="Agents Online"
                    value={activeAgents}
                    icon={Radio}
                    trend={{ value: "12%", isUp: true }}
                    chart={<MiniBarChart values={[40, 60, 55, 70, 85, 90, 95]} />}
                />
                <KPICard
                    label="Active Alerts"
                    value={unacknowledgedAlerts}
                    icon={ShieldAlert}
                    status={unacknowledgedAlerts > 0 ? "error" : "good"}
                    chart={<MiniBarChart values={alerts.map(a => a.severity === "critical" ? 100 : a.severity === "high" ? 75 : 50).slice(-7)} color="#ef4444" />}
                />
                <KPICard
                    label="Masters Healthy"
                    value={`${healthyMasters}/${masters.length}`}
                    icon={Target}
                    status="good"
                    chart={<MiniBarChart values={[100, 100, 100, 100, 100, 100, 100]} color="#10b981" />}
                />
                <KPICard
                    label="Security Events"
                    value={totalEvents}
                    icon={Mic}
                    trend={{ value: "Live", isUp: true }}
                    chart={<MiniBarChart values={securityEvents.map(e => e.severity === "critical" ? 100 : e.severity === "high" ? 75 : 50).slice(-7)} />}
                />
            </div>

            <div className="bg-surface/50 rounded-lg overflow-hidden border border-foreground/5 h-[520px]">
                <div className="p-4 border-b border-foreground/5 flex justify-between items-center">
                    <h3 className="text-foreground font-display text-sm uppercase tracking-wider flex items-center gap-2">
                        Network Topology
                    </h3>
                    <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" /> Degraded
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-neutral-500" /> Offline
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-foreground/30" /> Master
                        </span>
                    </div>
                </div>
                <div className="h-[calc(100%-53px)]">
                    <NetworkTopology />
                </div>
            </div>

            <AgentDrawer />
        </div>
    );
}
