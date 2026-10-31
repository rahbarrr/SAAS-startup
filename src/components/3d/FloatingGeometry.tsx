"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { COLORS } from "@/lib/design-system/tokens";

export interface FloatingGeometryProps {
  position?: [number, number, number];
  rotationSpeed?: number;
  shape?: "icosahedron" | "torus" | "octahedron" | "sphere";
  color?: string;
  wireframe?: boolean;
  scale?: number;
}

export function FloatingGeometry({
  position = [0, 0, 0],
  rotationSpeed = 0.5,
  shape = "icosahedron",
  color = COLORS.brand.royal,
  wireframe = false,
  scale = 1,
}: FloatingGeometryProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * rotationSpeed * 0.4;
      meshRef.current.rotation.y += delta * rotationSpeed * 0.6;
    }
  });

  const renderGeometry = () => {
    switch (shape) {
      case "torus":
        return <torusGeometry args={[1, 0.35, 16, 32]} />;
      case "octahedron":
        return <octahedronGeometry args={[1.2, 0]} />;
      case "sphere":
        return <sphereGeometry args={[1, 32, 32]} />;
      case "icosahedron":
      default:
        return <icosahedronGeometry args={[1.2, 0]} />;
    }
  };

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      {renderGeometry()}
      <meshStandardMaterial
        color={color}
        wireframe={wireframe}
        roughness={0.2}
        metalness={0.8}
      />
    </mesh>
  );
}
