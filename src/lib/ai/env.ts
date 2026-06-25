import { z } from "zod";

/** AI_MODE defaults to auto — resolves to mock when no creds (CI-safe) */
const aiEnvSchema = z.object({
  AI_MODE: z.enum(["mock", "key", "oauth", "auto"]).default("auto"),
  XAI_API_KEY: z.string().min(1).optional(),
  GROK_TEXT_MODEL: z.string().default("grok-4.3"),
  GROK_FAST_MODEL: z.string().default("grok-code-fast-1"),
  GROK_IMAGE_MODEL: z.string().default("grok-imagine-image-quality"),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;
export type AiMode = AiEnv["AI_MODE"];

function readRawEnv(): Record<string, string | undefined> {
  return {
    AI_MODE: process.env.AI_MODE ?? "auto",
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

/** @deprecated Use resolveXaiCredential().source instead */
export function isLiveMode(): boolean {
  const mode = getAiEnv().AI_MODE;
  return mode === "key" || mode === "oauth";
}

/** Validates API-key credentials — call only on key-forced paths */
export function requireLiveEnv(): AiEnv & { XAI_API_KEY: string } {
  const env = getAiEnv();
  if (env.AI_MODE !== "key") {
    throw new Error("API key calls require AI_MODE=key");
  }
  if (!env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is required when AI_MODE=key");
  }
  return env as AiEnv & { XAI_API_KEY: string };
}

/** Re-parse env — for tests after mutating process.env */
export function resetAiEnvCache(): void {
  cached = parseAiEnv();
}