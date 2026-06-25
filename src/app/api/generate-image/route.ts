import { generateGrokImage } from "@/lib/ai/generate-image";
import { resolveXaiCredential } from "@/lib/ai/credentials";

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

  const cred = await resolveXaiCredential();
  if (cred.source === "mock") {
    return Response.json({
      source: "mock",
      imageUrl: undefined,
      imagePrompt: prompt,
    });
  }

  const result = await generateGrokImage(prompt, cred);
  return Response.json({
    source: cred.source,
    imageUrl: result.url,
    imageError: result.error,
    imagePrompt: prompt,
  });
}