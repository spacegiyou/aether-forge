import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAiEnv, isMockMode, requireLiveEnv, resetAiEnvCache, validateAiEnvAtBoot } from "./env";

describe("ai env", () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetAiEnvCache();
  });

  afterEach(() => {
    process.env = { ...original };
    resetAiEnvCache();
  });

  it("defaults to mock mode without API key", () => {
    delete process.env.AI_MODE;
    delete process.env.XAI_API_KEY;
    resetAiEnvCache();
    expect(isMockMode()).toBe(true);
    expect(getAiEnv().GROK_TEXT_MODEL).toBe("grok-4.3");
  });

  it("requireLiveEnv throws without key", () => {
    process.env.AI_MODE = "live";
    delete process.env.XAI_API_KEY;
    resetAiEnvCache();
    expect(() => requireLiveEnv()).toThrow("XAI_API_KEY");
  });

  it("requireLiveEnv succeeds with key in live mode", () => {
    process.env.AI_MODE = "live";
    process.env.XAI_API_KEY = "xai-test-key";
    resetAiEnvCache();
    const env = requireLiveEnv();
    expect(env.XAI_API_KEY).toBe("xai-test-key");
    expect(env.GROK_IMAGE_MODEL).toBe("grok-imagine-image-quality");
  });

  it("validateAiEnvAtBoot runs eager Zod parse and rejects live without key", () => {
    process.env.AI_MODE = "live";
    delete process.env.XAI_API_KEY;
    expect(() => validateAiEnvAtBoot()).toThrow("XAI_API_KEY");
  });
});