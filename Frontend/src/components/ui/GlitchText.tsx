"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface GlitchTextProps {
    text: string;
    className?: string;
    as?: "h1" | "h2" | "h3" | "p" | "span";
    glitchOnlyOnHover?: boolean;
}

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*";

export const GlitchText: React.FC<GlitchTextProps> = ({
    text,
    className = "",
    as: Component = "span",
    glitchOnlyOnHover = false,
}) => {
    const [displayText, setDisplayText] = useState(text);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (glitchOnlyOnHover && !isHovered) {
            setDisplayText(text);
            return;
        }

        let intervalId: NodeJS.Timeout;
        let iteration = 0;

        const startGlitch = () => {
            intervalId = setInterval(() => {
                setDisplayText((prev) =>
                    prev
                        .split("")
                        .map((char, index) => {
                            if (index < iteration) {
                                return text[index];
                            }
                            return characters[Math.floor(Math.random() * characters.length)];
                        })
                        .join("")
                );

                if (iteration >= text.length) {
                    clearInterval(intervalId);
                }

                iteration += 1 / 3;
            }, 30);
        };

        startGlitch();

        return () => clearInterval(intervalId);
    }, [text, isHovered, glitchOnlyOnHover]);

    return (
        <Component
            className={`font-display relative inline-block ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <span className="relative z-10">{displayText}</span>
            {isHovered && (
                <>
                    <motion.span
                        className="absolute top-0 left-0 -z-10 text-cyan-neon opacity-70"
                        animate={{ x: [-2, 2, -2], y: [1, -1, 1] }}
                        transition={{ repeat: Infinity, duration: 0.1 }}
                    >
                        {displayText}
                    </motion.span>
                    <motion.span
                        className="absolute top-0 left-0 -z-10 text-red-alert opacity-70"
                        animate={{ x: [2, -2, 2], y: [-1, 1, -1] }}
                        transition={{ repeat: Infinity, duration: 0.1 }}
                    >
                        {displayText}
                    </motion.span>
                </>
            )}
        </Component>
    );
};
