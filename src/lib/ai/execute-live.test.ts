import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamLiveExecution } from "./execute-live";
import { planStreamMetaEvents } from "./stream-meta";
import { createGrokJsonCompletion } from "./grok-completion";
import { getGrokClient } from "./grok-client";
import { generateGrokImage } from "./generate-image";
import { loadOAuthToken, refreshOAuthToken } from "./oauth-store";

vi.mock("./grok-completion");
vi.mock("./grok-client");
vi.mock("./generate-image");
vi.mock("./oauth-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./oauth-store")>();
  return {
    ...actual,
    loadOAuthToken: vi.fn(),
    refreshOAuthToken: vi.fn(),
  };
});

const VALID_EXECUTION = {
  steps: [{ agent: "coder", message: "Building…" }],
  code: { language: "typescript", filename: "goal.ts", content: "export async function run() {}" },
  imagePrompt: "test",
  thread: [{ index: 1, text: "post" }],
  chartData: [{ name: "Speed", value: 80, agents: 2 }],
  summary: "done",
};

function apiError(status: number): Error & { status: number } {
  const e = new Error(`HTTP ${status}`) as Error & { status: number };
  e.status = status;
  return e;
}

async function collectEvents(goal: string, credential: Parameters<typeof streamLiveExecution>[1]) {
  const events = [];
  for await (const e of streamLiveExecution(goal, credential)) {
    events.push(e);
    if (e.type === "error" || e.type === "done") break;
  }
  return events;
}

describe("streamLiveExecution", () => {
  const original = { ...process.env };

  beforeEach(() => {
    vi.mocked(getGrokClient).mockResolvedValue({} as never);
    vi.mocked(generateGrokImage).mockResolvedValue({});
  });

  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
  });

  it("meta source reflects key after OAuth 401 refresh then key escape", async () => {
    let oauthCalls = 0;
    vi.mocked(createGrokJsonCompletion).mockImplementation(async (_client, source) => {
      if (source === "oauth") {
        oauthCalls++;
        throw apiError(401);
      }
      return JSON.stringify(VALID_EXECUTION);
    });

    vi.mocked(loadOAuthToken).mockReturnValue({
      access_token: "oauth-tok",
      refresh_token: "oauth-ref",
      obtained_at: Date.now(),
      expires_at: Date.now() + 9_999_999,
    });
    vi.mocked(refreshOAuthToken).mockResolvedValue({
      access_token: "refreshed-tok",
      refresh_token: "oauth-ref",
      obtained_at: Date.now(),
      expires_at: Date.now() + 9_999_999,
    });

    process.env.XAI_API_KEY = "xai-escape-key";

    const events = await collectEvents("test goal", {
      source: "oauth",
      token: "oauth-tok",
    });

    const metas = events.filter((e) => e.type === "meta");
    expect(metas).toEqual(planStreamMetaEvents("oauth", "key"));
    expect(oauthCalls).toBeGreaterThanOrEqual(2);
    expect(vi.mocked(createGrokJsonCompletion).mock.calls.some((c) => c[1] === "key")).toBe(true);
  });

  it("yields early meta with attempted source when fetch fails unrecoverably", async () => {
    vi.mocked(createGrokJsonCompletion).mockRejectedValue(new Error("re-authentication required"));

    const events = await collectEvents("fail goal", {
      source: "oauth",
      token: "oauth-tok",
    });

    const metas = events.filter((e) => e.type === "meta");
    expect(metas).toEqual(planStreamMetaEvents("oauth"));
    expect(events.find((e) => e.type === "error")).toBeDefined();
  });
});