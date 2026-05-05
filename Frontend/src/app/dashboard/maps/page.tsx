"use client";

import React, { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { MapView } from "@/components/dashboard/MapView";
import { GoogleMapView } from "@/components/dashboard/GoogleMapView";
import { MapPin, Layers, Crosshair, Target, Globe, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import AgentDrawer from "@/components/dashboard/AgentDrawer";

export default function MapsPage() {
    const { agents, masters, selectAgent } = useStore();
    const [showCoverage, setShowCoverage] = useState(true);
    const [mapStyle, setMapStyle] = useState<"default" | "satellite">("default");
    const [filter, setFilter] = useState<"all" | "active" | "gps">("all");
    const [mapEngine, setMapEngine] = useState<"mapbox" | "google">("mapbox");

    // Center map on the first agent with GPS coordinates
    const centerAgent = agents.find(a => a.position);
    const center: [number, number] = centerAgent?.position
        ? [centerAgent.position.lng, centerAgent.position.lat]
        : [3.3792, 6.5244]; // Fallback to a default coordinate

    const mapMarkers = useMemo(() => {
        const markers: Array<any> = [];

        // Add Masters (they have GPS coords in our updated schema)
        masters.forEach(master => {
            if (master.gps_lat && master.gps_lng) {
                markers.push({
                    id: master.id,
                    lng: master.gps_lng,
                    lat: master.gps_lat,
                    status: master.status,
                    type: "master",
                    name: master.name,
                    signalRadius: 50 // Masters have 50m coverage radius
                });
            } else {
                // Fallback: estimate master position based on its agents for visual purposes
                const masterAgents = agents.filter(a => a.masterId === master.id && a.position);
                if (masterAgents.length > 0) {
                    const avgLat = masterAgents.reduce((sum, a) => sum + a.position!.lat, 0) / masterAgents.length;
                    const avgLng = masterAgents.reduce((sum, a) => sum + a.position!.lng, 0) / masterAgents.length;
                    markers.push({
                        id: master.id,
                        lng: avgLng,
                        lat: avgLat,
                        status: master.status,
                        type: "master",
                        name: master.name,
                        signalRadius: 50
                    });
                }
            }
        });

        // Add Agents
        agents.forEach(agent => {
            if (agent.position) {
                // Apply filters
                if (filter === "active" && agent.status !== "active") return;
                if (filter === "gps" && !agent.capabilities.includes("gps")) return;

                // Calculate signal radius based on signal strength (mock logic)
                // -50dBm = ~30m, -90dBm = ~5m
                const normalizedSignal = Math.max(-90, Math.min(-50, agent.signal));
                const radius = 5 + ((normalizedSignal + 90) / 40) * 25;

                markers.push({
                    id: agent.id,
                    lng: agent.position.lng,
                    lat: agent.position.lat,
                    status: agent.status,
                    type: "agent",
                    name: agent.name,
                    signalRadius: radius,
                    onClick: () => selectAgent(agent.id)
                });
            }
        });

        return markers;
    }, [agents, masters, filter, selectAgent]);

    const activeCount = mapMarkers.filter(m => m.type === 'agent' && m.status === 'active').length;

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] min-h-[700px] space-y-4 relative pb-4">
            <div className="flex flex-col md:flex-row justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-display text-foreground uppercase tracking-wider flex items-center gap-2">
                        <MapPin className="text-emerald-500" /> Geospatial Intelligence
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Real-time location tracking and triangulation coverage maps.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex bg-surface border border-foreground/5 rounded-md p-1">
                        <button
                            onClick={() => setFilter("all")}
                            className={cn(
                                "px-3 py-1.5 text-xs font-mono uppercase rounded-sm transition-colors",
                                filter === "all" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            All Nodes
                        </button>
                        <button
                            onClick={() => setFilter("active")}
                            className={cn(
                                "px-3 py-1.5 text-xs font-mono uppercase rounded-sm transition-colors",
                                filter === "active" ? "bg-emerald-500/10 text-emerald-500" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Active Only
                        </button>
                        <button
                            onClick={() => setFilter("gps")}
                            className={cn(
                                "px-3 py-1.5 text-xs font-mono uppercase rounded-sm transition-colors",
                                filter === "gps" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            GPS Equipped
                        </button>
                    </div>

                    <div className="flex bg-surface border border-foreground/5 rounded-md p-1">
                        <button
                            onClick={() => setMapEngine("mapbox")}
                            className={cn(
                                "px-3 py-1.5 text-xs font-mono uppercase rounded-sm transition-colors",
                                mapEngine === "mapbox" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Mapbox
                        </button>
                        <button
                            onClick={() => setMapEngine("google")}
                            className={cn(
                                "px-3 py-1.5 text-xs font-mono uppercase rounded-sm transition-colors",
                                mapEngine === "google" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Google
                        </button>
                    </div>

                    <button
                        onClick={() => setMapStyle(mapStyle === "default" ? "satellite" : "default")}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 border rounded-md text-xs font-mono uppercase transition-colors",
                            mapStyle === "satellite"
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                : "bg-surface border-foreground/5 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Globe size={14} /> Satellite
                    </button>

                    <button
                        onClick={() => setShowCoverage(!showCoverage)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 border rounded-md text-xs font-mono uppercase transition-colors",
                            showCoverage
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                : "bg-surface border-foreground/5 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Target size={14} /> Coverage Map
                    </button>
                </div>
            </div>

            <div className="flex-1 relative rounded-lg overflow-hidden border border-foreground/5 shadow-2xl">
                {mapEngine === "mapbox" ? (
                    <MapView
                        center={center}
                        zoom={17}
                        markers={mapMarkers}
                        showCoverage={showCoverage}
                        mapStyleType={mapStyle}
                    />
                ) : (
                    <GoogleMapView
                        center={{ lat: center[1], lng: center[0] }}
                        zoom={17}
                        markers={mapMarkers}
                        showCoverage={showCoverage}
                        mapStyleType={mapStyle}
                    />
                )}

                {/* Map Overlay Stats */}
                <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur border border-foreground/10 rounded-lg p-3 w-48 shadow-lg pointer-events-none">
                    <div className="flex items-center gap-2 mb-3">
                        <Layers size={14} className="text-muted-foreground" />
                        <span className="text-xs font-display uppercase tracking-widest text-foreground">Map Layers</span>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground font-mono">Visible Agents</span>
                            <span className="text-foreground font-mono">{mapMarkers.filter(m => m.type === 'agent').length}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground font-mono">Active</span>
                            <span className="text-emerald-500 font-mono">{activeCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground font-mono">Masters</span>
                            <span className="text-foreground font-mono">{mapMarkers.filter(m => m.type === 'master').length}</span>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-foreground/10">
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground mb-1">
                            <Crosshair size={10} /> Triangulation Status
                        </div>
                        <div className="h-1.5 w-full bg-foreground/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: '85%' }} />
                        </div>
                        <div className="text-[9px] font-mono text-right mt-1 text-emerald-500">OPTIMAL</div>
                    </div>
                </div>

                {/* Map Legend Overlay */}
                <div className="absolute bottom-6 left-4 bg-surface/90 backdrop-blur border border-foreground/10 rounded-lg p-3 shadow-lg pointer-events-none">
                    <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-widest border-b border-foreground/10 pb-1">Legend</div>
                    <div className="space-y-2 text-xs font-mono">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border-2 border-emerald-500 bg-[#1a1a2e] flex items-center justify-center text-[8px] text-foreground font-bold">M</div>
                            <span className="text-foreground">Master Node</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border border-foreground bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-foreground">Active Agent</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border border-foreground bg-amber-500"></div>
                            <span className="text-foreground">Degraded / Warning</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full border border-foreground bg-neutral-500"></div>
                            <span className="text-foreground">Offline</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-foreground/10">
                            <div className="w-4 h-4 rounded-full border border-emerald-500/50 bg-emerald-500/20"></div>
                            <span className="text-muted-foreground">Signal Coverage</span>
                        </div>
                    </div>
                </div>
            </div>

            <AgentDrawer />
        </div>
    );
}