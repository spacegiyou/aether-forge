import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getGrokClient } from "./grok-client";

import { withCredentialFallback, getHttpStatus, planOAuthRecovery } from "./grok-errors";
import { loadOAuthToken, refreshOAuthToken } from "./oauth-store";
import type { XaiCredential } from "./credentials";

vi.mock("./oauth-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./oauth-store")>();
  return {
    ...actual,
    loadOAuthToken: vi.fn(),
    refreshOAuthToken: vi.fn(),
  };
});

function bearerToken(init?: RequestInit): string {
  const headers = init?.headers;
  const raw =
    headers instanceof Headers
      ? headers.get("Authorization")
      : (headers as Record<string, string> | undefined)?.Authorization;
  return String(raw ?? "").replace(/^Bearer\s+/i, "");
}

function openAiErrorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      error: { message, type: "invalid_request_error", code: status === 401 ? "invalid_api_key" : "forbidden" },
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

function openAiChatOk(content: string): Response {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: Date.now(),
      model: "grok-4.3",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("withCredentialFallback + real getGrokClient + OpenAI chat 401/403", () => {
  const original = { ...process.env };
  const oauthCred: XaiCredential = { source: "oauth", token: "oauth-access-test" };

  beforeEach(() => {
    vi.mocked(loadOAuthToken).mockReturnValue({
      access_token: "oauth-access-test",
      refresh_token: "oauth-refresh-test",
      obtained_at: Date.now(),
      expires_at: Date.now() + 9_999_999,
    });
    vi.mocked(refreshOAuthToken).mockResolvedValue({
      access_token: "oauth-refreshed-test",
      refresh_token: "oauth-refresh-test",
      obtained_at: Date.now(),
      expires_at: Date.now() + 9_999_999,
    });
  });

  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });

  it("OpenAI AuthenticationError status is visible to recovery planner", async () => {
    const mockFetch: typeof fetch = async () => openAiErrorResponse(401, "Unauthorized");
    const client = await getGrokClient(oauthCred, { fetch: mockFetch });
    try {
      await client.chat.completions.create({
        model: "grok-4.3",
        messages: [{ role: "user", content: "hi" }],
      });
      expect.fail("expected 401");
    } catch (err) {
      expect(getHttpStatus(err)).toBe(401);
      expect(
        planOAuthRecovery({
          status: getHttpStatus(err),
          source: "oauth",
          refreshAttempted: false,
          hasApiKey: true,
        })
      ).toBe("refresh-once");
    }
  });

  it("oauth chat 401 from real OpenAI client refreshes then escapes to key", async () => {
    let oauthAttempts = 0;
    const mockFetch: typeof fetch = async (_url, init) => {
      const auth = bearerToken(init);
      if (auth === "xai-escape-key") {
        return openAiChatOk('{"steps":[],"code":{"language":"ts","filename":"a.ts","content":"export {}"},"imagePrompt":"x","thread":[],"chartData":[],"summary":"ok"}');
      }
      if (auth.startsWith("oauth-")) {
        oauthAttempts++;
        return openAiErrorResponse(401, "Unauthorized");
      }
      return openAiErrorResponse(401, "Unauthorized");
    };

    process.env.XAI_API_KEY = "xai-escape-key";
    const getClient = (cred: XaiCredential) => getGrokClient(cred, { fetch: mockFetch });

    const deps = {
      loadOAuth: () => ({
        access_token: "oauth-access-test",
        refresh_token: "oauth-refresh-test",
        obtained_at: Date.now(),
        expires_at: Date.now() + 9_999_999,
      }),
      refreshOAuth: async () => ({
        access_token: "oauth-refreshed-test",
        refresh_token: "oauth-refresh-test",
        obtained_at: Date.now(),
        expires_at: Date.now() + 9_999_999,
      }),
      getKeyEscape: () => ({ source: "key" as const, token: "xai-escape-key" }),
    };

    const { result, source } = await withCredentialFallback(
      oauthCred,
      async (_cred, client) => {
        const completion = await client.chat.completions.create({
          model: "grok-4.3",
          messages: [{ role: "user", content: "return json" }],
        });
        return completion.choices[0]?.message?.content ?? "";
      },
      getClient,
      deps
    );

    expect(source).toBe("key");
    expect(result).toContain("summary");
    expect(oauthAttempts).toBeGreaterThanOrEqual(2);
  });

  it("oauth 403 from real OpenAI client falls back to key without refresh loop", async () => {
    const mockFetch: typeof fetch = async (_url, init) => {
      const auth = bearerToken(init);
      if (auth === "xai-403-escape") {
        return openAiChatOk('{"steps":[],"code":{"language":"ts","filename":"a.ts","content":"export {}"},"imagePrompt":"x","thread":[],"chartData":[],"summary":"ok"}');
      }
      return openAiErrorResponse(403, "Forbidden");
    };

    process.env.XAI_API_KEY = "xai-403-escape";
    const getClient = (cred: XaiCredential) => getGrokClient(cred, { fetch: mockFetch });

    const deps = {
      loadOAuth: () => null,
      refreshOAuth: async () => {
        throw new Error("n/a");
      },
      getKeyEscape: () => ({ source: "key" as const, token: "xai-403-escape" }),
    };

    const { source } = await withCredentialFallback(
      oauthCred,
      async (_cred, client) => {
        await client.chat.completions.create({
          model: "grok-4.3",
          messages: [{ role: "user", content: "return json" }],
        });
        return "unused";
      },
      getClient,
      deps
    );

    expect(source).toBe("key");
  });
});