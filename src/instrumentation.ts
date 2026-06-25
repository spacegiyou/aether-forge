/** Server boot hook — eager AI env validation before handling requests */
export async function register() {
  const { validateAiEnvAtBoot } = await import("@/lib/ai/env");
  validateAiEnvAtBoot();
}