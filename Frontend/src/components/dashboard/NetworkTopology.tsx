"use client";

import React, { useMemo, useRef, useState, useEffect, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from "react";
import { useStore } from "@/store/useStore";
import type { Agent, Master } from "@/types";
import { cn } from "@/lib/utils";
import { Plus, Minus, Maximize, Mic, Video, Move, MapPin, Battery, Wifi, Thermometer, Server, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface NetworkTopologyProps {
    className?: string;
}

interface LayoutNode {
    id: string;
    x: number;
    y: number;
    type: "master" | "agent";
    data: Master | Agent;
}

function statusColor(status: string): string {
    switch (status) {
        case "active":
        case "online":
            return "#10b981"; // emerald-500
        case "degraded":
            return "#f59e0b"; // amber-500
        case "offline":
            return "#6b7280"; // neutral-500
        default:
            return "#6b7280";
    }
}

function statusPulse(status: string): boolean {
    return status === "active" || status === "online";
}

export default function NetworkTopology({ className }: NetworkTopologyProps) {
    const { agents, masters, selectAgent, selectedAgentId } = useStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 800, height: 500 });
    const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);

    // Pan and Zoom state
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setSize({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };
        updateSize();
        const observer = new ResizeObserver(updateSize);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const layout = useMemo(() => {
        const nodes: LayoutNode[] = [];
        const edges: { from: string; to: string }[] = [];

        const centerX = size.width / 2;
        const centerY = size.height / 2;
        const masterRadius = Math.min(size.width, size.height) * 0.28;

        const matchedAgentIds = new Set<string>();

        masters.forEach((master, mi) => {
            const masterAngle = (mi / masters.length) * Math.PI * 2 - Math.PI / 2;
            const mx = centerX + Math.cos(masterAngle) * masterRadius;
            const my = centerY + Math.sin(masterAngle) * masterRadius;

            nodes.push({ id: master.id, x: mx, y: my, type: "master", data: master });

            // Robust matching: check both id and master_id (from DB)
            const masterAgents = agents.filter((a) => 
                a.masterId === master.id || a.masterId === (master as any).master_id
            );
            
            const agentRadius = Math.min(size.width, size.height) * 0.14;

            masterAgents.forEach((agent, ai) => {
                matchedAgentIds.add(agent.id);
                const spread = Math.min(Math.PI * 0.8, (masterAgents.length * Math.PI) / 6);
                const startAngle = masterAngle - spread / 2;
                const agentAngle = masterAgents.length === 1
                    ? masterAngle
                    : startAngle + (ai / (masterAgents.length - 1)) * spread;

                const ax = mx + Math.cos(agentAngle) * agentRadius;
                const ay = my + Math.sin(agentAngle) * agentRadius;

                nodes.push({ id: agent.id, x: ax, y: ay, type: "agent", data: agent });
                edges.push({ from: master.id, to: agent.id });
            });
        });

        // Add "Orphan" agents (no master or master not found) in a discovery orbit
        const orphanAgents = agents.filter(a => !matchedAgentIds.has(a.id));
        if (orphanAgents.length > 0) {
            const orphanRadius = Math.min(size.width, size.height) * 0.42;
            orphanAgents.forEach((agent, ai) => {
                const angle = (ai / orphanAgents.length) * Math.PI * 2;
                const ax = centerX + Math.cos(angle) * orphanRadius;
                const ay = centerY + Math.sin(angle) * orphanRadius;
                nodes.push({ id: agent.id, x: ax, y: ay, type: "agent", data: agent });
            });
        }

        return { nodes, edges };
    }, [agents, masters, size]);

    const getNode = (id: string) => layout.nodes.find((n) => n.id === id);

    // Zoom and pan handlers
    const handleWheel = (e: ReactWheelEvent<SVGSVGElement>) => {
        e.preventDefault();
        const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;

        // Calculate point under mouse to zoom towards it
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setTransform(prev => {
            const newScale = Math.min(Math.max(0.3, prev.scale * scaleChange), 3);

            // Adjust translation so the point under the mouse stays under the mouse
            const newX = mouseX - (mouseX - prev.x) * (newScale / prev.scale);
            const newY = mouseY - (mouseY - prev.y) * (newScale / prev.scale);

            return { x: newX, y: newY, scale: newScale };
        });
    };

    const handleMouseDown = (e: ReactMouseEvent<SVGSVGElement>) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    };

    const handleMouseMove = (e: ReactMouseEvent<SVGSVGElement>) => {
        if (isDragging) {
            setTransform(prev => ({
                ...prev,
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            }));
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleZoomIn = () => {
        setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }));
    };

    const handleZoomOut = () => {
        setTransform(prev => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.3) }));
    };

    const handleFit = () => {
        setTransform({ x: 0, y: 0, scale: 1 });
    };

    return (
        <div ref={containerRef} className={cn("w-full h-full relative overflow-hidden bg-[#0a0a0f]", className)}>
            <svg
                width={size.width}
                height={size.height}
                className={cn("select-none touch-none", isDragging ? "cursor-grabbing" : "cursor-grab")}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <defs>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
                        <stop offset="50%" stopColor="#10b981" stopOpacity="1" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                </defs>

                <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                    {layout.edges.map((edge) => {
                        const from = getNode(edge.from);
                        const to = getNode(edge.to);
                        if (!from || !to) return null;
                        const agentData = to.data as Agent;
                        const isSelected = selectedAgentId === to.id;
                        const isHovered = hoveredNode?.id === to.id || hoveredNode?.id === from.id;
                        const color = statusColor(agentData.status);
                        const isActive = agentData.status === "active";

                        return (
                            <g key={`${edge.from}-${edge.to}`}>
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={to.x}
                                    y2={to.y}
                                    stroke={color}
                                    strokeWidth={isSelected || isHovered ? 2 : 1}
                                    strokeOpacity={isActive ? 0.3 : 0.1}
                                    strokeDasharray={agentData.status === "offline" ? "4 4" : undefined}
                                />
                                {isActive && (
                                    <line
                                        x1={from.x}
                                        y1={from.y}
                                        x2={to.x}
                                        y2={to.y}
                                        stroke={color}
                                        strokeWidth={1.5}
                                        strokeOpacity={0.6}
                                        strokeDasharray="4 12"
                                        style={{ filter: "url(#glow)" }}
                                    >
                                        <animate
                                            attributeName="stroke-dashoffset"
                                            from="16"
                                            to="0"
                                            dur="1s"
                                            repeatCount="indefinite"
                                        />
                                    </line>
                                )}
                            </g>
                        );
                    })}

                    {layout.nodes
                        .filter((n) => n.type === "master")
                        .map((node) => {
                            const master = node.data as Master;
                            const isHovered = hoveredNode?.id === node.id;

                            return (
                                <g
                                    key={node.id}
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredNode(node)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                >
                                    {statusPulse(master.status) && (
                                        <circle
                                            cx={node.x}
                                            cy={node.y}
                                            r={24}
                                            fill={statusColor(master.status)}
                                            opacity={0.15}
                                        >
                                            <animate
                                                attributeName="r"
                                                from="22"
                                                to="30"
                                                dur="2s"
                                                repeatCount="indefinite"
                                            />
                                            <animate
                                                attributeName="opacity"
                                                from="0.15"
                                                to="0"
                                                dur="2s"
                                                repeatCount="indefinite"
                                            />
                                        </circle>
                                    )}
                                    <circle
                                        cx={node.x}
                                        cy={node.y}
                                        r={20}
                                        fill="#1a1a2e"
                                        stroke={statusColor(master.status)}
                                        strokeWidth={isHovered ? 3 : 2}
                                        style={{ filter: "url(#glow)" }}
                                    />
                                    <text
                                        x={node.x}
                                        y={node.y + 1}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fill="#e0e0e0"
                                        fontSize={9}
                                        fontFamily="var(--font-mono)"
                                        fontWeight="bold"
                                        pointerEvents="none"
                                    >
                                        M
                                    </text>
                                    <text
                                        x={node.x}
                                        y={node.y + 34}
                                        textAnchor="middle"
                                        fill={isHovered ? "#e0e0e0" : "#8b8b9e"}
                                        fontSize={10}
                                        fontFamily="var(--font-display)"
                                        pointerEvents="none"
                                    >
                                        {master.name}
                                    </text>
                                </g>
                            );
                        })}

                    {layout.nodes
                        .filter((n) => n.type === "agent")
                        .map((node) => {
                            const agent = node.data as Agent;
                            const isSelected = selectedAgentId === agent.id;
                            const isHovered = hoveredNode?.id === agent.id;
                            const r = isSelected ? 14 : isHovered ? 12 : 10;

                            return (
                                <g
                                    key={node.id}
                                    className="cursor-pointer"
                                    onClick={() => selectAgent(agent.id)}
                                    onMouseEnter={() => setHoveredNode(node)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                >
                                    {isSelected && (
                                        <circle
                                            cx={node.x}
                                            cy={node.y}
                                            r={18}
                                            fill="none"
                                            stroke="#e0e0e0"
                                            strokeWidth={1}
                                            strokeDasharray="3 3"
                                        >
                                            <animateTransform
                                                attributeName="transform"
                                                type="rotate"
                                                from={`0 ${node.x} ${node.y}`}
                                                to={`360 ${node.x} ${node.y}`}
                                                dur="8s"
                                                repeatCount="indefinite"
                                            />
                                        </circle>
                                    )}

                                    {statusPulse(agent.status) && !isSelected && (
                                        <circle
                                            cx={node.x}
                                            cy={node.y}
                                            r={r}
                                            fill={statusColor(agent.status)}
                                            opacity={0.1}
                                        >
                                            <animate
                                                attributeName="r"
                                                from={`${r}`}
                                                to={`${r + 6}`}
                                                dur="2.5s"
                                                repeatCount="indefinite"
                                            />
                                            <animate
                                                attributeName="opacity"
                                                from="0.1"
                                                to="0"
                                                dur="2.5s"
                                                repeatCount="indefinite"
                                            />
                                        </circle>
                                    )}

                                    <circle
                                        cx={node.x}
                                        cy={node.y}
                                        r={r}
                                        fill={isSelected ? statusColor(agent.status) : "#12121a"}
                                        stroke={statusColor(agent.status)}
                                        strokeWidth={isSelected ? 2.5 : 1.5}
                                        style={isSelected || isHovered ? { filter: "url(#glow)" } : undefined}
                                    />

                                    <text
                                        x={node.x}
                                        y={node.y - r - 8}
                                        textAnchor="middle"
                                        fill={isSelected || isHovered ? "#e0e0e0" : "#8b8b9e"}
                                        fontSize={9}
                                        fontFamily="var(--font-mono)"
                                        fontWeight={isSelected ? "bold" : "normal"}
                                        pointerEvents="none"
                                    >
                                        {agent.name}
                                    </text>
                                </g>
                            );
                        })}
                </g>
            </svg>

            {/* Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 bg-surface/80 backdrop-blur border border-foreground/10 rounded-md p-1 shadow-xl">
                <button
                    onClick={handleZoomIn}
                    className="p-1.5 hover:bg-foreground/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Zoom In"
                >
                    <Plus size={16} />
                </button>
                <div className="h-px bg-foreground/10 w-full" />
                <button
                    onClick={handleZoomOut}
                    className="p-1.5 hover:bg-foreground/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Zoom Out"
                >
                    <Minus size={16} />
                </button>
                <div className="h-px bg-foreground/10 w-full" />
                <button
                    onClick={handleFit}
                    className="p-1.5 hover:bg-foreground/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Fit to Screen"
                >
                    <Maximize size={16} />
                </button>
            </div>

            {/* Tooltip */}
            {hoveredNode && (
                <div
                    className="absolute pointer-events-none z-50 bg-surface/95 backdrop-blur-xl border border-foreground/10 shadow-2xl rounded-lg p-4 w-64 transform -translate-x-1/2 -translate-y-[calc(100%+20px)] transition-all duration-100 ease-out"
                    style={{
                        left: hoveredNode.x * transform.scale + transform.x,
                        top: hoveredNode.y * transform.scale + transform.y
                    }}
                >
                    {hoveredNode.type === "agent" ? (
                        <AgentTooltip agent={hoveredNode.data as Agent} />
                    ) : (
                        <MasterTooltip master={hoveredNode.data as Master} />
                    )}
                </div>
            )}
        </div>
    );
}

