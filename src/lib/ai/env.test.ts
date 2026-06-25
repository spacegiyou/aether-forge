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

  it("defaults to auto mode without API key", () => {
    delete process.env.AI_MODE;
    delete process.env.XAI_API_KEY;
    resetAiEnvCache();
    expect(isMockMode()).toBe(false);
    expect(getAiEnv().AI_MODE).toBe("auto");
    expect(getAiEnv().GROK_TEXT_MODEL).toBe("grok-4.3");
  });

  it("requireLiveEnv throws without key", () => {
    process.env.AI_MODE = "key";
    delete process.env.XAI_API_KEY;
    resetAiEnvCache();
    expect(() => requireLiveEnv()).toThrow("XAI_API_KEY");
  });

  it("requireLiveEnv succeeds with key in key mode", () => {
    process.env.AI_MODE = "key";
    process.env.XAI_API_KEY = "xai-test-key";
    resetAiEnvCache();
    const env = requireLiveEnv();
    expect(env.XAI_API_KEY).toBe("xai-test-key");
    expect(env.GROK_IMAGE_MODEL).toBe("grok-imagine-image-quality");
  });

  it("validateAiEnvAtBoot allows key mode without key (resolver falls back to mock)", () => {
    process.env.AI_MODE = "key";
    delete process.env.XAI_API_KEY;
    expect(() => validateAiEnvAtBoot()).not.toThrow();
    expect(getAiEnv().AI_MODE).toBe("key");
  });
});