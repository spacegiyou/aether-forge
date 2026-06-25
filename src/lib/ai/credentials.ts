import "server-only";

import { getAiEnv } from "./env";
import { loadValidOAuthToken, type OAuthTokenData } from "./oauth-store";

export type { CredentialSource } from "./source-badge";
export { sourceBadgeLabel, isLiveSource } from "./source-badge";
import type { CredentialSource } from "./source-badge";

export interface XaiCredential {
  source: CredentialSource;
  token?: string;
  expiresAt?: number;
}

type CredentialDeps = {
  loadOAuth: () => Promise<OAuthTokenData | null>;
  getEnv: () => ReturnType<typeof getAiEnv>;
};

const defaultDeps: CredentialDeps = {
  loadOAuth: loadValidOAuthToken,
  getEnv: getAiEnv,
};

/** Resolve bearer credential — OAuth preferred in auto mode */
export async function resolveXaiCredential(
  deps: CredentialDeps = defaultDeps
): Promise<XaiCredential> {
  const env = deps.getEnv();
  const mode = env.AI_MODE;

  if (mode === "mock") {
    return { source: "mock" };
  }

  if (mode === "key") {
    if (env.XAI_API_KEY) {
      return { source: "key", token: env.XAI_API_KEY };
    }
    return { source: "mock" };
  }

  if (mode === "oauth") {
    const oauth = await deps.loadOAuth();
    if (oauth) {
      return { source: "oauth", token: oauth.access_token, expiresAt: oauth.expires_at };
    }
    if (env.XAI_API_KEY) {
      return { source: "key", token: env.XAI_API_KEY };
    }
    return { source: "mock" };
  }

  // auto: prefer OAuth, then key, then mock
  const oauth = await deps.loadOAuth();
  if (oauth) {
    return { source: "oauth", token: oauth.access_token, expiresAt: oauth.expires_at };
  }
  if (env.XAI_API_KEY) {
    return { source: "key", token: env.XAI_API_KEY };
  }
  return { source: "mock" };
}