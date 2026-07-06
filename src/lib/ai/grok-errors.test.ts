import { describe, it, expect, vi } from "vitest";
import OpenAI, { AuthenticationError } from "openai";
import {
  planOAuthRecovery,
  getKeyEscapeCredential,
  getHttpStatus,
  withCredentialFallback,

  OAUTH_ALLOWLIST_MESSAGE,
  type RecoveryAction,
} from "./grok-errors";
import type { XaiCredential } from "./credentials";

describe("planOAuthRecovery", () => {
  const cases: Array<{
    name: string;
    input: Parameters<typeof planOAuthRecovery>[0];
    want: RecoveryAction;
  }> = [
    {
      name: "first oauth 401 → refresh once",
      input: { status: 401, source: "oauth", refreshAttempted: false, hasApiKey: true },
      want: "refresh-once",
    },
    {
      name: "first oauth 400 (real x.ai invalid token) → refresh once",
      input: { status: 400, source: "oauth", refreshAttempted: false, hasApiKey: true },
      want: "refresh-once",
    },
    {
      name: "second oauth 401 with key → use-key",
      input: { status: 401, source: "oauth", refreshAttempted: true, hasApiKey: true },
      want: "use-key",
    },
    {
      name: "second oauth 401 without key → throw-reauth",
      input: { status: 401, source: "oauth", refreshAttempted: true, hasApiKey: false },
      want: "throw-reauth",
    },
    {
      name: "oauth 403 with key → use-key",
      input: { status: 403, source: "oauth", refreshAttempted: false, hasApiKey: true },
      want: "use-key",
    },
    {
      name: "oauth 403 without key → throw-allowlist",
      input: { status: 403, source: "oauth", refreshAttempted: false, hasApiKey: false },
      want: "throw-allowlist",
    },
    {
      name: "key source 401 → rethrow",
      input: { status: 401, source: "key", refreshAttempted: false, hasApiKey: true },
      want: "rethrow",
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(planOAuthRecovery(c.input)).toBe(c.want);
    });
  }
});

describe("getKeyEscapeCredential", () => {
  it("returns key credential from env without loading oauth", () => {
    const prev = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "xai-escape-key";
    expect(getKeyEscapeCredential()).toEqual({ source: "key", token: "xai-escape-key" });
    process.env.XAI_API_KEY = prev;
  });
});

function bearerToken(init?: RequestInit): string {
  const headers = init?.headers;
  const raw =
    headers instanceof Headers
      ? headers.get("Authorization")
      : (headers as Record<string, string> | undefined)?.Authorization;
  return String(raw ?? "").replace(/^Bearer\s+/i, "");
}

function apiError(status: number): Error & { status: number } {
  const e = new Error(`HTTP ${status}`) as Error & { status: number };
  e.status = status;
  return e;
}

