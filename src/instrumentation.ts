export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { assertStartupEnv } = await import("@/lib/env/startup");
    // Throws with variable NAMES only; values are never printed.
    assertStartupEnv();
  }
}
