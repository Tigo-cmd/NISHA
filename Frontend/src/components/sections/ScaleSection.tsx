"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FadeInView } from '@/components/ui/fade-in-view';

const PixelTerminal = () => (
    <div className="flex flex-col items-center gap-2 mb-8">
        <svg width="60" height="50" viewBox="0 0 60 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="5" width="50" height="35" rx="2" stroke="#10b981" strokeWidth="2" />
            <rect x="15" y="15" width="30" height="15" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx="23" cy="21" r="1.5" fill="#10b981" />
            <circle cx="37" cy="21" r="1.5" fill="#10b981" />
            <path d="M25 28C26.5 29.5 33.5 29.5 35 28" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="20" y="40" width="20" height="4" fill="#10b981" />
            <rect x="10" y="44" width="40" height="2" fill="#10b981" />
        </svg>
    </div>
);

const LiveIndicator = () => (
    <div className="inline-flex flex-col items-center gap-1 mx-2 align-middle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse">
            <path d="M5 12.6667C5 12.6667 6.16667 11.5 8.5 11.5C10.8333 11.5 12 12.6667 12 12.6667C12 12.6667 13.1667 13.8333 15.5 13.8333C17.8333 13.8333 19 12.6667 19 12.6667" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            <path d="M5 8.66667C5 8.66667 6.16667 7.5 8.5 7.5C10.8333 7.5 12 8.66667 12 8.66667C12 8.66667 13.1667 9.83333 15.5 9.83333C17.8333 9.83333 19 8.66667 19 8.66667" stroke="#10b981" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </svg>
        <span className="text-[8px] font-black border border-emerald-500 px-1 rounded text-emerald-500 tracking-widest uppercase bg-emerald-500/10">Live</span>
    </div>
);

export const ScaleSection = () => (
    <section className="bg-background py-40 overflow-hidden relative border-y border-foreground/5">
        {/* Background effects */}
        <div className="absolute inset-0 z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-emerald-500/5 blur-[150px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <FadeInView className="flex flex-col items-center text-center">
                <PixelTerminal />

                <h2 className="text-emerald-500 font-display text-3xl md:text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] max-w-6xl uppercase selection:bg-emerald-500 selection:text-black">
                    From personal defense <span className="text-muted-foreground/30">to</span> perimeter security,
                    <br />
                    NISHA keeps <span className="text-muted-foreground/30">you</span> safe wherever you are
                    <br />
                    with real-time <LiveIndicator /> threat detection,
                    <br />
                    autonomous surveillance,
                    <br />
                    and guaranteed protection
                </h2>

                <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    transition={{ duration: 1.5, ease: "circOut" }}
                    className="h-px w-40 bg-emerald-500 mt-12 origin-left"
                />
            </FadeInView>
        </div>
    </section>
);
