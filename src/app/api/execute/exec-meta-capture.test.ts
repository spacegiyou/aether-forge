/**
 * Captures NDJSON meta transcripts for verification evidence (exec-modes.log).
 * Run: npx vitest run src/app/api/execute/exec-meta-capture.test.ts --reporter=verbose
 */

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
  getModelForSource: (s: string) => (s === "oauth" ? "grok-4.3" : "grok-code-fast-1"),
}));

const VALID = JSON.stringify({
  steps: [{ agent: "coder", message: "ok" }],
  code: { language: "ts", filename: "f.ts", content: "export {}" },
  imagePrompt: "img",
  thread: [{ index: 1, text: "t" }],
  chartData: [{ name: "A", value: 1, agents: 1 }],
  summary: "s",
});

async function captureMetaNdjson(label: string): Promise<string> {
  const res = await POST(
    new Request("http://localhost/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: `capture ${label}` }),
    })
  );
  expect(res.ok).toBe(true);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (const line of buffer.split("\n")) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as { type: string; source?: string; aiMode?: string };
      if (event.type === "meta") {
        const ndjson = JSON.stringify(event);
        console.log(`CAPTURE_NDJSON_META [${label}]: ${ndjson}`);
        console.log(`ASSERT_SOURCE [${label}]: ${event.source}`);
        await reader.cancel();
        return ndjson;
      }
    }
  }
  throw new Error(`no meta for ${label}`);
}

describe("POST /api/execute NDJSON meta capture", () => {
  const original = { ...process.env };
  let tmpDir: string;
  let tokenFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "aetherforge-capture-"));
    tokenFile = join(tmpDir, "xai-auth.json");
    vi.mocked(createGrokJsonCompletion).mockResolvedValue(VALID);
    resetAiEnvCache();
  });

  afterEach(() => {
    process.env = { ...original };
    resetAiEnvCache();
  });

  it("captures mock NDJSON meta", async () => {
    process.env.AI_MODE = "auto";
    delete process.env.XAI_API_KEY;
    delete process.env.XAI_AUTH_FILE;
    resetAiEnvCache();

    const line = await captureMetaNdjson("mock");
    expect(line).toContain('"source":"mock"');
    expect(line).toContain('"aiMode":"mock"');
  });

  it("captures key NDJSON meta", async () => {
    process.env.AI_MODE = "auto";
    process.env.XAI_API_KEY = "xai-capture-key";
    delete process.env.XAI_AUTH_FILE;
    resetAiEnvCache();

    const line = await captureMetaNdjson("key");
    expect(line).toContain('"source":"key"');
    expect(line).toContain('"aiMode":"live"');
  });

  it("captures oauth NDJSON meta", async () => {
    process.env.AI_MODE = "auto";
    process.env.XAI_API_KEY = "xai-capture-key";
    process.env.XAI_AUTH_FILE = tokenFile;
    writeFileSync(
      tokenFile,
      JSON.stringify({
        access_token: "oauth-capture",
        refresh_token: "oauth-ref",
        obtained_at: Date.now(),
        expires_at: Date.now() + 7_200_000,
      }),
      "utf8"
    );
    resetAiEnvCache();

    const line = await captureMetaNdjson("oauth");
    expect(line).toContain('"source":"oauth"');
    expect(line).toContain('"aiMode":"live"');
  });
});