import "server-only";

import OpenAI from "openai";
import { requireLiveEnv, getAiEnv } from "./env";

/** xAI Grok OpenAI-compatible client — server-only, never import in client components */
export function getGrokClient(): OpenAI {
  const env = requireLiveEnv();
  return new OpenAI({
    apiKey: env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
  });
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