function AgentTooltip({ agent }: { agent: Agent }) {
    const { masters } = useStore();
    const master = masters.find(m => m.id === agent.masterId);

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="text-sm font-display text-foreground leading-none mb-1">{agent.name}</h4>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{agent.id}</span>
                </div>
                <Badge variant={agent.status === "active" ? "success" : agent.status === "degraded" ? "warning" : "danger"}>
                    {agent.status}
                </Badge>
            </div>

            <div className="flex gap-2">
                {agent.capabilities.includes("audio") && <div className="p-1.5 bg-foreground/5 rounded text-foreground" title="Audio"><Mic size={12} /></div>}
                {agent.capabilities.includes("video") && <div className="p-1.5 bg-foreground/5 rounded text-foreground" title="Video"><Video size={12} /></div>}
                {agent.capabilities.includes("motion") && <div className="p-1.5 bg-foreground/5 rounded text-foreground" title="Motion"><Move size={12} /></div>}
                {agent.capabilities.includes("gps") && <div className="p-1.5 bg-foreground/5 rounded text-foreground" title="GPS"><MapPin size={12} /></div>}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Battery size={12} /> <span className={agent.battery < 20 ? "text-red-500" : "text-foreground"}>{agent.battery}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Wifi size={12} /> <span className="text-foreground font-mono">{agent.signal} dB</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Thermometer size={12} /> <span className="text-foreground font-mono">{agent.temp}°C</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock size={12} /> <span className="text-foreground">{agent.lastSeen}</span>
                </div>
            </div>

            <div className="pt-2 border-t border-foreground/10 flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground font-mono flex items-center gap-1">
                    <Server size={10} /> {master?.name || agent.masterId}
                </span>
                <span className="text-muted-foreground">{agent.zone}</span>
            </div>
        </div>
    );
}

