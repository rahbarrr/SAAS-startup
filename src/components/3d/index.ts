import dynamic from "next/dynamic";

export { WebGLCanvas, type WebGLCanvasProps } from "./WebGLCanvas";
export { FloatingGeometry, type FloatingGeometryProps } from "./FloatingGeometry";
export {
  InteractiveBackground,
  type InteractiveBackgroundProps,
} from "./InteractiveBackground";
export { FloatingBrandElements } from "./FloatingBrandElements";
export { ThreeDHeroScene, type ThreeDHeroSceneProps } from "./ThreeDHeroScene";
export { ThreeDVisualCard, type ThreeDVisualCardProps } from "./ThreeDVisualCard";

/**
 * SSR-safe dynamic exports. Use these for client-side mounting in Next.js Server Components.
 */
export const DynamicThreeDHeroScene = dynamic(
  () => import("./ThreeDHeroScene").then((m) => m.ThreeDHeroScene),
  { ssr: false }
);

export const DynamicThreeDVisualCard = dynamic(
  () => import("./ThreeDVisualCard").then((m) => m.ThreeDVisualCard),
  { ssr: false }
);
