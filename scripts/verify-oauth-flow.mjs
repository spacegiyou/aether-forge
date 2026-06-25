#!/usr/bin/env node
/**
 * Verification — drives shipped xai-oauth-lib.mjs manualPasteFlow + login --help.
 */

import { spawnSync } from "child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  manualPasteFlow,
  XAI_OAUTH_TOKEN_URL,
} from "./xai-oauth-lib.mjs";

const SCRATCH = process.env.SCRATCH_DIR;
const tmpDir = mkdtempSync(join(tmpdir(), "aetherforge-verify-"));
const tokenFile = join(tmpDir, "xai-auth.json");
const logs = [];

function log(line) {
  logs.push(line);
  console.log(line);
}

log("=== verify-oauth-flow (shipped lib + login --help) ===");

const help = spawnSync("node", ["scripts/xai-oauth-login.mjs", "--help"], {
  encoding: "utf8",
  cwd: process.cwd(),
});
log("--- login --help ---");
log(help.stdout.trim());
if (/access_token|refresh_token/i.test(help.stdout + help.stderr)) {
  throw new Error("help output leaked token field names with values");
}

process.env.XAI_AUTH_FILE = tokenFile;
const fetcher = async (url, init) => {
  if (String(url) !== XAI_OAUTH_TOKEN_URL) throw new Error(`unexpected fetch url: ${url}`);
  const body = String(init?.body ?? "");
  if (!body.includes("authorization_code") || !body.includes("code_verifier")) {
    throw new Error("shipped exchangeCode missing PKCE fields");
  }
  return new Response(
    JSON.stringify({
      access_token: "verify-access",
      refresh_token: "verify-refresh",
      expires_in: 3600,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

const result = await manualPasteFlow(
  "state-verify",
  "verifier-verify-xyz",
  "http://127.0.0.1:56121/callback?code=verify-code&state=state-verify",
  fetcher
);
delete process.env.XAI_AUTH_FILE;

if (!existsSync(result.path)) throw new Error("token file not created");
const saved = JSON.parse(readFileSync(result.path, "utf8"));
if (!saved.obtained_at || !saved.expires_at) throw new Error("missing obtained_at/expires_at");
log(`manualPasteFlow saved: ${result.path}`);
log(`obtained_at=${saved.obtained_at} expires_at=${saved.expires_at}`);
log("stdout: no secret values printed");

rmSync(tmpDir, { recursive: true, force: true });

if (SCRATCH) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, "auth-run.log"), logs.join("\n") + "\n");
}