import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  isExpired,
  refreshOAuthToken,
  saveOAuthToken,
  type OAuthTokenData,
  type TokenFetcher,
} from "./oauth-store";
import { XAI_OAUTH_REFRESH_SKEW_SECONDS } from "./oauth-constants";

describe("oauth-store", () => {
  const base: OAuthTokenData = {
    access_token: "old-access",
    refresh_token: "old-refresh",
    obtained_at: Date.now() - 60_000,
    expires_at: Date.now() + 7_200_000,
  };

  let tmpDir: string;
  let tokenFile: string;
  const originalAuthFile = process.env.XAI_AUTH_FILE;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "aetherforge-oauth-"));
    tokenFile = join(tmpDir, "xai-auth.json");
    process.env.XAI_AUTH_FILE = tokenFile;
  });

  afterEach(() => {
    if (originalAuthFile === undefined) {
      delete process.env.XAI_AUTH_FILE;
    } else {
      process.env.XAI_AUTH_FILE = originalAuthFile;
    }
  });

  it("isExpired returns true within refresh skew window", () => {
    const now = base.expires_at - XAI_OAUTH_REFRESH_SKEW_SECONDS * 1000 + 1;
    expect(isExpired(base, now)).toBe(true);
  });

  it("isExpired returns false when far from expiry", () => {
    expect(isExpired(base, Date.now())).toBe(false);
  });

  it("refreshOAuthToken exchanges refresh_token and returns new data", async () => {
    const fetcher: TokenFetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const refreshed = await refreshOAuthToken(base, {
      fetcher,
      tokenPath: tokenFile,
      saveToken: saveOAuthToken,
    });
    expect(refreshed.access_token).toBe("new-access");
    expect(refreshed.refresh_token).toBe("new-refresh");
    expect(refreshed.expires_at).toBeGreaterThan(Date.now());
    expect(existsSync(tokenFile)).toBe(true);
    const saved = JSON.parse(readFileSync(tokenFile, "utf8")) as OAuthTokenData;
    expect(saved.access_token).toBe("new-access");
    expect(fetcher).toHaveBeenCalledOnce();
    const [, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("grant_type=refresh_token");
    expect(String(init.body)).toContain("old-refresh");
  });

  it("refreshOAuthToken deletes scoped token file on invalid_grant", async () => {
    writeFileSync(tokenFile, JSON.stringify(base), "utf8");
    expect(existsSync(tokenFile)).toBe(true);

    const deletedPaths: string[][] = [];
    const fetcher: TokenFetcher = async () =>
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    await expect(
      refreshOAuthToken(base, {
        fetcher,
        tokenPath: tokenFile,
        deleteToken: (paths) => {
          deletedPaths.push(paths ?? []);
          if (paths) {
            for (const p of paths) {
              if (existsSync(p)) unlinkSync(p);
            }
          }
          return true;
        },
      })
    ).rejects.toThrow("re-auth required");

    expect(deletedPaths).toEqual([[tokenFile]]);
    expect(existsSync(tokenFile)).toBe(false);
  });
});