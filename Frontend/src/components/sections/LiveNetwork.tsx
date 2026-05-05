"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import TacticalOverlay from "@/components/dashboard/TacticalOverlay";
import { Activity, Shield, Zap, Globe } from "lucide-react";

const StatBox = ({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) => (
    <div className="flex flex-col gap-2 p-6 bg-surface/70 backdrop-blur-xl rounded-xl border border-foreground/10 relative overflow-hidden group hover:border-foreground/20 transition-colors">
        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
            <Icon className="w-12 h-12 text-foreground" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em]">{label}</span>
        <div className="flex items-baseline gap-2">
            <motion.span
                key={value}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-3xl font-display text-primary"
            >
                {value}
            </motion.span>
        </div>
    </div>
);

export const LiveNetwork = () => {
    const [nodes, setNodes] = useState(1243);
    const [detections, setDetections] = useState(23);
    const [time, setTime] = useState<string>("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setTime(new Date().toLocaleTimeString());

        const interval = setInterval(() => {
            setNodes(prev => prev + (Math.random() > 0.7 ? 1 : 0));
            if (Math.random() > 0.95) setDetections(prev => prev + 1);
            setTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <section id="network" className="py-32 bg-background relative overflow-hidden border-y border-foreground/5">
            <div className="container px-6 mx-auto relative z-10">
                <div className="flex flex-col items-center text-center mb-20">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-tighter border border-foreground/20 text-muted-foreground mb-4">
                        Global Intelligence Grid
                    </span>
                    <h2 className="text-4xl md:text-6xl font-display mb-6 max-w-3xl">
                        A DECENTRALIZED <span className="italic text-primary">DEFENSE</span> COLLECTIVE
                    </h2>
                    <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl px-4">
                        NISHA turns every connected node into a sentinel. Join thousands of points of intelligence working in unison to secure the physical world.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                        <StatBox label="Active Sentinels" value={nodes.toLocaleString()} icon={Globe} />
                        <StatBox label="Hazards Neutralized" value={detections} icon={Shield} />
                        <StatBox label="Data Processed" value="1.2 PB" icon={Zap} />
                        <StatBox label="System Health" value="99.98%" icon={Activity} />
                    </div>

                    <div className="lg:col-span-8 group relative">
                        <div className="relative bg-surface/70 backdrop-blur-xl rounded-2xl border border-foreground/10 overflow-hidden h-[600px]">
                            <div className="absolute top-0 inset-x-0 p-4 border-b border-foreground/5 flex justify-between items-center z-20 bg-background/40 backdrop-blur-md">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-mono text-foreground tracking-widest uppercase">Live Tactical Overlay :: Zone_7_LAGOS</span>
                                </div>
                                <div className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
                                    {mounted ? time : "--:--:--"} :: SIGNAL_STRENGTH: 98%
                                </div>
                            </div>

                            <div className="w-full h-full pt-12">
                                <TacticalOverlay />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
