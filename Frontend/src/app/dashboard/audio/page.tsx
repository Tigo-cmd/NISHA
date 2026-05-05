"use client";

import React, { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { apiService } from "@/services/apiService";
import { Mic, Play, Download, Clock, Activity, Shield } from "lucide-react";
import { WaveformVisualizer } from "@/components/dashboard/WaveformVisualizer";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface AudioClip {
    id: string;
    agentId: string;
    timestamp: string;
    class_name: string;
    confidence: number;
    transcription: string | null;
    base64?: string;
}

export default function AudioAnalysisPage() {
    const { agents } = useStore();
    const [clips, setClips] = useState<AudioClip[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClip, setSelectedClip] = useState<AudioClip | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);

    const fetchClips = async () => {
        try {
            // In a real scenario, we'd have a global audio events endpoint
            // For now, we fetch from the last 20 audio events
            const data = await apiService.getAudioEvents(20);
            if (data) {
                setClips(data.map((d: any) => ({
                    id: d.event_id,
                    agentId: d.agent_id,
                    timestamp: d.timestamp,
                    class_name: d.class_name,
                    confidence: d.confidence,
                    transcription: d.transcription,
                })));
            }
        } catch (err) {
            console.error("Failed to fetch audio clips:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClips();
        const interval = setInterval(fetchClips, 10000);
        return () => clearInterval(interval);
    }, []);

    const playClip = async (clip: AudioClip) => {
        try {
            setPlayingId(clip.id);
            // Fetch the actual audio data for this specific clip using the source agent ID
            const data = await apiService.getAgentMedia(clip.agentId, "audio");
            
            if (data?.base64) {
                // Convert base64 to Blob
                const byteCharacters = atob(data.base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                
                // Try to detect if it's AAC/M4A or WAV
                const mimeType = data.base64.startsWith('UklGR') ? 'audio/wav' : 'audio/m4a';
                const blob = new Blob([byteArray], { type: mimeType });
                const url = URL.createObjectURL(blob);
                
                const audio = new Audio(url);
                audio.onended = () => {
                    setPlayingId(null);
                    URL.revokeObjectURL(url); // Clean up memory
                };
                audio.onerror = () => {
                    console.error("Audio error:", audio.error);
                    setPlayingId(null);
                };
                
                await audio.play();
            } else {
                setPlayingId(null);
            }
        } catch (err) {
            console.error("Playback failed:", err);
            setPlayingId(null);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h2 className="text-2xl font-display text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Mic className="text-foreground" /> Audio Intelligence
                </h2>
                <p className="text-muted-foreground text-sm">
                    Real-time acoustic monitoring and automated transcription feed.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Live Feed */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-surface/50 border border-foreground/5 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-foreground/5 bg-foreground/5 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Recent Acoustic Events</span>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-[10px] font-mono text-red-500 uppercase">Live Feed</span>
                            </div>
                        </div>

                        <div className="divide-y divide-foreground/5 max-h-[600px] overflow-y-auto">
                            {loading ? (
                                <div className="p-12 text-center text-muted-foreground italic">Loading intelligence feed...</div>
                            ) : clips.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground italic">No acoustic events detected in perimeter.</div>
                            ) : (
                                clips.map((clip) => (
                                    <div 
                                        key={clip.id} 
                                        className={cn(
                                            "p-4 hover:bg-foreground/5 transition-colors cursor-pointer group",
                                            selectedClip?.id === clip.id && "bg-foreground/5 border-l-2 border-foreground"
                                        )}
                                        onClick={() => setSelectedClip(clip)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-foreground font-bold">{clip.class_name.toUpperCase()}</span>
                                                    <Badge variant={clip.confidence > 0.8 ? "default" : "secondary"} className="text-[9px]">
                                                        {(clip.confidence * 100).toFixed(0)}% Match
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {clip.transcription || "No voice pattern detected."}
                                                </p>
                                                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground font-mono">
                                                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(clip.timestamp).toLocaleTimeString()}</span>
                                                    <span className="flex items-center gap-1"><Activity size={10} /> {clip.agentId}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); playClip(clip); }}
                                                className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                                    playingId === clip.id 
                                                        ? "bg-emerald-500 text-white animate-pulse" 
                                                        : "bg-foreground/10 text-foreground hover:bg-foreground hover:text-background"
                                                )}
                                            >
                                                <Play size={16} className={playingId === clip.id ? "fill-current" : ""} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Analysis Details */}
                <div className="space-y-6">
                    <div className="bg-surface/50 border border-foreground/5 rounded-xl p-6 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center">
                                <Shield className="text-foreground" size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-display uppercase">Acoustic Analysis</h3>
                                <p className="text-[10px] text-muted-foreground font-mono">VETTING MODULE v2.4</p>
                            </div>
                        </div>

                        {selectedClip ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Spectral Profile</span>
                                    <div className="h-24 bg-black/40 rounded-lg flex items-center justify-center border border-foreground/5">
                                        <WaveformVisualizer height={60} level={selectedClip.confidence * 100} color="#facc15" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-foreground/5 p-3 rounded-lg border border-foreground/5">
                                        <div className="text-[9px] text-muted-foreground uppercase mb-1">Source Agent</div>
                                        <div className="text-xs font-mono font-bold truncate">{selectedClip.agentId}</div>
                                    </div>
                                    <div className="bg-foreground/5 p-3 rounded-lg border border-foreground/5">
                                        <div className="text-[9px] text-muted-foreground uppercase mb-1">Trigger Class</div>
                                        <div className="text-xs font-mono font-bold">{selectedClip.class_name}</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">NLP Transcription</span>
                                    <div className="bg-foreground/5 p-4 rounded-lg border border-foreground/5 min-h-[100px]">
                                        <p className="text-sm italic text-foreground leading-relaxed">
                                            {selectedClip.transcription ? `"${selectedClip.transcription}"` : "Processing autonomous transcription..."}
                                        </p>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => playClip(selectedClip)}
                                    className="w-full bg-foreground text-background py-3 rounded-lg font-bold text-sm uppercase tracking-widest hover:bg-muted-foreground transition-all flex items-center justify-center gap-2"
                                >
                                    <Play size={16} /> Replay Intelligence Clip
                                </button>
                                
                                <button className="w-full border border-foreground/10 text-foreground py-2 rounded-lg text-xs uppercase tracking-widest hover:bg-foreground/5 transition-all flex items-center justify-center gap-2">
                                    <Download size={14} /> Download Evidence (.WAV)
                                </button>
                            </div>
                        ) : (
                            <div className="py-12 text-center space-y-3">
                                <Mic className="mx-auto text-muted-foreground/20" size={48} />
                                <p className="text-xs text-muted-foreground uppercase tracking-widest">Select an event to analyze</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4">
                        <Activity className="text-emerald-500" size={24} />
                        <div>
                            <div className="text-[10px] font-mono text-emerald-500 uppercase font-bold">Neural Engine Active</div>
                            <div className="text-[9px] text-emerald-500/70">Monitoring 24/7 for security acoustic signatures.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
