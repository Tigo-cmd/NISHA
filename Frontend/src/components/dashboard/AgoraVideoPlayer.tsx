"use client";

import React, { useEffect, useRef, useState } from "react";
import AgoraRTC, { IRemoteVideoTrack, IRemoteAudioTrack, IAgoraRTCClient } from "agora-rtc-sdk-ng";
import { apiService } from "@/services/apiService";

interface AgoraVideoPlayerProps {
    channelName: string;
    agentId: string;
}

export const AgoraVideoPlayer: React.FC<AgoraVideoPlayerProps> = ({ channelName, agentId }) => {
    const client = useRef<IAgoraRTCClient | null>(null);
    const [videoTrack, setVideoTrack] = useState<IRemoteVideoTrack | null>(null);
    const [audioTrack, setAudioTrack] = useState<IRemoteAudioTrack | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<string>("Initializing...");

    useEffect(() => {
        if (!channelName) return;

        const init = async () => {
            try {
                setStatus("Fetching token...");
                const data = await apiService.getAgoraToken(channelName);

                if (data.error) {
                    setStatus(`Token Error: ${data.error}`);
                    return;
                }

                client.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

                client.current.on("user-published", async (user, mediaType) => {
                    await client.current?.subscribe(user, mediaType);
                    if (mediaType === "video") {
                        setVideoTrack(user.videoTrack || null);
                    }
                    if (mediaType === "audio") {
                        user.audioTrack?.play();
                        setAudioTrack(user.audioTrack || null);
                    }
                });

                client.current.on("user-unpublished", (user) => {
                    if (user.uid === 0) { // Assuming agent uid is 0 or we handle logic
                        setVideoTrack(null);
                        setAudioTrack(null);
                    }
                });

                await client.current.join(data.appId, channelName, data.token, null);
                setStatus("Live Feed Active");
                console.log(`[Agora] Joined channel: ${channelName}`);
            } catch (error) {
                console.error("[Agora] Setup failed:", error);
                setStatus("Connection Failed");
            }
        };

        init();

        return () => {
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

            {/* Bottom Controls Placeholder */}
            <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center px-4">
                <div className="text-[9px] font-mono text-white/50 uppercase">
                    Agora Professional Stream
                </div>
            </div>
        </div>
    );
};
