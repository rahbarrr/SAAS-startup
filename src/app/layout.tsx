import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "FieldTrack — Multi-Tenant Field Operations",
  description:
    "Plan field trips, manage approvals, record store visits, capture evidence, and review outcomes.",
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
