"use client";

import React, { useState, useEffect } from "react";
import { TerminalWindow, TerminalLine } from "@/components/ui/TerminalWindow";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export const TerminalIntro = () => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });
    const [startAnimation, setStartAnimation] = useState(false);

    useEffect(() => {
        if (isInView) {
            setStartAnimation(true);
        }
    }, [isInView]);

    return (
        <section ref={ref} className="py-24 bg-background relative overflow-hidden">
            <div className="container px-6 mx-auto max-w-4xl">
                <TerminalWindow title="nisha_init.sh" className="min-h-[400px]">
                    {startAnimation && (
                        <>
                            <TerminalLine delay={0.2}>initializing_secure_mesh_protocol...</TerminalLine>
                            <TerminalLine delay={0.8}><span className="text-[#39d353]">[OK]</span> cryptographic handshake established</TerminalLine>
                            <TerminalLine delay={1.4}><span className="text-[#39d353]">[OK]</span> distributed nodes detected: 847 active</TerminalLine>
                            <TerminalLine delay={2.0}><span className="text-[#39d353]">[OK]</span> audio sensors: 1,294 online</TerminalLine>
                            <TerminalLine delay={2.6}><span className="text-[#39d353]">[OK]</span> video feeds: 892 streaming</TerminalLine>
                            <TerminalLine delay={3.2}><span className="text-[#39d353]">[OK]</span> threat detection: ARMED</TerminalLine>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 4.2 }}
                                className="mt-8 pt-8 border-t border-foreground/5"
                            >
                                <div className="text-foreground font-display text-2xl mb-4">WELCOME TO NISHA v0.1.0</div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Community-powered security network. Our intelligence doesn't reside in
                                    a central server, but in every node. In every device. In you.
                                </p>
                                <div className="mt-6 flex items-center gap-2">
                                    <span className="w-2 h-5 bg-foreground animate-pulse" />
                                    <span className="text-foreground text-xs tracking-widest font-bold font-mono">AWAITING SELECTION...</span>
                                </div>
                            </motion.div>
                        </>
                    )}
                </TerminalWindow>
            </div>
        </section>
    );
};
