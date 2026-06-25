import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveXaiCredential } from "./credentials";
import type { OAuthTokenData } from "./oauth-store";
import { resetAiEnvCache } from "./env";

describe("resolveXaiCredential", () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetAiEnvCache();
  });

  afterEach(() => {
    process.env = { ...original };
    resetAiEnvCache();
  });

  const validOAuth: OAuthTokenData = {
    access_token: "oauth-access",
    refresh_token: "oauth-refresh",
    obtained_at: Date.now(),
    expires_at: Date.now() + 3_600_000,
  };

  it("returns mock when AI_MODE=mock", async () => {
    process.env.AI_MODE = "mock";
    process.env.XAI_API_KEY = "xai-key";
    resetAiEnvCache();
    const cred = await resolveXaiCredential({
      loadOAuth: async () => validOAuth,
      getEnv: () => ({
        AI_MODE: "mock",
        XAI_API_KEY: "xai-key",
        GROK_TEXT_MODEL: "grok-4.3",
        GROK_FAST_MODEL: "grok-code-fast-1",
        GROK_IMAGE_MODEL: "grok-imagine-image-quality",
      }),
    });
    expect(cred).toEqual({ source: "mock" });
  });

  it("returns key when AI_MODE=key with XAI_API_KEY", async () => {
    const cred = await resolveXaiCredential({
      loadOAuth: async () => validOAuth,
      getEnv: () => ({
        AI_MODE: "key",
        XAI_API_KEY: "xai-key",
        GROK_TEXT_MODEL: "grok-4.3",
        GROK_FAST_MODEL: "grok-code-fast-1",
        GROK_IMAGE_MODEL: "grok-imagine-image-quality",
      }),
    });
    expect(cred).toEqual({ source: "key", token: "xai-key" });
  });

  it("returns mock when AI_MODE=key without XAI_API_KEY (real env path)", async () => {
    process.env.AI_MODE = "key";
    delete process.env.XAI_API_KEY;
    delete process.env.XAI_AUTH_FILE;
    resetAiEnvCache();

    const cred = await resolveXaiCredential({
      loadOAuth: async () => null,
      getEnv: () => ({
        AI_MODE: "key",
        GROK_TEXT_MODEL: "grok-4.3",
        GROK_FAST_MODEL: "grok-code-fast-1",
        GROK_IMAGE_MODEL: "grok-imagine-image-quality",
      }),
    });
    expect(cred).toEqual({ source: "mock" });
  });

  it("prefers oauth in auto mode when token is valid", async () => {
    const cred = await resolveXaiCredential({
      loadOAuth: async () => validOAuth,
      getEnv: () => ({
        AI_MODE: "auto",
        XAI_API_KEY: "xai-key",
        GROK_TEXT_MODEL: "grok-4.3",
        GROK_FAST_MODEL: "grok-code-fast-1",
        GROK_IMAGE_MODEL: "grok-imagine-image-quality",
      }),
    });
    expect(cred.source).toBe("oauth");
    expect(cred.token).toBe("oauth-access");
    expect(cred.expiresAt).toBe(validOAuth.expires_at);
  });

  it("falls back to key in auto mode when no oauth token", async () => {
    const cred = await resolveXaiCredential({
      loadOAuth: async () => null,
      getEnv: () => ({
        AI_MODE: "auto",
        XAI_API_KEY: "xai-key",
        GROK_TEXT_MODEL: "grok-4.3",
        GROK_FAST_MODEL: "grok-code-fast-1",
        GROK_IMAGE_MODEL: "grok-imagine-image-quality",
      }),
    });
    expect(cred).toEqual({ source: "key", token: "xai-key" });
  });

  it("returns mock in auto mode with no credentials", async () => {
    const cred = await resolveXaiCredential({
      loadOAuth: async () => null,
      getEnv: () => ({
        AI_MODE: "auto",
        GROK_TEXT_MODEL: "grok-4.3",
        GROK_FAST_MODEL: "grok-code-fast-1",
        GROK_IMAGE_MODEL: "grok-imagine-image-quality",
      }),
    });
    expect(cred).toEqual({ source: "mock" });
  });

  it("uses oauth when AI_MODE=oauth and token exists", async () => {
    const cred = await resolveXaiCredential({
      loadOAuth: async () => validOAuth,
      getEnv: () => ({
        AI_MODE: "oauth",
        GROK_TEXT_MODEL: "grok-4.3",
        GROK_FAST_MODEL: "grok-code-fast-1",
        GROK_IMAGE_MODEL: "grok-imagine-image-quality",
      }),
    });
    expect(cred.source).toBe("oauth");
  });

  it("falls back to key when AI_MODE=oauth but token missing", async () => {
    const cred = await resolveXaiCredential({
      loadOAuth: async () => null,
      getEnv: () => ({
        AI_MODE: "oauth",
        XAI_API_KEY: "xai-key",
        GROK_TEXT_MODEL: "grok-4.3",
        GROK_FAST_MODEL: "grok-code-fast-1",
        GROK_IMAGE_MODEL: "grok-imagine-image-quality",
      }),
    });
    expect(cred).toEqual({ source: "key", token: "xai-key" });
  });
});