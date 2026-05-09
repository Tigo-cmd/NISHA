"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Play, Pause, AlertTriangle, Camera, Layers } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { apiService } from '@/services/apiService';
import { websocketService } from '@/services/websocketService';
import { WebSocketMessageType } from '@/types';
import dynamic from 'next/dynamic';

const AgoraVideoPlayer = dynamic(() => import('./AgoraVideoPlayer').then(mod => mod.AgoraVideoPlayer), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-black/50 animate-pulse flex items-center justify-center text-[10px] font-mono text-white/30 uppercase tracking-widest">Loading Stream...</div>
});

interface VideoAnalysis {
  label: string;
  confidence: number;
  timestamp: number;
}

interface VideoStreamProps {
  title: string;
  nodeId: string;
}

export const VideoStream: React.FC<VideoStreamProps> = ({
  title,
  nodeId
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentClip, setCurrentClip] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Update image directly from WebSocket events
  useEffect(() => {
    if (!isStreaming) return;

    const unsub = websocketService.subscribe(WebSocketMessageType.NEW_CLIP, async (data: any) => {
      // Only care about video frames for this specific agent
      if (data.media_type === 'video' && data.agent_id === nodeId) {
        try {
          const result = await apiService.getAgentMedia(nodeId, 'video');
          if (result && result.base64) {
            const dataUrl = `data:image/jpeg;base64,${result.base64}`;
            setCurrentClip(dataUrl);
          }
        } catch (error) {
          console.error("Failed to fetch new video frame", error);
        }
      }
    });

    // Initial fetch to get the very last frame immediately
    const fetchInitial = async () => {
      try {
        const result = await apiService.getAgentMedia(nodeId, 'video');
        if (result && result.base64) {
          setCurrentClip(`data:image/jpeg;base64,${result.base64}`);
        }
      } catch (e) {}
    };
    fetchInitial();

    return () => unsub();
  }, [isStreaming, nodeId]);

  const startStream = async () => {
    try {
      await apiService.sendAgentCommand(nodeId, "START_STREAM");
      setIsStreaming(true);
    } catch (error) {
      console.error("Failed to start stream command", error);
      setIsStreaming(true);
    }
  };

  const stopStream = async () => {
    try {
      await apiService.sendAgentCommand(nodeId, "STOP_STREAM");
    } catch (error) {
      console.error("Failed to stop stream command", error);
    }
    setIsStreaming(false);
    setCurrentClip(null);
  };

  const { masters } = useStore();
  const master = masters.find(m => nodeId.startsWith(m.id) || m.id === 'm01');
  const masterUrl = master?.ip ? (master.ip.startsWith('http') ? master.ip : `https://${master.ip}`) : undefined;

  return (
    <Card className="w-full max-w-full shadow-xl border border-foreground/5 bg-surface/70 rounded-xl overflow-hidden">
      <CardHeader className="bg-surface border-b border-foreground/5 p-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-foreground/5 rounded-md">
              <Camera className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <div className="text-sm font-display text-foreground uppercase tracking-widest">{title}</div>
              <div className="text-[10px] font-mono text-muted-foreground">{nodeId}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <Badge variant="outline" className="animate-pulse bg-red-500/10 text-red-500 border-red-500/20">
                LIVE
              </Badge>
            )}
            <Badge variant={isStreaming ? "success" : "secondary"}>
              {isStreaming ? "CONNECTED" : "IDLE"}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-foreground/10 flex items-center justify-center shadow-inner">
          {isStreaming ? (
            <AgoraVideoPlayer 
                channelName={`nisha_stream_${nodeId}`} 
                agentId={nodeId} 
                masterUrl={masterUrl}
            />
          ) : (
            <div className="text-center text-muted-foreground">
              <Camera className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs font-mono uppercase tracking-widest">
                STREAM OFFLINE
              </p>
            </div>
          )}
        </div>

        <Button
          variant={isStreaming ? "destructive" : "default"}
          onClick={isStreaming ? stopStream : startStream}
          className="w-full font-mono text-xs uppercase tracking-widest transition-all"
        >
          {isStreaming ? (
            <>
              <Pause className="w-4 h-4 mr-2" />
              Stop Feed
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Initialize Link
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default VideoStream;
