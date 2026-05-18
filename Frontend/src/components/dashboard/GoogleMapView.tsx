"use client";

import React, { useState, useEffect } from "react";
import {
    APIProvider,
    Map,
    AdvancedMarker,
    Pin,
    useMap,
} from "@vis.gl/react-google-maps";

interface GoogleMapViewProps {
    className?: string;
    center?: { lat: number; lng: number };
    zoom?: number;
    markers?: Array<{
        id: string;
        lng: number;
        lat: number;
        status: "active" | "degraded" | "offline";
        type: "agent" | "master";
        name: string;
        signalRadius?: number;
        onClick?: () => void;
    }>;
    showCoverage?: boolean;
    mapStyleType?: "default" | "satellite";
}

// Circle component to draw coverage on Google Maps
const CoverageCircle = ({ center, radius, color }: { center: { lat: number; lng: number }, radius: number, color: string }) => {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        const circle = new google.maps.Circle({
            map,
            center,
            radius,
            fillColor: color,
            fillOpacity: 0.15,
            strokeColor: color,
            strokeOpacity: 0.5,
            strokeWeight: 1,
            clickable: false,
        });

        return () => {
            circle.setMap(null);
        };
    }, [map, center, radius, color]);

    return null;
};

export function GoogleMapView({
    className,
    center = { lat: 6.5244, lng: 3.3792 },
    zoom = 16,
    markers = [],
    showCoverage = true,
    mapStyleType = "default"
}: GoogleMapViewProps) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

    if (!apiKey || apiKey.includes("YOUR_GOOGLE_MAPS_KEY")) {
        return (
            <div className={`flex flex-col items-center justify-center bg-surface/50 border border-foreground/10 rounded-lg p-8 ${className}`}>
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 text-amber-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <h3 className="text-lg font-display text-foreground mb-2">Google Maps Key Missing</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                    To use Google Maps, please add your API Key to the <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code> file.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            <APIProvider apiKey={apiKey}>
                <Map
                    className="w-full h-full"
                    defaultCenter={center}
                    defaultZoom={zoom}
                    mapId="bf51a910020faedc" // Use a dark mode map ID if available
                    mapTypeId={mapStyleType === "satellite" ? "satellite" : "roadmap"}
                    gestureHandling={'greedy'}
                    disableDefaultUI={true}
                >
                    {markers.map((marker) => {
                        const markerColor = marker.status === 'active' ? '#10b981' : marker.status === 'degraded' ? '#f59e0b' : '#6b7280';
                        
                        return (
                            <React.Fragment key={marker.id}>
                                <AdvancedMarker
                                    position={{ lat: marker.lat, lng: marker.lng }}
                                    onClick={marker.onClick}
                                >
                                    {marker.type === 'master' ? (
                                        <div className="flex flex-col items-center">
                                            <div style={{ width: 24, height: 24, backgroundColor: '#1a1a2e', border: `2px solid ${markerColor}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 10px ${markerColor}80` }}>
                                                <span style={{ color: '#e0e0e0', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' }}>M</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative" style={{ width: 14, height: 14 }}>
                                            {marker.status === 'active' && (
                                                <div className="absolute inset-[-4px] bg-emerald-500 rounded-full opacity-30 animate-ping" />
                                            )}
                                            <div className="absolute inset-0 bg-emerald-500 rounded-full border-[1.5px] border-[#1a1a2e]" />
                                        </div>
                                    )}
                                </AdvancedMarker>
                                
                                {showCoverage && marker.signalRadius && (
                                    <CoverageCircle 
                                        center={{ lat: marker.lat, lng: marker.lng }} 
                                        radius={marker.signalRadius} 
                                        color={markerColor} 
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </Map>
            </APIProvider>
        </div>
    );
}
