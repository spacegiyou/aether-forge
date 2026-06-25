import { resolveXaiCredential } from "@/lib/ai/credentials";

export const runtime = "nodejs";

/** GET current xAI credential source for UI status */
export async function GET(): Promise<Response> {
  const cred = await resolveXaiCredential();
  return Response.json({
    source: cred.source,
    expires_at: cred.expiresAt,
  });
}