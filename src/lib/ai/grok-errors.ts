import "server-only";

import type OpenAI from "openai";
import type { CredentialSource, XaiCredential } from "./credentials";
import { refreshOAuthToken, loadOAuthToken } from "./oauth-store";

export const OAUTH_ALLOWLIST_MESSAGE =
  "Your Grok subscription tier isn't allowlisted for OAuth API access (HTTP 403). Set XAI_API_KEY to use the API path.";

export type RecoveryAction =
  | "refresh-once"
  | "use-key"
  | "throw-reauth"
  | "throw-allowlist"
  | "rethrow";

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

/** Escape to API key only — never re-resolves OAuth from disk */
export function getKeyEscapeCredential(): XaiCredential | null {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return null;
  return { source: "key", token: key };
}

export function hasApiKeyEnv(): boolean {
  return !!process.env.XAI_API_KEY?.trim();
}

/** Pure 401/403 recovery planner — no I/O */
export function planOAuthRecovery(input: {
  status: number | undefined;
  source: CredentialSource;
  refreshAttempted: boolean;
  hasApiKey: boolean;
}): RecoveryAction {
  const { status, source, refreshAttempted, hasApiKey } = input;

  if (status === 403 && source === "oauth") {
    return hasApiKey ? "use-key" : "throw-allowlist";
  }

  if (status === 401 && source === "oauth") {
    if (!refreshAttempted) return "refresh-once";
    if (hasApiKey) return "use-key";
    return "throw-reauth";
  }

  return "rethrow";
}

export type CredentialFallbackDeps = {
  loadOAuth: typeof loadOAuthToken;
  refreshOAuth: typeof refreshOAuthToken;
  getKeyEscape: typeof getKeyEscapeCredential;
};

const defaultDeps: CredentialFallbackDeps = {
  loadOAuth: loadOAuthToken,
  refreshOAuth: refreshOAuthToken,
  getKeyEscape: getKeyEscapeCredential,
};

export async function withCredentialFallback<T>(
  initial: XaiCredential,
  fn: (cred: XaiCredential, client: OpenAI) => Promise<T>,
  getClient: (cred: XaiCredential) => Promise<OpenAI>,
  deps: CredentialFallbackDeps = defaultDeps
): Promise<{ result: T; source: CredentialSource }> {
  let cred = initial;
  let refreshAttempted = false;

  while (true) {
    const client = await getClient(cred);
    try {
      const result = await fn(cred, client);
      return { result, source: cred.source };
    } catch (err) {
      const status = getHttpStatus(err);
      const action = planOAuthRecovery({
        status,
        source: cred.source,
        refreshAttempted,
        hasApiKey: hasApiKeyEnv(),
      });

      switch (action) {
        case "refresh-once": {
          refreshAttempted = true;
          const stored = deps.loadOAuth();
          if (stored) {
            try {
              const refreshed = await deps.refreshOAuth(stored);
              cred = {
                source: "oauth",
                token: refreshed.access_token,
                expiresAt: refreshed.expires_at,
              };
              continue;
            } catch {
              // refresh failed — fall through to key escape
            }
          }
          const escape = deps.getKeyEscape();
          if (escape) {
            cred = escape;
            continue;
          }
          throw new Error("re-authentication required");
        }
        case "use-key": {
          const escape = deps.getKeyEscape();
          if (escape) {
            cred = escape;
            continue;
          }
          if (status === 403) throw new Error(OAUTH_ALLOWLIST_MESSAGE);
          throw new Error("re-authentication required");
        }
        case "throw-reauth":
          throw new Error("re-authentication required");
        case "throw-allowlist":
          throw new Error(OAUTH_ALLOWLIST_MESSAGE);
        case "rethrow":
          throw err;
      }
    }
  }
}