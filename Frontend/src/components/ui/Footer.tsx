"use client";

import React, { useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

const asciiArt = [
    "  _   _   _____   _____   _    _      /\\   ",
    " | \\ | | |_   _| / ____| | |  | |    /  \\  ",
    " |  \\| |   | |  | (___   | |__| |   / /\\ \\ ",
    " | . ` |   | |   \\___ \\  |  __  |  / ____ \\",
    " | |\\  |  _| |_  ____) | | |  | | /_/    \\_\\",
    " |_| \\_| |_____||_____/  |_|  |_|          "
];

const Character = ({ char, delay }: { char: string; delay: number }) => {
    const [displayChar, setDisplayChar] = useState(char === ' ' ? ' ' : ' ');
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        if (char === ' ') {
            setOpacity(1);
            return;
        }

        const timeout = setTimeout(() => {
            setOpacity(1);
            let iterations = 0;
            const interval = setInterval(() => {
                const randomChars = "!@#$%^&*()_+-=[]{}|;:,.<>?/";
                setDisplayChar(randomChars[Math.floor(Math.random() * randomChars.length)]);

                iterations++;
                if (iterations > 5) {
                    clearInterval(interval);
                    setDisplayChar(char);
                }
            }, 40);
        }, delay * 1000);

        return () => clearTimeout(timeout);
    }, [char, delay]);

    return (
        <span style={{ opacity, transition: 'opacity 0.2s', display: 'inline-block', width: '1ch' }}>
            {displayChar}
        </span>
    );
};

export const Footer = () => {
    const ref = React.useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    return (
        <footer
            ref={ref}
            className="pt-20 pb-32 bg-[#050505] overflow-hidden border-t border-emerald-500/10"
        >
            <div className="max-w-7xl mx-auto px-6 mb-24 grid grid-cols-1 md:grid-cols-4 gap-12 text-sm">
                <div className="col-span-1 md:col-span-1 flex flex-col items-start gap-4">
                    <div className="flex items-center gap-3">
                        <img src="/assets/logo-icon.png" alt="NISHA" className="w-8 h-8 opacity-80 hover:opacity-100 transition-opacity" />
                        <span className="font-display font-bold text-lg text-emerald-500 tracking-wider">NISHA</span>
                    </div>
                    <p className="text-muted-foreground/60 font-mono text-xs max-w-xs">
                        Advanced autonomous sentinel nodes for global perimeter security, acoustic intelligence, and optical threat detection.
                    </p>
                </div>
                
                <div>
                    <h4 className="font-mono text-emerald-500/80 mb-4 tracking-widest text-[10px] uppercase">Intelligence</h4>
                    <ul className="space-y-3 font-mono text-xs text-muted-foreground/50">
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">Tactical Map</a></li>
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">Perimeter View</a></li>
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">Alert Analytics</a></li>
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">System Health</a></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-mono text-emerald-500/80 mb-4 tracking-widest text-[10px] uppercase">Resources</h4>
                    <ul className="space-y-3 font-mono text-xs text-muted-foreground/50">
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">Hardware Specs</a></li>
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">Firmware Archive</a></li>
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">API Documentation</a></li>
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">Support Portal</a></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-mono text-emerald-500/80 mb-4 tracking-widest text-[10px] uppercase">Legal & Contact</h4>
                    <ul className="space-y-3 font-mono text-xs text-muted-foreground/50">
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">Privacy Policy</a></li>
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">Terms of Service</a></li>
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">Compliance Hub</a></li>
                        <li><a href="#" className="hover:text-emerald-500 transition-colors">Contact Command</a></li>
                    </ul>
                </div>
            </div>

            <div className="container px-6 mx-auto flex flex-col items-center justify-center border-t border-white/5 pt-24">
                <div className="relative group my-16">
                    {/* Background Glow */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full bg-emerald-500/10 blur-[160px] group-hover:bg-emerald-500/20 transition-colors duration-1000" />

                    <pre className="relative z-10 font-mono text-[clamp(0.6rem,2vw,4.4rem)] leading-[0.9] tracking-[-0.25em] text-white/40 group-hover:text-emerald-500 group-hover:drop-shadow-[0_0_25px_rgba(16,185,129,0.7)] transition-all duration-700 select-none">
                        {isInView && asciiArt.map((line, lineIdx) => (
                            <div key={lineIdx} className="whitespace-pre flex justify-center">
                                {line.split('').map((char, charIdx) => (
                                    <Character
                                        key={charIdx}
                                        char={char}
                                        delay={(lineIdx * 0.05) + (charIdx * 0.005)}
                                    />
                                ))}
                            </div>
                        ))}
                    </pre>

                    {/* Scanline Effect */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent h-16 w-full z-20 pointer-events-none"
                        animate={{ top: ['-20%', '120%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    />
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : {}}
                    transition={{ delay: 2, duration: 1 }}
                    className="mt-16 flex flex-col items-center gap-4"
                >
                    <div className="h-px w-48 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                    <p className="text-xs font-mono uppercase tracking-[0.8em] text-emerald-500/50">
                        Hardwired for Excellence
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/30 mt-4">
                        © {new Date().getFullYear()} NISHA Systems. All rights reserved.
                    </p>
                </motion.div>
            </div>
        </footer>
    );
};
