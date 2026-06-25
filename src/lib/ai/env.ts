import { z } from "zod";

/** AI_MODE defaults to mock — safe for CI/tests without XAI_API_KEY */
const aiEnvSchema = z.object({
  AI_MODE: z.enum(["mock", "live"]).default("mock"),
  XAI_API_KEY: z.string().min(1).optional(),
  GROK_TEXT_MODEL: z.string().default("grok-4.3"),
  GROK_FAST_MODEL: z.string().default("grok-code-fast-1"),
  GROK_IMAGE_MODEL: z.string().default("grok-imagine-image-quality"),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;

function readRawEnv(): Record<string, string | undefined> {
  return {
    AI_MODE: process.env.AI_MODE ?? "mock",
    XAI_API_KEY: process.env.XAI_API_KEY,
    GROK_TEXT_MODEL: process.env.GROK_TEXT_MODEL ?? "grok-4.3",
    GROK_FAST_MODEL: process.env.GROK_FAST_MODEL ?? "grok-code-fast-1",
    GROK_IMAGE_MODEL: process.env.GROK_IMAGE_MODEL ?? "grok-imagine-image-quality",
  };
}

function parseAiEnv(): AiEnv {
  return aiEnvSchema.parse(readRawEnv());
}

let cached: AiEnv = parseAiEnv();

/** Eager Zod validation at server boot — also runs on module load */
export function validateAiEnvAtBoot(): AiEnv {
  cached = parseAiEnv();
  if (cached.AI_MODE === "live" && !cached.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is required when AI_MODE=live");
  }
  return cached;
}

// Validate env shape as soon as this module loads (server startup / route import)
validateAiEnvAtBoot();

export function getAiEnv(): AiEnv {
  return cached;
}

export function isMockMode(): boolean {
  return getAiEnv().AI_MODE === "mock";
}

export function isLiveMode(): boolean {
  return getAiEnv().AI_MODE === "live";
}

/** Validates live credentials — call only on live execution paths */
export function requireLiveEnv(): AiEnv & { XAI_API_KEY: string } {
  const env = getAiEnv();
  if (env.AI_MODE !== "live") {
    throw new Error("Live Grok calls require AI_MODE=live");
  }
  if (!env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is required when AI_MODE=live");
  }
  return env as AiEnv & { XAI_API_KEY: string };
}

/** Re-parse env — for tests after mutating process.env */
export function resetAiEnvCache(): void {
  cached = parseAiEnv();
}