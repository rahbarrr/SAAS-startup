import "server-only";
import { z } from "zod";
import { getPublicEnv } from "./public";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY must be a non-empty string")
    .optional(),
});

export type ServerEnv = ReturnType<typeof getPublicEnv> & z.infer<typeof serverEnvSchema>;

/**
 * Validates and returns server-only environment variables.
 * Protected by `import "server-only"` so bundling into browser code is a build error.
 */
export function getServerEnv(
  envSource: Record<string, string | undefined> = process.env
): ServerEnv {
  const publicEnv = getPublicEnv(envSource);
  const serverOnly = serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: envSource.SUPABASE_SERVICE_ROLE_KEY || undefined,
  });

  return {
    ...publicEnv,
    ...serverOnly,
  };
}
