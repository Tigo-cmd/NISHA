"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Circle, Line, Text, Group } from 'react-konva';
import { Card } from '@/components/ui/card';

interface SensorNode {
  id: number;
  x: number;
  y: number;
  motion: boolean;
  sound: boolean;
  audioLevel: number;
}

interface TracePoint {
  x: number;
  y: number;
}

interface Node3D {
  id: number;
  x: number;
  y: number;
  z: number;
  label: string;
}

interface SensorNetworkProps {
  sensors?: SensorNode[];
  source?: { x: number; y: number };
  trace?: TracePoint[];
  nodes3D?: Node3D[];
}

const mockSensors: SensorNode[] = [
  { id: 1, x: -2, y: 2, motion: false, sound: true, audioLevel: 450 },
  { id: 2, x: 2, y: 2, motion: true, sound: false, audioLevel: 200 },
  { id: 3, x: -2, y: -2, motion: false, sound: false, audioLevel: 100 },
  { id: 4, x: 2, y: -2, motion: true, sound: true, audioLevel: 600 },
  { id: 5, x: 0, y: 0, motion: false, sound: true, audioLevel: 350 },
  { id: 6, x: -1, y: 1, motion: true, sound: false, audioLevel: 250 }
];

// Generate random 3D nodes
const generateRandom3DNodes = (): Node3D[] => {
  return [
    {
      id: 1,
      x: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
      y: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
      z: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
      label: 'Node-1'
    },
    {
      id: 2,
      x: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
      y: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
      z: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
      label: 'Node-2'
    },
    {
      id: 3,
      x: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
      y: parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
      z: parseFloat((Math.random() * 2 + 0.5).toFixed(2)),
      label: 'Node-3'
    }
  ];
};

// Mock 3D nodes with random distances
const mock3DNodes: Node3D[] = generateRandom3DNodes();

// Calculate center of the triangle formed by the 3D nodes
const calculateTriangleCenter = () => {
  const node1 = mock3DNodes[0];
  const node2 = mock3DNodes[1];
  const node3 = mock3DNodes[2];
  return {
    x: (node1.x + node2.x + node3.x) / 3,
    y: (node1.y + node2.y + node3.y) / 3
  };
};

const mockSource = calculateTriangleCenter();

const mockTrace: TracePoint[] = [
  { x: -2, y: 2 },
  { x: -1, y: 1.5 },
  { x: 0, y: 1 },
  { x: 1, y: 0.5 },
  { x: 2, y: -0.5 },
  { x: 1.5, y: -1.5 }
];

