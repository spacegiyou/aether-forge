import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { streamGoalExecution } from "./execute-router";
import { resetAiEnvCache } from "./env";
import { createGrokJsonCompletion } from "./grok-completion";

vi.mock("./grok-completion");
vi.mock("./generate-image", () => ({
  generateGrokImage: vi.fn().mockResolvedValue({}),
}));
vi.mock("./grok-client", () => ({
  getGrokClient: vi.fn().mockResolvedValue({}),
  getModelForSource: (s: string) => (s === "oauth" ? "grok-4.3" : "grok-code-fast-1"),
}));

const VALID_EXECUTION = JSON.stringify({
  steps: [{ agent: "coder", message: "ok" }],
  code: { language: "ts", filename: "f.ts", content: "export {}" },
  imagePrompt: "img",
  thread: [{ index: 1, text: "t" }],
  chartData: [{ name: "A", value: 1, agents: 1 }],
  summary: "s",
});

describe("streamGoalExecution credential routing", () => {
  const original = { ...process.env };
  let tmpDir: string;
  let tokenFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "aetherforge-exec-"));
    tokenFile = join(tmpDir, "xai-auth.json");
    vi.mocked(createGrokJsonCompletion).mockResolvedValue(VALID_EXECUTION);
    resetAiEnvCache();
  });

  afterEach(() => {
    process.env = { ...original };
    resetAiEnvCache();
  });

  async function firstMeta(goal = "test goal") {
    const gen = streamGoalExecution(goal);
    const first = await gen.next();
    await gen.return(undefined);
    return first.value;
  }

  it("meta source is mock with no creds (AI_MODE=auto)", async () => {
    process.env.AI_MODE = "auto";
    delete process.env.XAI_API_KEY;
    delete process.env.XAI_AUTH_FILE;
    resetAiEnvCache();

    const event = await firstMeta();
    expect(event).toEqual({ type: "meta", aiMode: "mock", source: "mock" });
  });

  it("meta source is key when XAI_API_KEY set and no oauth token", async () => {
    process.env.AI_MODE = "auto";
    process.env.XAI_API_KEY = "xai-test-key";
    delete process.env.XAI_AUTH_FILE;
    resetAiEnvCache();

    const event = await firstMeta();
    expect(event).toEqual({ type: "meta", aiMode: "live", source: "key" });
  });

  it("meta source is oauth when non-expired token file exists", async () => {
    process.env.AI_MODE = "auto";
    process.env.XAI_API_KEY = "xai-test-key";
    process.env.XAI_AUTH_FILE = tokenFile;
    writeFileSync(
      tokenFile,
      JSON.stringify({
        access_token: "oauth-access-token",
        refresh_token: "oauth-refresh-token",
        obtained_at: Date.now(),
        expires_at: Date.now() + 7_200_000,
      }),
      "utf8"
    );
    resetAiEnvCache();

    const event = await firstMeta();
    expect(event).toEqual({ type: "meta", aiMode: "live", source: "oauth" });
  });
});