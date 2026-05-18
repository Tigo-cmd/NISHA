"use client";

import React, { useEffect, useRef, useState } from "react";
import AgoraRTC, { IRemoteVideoTrack, IRemoteAudioTrack, IAgoraRTCClient } from "agora-rtc-sdk-ng";
import { apiService } from "@/services/apiService";
import { websocketService } from "@/services/websocketService";
import { WebSocketMessageType } from "@/types";
import { WaveformVisualizer } from "./WaveformVisualizer";

interface AgoraVideoPlayerProps {
    channelName: string;
    agentId: string;
    masterUrl?: string;
}

export const AgoraVideoPlayer: React.FC<AgoraVideoPlayerProps> = ({ channelName, agentId, masterUrl }) => {
    const client = useRef<IAgoraRTCClient | null>(null);
    const [videoTrack, setVideoTrack] = useState<IRemoteVideoTrack | null>(null);
    const [audioTrack, setAudioTrack] = useState<IRemoteAudioTrack | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<string>("Initializing...");
    const [volume, setVolume] = useState(100);
    const [isPaused, setIsPaused] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [activeThreats, setActiveThreats] = useState<any[]>([]);

    useEffect(() => {
        if (!channelName) return;
        let isMounted = true;

        const init = async () => {
            try {
                setStatus("Fetching token...");
                const data = await apiService.getAgoraToken(channelName, masterUrl);
                if (!isMounted) return;

                if (data.error) {
                    setStatus(`Token Error: ${data.error}`);
                    return;
                }

                client.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

                client.current.on("user-published", async (user, mediaType) => {
                    if (!isMounted) return;
                    if (client.current?.connectionState === "CONNECTED") {
                        try {
                            await client.current.subscribe(user, mediaType);
                            if (!isMounted) return;
                            if (mediaType === "video") setVideoTrack(user.videoTrack || null);
                            if (mediaType === "audio") {
                                const track = user.audioTrack || null;
                                if (track && !isMuted) track.play();
                                setAudioTrack(track);
                            }
                        } catch (e) {}
                    }
                });

                client.current.on("user-unpublished", (user) => {
                    setVideoTrack(null);
                    setAudioTrack(null);
                });

                client.current.on("connection-state-change", (curState) => {
                    if (curState === "CONNECTED" && isMounted) {
                        client.current?.remoteUsers.forEach(async (user) => {
                            try {
                                await client.current?.subscribe(user, user.hasVideo ? "video" : "audio");
                                if (!isMounted) return;
                                if (user.hasVideo) setVideoTrack(user.videoTrack || null);
                                if (user.hasAudio) {
                                    const track = user.audioTrack || null;
                                    if (track && !isMuted) track.play();
                                    setAudioTrack(track);
                                }
                            } catch (e) {}
                        });
                    }
                });

                await client.current.join(data.appId, channelName, data.token, null);
                if (!isMounted) {
                    client.current.leave();
                    return;
                }
                setStatus("Live Feed Active");
            } catch (error) {
                if (isMounted) {
                    console.error("[Agora] Setup failed:", error);
                    setStatus("Connection Failed");
                }
            }
        };

        init();

        return () => {
            isMounted = false;
            client.current?.leave();
            client.current?.removeAllListeners();
            videoTrack?.stop();
            audioTrack?.stop();
        };
    }, [channelName]);

    useEffect(() => {
        if (videoTrack && containerRef.current) {
            if (isPaused) {
                videoTrack.stop();
            } else {
                videoTrack.play(containerRef.current);
            }
        }
    }, [videoTrack, isPaused]);

    useEffect(() => {
        if (audioTrack) {
            if (isMuted || isPaused) {
                audioTrack.stop();
            } else {
                audioTrack.play();
                audioTrack.setVolume(volume);
            }
        }
    }, [isMuted, isPaused, audioTrack, volume]);

    useEffect(() => {
        if (!websocketService) return;

        const unsubscribe = websocketService.subscribe(
            WebSocketMessageType.WEAPON_THREAT_EVENT, 
            (data: any) => {
                if (data.agent_id === agentId && data.weapons && data.weapons.length > 0) {
                    setActiveThreats(data.weapons);
                    // Clear threats after 2 seconds if no new detection comes in
                    setTimeout(() => setActiveThreats([]), 2000);
                }
            }
        );

        return () => unsubscribe();
    }, [agentId]);

    useEffect(() => {
        if (!audioTrack || isMuted || isPaused) {
            setAudioLevel(0);
            return;
        }

        const interval = setInterval(() => {
            setAudioLevel(audioTrack.getVolumeLevel() * 100);
        }, 100);

        return () => clearInterval(interval);
    }, [audioTrack, isMuted, isPaused]);

    const [stats, setStats] = useState({ latency: 0, bitrate: 0 });

    useEffect(() => {
        if (!client.current) return;
        
        const interval = setInterval(() => {
            if (client.current?.connectionState === "CONNECTED") {
                const rtcStats = client.current.getRTCStats();
                setStats({
                    latency: rtcStats.Duration || 0, // Mocking latency with Duration for now as Agora Web SDK 4.x stats vary
                    bitrate: Math.round((rtcStats.RecvBitrate || 0) / 1024)
                });
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [client.current]);

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    const togglePause = () => {
        setIsPaused(!isPaused);
    };

    return (
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-foreground/10 group">
            <div ref={containerRef} className="w-full h-full" />
            
            {/* AI Threat Overlays */}
            {activeThreats.map((threat, index) => {
                // YOLO boxes are often normalized or absolute depending on the stream
                // For Agora, we assume the AI is processing at 320x240 or 640x480
                // We map these to percentage for CSS placement
                const box = threat.box;
                if (!box) return null;
                
                const left = (box[0] / 320) * 100;
                const top = (box[1] / 240) * 100;
                const width = ((box[2] - box[0]) / 320) * 100;
                const height = ((box[3] - box[1]) / 240) * 100;

                return (
                    <div 
                        key={index}
                        className="absolute border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] pointer-events-none z-20"
                        style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                            transition: 'all 0.1s ease-out'
                        }}
                    >
                        <div className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 whitespace-nowrap rounded-t">
                            {threat.class.toUpperCase()} {(threat.confidence * 100).toFixed(0)}%
                        </div>
                    </div>
                );
            })}
            
            {/* Overlay */}
            <div className="absolute top-4 inset-x-4 flex items-start justify-between pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                    <div className={`w-2 h-2 rounded-full ${videoTrack ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className="text-[10px] font-mono text-white uppercase tracking-widest bg-black/50 px-2 py-1 rounded">
                        {videoTrack ? 'LIVE' : 'OFFLINE'}
                    </span>
                    <span className="text-[10px] font-mono text-white/70 uppercase tracking-widest bg-black/50 px-2 py-1 rounded">
                        {agentId}
                    </span>
                </div>

                <div className="flex flex-col items-end gap-1 pointer-events-auto">
                    {client.current?.connectionState === "CONNECTED" && (
                        <>
                            <div className="flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded">
                                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                <span className="text-[9px] font-mono text-white/70 uppercase">Stable Link</span>
                            </div>
                            <div className="text-[8px] font-mono text-white/40 uppercase bg-black/30 px-1.5 py-0.5 rounded">
                                {stats.bitrate} KBPS
                            </div>
                        </>
                    )}
                </div>
            </div>

            {!videoTrack && audioTrack && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/50 backdrop-blur-sm p-8">
                    <div className="w-full max-w-md text-center">
                        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full mb-6">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">Listen Mode Active</span>
                        </div>
                        <WaveformVisualizer 
                            color="#10b981" 
                            height={80} 
                            isLive={!isPaused} 
                            level={audioLevel} 
                        />
                        <p className="mt-6 text-[9px] font-mono text-white/30 uppercase tracking-[0.3em]">
                            Broadcasting Audio Intelligence Only
                        </p>
                    </div>
                </div>
            )}

            {!videoTrack && !audioTrack && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-surface/50 backdrop-blur-sm">
                    <p className="text-xs font-mono uppercase tracking-[0.2em]">{status}</p>
                </div>
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between px-4">
                <div className="text-[9px] font-mono text-white/50 uppercase">
                    Agora Professional Stream
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={togglePause}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title={isPaused ? "Play" : "Pause"}
                    >
                        {isPaused ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                        )}
                    </button>

                    {!isMuted && (
                        <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-full border border-white/10 group/vol">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={volume} 
                                onChange={(e) => setVolume(parseInt(e.target.value))}
                                className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                            />
                        </div>
                    )}
                    <button 
                        onClick={toggleMute}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