export const TacticalOverlay: React.FC<SensorNetworkProps> = ({
  sensors = mockSensors,
  source = mockSource,
  trace = mockTrace,
  nodes3D = mock3DNodes
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(80);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Measure container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Convert world coords to screen
  const toScreen = (p: { x: number; y: number }) => ({
    x: offset.x + size.width / 2 + p.x * scale,
    y: offset.y + size.height / 2 - p.y * scale
  });

  // Zoom
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const factor = e.evt.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.min(Math.max(s * factor, 20), 200));
  };

  const nodesToRender = sensors;

  return (
    <Card className="glass-panel h-full w-full">
      <div
        ref={containerRef}
        className="relative w-full h-full cursor-grab"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {size.width > 0 && size.height > 0 && (
          <Stage
            ref={stageRef}
            width={size.width}
            height={size.height}
            draggable
            onDragStart={() => setIsDragging(true)}
            onDragEnd={e => {
              setIsDragging(false);
              setOffset({ x: e.target.x(), y: e.target.y() });
            }}
            onWheel={handleWheel}
          >
            <Layer>
              {/* Grid */}
              {Array.from({ length: Math.ceil(size.width / scale) + 2 }).map((_, i) => (
                <Line
                  key={`v${i}`}
                  points={[i * scale + (offset.x % scale), 0, i * scale + (offset.x % scale), size.height]}
                  stroke="#ddd"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: Math.ceil(size.height / scale) + 2 }).map((_, i) => (
                <Line
                  key={`h${i}`}
                  points={[0, i * scale + (offset.y % scale), size.width, i * scale + (offset.y % scale)]}
                  stroke="#ddd"
                  strokeWidth={1}
                />
              ))}

              {/* Connections */}
              {nodesToRender.map((a, ai) =>
                nodesToRender.slice(ai + 1).map((b, bi) => {
                  const pa = toScreen(a);
                  const pb = toScreen(b);
                  const dist = Math.hypot(b.x - a.x, b.y - a.y).toFixed(1);
                  return (
                    <Group key={`${ai}-${bi}`}>
                      <Line
                        points={[pa.x, pa.y, pb.x, pb.y]}
                        stroke="#477fa0"
                        strokeWidth={2}
                      />
                      <Text
                        x={(pa.x + pb.x) / 2 + 5}
                        y={(pa.y + pb.y) / 2 - 10}
                        text={`${dist}m`}
                        fontSize={12}
                        fill="#333"
                      />
                    </Group>
                  );
                })
              )}

              {/* Trace */}
              {trace.length > 1 && (
                <Line
                  points={trace.flatMap(p => {
                    const sp = toScreen(p);
                    return [sp.x, sp.y];
                  })}
                  stroke="rgba(255,100,100,0.5)"
                  strokeWidth={3}
                />
              )}

              {/* Source */}
              {source && (
                <Circle
                  x={toScreen(source).x}
                  y={toScreen(source).y}
                  radius={10}
                  fill="red"
                />
              )}

              {/* 3D Nodes Connections */}
              {nodes3D.map((a, ai) =>
                nodes3D.slice(ai + 1).map((b, bi) => {
                  const pa = toScreen(a);
                  const pb = toScreen(b);
                  // Calculate 3D distance including z-axis
                  const dist3D = Math.sqrt(
                    Math.pow(b.x - a.x, 2) +
                    Math.pow(b.y - a.y, 2) +
                    Math.pow(b.z - a.z, 2)
                  ).toFixed(2);
                  return (
                    <Group key={`3d-conn-${ai}-${bi}`}>
                      <Line
                        points={[pa.x, pa.y, pb.x, pb.y]}
                        stroke="#ff8c00"
                        strokeWidth={3}
                      />
                      <Text
                        x={(pa.x + pb.x) / 2 + 5}
                        y={(pa.y + pb.y) / 2 + 15}
                        text={`${dist3D}m`}
                        fontSize={13}
                        fill="#ff8c00"
                        fontStyle="bold"
                      />
                    </Group>
                  );
                })
              )}

              {/* 3D Nodes */}
              {nodes3D.map(node => {
                const p = toScreen(node);
                return (
                  <Group key={`3d-node-${node.id}`}>
                    <Circle
                      x={p.x}
                      y={p.y}
                      radius={10}
                      fill="#ff8c00"
                      stroke="#333"
                      strokeWidth={2}
                    />
                    <Text
                      x={p.x - 8}
                      y={p.y - 25}
                      text={node.label}
                      fontSize={12}
                      fill="#ff8c00"
                      fontStyle="bold"
                    />
                    <Text
                      x={p.x - 20}
                      y={p.y + 20}
                      text={`X:${node.x} Y:${node.y} Z:${node.z}`}
                      fontSize={10}
                      fill="#666"
                    />
                  </Group>
                );
              })}

              {/* Nodes */}
              {nodesToRender.map(node => {
                const p = toScreen(node);
                const active = node.motion || node.sound || node.audioLevel > 300;
                return (
                  <Group key={node.id}>
                    <Circle
                      x={p.x}
                      y={p.y}
                      radius={12}
                      fill={active ? 'green' : 'gray'}
                    />
                    <Text
                      x={p.x + 15}
                      y={p.y - 10}
                      text={['A', 'B', 'C', 'D', 'E', 'F'][node.id - 1] || ''}
                      fontSize={14}
                      fill="#000"
                    />
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        )}
      </div>
    </Card>
  );
};

export default TacticalOverlay;
