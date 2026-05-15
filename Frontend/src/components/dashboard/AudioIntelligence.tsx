"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Mic, 
    Volume2, 
    VolumeX, 
    Activity, 
    Clock, 
    Globe, 
    Radio,
    ChevronRight,
    Headphones
} from "lucide-react";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { websocketService } from "@/services/websocketService";
import { WebSocketMessageType } from "@/types";

export function AudioIntelligence() {
    const { agents } = useStore();
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [transcripts, setTranscripts] = useState<Record<string, any[]>>({});
    const [isListening, setIsListening] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    
    // Filter only agents with audio capabilities
    const audioAgents = agents.filter(a => a.capabilities.includes("audio"));
    const selectedAgent = audioAgents.find(a => a.id === selectedAgentId) || audioAgents[0];

    useEffect(() => {
        if (!selectedAgentId && audioAgents.length > 0) {
            setSelectedAgentId(audioAgents[0].id);
        }
    }, [audioAgents, selectedAgentId]);

    // Handle Audio Playback
    useEffect(() => {
        if (isListening && !audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000 // Match ESP32/Master sample rate
            });
            nextStartTimeRef.current = audioContextRef.current.currentTime;
        }

        const unsubAudio = websocketService.subscribe("AUDIO_FRAME", (data: any) => {
            if (!isListening || !audioContextRef.current || data.agent_id !== selectedAgentId) return;

            try {
                // Decode base64 to bytes
                const binaryString = window.atob(data.audio);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                // Convert PCM16 to Float32
                const pcm16 = new Int16Array(bytes.buffer);
                const float32 = new Float32Array(pcm16.length);
                for (let i = 0; i < pcm16.length; i++) {
                    float32[i] = pcm16[i] / 32768.0;
                }

                const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 16000);
                audioBuffer.getChannelData(0).set(float32);

                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);

                // Scheduling for gapless playback
                const startTime = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
                source.start(startTime);
                nextStartTimeRef.current = startTime + audioBuffer.duration;

            } catch (e) {
                console.error("Audio Playback Error:", e);
            }
        });

        return () => {
            unsubAudio();
            if (!isListening && audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, [isListening, selectedAgentId]);

    useEffect(() => {
        // Subscribe to live transcriptions
        const unsub = websocketService.subscribe(WebSocketMessageType.TRANSCRIPTION_EVENT, (data: any) => {
            if (data && data.text) {
                setTranscripts(prev => {
                    const targetId = data.agent_id || selectedAgentId;
                    const existing = prev[targetId] || [];
                    const updated = [{
                        text: data.text,
                        language: data.language,
                        timestamp: data.timestamp || Date.now() / 1000,
                        is_final: data.is_final,
                        has_threat: data.has_threat || false,
                        threat_keywords: data.threat_keywords || null,
                    }, ...existing].slice(0, 10);
                    
                    return { ...prev, [targetId]: updated };
                });
            }
        });

        return () => unsub();
    }, [selectedAgentId]);

    return (
        <div className="flex h-full gap-4 p-4 overflow-hidden bg-background">
            {/* Sidebar: Agent Selector */}
            <div className="w-64 flex flex-col gap-3">
                <div className="flex items-center gap-2 px-2 mb-2">
                    <Radio className="text-emerald-500 animate-pulse" size={18} />
                    <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Audio Sources</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {audioAgents.map(agent => (
                        <button
                            key={agent.id}
                            onClick={() => setSelectedAgentId(agent.id)}
                            className={cn(
                                "w-full p-3 rounded-lg border text-left transition-all group",
                                selectedAgentId === agent.id 
                                    ? "bg-foreground/5 border-foreground/20 shadow-sm" 
                                    : "bg-surface/30 border-foreground/5 hover:bg-foreground/5"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={cn(
                                    "text-[10px] font-mono uppercase tracking-tighter",
                                    selectedAgentId === agent.id ? "text-foreground" : "text-muted-foreground"
                                )}>
                                    {agent.id}
                                </span>
                                {agent.audioLevel && agent.audioLevel > 50 && (
                                    <Activity size={12} className="text-emerald-500 animate-pulse" />
                                )}
                            </div>
                            <div className="text-xs font-medium truncate">{agent.name}</div>
                            <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1 bg-foreground/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 transition-all duration-300" 
                                        style={{ width: `${Math.min((agent.audioLevel || 0) / 100 * 100, 100)}%` }}
                                    />
                                </div>
                                <span className="text-[9px] font-mono text-muted-foreground">{agent.audioLevel || 0}dB</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content: Intelligence Panel */}
            <div className="flex-1 flex flex-col gap-4">
                {selectedAgent ? (
                    <>
                        {/* Monitor Header */}
                        <div className="bg-surface/50 border border-foreground/10 rounded-xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                            
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h2 className="text-2xl font-display uppercase tracking-tight">{selectedAgent.name}</h2>
                                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-mono uppercase">Live Monitored</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-mono">{selectedAgent.hardware} · {selectedAgent.zone}</p>
                                </div>

                                <button 
                                    onClick={() => {
                                        setIsListening(!isListening);
                                        if (!isListening && audioContextRef.current) {
                                            audioContextRef.current.resume();
                                        }
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider transition-all",
                                        isListening 
                                            ? "bg-red-500 text-white shadow-lg shadow-red-500/20" 
                                            : "bg-foreground text-background hover:opacity-90"
                                    )}
                                >
                                    {isListening ? <Volume2 size={14} /> : <Headphones size={14} />}
                                    {isListening ? "Listening Live" : "Listen Live"}
                                </button>
                            </div>

                            <div className="mt-8">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span className="text-[10px] font-mono uppercase text-muted-foreground">Level: {selectedAgent.audioLevel} dB</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Mic size={12} className="text-muted-foreground" />
                                            <span className="text-[10px] font-mono uppercase text-muted-foreground">Status: Active</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-24 bg-foreground/5 rounded-lg border border-foreground/5 overflow-hidden">
                                    <WaveformVisualizer 
                                        height={96} 
                                        color={isListening ? "#ef4444" : "#10b981"} 
                                        level={selectedAgent.audioLevel || 10} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Transcription Scroll */}
                        <div className="flex-1 bg-surface/30 border border-foreground/5 rounded-xl flex flex-col overflow-hidden">
                            <div className="px-6 py-4 border-b border-foreground/5 flex justify-between items-center bg-surface/20">
                                <div className="flex items-center gap-2">
                                    <Activity size={14} className="text-emerald-500" />
                                    <h3 className="text-xs font-mono uppercase tracking-widest">Intelligence Feed</h3>
                                </div>
                                <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground uppercase">
                                    <span className="flex items-center gap-1"><Globe size={10} /> Auto-Detect</span>
                                    <span className="flex items-center gap-1"><Clock size={10} /> Real-time</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <AnimatePresence mode="popLayout">
                                    {(transcripts[selectedAgent.id] || []).map((t, i) => (
                                        <motion.div
                                            key={`${t.timestamp}-${i}`}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className={cn(
                                                "p-4 rounded-xl border transition-all",
                                                t.has_threat
                                                    ? "bg-red-500/10 border-red-500/40 scale-[1.02]"
                                                    : i === 0 
                                                        ? "bg-foreground/5 border-emerald-500/30 scale-[1.02]" 
                                                        : "bg-surface/50 border-foreground/5 opacity-60"
                                            )}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">{t.language || "en"}</span>
                                                    {!t.is_final && <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />}
                                                    {t.has_threat && (
                                                        <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-mono uppercase animate-pulse">
                                                            ⚠️ THREAT
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-mono text-muted-foreground">
                                                    {new Date(t.timestamp * 1000).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <p className={cn(
                                                "text-sm font-medium leading-relaxed",
                                                t.has_threat ? "text-red-300" : i === 0 ? "text-foreground" : "text-muted-foreground"
                                            )}>
                                                "{t.text}"
                                            </p>
                                            {t.threat_keywords && t.threat_keywords.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {t.threat_keywords.map((kw: string, ki: number) => (
                                                        <span key={ki} className="px-1.5 py-0.5 bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] font-mono rounded">
                                                            {kw}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                
                                {(!transcripts[selectedAgent.id] || transcripts[selectedAgent.id].length === 0) && (
                                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                                        <Mic size={48} className="mb-4" />
                                        <p className="text-xs font-mono uppercase tracking-[0.2em]">Awaiting Signal Intelligence...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <Radio size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-mono uppercase tracking-widest opacity-40">No Audio Sources Available</p>
                    </div>
                )}
            </div>
        </div>
    );
}
