#!/usr/bin/env node
/**
 * Verification plan evidence — pre-oauth gate, unit/static/HTTP probes, final-green.
 */

import { spawnSync } from "child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { exchangeCode, manualPasteFlow } from "./xai-oauth-lib.mjs";
import { TOKEN_URL, BROWSER_AUTHORIZE_URL } from "./oauth-contract.mjs";

const SCRATCH = process.env.SCRATCH_DIR || join(process.cwd(), ".scratch-oauth-evidence");
mkdirSync(SCRATCH, { recursive: true });

const preOauth = join(SCRATCH, "pre-oauth.log");
const finalGreen = join(SCRATCH, "final-green.log");
const execModes = join(SCRATCH, "exec-modes.log");
const authRun = join(SCRATCH, "auth-run.log");
const unitCreds = join(SCRATCH, "unit-creds.log");
const staticCheck = join(SCRATCH, "static-check.log");
const finalEvidence = join(SCRATCH, "final-evidence.txt");

const preGitStatus = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" }).stdout.trim();

function runShell(cmd, logPath, { append = false, failOnError = true } = {}) {
  const prefix = append ? readFileSync(logPath, "utf8") + `\n=== ${cmd} ===\n` : `=== ${cmd} ===\n`;
  writeFileSync(logPath, prefix, { encoding: "utf8" });
  const result = spawnSync("sh", ["-c", cmd], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = (result.stdout || "") + (result.stderr || "");
  writeFileSync(logPath, out + `\nexit=${result.status ?? 1}\n`, { flag: "a" });
  if (failOnError && result.status !== 0) {
    throw new Error(`${cmd} failed with ${result.status}`);
  }
  return result;
}

function append(path, text) {
  writeFileSync(path, text + "\n", { flag: "a" });
}

function runNode(script, logPath, extraEnv = {}) {
  append(logPath, `=== node ${script} ===`);
  const result = spawnSync("node", [script], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: { ...process.env, SCRATCH_DIR: SCRATCH, ...extraEnv },
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = (result.stdout || "") + (result.stderr || "");
  append(logPath, out + `\nexit=${result.status ?? 1}`);
  if (result.status !== 0) {
    throw new Error(`node ${script} failed with ${result.status}`);
  }
  return result;
}

// Plan step 1: pre-oauth gate (git status + lint/build/test)
writeFileSync(
  preOauth,
  [
    "=== git status --porcelain (pre-capture) ===",
    preGitStatus || "(clean)",
    "",
  ].join("\n")
);
if (preGitStatus) {
  throw new Error(`git working tree must be clean before evidence capture:\n${preGitStatus}`);
}
runShell("npm run lint && npm run build && npm test", preOauth, { append: true });

// Plan step 3: vitest only (no node --test on .ts)
runShell(
  "npx vitest run src/lib/ai/credentials.test.ts src/lib/ai/oauth-store.test.ts --reporter=verbose",
  unitCreds
);

// Plan step 5: static structural checks
runNode("scripts/capture-static-check.mjs", staticCheck);

// Plan step 2 + OAuth probes
writeFileSync(authRun, "");
runNode("scripts/verify-xai-oauth-endpoints.mjs", authRun);
runShell("node scripts/xai-oauth-login.mjs --help", authRun, { append: true });
runShell("node --test scripts/xai-oauth-lib.test.mjs", authRun, { append: true });
runShell(
  "npx vitest run src/lib/ai/execute-live.integration.test.ts --reporter=verbose",
  authRun,
  { append: true }
);

append(authRun, "=== real OIDC token exchange (invalid code, no mock) ===");
append(authRun, `token_url: ${TOKEN_URL}`);
append(authRun, `browser_authorize: ${BROWSER_AUTHORIZE_URL}`);
append(authRun, "note: full success exchange requires interactive npm run auth:xai (browser login)");
try {
  await exchangeCode("invalid-capture-code", "capture-verifier-abc");
  throw new Error("expected token exchange to fail for invalid code");
} catch (e) {
  append(authRun, `expected_token_exchange_error: ${e instanceof Error ? e.message : String(e)}`);
}

append(authRun, "=== manualPasteFlow real token URL (invalid code, no mock) ===");
try {
  await manualPasteFlow("probe-state", "probe-verifier-abc", "invalid-paste-code");
  throw new Error("expected manualPasteFlow to fail on invalid code");
} catch (e) {
  append(authRun, `manual_paste_real_exchange_error: ${e instanceof Error ? e.message : String(e)}`);
}

// Plan step 4: HTTP exec modes
writeFileSync(execModes, "");
runNode("scripts/capture-exec-modes-http.mjs", execModes);

// Plan step 7: final green (full suite incl oauth node tests)
runShell(
  "npm run lint && npm run build && npm test && npm run test:oauth-script && npm run test:oauth-contract",
  finalGreen
);

const realTokenPath = join(homedir(), ".aetherforge", "xai-auth.json");
writeFileSync(
  finalEvidence,
  [
    "=== git status (pre-capture) ===",
    preGitStatus || "(clean)",
    "",
    "=== git status (post-capture) ===",
    spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" }).stdout.trim() || "(clean)",
    "",
    "=== package.json auth scripts ===",
    spawnSync("grep", ["-A2", "auth:xai", "package.json"], { encoding: "utf8" }).stdout.trim(),
    "",
    "=== .gitignore token patterns ===",
    spawnSync("grep", ["-E", "xai-auth|aetherforge", ".gitignore"], { encoding: "utf8" }).stdout.trim(),
    "",
    `default home token path: ${realTokenPath}`,
    `token file exists after capture: ${existsSync(realTokenPath)}`,
    "browser authorize: accounts.x.ai/oauth2/authorize",
    "OIDC token exchange: auth.x.ai/oauth2/token (hermes-agent)",
    "see oauth-contract.json VERIFICATION_NOTE + scripts/capture-static-check.mjs",
  ].join("\n") + "\n"
);

console.log(`Evidence captured to ${SCRATCH}`);