describe("withCredentialFallback", () => {
  const oauthCred: XaiCredential = { source: "oauth", token: "oauth-tok" };

  it("getHttpStatus reads status from awaited OpenAI AuthenticationError", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    const client = new OpenAI({
      apiKey: "oauth-tok",
      baseURL: "https://api.x.ai/v1",
      fetch: mockFetch,
    });
    try {
      await client.chat.completions.create({
        model: "grok-4.3",
        messages: [{ role: "user", content: "hi" }],
      });
      expect.fail("expected throw");
    } catch (err) {
      expect(getHttpStatus(err)).toBe(401);
    }
  });

  it("recovers when fn awaits real OpenAI client chat 401 then key success", async () => {
    let oauthAttempts = 0;
    const mockFetch: typeof fetch = async (_url, init) => {
      const auth = bearerToken(init);
      if (auth === "xai-fallback") {
        return new Response(
          JSON.stringify({
            id: "chatcmpl-test",
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: "grok-build-0.1",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: '{"summary":"ok"}' },
                finish_reason: "stop",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      oauthAttempts++;
      return new Response(
        JSON.stringify({ error: { message: "Unauthorized", type: "invalid_request_error" } }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    };

    const getClient = async (cred: XaiCredential) =>
      new OpenAI({ apiKey: cred.token!, baseURL: "https://api.x.ai/v1", fetch: mockFetch });

    const deps = {
      loadOAuth: () => ({
        access_token: "oauth-tok",
        refresh_token: "oauth-ref",
        obtained_at: Date.now(),
        expires_at: Date.now() + 9999,
      }),
      refreshOAuth: async () => ({
        access_token: "oauth-refreshed",
        refresh_token: "oauth-ref",
        obtained_at: Date.now(),
        expires_at: Date.now() + 9999,
      }),
      getKeyEscape: () => ({ source: "key" as const, token: "xai-fallback" }),
    };
    const prev = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "xai-fallback";

    const { result, source } = await withCredentialFallback(
      oauthCred,
      async (_cred, client) => {
        const completion = await client.chat.completions.create({
          model: "grok-4.3",
          messages: [{ role: "user", content: "hi" }],
        });
        return completion.choices[0]?.message?.content ?? "";
      },
      getClient,
      deps
    );

    expect(source).toBe("key");
    expect(result).toContain("summary");
    expect(oauthAttempts).toBeGreaterThanOrEqual(2);
    process.env.XAI_API_KEY = prev;
  });

  it("recovers from OpenAI AuthenticationError (real SDK error shape)", async () => {
    const fn = vi.fn(async (cred: XaiCredential) => {
      if (cred.source === "key") return "ok";
      throw new AuthenticationError(401, { message: "Unauthorized" }, undefined, new Headers());
    });
    expect(getHttpStatus(new AuthenticationError(401, { message: "x" }, undefined, new Headers()))).toBe(
      401
    );

    const deps = {
      loadOAuth: () => null,
      refreshOAuth: async () => {
        throw new Error("n/a");
      },
      getKeyEscape: () => ({ source: "key" as const, token: "xai-fallback" }),
    };
    const prev = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "xai-fallback";

    const { result, source } = await withCredentialFallback(
      oauthCred,
      fn,
      async () => ({} as never),
      deps
    );
    expect(result).toBe("ok");
    expect(source).toBe("key");
    process.env.XAI_API_KEY = prev;
  });

  it("second 401 after refresh succeeds falls back to key escape", async () => {
    const fn = vi.fn(async (cred) => {
      if (cred.source === "key") return "ok-after-key-escape";
      throw apiError(401);
    });
    const deps = {
      loadOAuth: () => ({
        access_token: "a",
        refresh_token: "r",
        obtained_at: Date.now(),
        expires_at: Date.now() + 9999,
      }),
      refreshOAuth: async () => ({
        access_token: "refreshed",
        refresh_token: "r",
        obtained_at: Date.now(),
        expires_at: Date.now() + 9999,
      }),
      getKeyEscape: () => ({ source: "key" as const, token: "xai-fallback" }),
    };
    const prev = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "xai-fallback";

    const { result, source } = await withCredentialFallback(
      oauthCred,
      fn,
      async () => ({} as never),
      deps
    );
    expect(result).toBe("ok-after-key-escape");
    expect(source).toBe("key");
    expect(fn.mock.calls[0][0].source).toBe("oauth");
    expect(fn.mock.calls[1][0].source).toBe("oauth");
    expect(fn.mock.calls[2][0].source).toBe("key");
    process.env.XAI_API_KEY = prev;
  });

  it("refresh failure with key present uses key escape", async () => {
    const fn = vi.fn(async (cred) => {
      if (cred.source === "oauth") throw apiError(401);
      return "ok";
    });
    const deps = {
      loadOAuth: () => ({
        access_token: "a",
        refresh_token: "r",
        obtained_at: Date.now(),
        expires_at: Date.now() + 9999,
      }),
      refreshOAuth: async () => {
        throw new Error("invalid_grant");
      },
      getKeyEscape: () => ({ source: "key" as const, token: "xai-fallback" }),
    };
    const prev = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "xai-fallback";

    const { result, source } = await withCredentialFallback(
      oauthCred,
      fn,
      async () => ({} as never),
      deps
    );
    expect(result).toBe("ok");
    expect(source).toBe("key");
    process.env.XAI_API_KEY = prev;
  });

  it("401 without key throws re-authentication required", async () => {
    const fn = vi.fn(async () => {
      throw apiError(401);
    });
    const deps = {
      loadOAuth: () => null,
      refreshOAuth: async () => {
        throw new Error("no");
      },
      getKeyEscape: () => null,
    };
    const prev = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;

    await expect(
      withCredentialFallback(oauthCred, fn, async () => ({} as never), deps)
    ).rejects.toThrow("re-authentication required");
    process.env.XAI_API_KEY = prev;
  });

  it("403 oauth with key falls back to key", async () => {
    const fn = vi.fn(async (cred) => {
      if (cred.source === "oauth") throw apiError(403);
      return "allowed";
    });
    const deps = {
      loadOAuth: () => null,
      refreshOAuth: async () => {
        throw new Error("n/a");
      },
      getKeyEscape: () => ({ source: "key" as const, token: "xai-key" }),
    };

    const { result, source } = await withCredentialFallback(
      oauthCred,
      fn,
      async () => ({} as never),
      deps
    );
    expect(result).toBe("allowed");
    expect(source).toBe("key");
  });

  it("403 oauth without key throws allowlist message", async () => {
    const fn = vi.fn(async () => {
      throw apiError(403);
    });
    const deps = {
      loadOAuth: () => null,
      refreshOAuth: async () => {
        throw new Error("n/a");
      },
      getKeyEscape: () => null,
    };
    const prev = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;

    await expect(
      withCredentialFallback(oauthCred, fn, async () => ({} as never), deps)
    ).rejects.toThrow(OAUTH_ALLOWLIST_MESSAGE);
    process.env.XAI_API_KEY = prev;
  });
});
