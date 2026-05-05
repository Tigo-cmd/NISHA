"use client";

import React from "react";
import { motion } from "framer-motion";
import { Mic, Video, Map, Bell, Share2, ShieldCheck } from "lucide-react";

const features = [
    {
        icon: <Mic className="w-6 h-6" />,
        title: "AUDIO DETECTION",
        desc: "Gunshots. Explosions. Screams. Identified in 100ms by edge-AI nodes.",
    },
    {
        icon: <Video className="w-6 h-6" />,
        title: "VIDEO INTELLIGENCE",
        desc: "Motion detected. Objects classified. Suspicious activity flagged in real-time.",
    },
    {
        icon: <Map className="w-6 h-6" />,
        title: "LOCATION MAPPING",
        desc: "Incidents mapped. Response coordinated. Evidence geotagged for audit.",
    },
    {
        icon: <Bell className="w-6 h-6" />,
        title: "REAL-TIME ALERTS",
        desc: "Instant notifications. Telegram integration. Community-wide warnings.",
    },
    {
        icon: <Share2 className="w-6 h-6" />,
        title: "MESH NETWORK",
        desc: "Offline-first sync. Devices relay through each other. Always on.",
    },
    {
        icon: <ShieldCheck className="w-6 h-6" />,
        title: "PRIVACY FIRST",
        desc: "On-device processing. End-to-end encrypted. You own your data.",
    },
];

export const Features = () => {
    return (
        <section id="features" className="py-24 bg-background relative">
            <div className="container px-6 mx-auto">
                <div className="text-center mb-20">
                    <h2 className="text-4xl md:text-5xl font-display mb-4">SYSTEM CAPABILITIES</h2>
                    <div className="w-24 h-[1px] bg-primary/30 mx-auto" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-primary/5 border border-primary/10">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-background p-10 group hover:bg-surface/50 transition-colors"
                        >
                            <div className="text-muted-foreground mb-6 transition-transform duration-300 group-hover:scale-110 group-hover:text-primary">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-display mb-4 text-foreground">
                                {feature.title}
                            </h3>
                            <p className="text-muted-foreground leading-relaxed text-sm">
                                {feature.desc}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};
