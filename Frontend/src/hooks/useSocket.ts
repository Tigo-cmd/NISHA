"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useStore } from "@/store/useStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8000";

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);
    const { addAlert, updateAgent, setSystemHealth } = useStore();

    useEffect(() => {
        // Initialize socket connection
        const socket = io(SOCKET_URL, {
            transports: ["websocket"],
            reconnectionAttempts: 5,
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Connected to NISHA Hub");
            setSystemHealth(true);
        });

        socket.on("disconnect", () => {
            console.log("Disconnected from NISHA Hub");
            setSystemHealth(false);
        });

        // Listen for new audio alerts
        socket.on("audio_alert", (data) => {
            addAlert({
                id: data.id,
                type: "AUDIO",
                severity: data.priority.toLowerCase(),
                description: `${data.class_name} detected at ${data.location_zone}`,
                timestamp: data.timestamp,
                agentId: data.agent_id,
                acknowledged: false,
            });
        });

        // Listen for agent status updates
        socket.on("agent_status", (data) => {
            updateAgent(data.agent_id, {
                status: data.status.toLowerCase(),
                lastSeen: new Date().toISOString(),
            });
        });

        return () => {
            socket.disconnect();
        };
    }, [addAlert, updateAgent, setSystemHealth]);

    return socketRef.current;
};
