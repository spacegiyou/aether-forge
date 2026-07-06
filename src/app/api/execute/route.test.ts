import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { POST } from "./route";
import { resetAiEnvCache } from "@/lib/ai/env";
import { createGrokJsonCompletion } from "@/lib/ai/grok-completion";

vi.mock("@/lib/ai/grok-completion");
vi.mock("@/lib/ai/generate-image", () => ({
  generateGrokImage: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/ai/grok-client", () => ({
  getGrokClient: vi.fn().mockResolvedValue({}),
  getModelForSource: (s: string) => (s === "oauth" ? "grok-4.3" : "grok-build-0.1"),
}));

const VALID_EXECUTION = JSON.stringify({
  steps: [{ agent: "coder", message: "ok" }],
  code: { language: "ts", filename: "f.ts", content: "export {}" },
  imagePrompt: "img",
  thread: [{ index: 1, text: "t" }],
  chartData: [{ name: "A", value: 1, agents: 1 }],
  summary: "s",
});

async function firstMetaFromExecute(goal = "build a test dashboard"): Promise<{
  aiMode: string;
  source: string;
}> {
  const res = await POST(
    new Request("http://localhost/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    })
  );
  expect(res.ok).toBe(true);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("no body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const line = buffer.split("\n").find((l) => l.trim());
    if (line) {
      const event = JSON.parse(line) as { type: string; aiMode?: string; source?: string };
      if (event.type === "meta") {
        await reader.cancel();
        return { aiMode: event.aiMode!, source: event.source! };
      }
    }
  }
  throw new Error("no meta event in stream");
}

describe("POST /api/execute meta source", () => {
  const original = { ...process.env };
  let tmpDir: string;
  let tokenFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "aetherforge-api-exec-"));
    tokenFile = join(tmpDir, "xai-auth.json");
    vi.mocked(createGrokJsonCompletion).mockResolvedValue(VALID_EXECUTION);
    resetAiEnvCache();
  });

  afterEach(() => {
    process.env = { ...original };
    resetAiEnvCache();
  });

  it("returns meta source mock with no creds", async () => {
    process.env.AI_MODE = "auto";
    delete process.env.XAI_API_KEY;
    delete process.env.XAI_AUTH_FILE;
    resetAiEnvCache();

    const meta = await firstMetaFromExecute();
    expect(meta).toEqual({ aiMode: "mock", source: "mock" });
  });

  it("returns meta source key when XAI_API_KEY set", async () => {
    process.env.AI_MODE = "auto";
    process.env.XAI_API_KEY = "xai-test-key";
    delete process.env.XAI_AUTH_FILE;
    resetAiEnvCache();

    const meta = await firstMetaFromExecute();
    expect(meta).toEqual({ aiMode: "live", source: "key" });
  });

  it("returns meta source oauth when token file exists", async () => {
    process.env.AI_MODE = "auto";
    process.env.XAI_API_KEY = "xai-test-key";
    process.env.XAI_AUTH_FILE = tokenFile;
    writeFileSync(
      tokenFile,
      JSON.stringify({
        access_token: "oauth-access",
        refresh_token: "oauth-refresh",
        obtained_at: Date.now(),
        expires_at: Date.now() + 7_200_000,
      }),
      "utf8"
    );
    resetAiEnvCache();

    const meta = await firstMetaFromExecute();
    expect(meta).toEqual({ aiMode: "live", source: "oauth" });
  });
});
