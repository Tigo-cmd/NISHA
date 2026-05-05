"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { Badge } from "@/components/ui/Badge";
import {
    ShieldAlert,
    Search,
    Settings,
    CheckCircle2,
    AlertCircle,
    MoreVertical,
    Volume2,
    Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AlertCenterPage() {
    const { alerts, agents, acknowledgeAlert } = useStore();
    const [filter, setFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const displayAlerts = alerts.filter(alert => {
        // Filter by tab
        if (filter === "unacknowledged" && alert.acknowledged) return false;
        if (filter === "critical" && alert.severity !== "critical") return false;
        if (filter === "high" && alert.severity !== "high") return false;
        if (filter === "medium" && alert.severity !== "medium") return false;

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                alert.id.toLowerCase().includes(query) ||
                alert.description.toLowerCase().includes(query) ||
                alert.type.toLowerCase().includes(query) ||
                alert.agentId.toLowerCase().includes(query)
            );
        }

        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-display text-foreground uppercase tracking-wider">Alert Management</h2>
                    <p className="text-muted-foreground text-sm">Review and respond to system security events.</p>
                </div>

                <div className="flex gap-3">
                    <div className="flex items-center px-4 bg-surface border border-foreground/5 rounded-md focus-within:border-foreground/20 transition-colors">
                        <Search size={16} className="text-muted-foreground mr-2" />
                        <input
                            type="text"
                            placeholder="Search alerts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none outline-none text-xs text-foreground py-2"
                        />
                    </div>
                    <button className="p-2 bg-surface border border-foreground/5 rounded-md text-muted-foreground hover:text-foreground">
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            <div className="flex gap-2 pb-2 overflow-x-auto">
                {["all", "unacknowledged", "critical", "high", "medium"].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-4 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-widest transition-all",
                            filter === f
                                ? "bg-foreground text-background border-foreground font-bold"
                                : "bg-surface border-foreground/5 text-muted-foreground hover:border-foreground/20"
                        )}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {displayAlerts.length === 0 && (
                    <div className="bg-surface/50 border border-foreground/5 rounded-xl p-12 text-center flex flex-col items-center">
                        <ShieldAlert size={48} className="text-emerald-500/50 mb-4" />
                        <h3 className="text-lg font-display text-foreground uppercase tracking-wider mb-2">No Active Alerts</h3>
                        <p className="text-sm font-mono text-muted-foreground">The perimeter is secure and no incidents match your current filter.</p>
                    </div>
                )}
                
                {displayAlerts.map((alert) => {
                    const agent = agents.find(a => a.id === alert.agentId);
                    const location = agent?.zone || "Unknown Zone";
                    const isUnacknowledged = !alert.acknowledged;

                    return (
                        <div
                            key={alert.id}
                            className={cn(
                                "bg-surface/70 p-6 rounded-lg border-l-4 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all group border border-foreground/5",
                                isUnacknowledged ? "bg-foreground/5" : "opacity-60",
                                alert.severity === "critical" ? "border-l-red-500" : alert.severity === "high" ? "border-l-amber-500" : "border-l-foreground/20"
                            )}
                        >
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    "p-3 rounded-md border",
                                    alert.severity === "critical" ? "text-red-500 bg-red-500/5 border-red-500/10" : "text-muted-foreground bg-foreground/5 border-foreground/10"
                                )}>
                                    {alert.type === "AUDIO" ? <Volume2 size={24} /> : alert.type === "VIDEO" ? <Video size={24} /> : <AlertCircle size={24} />}
                                </div>

                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg font-display text-foreground">{alert.description}</h3>
                                        <Badge variant={alert.severity === "critical" ? "danger" : alert.severity === "high" ? "warning" : "default"}>
                                            {alert.severity}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                                        <span>ID: {alert.id}</span>
                                        <span className="flex items-center gap-1"><ShieldAlert size={12} /> {location}</span>
                                        <span>AGENT: {alert.agentId}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 self-end md:self-center">
                                <div className="text-right mr-4 hidden md:block">
                                    <div className="text-xs text-foreground font-mono">{new Date(alert.timestamp).toLocaleTimeString()}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase">Timestamped</div>
                                </div>

                                <div className="flex gap-2">
                                    {isUnacknowledged ? (
                                        <button 
                                            onClick={() => acknowledgeAlert(alert.id)}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-mono font-bold rounded hover:bg-emerald-500 hover:text-background transition-all"
                                        >
                                            <CheckCircle2 size={14} /> ACKNOWLEDGE
                                        </button>
                                    ) : (
                                        <Badge variant="outline">Resolved</Badge>
                                    )}
                                    <button className="p-2 bg-surface border border-foreground/5 rounded-md text-muted-foreground hover:text-foreground">
                                        <MoreVertical size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
