"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowDown, Shield } from "lucide-react";
import { Globe } from "@/components/ui/interactive-globe";
import { FloatingPaths } from "@/components/ui/background-paths";

export const Hero = () => {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-black">
            {/* Background Paths */}
            <div className="absolute inset-0">
                <FloatingPaths position={1} />
                <FloatingPaths position={-1} />
            </div>

            {/* Ambient green glow tailored to NISHA */}
            <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-[#39d353]/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-[#39d353]/5 blur-[100px] pointer-events-none" />

            <div className="container px-6 relative z-10">
                <div className="w-full overflow-hidden relative z-10">
                    
                    <div className="flex flex-col lg:flex-row min-h-[600px]">
                        {/* Left content */}
                        <div className="flex-1 flex flex-col justify-center p-10 md:p-14 relative z-10">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                            >
                                <div className="inline-flex items-center gap-2 rounded-full border border-[#39d353]/30 bg-[#39d353]/10 px-3 py-1 text-xs text-[#39d353] mb-6 w-fit font-mono">
                                    <span className="size-1.5 rounded-full bg-[#39d353] animate-pulse" />
                                    NETWORK IS ALIVE
                                </div>

                                <div className="font-mono text-xs md:text-sm tracking-[0.3em] uppercase mb-4 text-muted-foreground">
                                    Node-Based Intelligence & Security Hazard Analyzer
                                </div>

                                <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] mb-6 font-display">
                                    DISTRIBUTED
                                    <br />
                                    <span className="text-[#39d353]">
                                        DEFENSE
                                    </span>
                                </h1>

                                <p className="text-sm md:text-base text-gray-400 max-w-md leading-relaxed mb-8">
                                    Your device becomes a sensor. Your community becomes intelligent. Deploying secure mesh infrastructure in under 100ms. Drag the globe to explore active nodes.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                                    <Link
                                        href="/dashboard/agents"
                                        className="px-8 py-3 rounded-md bg-[#39d353] text-black font-display font-bold uppercase tracking-wider text-sm transition-opacity hover:opacity-90 text-center"
                                    >
                                        Initialize Sensor
                                    </Link>
                                    <Link
                                        href="/dashboard"
                                        className="px-8 py-3 rounded-md border border-[#39d353]/50 text-[#39d353] font-display font-medium uppercase tracking-wider text-sm transition-colors hover:bg-[#39d353]/10 text-center"
                                    >
                                        Access Dashboard
                                    </Link>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div>
                                        <p className="text-2xl font-bold text-white font-mono">100<span className="text-[#39d353]">ms</span></p>
                                        <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Deployment</p>
                                    </div>
                                    <div className="w-px h-8 bg-gray-800" />
                                    <div>
                                        <p className="text-2xl font-bold text-white font-mono">256<span className="text-[#39d353]">-bit</span></p>
                                        <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Encryption</p>
                                    </div>
                                    <div className="w-px h-8 bg-gray-800" />
                                    <div>
                                        <p className="text-2xl font-bold text-white font-mono">99.9<span className="text-[#39d353]">%</span></p>
                                        <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Uptime</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Right — Globe */}
                        <div className="flex-1 flex items-center justify-center p-4 md:p-0 min-h-[400px] lg:min-h-full relative z-10 overflow-hidden">
                            {/* Inner subtle glow for the globe area */}
                            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#39d353]/5 pointer-events-none" />
                            
                            <Globe size={700} className="opacity-90 hover:opacity-100 transition-opacity duration-500 absolute md:translate-x-[10%]" />
                            
                            {/* Right edge blend gradient */}
                            <div className="absolute top-0 right-0 bottom-0 w-40 bg-gradient-to-r from-transparent to-black pointer-events-none" />
                        </div>
                    </div>
                </div>

                <motion.div
                    className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                    animate={{ y: [0, 8, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                >
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                        Scroll
                    </span>
                    <ArrowDown className="w-4 h-4 text-[#39d353]" />
                </motion.div>
            </div>
        </section>
    );
};
