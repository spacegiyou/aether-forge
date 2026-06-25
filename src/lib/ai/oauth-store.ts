import "server-only";

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_REFRESH_SKEW_SECONDS,
  XAI_OAUTH_TOKEN_URL,
} from "./oauth-constants";

export interface OAuthTokenData {
  access_token: string;
  refresh_token: string;
  obtained_at: number;
  expires_at: number;
}

export type TokenFetcher = (url: string, init: RequestInit) => Promise<Response>;

const DEFAULT_FETCHER: TokenFetcher = (url, init) => fetch(url, init);

function homeTokenPath(): string {
  return join(homedir(), ".aetherforge", "xai-auth.json");
}

function localTokenPath(): string {
  return join(process.cwd(), ".xai-auth.json");
}

/** Resolve token file path — prefer ~/.aetherforge, else project-local */
export function getOAuthTokenPath(): string {
  const home = homeTokenPath();
  if (existsSync(home)) return home;
  const local = localTokenPath();
  if (existsSync(local)) return local;
  return home;
}

export function loadOAuthToken(): OAuthTokenData | null {
  const paths = [homeTokenPath(), localTokenPath()];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      const raw = readFileSync(path, "utf8");
      const data = JSON.parse(raw) as OAuthTokenData;
      if (data.access_token && data.refresh_token && data.expires_at) {
        return data;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function saveOAuthToken(data: OAuthTokenData, targetPath?: string): void {
  const path = targetPath ?? getOAuthTokenPath();
  const dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

export function deleteOAuthToken(): boolean {
  let deleted = false;
  for (const path of [homeTokenPath(), localTokenPath()]) {
    if (existsSync(path)) {
      unlinkSync(path);
      deleted = true;
    }
  }
  return deleted;
}

export function isExpired(data: OAuthTokenData, nowMs = Date.now()): boolean {
  const skewMs = XAI_OAUTH_REFRESH_SKEW_SECONDS * 1000;
  return nowMs >= data.expires_at - skewMs;
}

function tokenDataFromResponse(
  body: { access_token: string; refresh_token?: string; expires_in: number },
  existing?: OAuthTokenData
): OAuthTokenData {
  const now = Date.now();
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? existing?.refresh_token ?? "",
    obtained_at: now,
    expires_at: now + body.expires_in * 1000,
  };
}

export async function refreshOAuthToken(
  data: OAuthTokenData,
  fetcher: TokenFetcher = DEFAULT_FETCHER
): Promise<OAuthTokenData> {
  const res = await fetcher(XAI_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
      client_id: XAI_OAUTH_CLIENT_ID,
    }).toString(),
  });

  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok) {
    if (body.error === "invalid_grant") {
      deleteOAuthToken();
      throw new Error("re-auth required");
    }
    throw new Error(body.error_description ?? body.error ?? `Token refresh failed (${res.status})`);
  }

  if (!body.access_token || !body.expires_in) {
    throw new Error("Token refresh returned incomplete response");
  }

  const refreshed = tokenDataFromResponse(
    {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_in: body.expires_in,
    },
    data
  );
  saveOAuthToken(refreshed);
  return refreshed;
}

/** Load token, refreshing if near expiry */
export async function loadValidOAuthToken(
  fetcher: TokenFetcher = DEFAULT_FETCHER
): Promise<OAuthTokenData | null> {
  const data = loadOAuthToken();
  if (!data) return null;
  if (!isExpired(data)) return data;
  try {
    return await refreshOAuthToken(data, fetcher);
  } catch {
    return null;
  }
}