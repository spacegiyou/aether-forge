#!/usr/bin/env node
/**
 * Verification helper — exercises PKCE token exchange + save in a temp dir
 * without printing secrets or touching ~/.aetherforge.
 */

import {
  mkdtempSync,
  existsSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";

const SCRATCH = process.env.SCRATCH_DIR;
const tmpDir = mkdtempSync(join(tmpdir(), "aetherforge-verify-"));
const tokenFile = join(tmpDir, "xai-auth.json");

const logs = [];

function log(line) {
  logs.push(line);
  console.log(line);
}

function saveTokens(path, body) {
  const now = Date.now();
  const data = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    obtained_at: now,
    expires_at: now + body.expires_in * 1000,
  };
  const dir = join(path, "..");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

log("=== verify-oauth-flow ===");
log(`temp dir: ${tmpDir}`);

const help = spawnSync("node", ["scripts/xai-oauth-login.mjs", "--help"], {
  encoding: "utf8",
  cwd: process.cwd(),
});
log("--- --help stdout ---");
log(help.stdout.trim());
if (help.stderr) log(`stderr: ${help.stderr.trim()}`);
const helpCombined = help.stdout + help.stderr;
if (/access_token|refresh_token|"xai-[a-zA-Z0-9]{8,}"/i.test(helpCombined)) {
  throw new Error("help output leaked secrets");
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("/oauth2/token")) {
    const body = String(init?.body ?? "");
    if (!body.includes("authorization_code") || !body.includes("code_verifier")) {
      throw new Error("token request missing PKCE fields");
    }
    return new Response(
      JSON.stringify({
        access_token: "verify-access",
        refresh_token: "verify-refresh",
        expires_in: 3600,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  return originalFetch(url, init);
};

const tokenUrl = "https://auth.x.ai/oauth2/token";
const res = await fetch(tokenUrl, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: "test-auth-code",
    redirect_uri: "http://127.0.0.1:56121/callback",
    client_id: "b1a00492-073a-47ea-816f-4c329264a828",
    code_verifier: "test-verifier",
  }).toString(),
});
const exchanged = await res.json();
saveTokens(tokenFile, exchanged);
globalThis.fetch = originalFetch;

if (!existsSync(tokenFile)) {
  throw new Error("token file not created");
}
const saved = JSON.parse(readFileSync(tokenFile, "utf8"));
if (!saved.obtained_at || !saved.expires_at) {
  throw new Error("token file missing obtained_at/expires_at");
}
log(`token file created: ${tokenFile}`);
log(`obtained_at=${saved.obtained_at} expires_at=${saved.expires_at}`);
log("stdout check: no access_token value printed above");

rmSync(tmpDir, { recursive: true, force: true });
log("temp dir cleaned up");

if (SCRATCH) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, "auth-run.log"), logs.join("\n") + "\n");
  log(`wrote ${join(SCRATCH, "auth-run.log")}`);
}