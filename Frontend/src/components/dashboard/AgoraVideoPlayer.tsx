"use client";

import React, { useEffect, useRef, useState } from "react";
import AgoraRTC, { IRemoteVideoTrack, IRemoteAudioTrack, IAgoraRTCClient } from "agora-rtc-sdk-ng";
import { apiService } from "@/services/apiService";

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
            videoTrack.play(containerRef.current);
        }
    }, [videoTrack]);

    useEffect(() => {
        if (audioTrack) {
            if (isMuted) {
                audioTrack.stop();
            } else {
                audioTrack.play();
                audioTrack.setVolume(volume);
            }
        }
    }, [isMuted, audioTrack, volume]);

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    return (
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-foreground/10 group">
            <div ref={containerRef} className="w-full h-full" />
            
            {/* Overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${videoTrack ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[10px] font-mono text-white uppercase tracking-widest bg-black/50 px-2 py-1 rounded">
                    {videoTrack ? 'LIVE' : 'OFFLINE'}
                </span>
                <span className="text-[10px] font-mono text-white/70 uppercase tracking-widest bg-black/50 px-2 py-1 rounded">
                    {agentId}
                </span>
            </div>

            {!videoTrack && (
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
