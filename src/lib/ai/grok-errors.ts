import "server-only";

import type OpenAI from "openai";
import { resolveXaiCredential, type CredentialSource, type XaiCredential } from "./credentials";
import { refreshOAuthToken, loadOAuthToken } from "./oauth-store";

export const OAUTH_ALLOWLIST_MESSAGE =
  "Your Grok subscription tier isn't allowlisted for OAuth API access (HTTP 403). Set XAI_API_KEY to use the API path.";

export function getHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

export function isOAuthCompletionRejected(err: unknown): boolean {
  const status = getHttpStatus(err);
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 422;
}

export async function withCredentialFallback<T>(
  initial: XaiCredential,
  fn: (cred: XaiCredential, client: OpenAI) => Promise<T>,
  getClient: (cred: XaiCredential) => Promise<OpenAI>
): Promise<{ result: T; source: CredentialSource }> {
  let cred = initial;
  let retried401 = false;

  while (true) {
    const client = await getClient(cred);
    try {
      const result = await fn(cred, client);
      return { result, source: cred.source };
    } catch (err) {
      const status = getHttpStatus(err);

      if (status === 401 && cred.source === "oauth" && !retried401) {
        const stored = loadOAuthToken();
        if (stored) {
          try {
            const refreshed = await refreshOAuthToken(stored);
            cred = { source: "oauth", token: refreshed.access_token, expiresAt: refreshed.expires_at };
            retried401 = true;
            continue;
          } catch {
            // fall through to key fallback
          }
        }
        const fallback = await resolveXaiCredential();
        if (fallback.source === "key" && fallback.token) {
          cred = fallback;
          continue;
        }
        throw new Error("re-authentication required");
      }

      if (status === 403 && cred.source === "oauth") {
        if (process.env.XAI_API_KEY) {
          cred = { source: "key", token: process.env.XAI_API_KEY };
          continue;
        }
        throw new Error(OAUTH_ALLOWLIST_MESSAGE);
      }

      throw err;
    }
  }
}