"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import { useEffect, useState, type ReactNode } from "react";

export interface WebGLCanvasProps extends Omit<CanvasProps, "children"> {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}

function isWebGLSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Enterprise WebGL Canvas wrapper for React Three Fiber.
 * Detects WebGL capability, prevents SSR execution, catches errors, and renders graceful fallbacks.
 */
export function WebGLCanvas({
  children,
  fallback,
  className,
  camera = { position: [0, 0, 5], fov: 45 },
  dpr = [1, 1.5],
  ...props
}: WebGLCanvasProps) {
  const [mounted, setMounted] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    setMounted(true);
    setHasWebGL(isWebGLSupported());
  }, []);

  const defaultFallback = (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle, rgba(56, 217, 214, 0.08) 0%, rgba(41, 63, 145, 0.04) 100%)",
        borderRadius: "var(--radius-lg, 0.875rem)",
      }}
      aria-label="3D visual scene (rendering static fallback)"
    />
  );

  if (!mounted || !hasWebGL) {
    return fallback ?? defaultFallback;
  }

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <Canvas
        camera={camera}
        dpr={dpr}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        {...props}
      >
        {children}
      </Canvas>
    </div>
  );
}
