"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial, Float } from "@react-three/drei";
import * as THREE from "three";

function Nodes({ count = 200 }) {
    const points = useMemo(() => {
        const p = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            p[i * 3] = (Math.random() - 0.5) * 15;
            p[i * 3 + 1] = (Math.random() - 0.5) * 15;
            p[i * 3 + 2] = (Math.random() - 0.5) * 15;
        }
        return p;
    }, [count]);

    const ref = useRef<THREE.Points>(null);

    useFrame((state) => {
        if (!ref.current) return;
        ref.current.rotation.x = state.mouse.y * 0.05;
        ref.current.rotation.y = state.mouse.x * 0.05;
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={points} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color="#00f0ff"
                    size={0.05}
                    sizeAttenuation={true}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </Points>
        </group>
    );
}

function Connections({ count = 50 }) {
    const lines = useMemo(() => {
        const lineGeometries = [];
        for (let i = 0; i < count; i++) {
            const start = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
            const end = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
            lineGeometries.push({ start, end });
        }
        return lineGeometries;
    }, [count]);

    return (
        <group>
            {lines.map((line, i) => (
                <LineItem key={i} start={line.start} end={line.end} />
            ))}
        </group>
    );
}

function LineItem({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
    const ref = useRef<THREE.LineSegments>(null);

    useFrame((state) => {
        if (!ref.current) return;
        const material = ref.current.material as THREE.LineBasicMaterial;
        material.opacity = 0.1 + Math.sin(state.clock.elapsedTime * 2 + start.x) * 0.1;
    });

    const geometry = useMemo(() => {
        const g = new THREE.BufferGeometry().setFromPoints([start, end]);
        return g;
    }, [start, end]);

    return (
        <lineSegments ref={ref} geometry={geometry}>
            <lineBasicMaterial color="#00f0ff" transparent opacity={0.2} />
        </lineSegments>
    );
}

export const MeshBackground = () => {
    return (
        <div className="absolute inset-0 -z-10 bg-background">
            <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
                <color attach="background" args={["#0a0a0f"]} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#00f0ff" />

                <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
                    <Nodes count={300} />
                    <Connections count={40} />
                </Float>

                {/* Subtle grid or sphere in center */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <icosahedronGeometry args={[4, 1]} />
                    <meshBasicMaterial color="#bd00ff" wireframe transparent opacity={0.05} />
                </mesh>
            </Canvas>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
        </div>
    );
};
