import "server-only";

import OpenAI from "openai";
import { getAiEnv } from "./env";
import { resolveXaiCredential, type CredentialSource, type XaiCredential } from "./credentials";

export type GrokClientOptions = {
  /** Inject for tests — drives real OpenAI SDK against mocked HTTP responses */
  fetch?: typeof fetch;
};

/** xAI Grok OpenAI-compatible client — server-only, never import in client components */
export async function getGrokClient(
  credential?: XaiCredential,
  options?: GrokClientOptions
): Promise<OpenAI> {
  const cred = credential ?? (await resolveXaiCredential());
  if (cred.source === "mock" || !cred.token) {
    throw new Error("No xAI credential");
  }
  const baseURL = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
  return new OpenAI({ apiKey: cred.token, baseURL, fetch: options?.fetch });
}

export function getTextModel(): string {
  return getAiEnv().GROK_TEXT_MODEL;
}

export function getFastModel(): string {
  return getAiEnv().GROK_FAST_MODEL;
}

export function getImageModel(): string {
  return getAiEnv().GROK_IMAGE_MODEL;
}

export function getModelForSource(source: CredentialSource): string {
  if (source === "oauth") return getTextModel();
  return getFastModel();
}