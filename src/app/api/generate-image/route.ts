import { generateGrokImage } from "@/lib/ai/generate-image";
import { isMockMode } from "@/lib/ai/env";

export const runtime = "nodejs";

/** Image generation for MultimodalLab — live uses Grok Imagine, mock returns placeholder meta */
export async function POST(request: Request): Promise<Response> {
  let prompt = "";
  try {
    const body = (await request.json()) as { prompt?: string };
    prompt = (body.prompt ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (isMockMode()) {
    return Response.json({
      aiMode: "mock",
      imageUrl: undefined,
      imagePrompt: prompt,
    });
  }

  const result = await generateGrokImage(prompt);
  return Response.json({
    aiMode: "live",
    imageUrl: result.url,
    imageError: result.error,
    imagePrompt: prompt,
  });
}