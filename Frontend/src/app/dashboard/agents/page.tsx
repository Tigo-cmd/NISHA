"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { Badge } from "@/components/ui/Badge";
import {
    Search,
    Filter,
    Battery,
    Wifi,
    MapPin,
    ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function AgentListPage() {
    const { agents } = useStore();
    const [search, setSearch] = useState("");

    const filteredAgents = agents.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.id.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-display text-foreground uppercase tracking-wider">Agent Fleet</h2>
                    <p className="text-muted-foreground text-sm">Manage and monitor distributed sensor nodes.</p>
                </div>

                <div className="flex gap-3">
                    <div className="flex items-center px-4 bg-surface border border-foreground/5 rounded-md focus-within:border-foreground/20 transition-colors">
                        <Search size={16} className="text-muted-foreground mr-2" />
                        <input
                            type="text"
                            placeholder="Filter agents..."
                            className="bg-transparent border-none outline-none text-xs text-foreground py-2"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button className="p-2 bg-surface border border-foreground/5 rounded-md text-muted-foreground hover:text-foreground">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            <div className="bg-surface/70 rounded-lg overflow-hidden border border-foreground/5">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-foreground/5 border-b border-foreground/5 text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em]">
                            <th className="px-6 py-4">Agent ID</th>
                            <th className="px-6 py-4">Identifier</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Network</th>
                            <th className="px-6 py-4">Location</th>
                            <th className="px-6 py-4">Power</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/5">
                        {filteredAgents.map((agent) => (
                            <tr key={agent.id} className="group hover:bg-foreground/5 transition-colors">
                                <td className="px-6 py-4">
                                    <span className="text-xs font-mono text-foreground font-bold">{agent.id}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-foreground">{agent.name}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{agent.hardware}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge
                                        variant={agent.status === "active" ? "success" : agent.status === "degraded" ? "warning" : "danger"}
                                        pulse={agent.status !== "offline"}
                                    >
                                        {agent.status}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Wifi size={14} className={cn(
                                            agent.signal > -60 ? "text-emerald-500" : agent.signal > -80 ? "text-amber-500" : "text-red-500",
                                            agent.status === "offline" && "text-muted-foreground opacity-30"
                                        )} />
                                        <span className="text-xs font-mono text-foreground">{agent.status === "offline" ? "---" : `${agent.signal} dBm`}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin size={14} />
                                        <span className="text-xs">{agent.zone}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Battery size={14} className={cn(
                                            agent.battery > 50 ? "text-emerald-500" : agent.battery > 20 ? "text-amber-500" : "text-red-500",
                                            agent.status === "offline" && "text-muted-foreground opacity-30"
                                        )} />
                                        <span className="text-xs font-mono text-foreground">{agent.status === "offline" ? "0%" : `${agent.battery}%`}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Link href={`/dashboard/agents/${agent.id}`} className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-md transition-all inline-block">
                                        <ExternalLink size={16} />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredAgents.length === 0 && (
                    <div className="py-20 text-center text-muted-foreground font-mono text-sm leading-8">
                        NO AGENTS MATCHING SEARCH CRITERIA.
                    </div>
                )}
            </div>
        </div>
    );
}
