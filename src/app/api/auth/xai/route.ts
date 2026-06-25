import { deleteOAuthToken } from "@/lib/ai/oauth-store";

export const runtime = "nodejs";

/** DELETE OAuth token file (sign out) */
export async function DELETE(): Promise<Response> {
  const deleted = deleteOAuthToken();
  return Response.json({ ok: true, deleted });
}