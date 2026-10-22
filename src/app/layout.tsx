import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "FieldTrack — Multi-Tenant Field Operations",
  description:
    "Plan field trips, manage approvals, record store visits, capture evidence, and review outcomes.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FieldTrack",
  },
  icons: {
    apple: "/icons/icon-192.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
