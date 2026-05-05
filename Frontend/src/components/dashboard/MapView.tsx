"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "next-themes";

interface MapViewProps {
    className?: string;
    center?: [number, number];
    zoom?: number;
    markers?: Array<{
        id: string;
        lng: number;
        lat: number;
        status: "active" | "degraded" | "offline";
        type: "agent" | "master";
        name: string;
        signalRadius?: number; // Represented in meters for coverage
        onClick?: () => void;
    }>;
    showCoverage?: boolean;
    mapStyleType?: "default" | "satellite";
}

// Function to generate circle polygon for coverage visualization
const createGeoJSONCircle = (center: [number, number], radiusInMeters: number, points = 64) => {
    const coords = {
        latitude: center[1],
        longitude: center[0]
    };

    const km = radiusInMeters / 1000;
    const ret = [];
    const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
    const distanceY = km / 110.574;

    let theta, x, y;
    for (let i = 0; i < points; i++) {
        theta = (i / points) * (2 * Math.PI);
        x = distanceX * Math.cos(theta);
        y = distanceY * Math.sin(theta);
        ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]); // close the polygon

    return {
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: [ret]
        }
    };
};

export function MapView({
    className,
    center = [3.3792, 6.5244], // Default to Lagos, Nigeria based on mock data
    zoom = 16,
    markers = [],
    showCoverage = true,
    mapStyleType = "default"
}: MapViewProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
    const { theme } = useTheme();
    const [mapLoaded, setMapLoaded] = useState(false);

    // Get token from env or provide empty fallback for error message
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    useEffect(() => {
        if (!mapContainer.current) return;
        if (!token) return;

        mapboxgl.accessToken = token;

        // Determine map style based on theme and mapStyleType prop
        let mapStyle = theme === "light"
            ? "mapbox://styles/mapbox/light-v11"
            : "mapbox://styles/mapbox/dark-v11";
            
        if (mapStyleType === "satellite") {
            mapStyle = "mapbox://styles/mapbox/satellite-streets-v12";
        }

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: mapStyle,
            center: center,
            zoom: zoom,
            pitch: 45,
            bearing: -17.6,
            antialias: true
        });

        map.current.on('load', () => {
            setMapLoaded(true);

            // Add 3D buildings layer
            if (!map.current) return;
            const layers = map.current.getStyle().layers;
            let labelLayerId;
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i] as mapboxgl.SymbolLayer;
                if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
                    labelLayerId = layer.id;
                    break;
                }
            }

            map.current.addLayer(
                {
                    'id': '3d-buildings',
                    'source': 'composite',
                    'source-layer': 'building',
                    'filter': ['==', 'extrude', 'true'],
                    'type': 'fill-extrusion',
                    'minzoom': 15,
                    'paint': {
                        'fill-extrusion-color': theme === 'light' ? '#aaa' : '#333',
                        'fill-extrusion-height': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            15,
                            0,
                            15.05,
                            ['get', 'height']
                        ],
                        'fill-extrusion-base': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            15,
                            0,
                            15.05,
                            ['get', 'min_height']
                        ],
                        'fill-extrusion-opacity': 0.6
                    }
                },
                labelLayerId
            );
        });

        // Clean up on unmount
        return () => {
            map.current?.remove();
        };
    }, [theme, token, mapStyleType]); // Re-initialize map if theme or style changes

    // Update markers and coverage when props change
    useEffect(() => {
        if (!map.current || !mapLoaded || !map.current.isStyleLoaded()) return;

        // Clear existing markers not in new array
        const currentMarkerIds = markers.map(m => m.id);
        Object.keys(markersRef.current).forEach(id => {
            if (!currentMarkerIds.includes(id)) {
                markersRef.current[id].remove();
                delete markersRef.current[id];
            }
        });

        // Process coverage sources
        let coverageFeatures: any[] = [];

        // Add or update markers
        markers.forEach(marker => {
            if (marker.signalRadius && showCoverage) {
                coverageFeatures.push(createGeoJSONCircle([marker.lng, marker.lat], marker.signalRadius));
            }

            const el = document.createElement('div');
            el.className = 'custom-marker';

            let bgColor = '#6b7280'; // offline
            if (marker.status === 'active') bgColor = '#10b981';
            if (marker.status === 'degraded') bgColor = '#f59e0b';

            if (marker.type === 'master') {
                el.innerHTML = `
                    <div style="width: 24px; height: 24px; background-color: #1a1a2e; border: 2px solid ${bgColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px ${bgColor}80;">
                        <span style="color: #e0e0e0; font-size: 10px; font-weight: bold; font-family: monospace;">M</span>
                    </div>
                `;
            } else {
                el.innerHTML = `
                    <div style="position: relative; width: 14px; height: 14px;">
                        ${marker.status === 'active' ? `<div style="position: absolute; inset: -4px; background-color: ${bgColor}; border-radius: 50%; opacity: 0.3; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
                        <div style="position: absolute; inset: 0; background-color: ${bgColor}; border-radius: 50%; border: 1.5px solid #1a1a2e;"></div>
                    </div>
                `;
            }

            el.style.cursor = 'pointer';
            if (marker.onClick) {
                el.addEventListener('click', marker.onClick);
            }

            if (!markersRef.current[marker.id]) {
                // Create new popup
                const popup = new mapboxgl.Popup({ offset: 15, closeButton: false, className: 'dark-popup' })
                    .setHTML(`
                        <div style="padding: 4px; font-family: monospace;">
                            <div style="font-size: 12px; font-weight: bold; color: #e0e0e0; margin-bottom: 2px;">${marker.name}</div>
                            <div style="font-size: 10px; color: #8b8b9e;">${marker.id}</div>
                            <div style="font-size: 10px; color: ${bgColor}; margin-top: 4px; text-transform: uppercase;">${marker.status}</div>
                        </div>
                    `);

                markersRef.current[marker.id] = new mapboxgl.Marker(el)
                    .setLngLat([marker.lng, marker.lat])
                    .setPopup(popup)
                    .addTo(map.current!);
            } else {
                // Update existing
                markersRef.current[marker.id].setLngLat([marker.lng, marker.lat]);
                // We'd ideally update DOM element here if status changed, but for simplicity we'll just let mapbox handle position
            }
        });

        // Update coverage layer
        if (map.current.getSource('coverage')) {
            (map.current.getSource('coverage') as mapboxgl.GeoJSONSource).setData({
                type: 'FeatureCollection',
                features: coverageFeatures
            });
        } else if (coverageFeatures.length > 0) {
            map.current.addSource('coverage', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: coverageFeatures
                }
            });

            // Fill layer for overlapping areas
            map.current.addLayer({
                id: 'coverage-fill',
                type: 'fill',
                source: 'coverage',
                paint: {
                    'fill-color': '#10b981',
                    'fill-opacity': 0.15,
                }
            });

            // Line layer for boundaries
            map.current.addLayer({
                id: 'coverage-line',
                type: 'line',
                source: 'coverage',
                paint: {
                    'line-color': '#10b981',
                    'line-width': 1,
                    'line-opacity': 0.5,
                    'line-dasharray': [2, 2]
                }
            });
        }

    }, [markers, mapLoaded, showCoverage]);

    if (!token) {
        return (
            <div className={`flex flex-col items-center justify-center bg-surface/50 border border-foreground/10 rounded-lg p-8 ${className}`}>
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 text-amber-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </div>
                <h3 className="text-lg font-display text-foreground mb-2">Mapbox Token Missing</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                    To view the interactive map, you need to provide a Mapbox public access token.
                    Set the <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code> environment variable.
                </p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full rounded-lg overflow-hidden border border-foreground/5">
            <div ref={mapContainer} className={`w-full h-full ${className}`} />

            {/* Inject minimal CSS for custom mapbox elements */}
            <style dangerouslySetInnerHTML={{__html: `
                .dark-popup .mapboxgl-popup-content {
                    background-color: #1a1a2e;
                    border: 1px solid rgba(224, 224, 224, 0.1);
                    border-radius: 6px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                    padding: 8px 12px;
                }
                .dark-popup .mapboxgl-popup-tip {
                    border-top-color: #1a1a2e;
                    border-bottom-color: #1a1a2e;
                }
            `}} />
        </div>
    );
}