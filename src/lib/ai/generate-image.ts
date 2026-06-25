import "server-only";

import { getGrokClient, getImageModel } from "./grok-client";
import { resolveXaiCredential, type XaiCredential } from "./credentials";
import { withCredentialFallback } from "./grok-errors";

export interface ImageGenerationResult {
  url?: string;
  error?: string;
}

/** Generate image via xAI — live only; mock returns undefined */
export async function generateGrokImage(
  prompt: string,
  credential?: XaiCredential
): Promise<ImageGenerationResult> {
  const cred = credential ?? (await resolveXaiCredential());

  if (cred.source === "mock" || !cred.token) {
    return {};
  }

  try {
    const { result: url } = await withCredentialFallback(
      cred,
      async (activeCred, client) => {
        const response = await client.images.generate({
          model: getImageModel(),
          prompt,
          n: 1,
        });
        const imageUrl = response.data?.[0]?.url;
        if (!imageUrl) {
          throw new Error("Image generation returned no URL");
        }
        return imageUrl;
      },
      getGrokClient
    );
    return { url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return { error: message };
  }
}