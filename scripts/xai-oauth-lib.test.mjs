#!/usr/bin/env node
/**
 * Tests the SHIPPED scripts/xai-oauth-lib.mjs code path (used by xai-oauth-login.mjs).
 * Run: node --test scripts/xai-oauth-lib.test.mjs
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  parseCallbackInput,
  manualPasteFlow,
  exchangeCode,
  buildAuthorizeUrl,
  pkceChallenge,
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_TOKEN_URL,
  XAI_OAUTH_AUTHORIZE_URL,
} from "./xai-oauth-lib.mjs";

describe("xai-oauth-lib (shipped login code)", () => {
  let tmpDir;
  let tokenFile;
  const originalAuthFile = process.env.XAI_AUTH_FILE;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "aetherforge-oauth-lib-"));
    tokenFile = join(tmpDir, "xai-auth.json");
    process.env.XAI_AUTH_FILE = tokenFile;
  });

  after(() => {
    if (originalAuthFile === undefined) delete process.env.XAI_AUTH_FILE;
    else process.env.XAI_AUTH_FILE = originalAuthFile;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parseCallbackInput accepts callback URL, query, or bare code", () => {
    assert.deepEqual(parseCallbackInput("http://127.0.0.1:56121/callback?code=abc&state=xyz"), {
      code: "abc",
      state: "xyz",
    });
    assert.deepEqual(parseCallbackInput("bare-code"), { code: "bare-code", state: null });
  });

  it("buildAuthorizeUrl uses auth.x.ai authorize + plan=generic", () => {
    const url = buildAuthorizeUrl("state123", "verifier123");
    assert.ok(url.startsWith("https://auth.x.ai/oauth2/authorize"));
    assert.ok(url.startsWith(XAI_OAUTH_AUTHORIZE_URL));
    assert.ok(url.includes(`client_id=${XAI_OAUTH_CLIENT_ID}`));
    assert.ok(url.includes("plan=generic"));
    assert.ok(url.includes("code_challenge_method=S256"));
  });

  it("manualPasteFlow drives exchangeCode+saveTokens on shipped path", async () => {
    const verifier = "test-verifier-abc";
    const fetcher = async (url, init) => {
      assert.equal(url, XAI_OAUTH_TOKEN_URL);
      const body = String(init.body);
      assert.match(body, /grant_type=authorization_code/);
      assert.match(body, /code=auth-code-123/);
      assert.match(body, /code_verifier=test-verifier-abc/);
      assert.match(body, /code_challenge=/);
      assert.match(body, /code_challenge_method=S256/);
      return new Response(
        JSON.stringify({
          access_token: "shipped-access",
          refresh_token: "shipped-refresh",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const pasted = "http://127.0.0.1:56121/callback?code=auth-code-123&state=s1";
    const result = await manualPasteFlow("s1", verifier, pasted, fetcher);
    assert.equal(result.path, tokenFile);
    assert.ok(existsSync(tokenFile));
    const saved = JSON.parse(readFileSync(tokenFile, "utf8"));
    assert.equal(saved.access_token, "shipped-access");
    assert.ok(saved.obtained_at > 0);
    assert.ok(saved.expires_at > saved.obtained_at);
  });

  it("exchangeCode echoes code_challenge per hermes-agent #26990", async () => {
    const verifier = "v1";
    let capturedBody = "";
    const fetcher = async (_url, init) => {
      capturedBody = String(init.body);
      return new Response(
        JSON.stringify({ access_token: "a", refresh_token: "r", expires_in: 60 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };
    await exchangeCode("c1", verifier, fetcher);
    assert.equal(capturedBody, new URLSearchParams({
      grant_type: "authorization_code",
      code: "c1",
      redirect_uri: "http://127.0.0.1:56121/callback",
      client_id: XAI_OAUTH_CLIENT_ID,
      code_verifier: verifier,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
    }).toString());
  });
});