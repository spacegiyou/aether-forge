#!/usr/bin/env node
/**
 * Structural OAuth contract conformance — no duplicated host literals outside allowlist.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import {
  BROWSER_UI_HOST,
  BROWSER_AUTHORIZE_URL,
  OIDC_ISSUER,
  AUTHORIZE_URL,
  TOKEN_URL,
  CLIENT_ID,
  SCOPE,
  REDIRECT_PORT,
  PKCE_METHOD,
  verifyOAuthContract,
} from "./oauth-contract.mjs";

const ROOT = join(import.meta.dirname, "..");

const ALLOWLIST = new Set([
  "README.md",
  "scripts/oauth-contract.json",
  "scripts/oauth-contract.mjs",
  "scripts/oauth-contract.test.mjs",
  "scripts/verify-xai-oauth-endpoints.mjs",
  "scripts/capture-oauth-evidence.mjs",
]);

const SCAN_EXT = new Set([".ts", ".tsx", ".mjs", ".js", ".md", ".example"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function countHostLiterals(filePath, host) {
  const rel = relative(ROOT, filePath);
  if (ALLOWLIST.has(rel)) return 0;
  const ext = filePath.slice(filePath.lastIndexOf("."));
  if (!SCAN_EXT.has(ext)) return 0;
  const text = readFileSync(filePath, "utf8");
  const matches = text.match(new RegExp(host.replace(/\./g, "\\."), "g"));
  return matches?.length ?? 0;
}

describe("oauth-contract", () => {
  it("exports hermes-derived constants", () => {
    assert.equal(BROWSER_UI_HOST, "accounts.x.ai");
    assert.equal(BROWSER_AUTHORIZE_URL, "https://accounts.x.ai/oauth2/authorize");
    assert.equal(OIDC_ISSUER, "https://auth.x.ai");
    assert.equal(AUTHORIZE_URL, "https://auth.x.ai/oauth2/authorize");
    assert.equal(TOKEN_URL, "https://auth.x.ai/oauth2/token");
    assert.equal(CLIENT_ID, "b1a00492-073a-47ea-816f-4c329264a828");
    assert.equal(SCOPE, "openid profile email offline_access grok-cli:access api:access");
    assert.equal(REDIRECT_PORT, 56121);
    assert.equal(PKCE_METHOD, "S256");
  });

  it("verifyOAuthContract probes accounts 404 and auth OIDC match", async () => {
    const { lines, discovery } = await verifyOAuthContract();
    assert.ok(lines.some((l) => l.includes("accounts discovery status: 404")));
    assert.ok(lines.some((l) => l.includes("accounts authorize GET (browser UI):")));
    assert.ok(lines.some((l) => l.includes("accounts token HEAD:")));
    assert.ok(lines.some((l) => l.includes("accounts token POST (invalid code):")));
    assert.ok(lines.some((l) => l.includes("verified_against_accounts:")));
    assert.ok(lines.some((l) => l.includes("browser_authorize:")));
    assert.ok(lines.some((l) => l.includes("auth discovery status: 200")));
    assert.equal(discovery.authorization_endpoint, AUTHORIZE_URL);
    assert.equal(discovery.token_endpoint, TOKEN_URL);
  });

  it("no raw host literals outside contract allowlist", () => {
    const offenders = [];
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file);
      for (const host of ["accounts.x.ai", "auth.x.ai"]) {
        const count = countHostLiterals(file, host);
        if (count > 0) offenders.push(`${rel}: ${host} (${count})`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `OAuth hosts must only appear in oauth-contract + README:\n${offenders.join("\n")}`
    );
  });
});
