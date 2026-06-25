import "server-only";

import { getGrokClient, getImageModel } from "./grok-client";
import { isMockMode } from "./env";

export interface ImageGenerationResult {
  url?: string;
  error?: string;
}

/** Generate image via xAI — live only; mock returns undefined */
export async function generateGrokImage(prompt: string): Promise<ImageGenerationResult> {
  if (isMockMode()) {
    return {};
  }

  try {
    const client = getGrokClient();
    const response = await client.images.generate({
      model: getImageModel(),
      prompt,
      n: 1,
    });

    const url = response.data?.[0]?.url;
    if (!url) {
      return { error: "Image generation returned no URL" };
    }
    return { url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return { error: message };
  }
}