"use client";

import { Suspense } from "react";
import { COLORS } from "@/lib/design-system/tokens";
import { FloatingBrandElements } from "./FloatingBrandElements";
import { InteractiveBackground } from "./InteractiveBackground";
import { WebGLCanvas } from "./WebGLCanvas";

export interface ThreeDHeroSceneProps {
  className?: string;
  enableBackgroundParticles?: boolean;
}

export function ThreeDHeroScene({
  className,
  enableBackgroundParticles = true,
}: ThreeDHeroSceneProps) {
  return (
    <WebGLCanvas
      className={className}
      camera={{ position: [0, 0, 5], fov: 42 }}
      fallback={
        <div
          className={className}
          style={{
            width: "100%",
            height: "100%",
            minHeight: "20rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(circle, rgba(136, 117, 247, 0.12) 0%, rgba(41, 63, 145, 0.05) 70%, transparent 100%)",
            borderRadius: "var(--radius-xl, 1.125rem)",
          }}
        >
          <div
            style={{
              width: "6rem",
              height: "6rem",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #293F91 0%, #8875F7 100%)",
              boxShadow: "0 0 32px rgba(56, 217, 214, 0.35)",
            }}
          />
        </div>
      }
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} color="#ffffff" />
      <directionalLight
        position={[-5, -5, -2]}
        intensity={0.5}
        color={COLORS.brand.violet}
      />
      <pointLight
        position={[0, 0, 2]}
        intensity={1}
        color={COLORS.brand.cyan}
        distance={8}
      />

      <Suspense fallback={null}>
        <FloatingBrandElements />
        {enableBackgroundParticles ? <InteractiveBackground count={50} /> : null}
      </Suspense>
    </WebGLCanvas>
  );
}
