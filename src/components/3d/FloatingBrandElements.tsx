"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { COLORS } from "@/lib/design-system/tokens";

export function FloatingBrandElements() {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 1.2) * 0.15;
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central Brand Core */}
      <mesh>
        <octahedronGeometry args={[1.1, 1]} />
        <meshPhysicalMaterial
          color={COLORS.brand.royal}
          emissive={COLORS.brand.violet}
          emissiveIntensity={0.2}
          roughness={0.15}
          metalness={0.85}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Orbiting Cyan Ring */}
      <mesh rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[1.7, 0.04, 16, 64]} />
        <meshStandardMaterial
          color={COLORS.brand.cyan}
          emissive={COLORS.brand.cyan}
          emissiveIntensity={0.6}
          roughness={0.2}
        />
      </mesh>

      {/* Outer Violet Accent Ring */}
      <mesh rotation={[-Math.PI / 4, Math.PI / 6, 0]}>
        <torusGeometry args={[2.1, 0.03, 16, 64]} />
        <meshStandardMaterial
          color={COLORS.brand.violet}
          emissive={COLORS.brand.violet}
          emissiveIntensity={0.4}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}
