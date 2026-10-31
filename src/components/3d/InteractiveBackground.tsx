"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS } from "@/lib/design-system/tokens";

export interface InteractiveBackgroundProps {
  count?: number;
  color?: string;
}

export function InteractiveBackground({
  count = 45,
  color = COLORS.brand.cyan,
}: InteractiveBackgroundProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() - 0.5) * 10;
      positions[idx + 1] = (Math.random() - 0.5) * 8;
      positions[idx + 2] = (Math.random() - 0.5) * 5;
    }
    return positions;
  }, [count]);

  useFrame(({ pointer }, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.05;
      pointsRef.current.rotation.x = pointer.y * 0.1;
      pointsRef.current.rotation.z = pointer.x * 0.05;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[particles, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color={color}
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
