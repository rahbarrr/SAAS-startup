"use client";

import { Suspense, type ReactNode } from "react";
import { COLORS } from "@/lib/design-system/tokens";
import { FloatingGeometry, type FloatingGeometryProps } from "./FloatingGeometry";
import { WebGLCanvas } from "./WebGLCanvas";

export interface ThreeDVisualCardProps {
  title: string;
  subtitle?: string;
  shape?: FloatingGeometryProps["shape"];
  shapeFillColor?: string;
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function ThreeDVisualCard({
  title,
  subtitle,
  shape = "icosahedron",
  shapeFillColor = COLORS.brand.royal,
  badge,
  children,
  className,
}: ThreeDVisualCardProps) {
  return (
    <article
      className={className ?? "card"}
      style={{
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 3D Header Canvas */}
      <div style={{ height: "7.5rem", width: "100%", position: "relative" }}>
        <WebGLCanvas
          camera={{ position: [0, 0, 3], fov: 45 }}
          fallback={
            <div
              style={{
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(135deg, rgba(41, 63, 145, 0.08) 0%, rgba(136, 117, 247, 0.08) 100%)",
              }}
            />
          }
        >
          <ambientLight intensity={1} />
          <directionalLight position={[3, 3, 3]} intensity={1.5} />
          <Suspense fallback={null}>
            <FloatingGeometry
              shape={shape}
              color={shapeFillColor}
              rotationSpeed={0.8}
              scale={0.9}
            />
          </Suspense>
        </WebGLCanvas>

        {badge ? (
          <div
            style={{ position: "absolute", top: "0.75rem", right: "0.75rem", zIndex: 1 }}
          >
            {badge}
          </div>
        ) : null}
      </div>

      <div
        style={{
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
        }}
      >
        <h3 className="card-title" style={{ fontSize: "1rem" }}>
          {title}
        </h3>
        {subtitle ? (
          <p className="card-meta" style={{ fontSize: "0.8125rem" }}>
            {subtitle}
          </p>
        ) : null}
        {children}
      </div>
    </article>
  );
}
