import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { streamGoalExecution } from "./execute-router";
import { resetAiEnvCache } from "./env";

describe("streamGoalExecution credential routing", () => {
  const original = { ...process.env };
  let tmpDir: string;
  let tokenFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "aetherforge-exec-"));
    tokenFile = join(tmpDir, "xai-auth.json");
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