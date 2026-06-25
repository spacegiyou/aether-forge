/**
 * Shared xAI OAuth helpers — constants from scripts/oauth-contract.mjs only.
 */

import { mkdirSync, writeFileSync, renameSync, existsSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createHash } from "crypto";
import {
  XAI_OAUTH_ISSUER,
  XAI_OAUTH_DISCOVERY_URL,
  XAI_OAUTH_AUTHORIZE_URL,
  XAI_OAUTH_TOKEN_URL,
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_SCOPE,
  REDIRECT_HOST,
  REDIRECT_PORT,
  REDIRECT_PATH,
  REDIRECT_URI,
  PKCE_METHOD,
  AUTHORIZE_PLAN,
} from "./oauth-contract.mjs";

export {
  XAI_OAUTH_ISSUER,
  XAI_OAUTH_DISCOVERY_URL,
  XAI_OAUTH_AUTHORIZE_URL,
  XAI_OAUTH_TOKEN_URL,
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_SCOPE,
  REDIRECT_HOST,
  REDIRECT_PORT,
  REDIRECT_PATH,
  REDIRECT_URI,
};

export function resolveTokenUrl() {
  return process.env.XAI_OAUTH_TOKEN_URL?.trim() || XAI_OAUTH_TOKEN_URL;
}
export const TIMEOUT_MS = 180_000;

export function tokenSearchPaths() {
  const envPath = process.env.XAI_AUTH_FILE?.trim();
  if (envPath) return [envPath];
  return [
    join(homedir(), ".aetherforge", "xai-auth.json"),
    join(process.cwd(), ".xai-auth.json"),
  ];
}

export function tokenPath() {
  const paths = tokenSearchPaths();
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return paths[0];
}

export function base64Url(buf) {
  return buf.toString("base64url");
}

export function pkceChallenge(verifier) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function saveTokens(body, targetPath = tokenPath()) {
  const now = Date.now();
  const data = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    obtained_at: now,
    expires_at: now + body.expires_in * 1000,
  };
  const dir = join(targetPath, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = `${targetPath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(tmp, targetPath);
  return { path: targetPath, data };
}

export function deleteTokenFiles(paths = tokenSearchPaths()) {
  let deleted = false;
  for (const path of paths) {
    if (existsSync(path)) {
      unlinkSync(path);
      deleted = true;
    }
  }
  return deleted;
}

export async function exchangeCode(code, verifier, fetcher = fetch) {
  const challenge = pkceChallenge(verifier);
  const res = await fetcher(resolveTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: XAI_OAUTH_CLIENT_ID,
      code_verifier: verifier,
      code_challenge: challenge,
      code_challenge_method: PKCE_METHOD,
    }).toString(),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error_description ?? body.error ?? `Token exchange failed (${res.status})`);
  }
  if (!body.access_token || !body.refresh_token || !body.expires_in) {
    throw new Error("Token exchange returned incomplete response");
  }
  return body;
}

export function buildAuthorizeUrl(state, verifier) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: XAI_OAUTH_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: XAI_OAUTH_SCOPE,
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: PKCE_METHOD,
    plan: AUTHORIZE_PLAN,
  });
  return `${XAI_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export function parseCallbackInput(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith("http")) {
    const u = new URL(trimmed);
    return { code: u.searchParams.get("code"), state: u.searchParams.get("state") };
  }
  if (trimmed.startsWith("?")) {
    const params = new URLSearchParams(trimmed.slice(1));
    return { code: params.get("code"), state: params.get("state") };
  }
  return { code: trimmed, state: null };
}

/** Manual-paste flow — shipped code path used by login script */
export async function manualPasteFlow(state, verifier, input, fetcher = fetch) {
  const { code, state: returnedState } = parseCallbackInput(input);
  if (returnedState && returnedState !== state) {
    throw new Error("State mismatch (possible CSRF)");
  }
  if (!code) throw new Error("No authorization code found in input");
  const tokens = await exchangeCode(code, verifier, fetcher);
  return saveTokens(tokens);
}

export function printHelp() {
  return `xAI Grok OAuth login for AetherForge

Usage:
  node scripts/xai-oauth-login.mjs [--manual-paste] [--help]

Options:
  --manual-paste  Print authorize URL and accept pasted callback URL or code
  --help          Show this help

Tokens are saved to ~/.aetherforge/xai-auth.json (never printed).`;
}