function MasterTooltip({ master }: { master: Master }) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="text-sm font-display text-foreground leading-none mb-1">{master.name}</h4>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{master.id}</span>
                </div>
                <Badge variant={master.status === "online" ? "success" : master.status === "degraded" ? "warning" : "danger"}>
                    {master.status}
                </Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs">
                <div>
                    <span className="text-[10px] font-mono text-muted-foreground block mb-0.5">IP ADDRESS</span>
                    <span className="font-mono text-foreground">{master.ip}</span>
                </div>
                <div>
                    <span className="text-[10px] font-mono text-muted-foreground block mb-0.5">AGENTS</span>
                    <span className="font-mono text-foreground">{master.agentCount} connected</span>
                </div>
                <div>
                    <span className="text-[10px] font-mono text-muted-foreground block mb-0.5">CPU</span>
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 bg-foreground/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${master.cpuUsage}%` }} />
                        </div>
                        <span className="text-[10px] font-mono">{master.cpuUsage}%</span>
                    </div>
                </div>
                <div>
                    <span className="text-[10px] font-mono text-muted-foreground block mb-0.5">RAM</span>
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 bg-foreground/10 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${master.ramUsage}%` }} />
                        </div>
                        <span className="text-[10px] font-mono">{master.ramUsage}%</span>
                    </div>
                </div>
            </div>

            <div className="pt-2 border-t border-foreground/10 flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground font-mono flex items-center gap-1">
                    <Clock size={10} /> Uptime
                </span>
                <span className="text-foreground font-mono">{master.uptime}</span>
            </div>
        </div>
    );
}
