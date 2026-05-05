"use client";

import React, { useRef, useEffect } from "react";

interface WaveformVisualizerProps {
    color?: string;
    height?: number;
    isLive?: boolean;
    level?: number;
}

export const WaveformVisualizer = ({
    color = "#e0e0e0",
    height = 120,
    isLive = true,
    level = 0,
}: WaveformVisualizerProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;
        let offset = 0;

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const waveHeight = canvas.height / 2;
            const waveWidth = canvas.width;

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineCap = "round";

            for (let x = 0; x < waveWidth; x += 2) {
                const relativeX = (x + offset) * 0.05;
                // Base jitter + level-based amplitude
                const baseJitter = Math.random() * 0.2;
                const levelMultiplier = Math.max(0.1, level / 80); 
                const amplitude = isLive ? (levelMultiplier + baseJitter) : 0.1;
                
                const y = waveHeight + Math.sin(relativeX) * (waveHeight * 0.7 * amplitude);

                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();

            ctx.globalAlpha = 0.15;
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            offset += 2;
            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [color, isLive]);

    return (
        <div className="w-full bg-background/30 rounded-lg p-4 border border-foreground/5 relative overflow-hidden">
            <canvas
                ref={canvasRef}
                width={800}
                height={height}
                className="w-full h-full"
            />
            {isLive && (
                <div className="absolute top-2 right-4 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-red-500 uppercase font-bold">Live Stream</span>
                </div>
            )}
        </div>
    );
};
