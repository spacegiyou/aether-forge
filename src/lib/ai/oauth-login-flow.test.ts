import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_TOKEN_URL,
  XAI_OAUTH_REDIRECT_URI,
} from "./oauth-constants";
import { saveOAuthToken } from "./oauth-store";

/** Mirrors scripts/xai-oauth-login.mjs parseCallbackInput */
function parseCallbackInput(input: string): { code: string | null; state: string | null } {
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

/** Mirrors scripts/xai-oauth-login.mjs exchangeCode (PKCE authorization_code grant) */
async function exchangeCode(code: string, verifier: string): Promise<Response> {
  return fetch(XAI_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: XAI_OAUTH_REDIRECT_URI,
      client_id: XAI_OAUTH_CLIENT_ID,
      code_verifier: verifier,
    }).toString(),
  });
}

describe("oauth login flow (PKCE manual-paste path)", () => {
  let tmpDir: string;
  let tokenFile: string;
  const originalAuthFile = process.env.XAI_AUTH_FILE;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "aetherforge-login-"));
    tokenFile = join(tmpDir, "xai-auth.json");
    process.env.XAI_AUTH_FILE = tokenFile;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalAuthFile === undefined) {
      delete process.env.XAI_AUTH_FILE;
    } else {
      process.env.XAI_AUTH_FILE = originalAuthFile;
    }
  });

  it("parseCallbackInput accepts callback URL, query fragment, or bare code", () => {
    expect(parseCallbackInput("http://127.0.0.1:56121/callback?code=abc&state=xyz")).toEqual({
      code: "abc",
      state: "xyz",
    });
    expect(parseCallbackInput("?code=abc&state=xyz")).toEqual({ code: "abc", state: "xyz" });
    expect(parseCallbackInput("bare-code-value")).toEqual({ code: "bare-code-value", state: null });
  });

  it("exchanges code via PKCE and saves token file without printing secrets", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const pasted = "http://127.0.0.1:56121/callback?code=auth-code-123&state=ignored";
    const { code } = parseCallbackInput(pasted);
    expect(code).toBe("auth-code-123");

    const res = await exchangeCode(code!, "pkce-verifier-xyz");
    const body = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const now = Date.now();
    saveOAuthToken(
      {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        obtained_at: now,
        expires_at: now + body.expires_in * 1000,
      },
      tokenFile
    );

    expect(existsSync(tokenFile)).toBe(true);
    const saved = JSON.parse(readFileSync(tokenFile, "utf8")) as {
      access_token: string;
      refresh_token: string;
      obtained_at: number;
      expires_at: number;
    };
    expect(saved.access_token).toBe("test-access-token");
    expect(saved.obtained_at).toBeGreaterThan(0);
    expect(saved.expires_at).toBeGreaterThan(saved.obtained_at);

    const requestBody = String(fetchMock.mock.calls[0]?.[1]?.body ?? "");
    expect(requestBody).toContain("grant_type=authorization_code");
    expect(requestBody).toContain("code=auth-code-123");
    expect(requestBody).toContain("code_verifier=pkce-verifier-xyz");
    expect(requestBody).toContain(`client_id=${XAI_OAUTH_CLIENT_ID}`);
  });
});