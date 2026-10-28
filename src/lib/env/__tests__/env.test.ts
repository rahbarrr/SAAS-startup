import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Environment variable validation & secret isolation", () => {
  it("parses valid public and server environment variables (ALLOWED)", () => {
    const env = getServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-placeholder",
      RESEND_API_KEY: "resend-key-placeholder",
      RESEND_FROM_EMAIL: "FieldTrack <invites@example.com>",
    });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("public-anon-placeholder");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-secret-placeholder");
    expect(env.RESEND_API_KEY).toBe("resend-key-placeholder");
    expect(env.RESEND_FROM_EMAIL).toBe("FieldTrack <invites@example.com>");
  });

  it("rejects missing or malformed NEXT_PUBLIC_SUPABASE_URL (DENIED)", () => {
    expect(() =>
      getPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-placeholder",
      })
    ).toThrow();

    expect(() =>
      getPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      })
    ).toThrow();
  });

  it("ensures .env.example contains only variable names and descriptions with empty values", () => {
    const envExamplePath = path.resolve(process.cwd(), ".env.example");
    const content = fs.readFileSync(envExamplePath, "utf8");
    const assignmentLines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    expect(assignmentLines.length).toBeGreaterThanOrEqual(3);
    for (const line of assignmentLines) {
      const [key, value = ""] = line.split("=");
      expect(key).toBeTruthy();
      expect(value.trim()).toBe("");
    }
  });

  it("ensures no client component ('use client') imports server-only environment or service modules", () => {
    const srcDir = path.resolve(process.cwd(), "src");
    const allFiles = collectSourceFiles(srcDir);

    const clientFiles = allFiles.filter((filePath) => {
      const content = fs.readFileSync(filePath, "utf8").trimStart();
      return content.startsWith('"use client"') || content.startsWith("'use client'");
    });

    expect(clientFiles.length).toBeGreaterThanOrEqual(2);

    for (const clientFile of clientFiles) {
      const content = fs.readFileSync(clientFile, "utf8");
      expect(content).not.toContain("@/lib/env/server");
      expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(content).not.toContain("OPENAI_API_KEY");
      expect(content).not.toContain("RESEND_API_KEY");
      expect(content).not.toContain("@/lib/supabase/server");
    }
  });
});
