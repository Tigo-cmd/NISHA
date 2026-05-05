"use client";

import React from "react";
import { WorldMap } from "@/components/ui/map";
import { Server, Smartphone, Activity } from "lucide-react";
import { motion } from "framer-motion";

export const NetworkMap = () => {
    return (
        <section id="network" className="py-32 bg-black relative border-t border-[#39d353]/10">
            {/* Background glowing effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#39d353]/5 via-black to-black pointer-events-none" />

            <div className="container px-6 mx-auto relative z-10">
                <div className="max-w-3xl mx-auto text-center mb-16">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#39d353]/30 bg-[#39d353]/10 px-3 py-1 text-xs text-[#39d353] mb-6 font-mono uppercase">
                        <Activity className="w-3 h-3" />
                        Master-Agent Topology
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white font-display mb-6">
                        Distributed <span className="text-[#39d353]">Intelligence</span>
                    </h2>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        NISHA operates on a Master-Agent mesh network. Mobile phones act as distributed <strong>Agents</strong> (Sensors), continuously streaming GPS, Audio, and Video telemetry over WebSockets to a centralized <strong>Master Node</strong> for real-time threat analysis and geographic awareness.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 max-w-4xl mx-auto">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="p-6 rounded-xl border border-[#39d353]/20 bg-black/50 backdrop-blur-md flex items-start gap-4"
                    >
                        <div className="p-3 rounded-lg bg-[#39d353]/10 text-[#39d353]">
                            <Server className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-white font-display font-bold text-xl mb-2">Master Nodes (Global)</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                A distributed network of central command servers running Python FastAPI. They ingest high-frequency WebSocket frames, process media via AI, and aggregate telemetry globally for a unified, resilient dashboard.
                            </p>
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="p-6 rounded-xl border border-[#39d353]/20 bg-black/50 backdrop-blur-md flex items-start gap-4"
                    >
                        <div className="p-3 rounded-lg bg-[#39d353]/10 text-[#39d353]">
                            <Smartphone className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-white font-display font-bold text-xl mb-2">Hardware Agents (Worldwide)</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                A vast array of sensory nodes—including React Native mobile phones, smartwatches, ESP32 hardware, drones, and IoT devices. They silently capture and stream environmental data (GPS, audio, video) to the nearest Master Node with sub-second latency.
                            </p>
                        </div>
                    </motion.div>
                </div>

                <div className="w-full rounded-2xl border border-[#39d353]/20 bg-black/40 overflow-hidden relative shadow-[0_0_30px_rgba(57,211,83,0.05)] p-4 md:p-8">
                    <WorldMap
                        dots={[
                            // Master 1: Abuja
                            { start: { lat: 37.78, lng: -122.42, label: "Lagos (Phone)" }, end: { lat: 40.71, lng: -74.01, label: "Abuja (Master)" } },
                            { start: { lat: 25.76, lng: -80.19, label: "Delta (IoT)" }, end: { lat: 40.71, lng: -74.01, label: "Abuja (Master)" } },
                            { start: { lat: 49.28, lng: -123.12, label: "Rivers (Watch)" }, end: { lat: 40.71, lng: -74.01, label: "Abuja (Master)" } },
                            
                            // Master 2: Kano
                            { start: { lat: 51.51, lng: -0.13, label: "Edo (Phone)" }, end: { lat: 28.61, lng: 77.21, label: "Kano (Master)" } },
                            { start: { lat: 55.76, lng: 37.62, label: "Oyo (Camera)" }, end: { lat: 28.61, lng: 77.21, label: "Kano (Master)" } },
                            { start: { lat: 25.20, lng: 55.27, label: "Enugu (IoT)" }, end: { lat: 28.61, lng: 77.21, label: "Kano (Master)" } },

                            // Master 3: Kaduna
                            { start: { lat: 35.68, lng: 139.69, label: "Sokoto (Watch)" }, end: { lat: -33.87, lng: 151.21, label: "Kaduna (Master)" } },
                            { start: { lat: -6.20, lng: 106.81, label: "Borno (Drone)" }, end: { lat: -33.87, lng: 151.21, label: "Kaduna (Master)" } },
                            { start: { lat: -36.84, lng: 174.76, label: "Ogun (Phone)" }, end: { lat: -33.87, lng: 151.21, label: "Kaduna (Master)" } }
                        ]}
                    />
                </div>
            </div>
        </section>
    );
};
