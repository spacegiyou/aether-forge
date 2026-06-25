import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamLiveExecution } from "./execute-live";
import { generateGrokImage } from "./generate-image";
import { loadOAuthToken, refreshOAuthToken } from "./oauth-store";

vi.mock("./generate-image", () => ({
  generateGrokImage: vi.fn().mockResolvedValue({}),
}));

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

function chatOk(content: string): Response {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-live",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "grok-4.3",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function chatErr(status: number): Response {
  return new Response(
    JSON.stringify({
      error: { message: status === 401 ? "Unauthorized" : "Forbidden", type: "invalid_request_error" },
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

const VALID_EXECUTION = JSON.stringify({
  steps: [{ agent: "coder", message: "ok" }],
  code: { language: "typescript", filename: "goal.ts", content: "export async function run() {}" },
  imagePrompt: "test",
  thread: [{ index: 1, text: "post" }],
  chartData: [{ name: "Speed", value: 80, agents: 2 }],
  summary: "done",
});

async function collectAll(goal: string, credential: Parameters<typeof streamLiveExecution>[1]) {
  const events = [];
  for await (const e of streamLiveExecution(goal, credential)) {
    events.push(e);
  }
  return events;
}

describe("streamLiveExecution (real Grok client path)", () => {
  const original = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(generateGrokImage).mockResolvedValue({});
  });

  afterEach(() => {
    process.env = { ...original };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("full stream: OAuth 401 via real OpenAI SDK then key escape yields two metas", async () => {
    let oauthCalls = 0;
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const auth = bearerToken(init);
      if (auth === "xai-live-escape") return chatOk(VALID_EXECUTION);
      if (auth.startsWith("oauth-")) {
        oauthCalls++;
        return chatErr(401);
      }
      return chatErr(401);
    });

    vi.mocked(loadOAuthToken).mockReturnValue({
      access_token: "oauth-live",
      refresh_token: "oauth-ref",
      obtained_at: Date.now(),
      expires_at: Date.now() + 9_999_999,
    });
    vi.mocked(refreshOAuthToken).mockResolvedValue({
      access_token: "oauth-refreshed-live",
      refresh_token: "oauth-ref",
      obtained_at: Date.now(),
      expires_at: Date.now() + 9_999_999,
    });

    process.env.XAI_API_KEY = "xai-live-escape";

    const events = await collectAll("integration goal", {
      source: "oauth",
      token: "oauth-live",
    });

    const metas = events.filter((e) => e.type === "meta");
    expect(metas).toEqual([
      { type: "meta", aiMode: "live", source: "oauth" },
      { type: "meta", aiMode: "live", source: "key" },
    ]);
    expect(events.find((e) => e.type === "output")).toBeDefined();
    expect(oauthCalls).toBeGreaterThanOrEqual(2);
    expect(fetchMock).toHaveBeenCalled();
  });
});