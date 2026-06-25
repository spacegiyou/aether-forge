#!/usr/bin/env node
/**
 * Verification plan evidence — requires clean git tree, then lint/build/test, then HTTP/OAuth probes.
 */

import { spawnSync, spawn } from "child_process";
import { createServer } from "http";
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { exchangeCode, manualPasteFlow } from "./xai-oauth-lib.mjs";
import { TOKEN_URL, BROWSER_AUTHORIZE_URL } from "./oauth-contract.mjs";

const SCRATCH = process.env.SCRATCH_DIR || join(process.cwd(), ".scratch-oauth-evidence");
mkdirSync(SCRATCH, { recursive: true });

const finalGreen = join(SCRATCH, "final-green.log");
const execModes = join(SCRATCH, "exec-modes.log");
const authRun = join(SCRATCH, "auth-run.log");
const unitCreds = join(SCRATCH, "unit-creds.log");
const finalEvidence = join(SCRATCH, "final-evidence.txt");

for (const f of [finalGreen, execModes, authRun, unitCreds]) {
  writeFileSync(f, "");
}

const gitStatus = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" }).stdout.trim();
if (gitStatus) {
  throw new Error(`git working tree must be clean before evidence capture:\n${gitStatus}`);
}

function runShell(cmd, logPath) {
  writeFileSync(logPath, `=== ${cmd} ===\n`, { encoding: "utf8" });
  const result = spawnSync("sh", ["-c", cmd], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = (result.stdout || "") + (result.stderr || "");
  writeFileSync(logPath, out + `\nexit=${result.status ?? 1}\n`, { flag: "a" });
  if (result.status !== 0) {
    throw new Error(`${cmd} failed with ${result.status}`);
  }
  return result;
}

function append(path, text) {
  writeFileSync(path, text + "\n", { flag: "a" });
}

function runNode(script, logPath, extraEnv = {}) {
  writeFileSync(logPath, readFileSync(logPath, "utf8") + `\n=== node ${script} ===\n`, { flag: "a" });
  const result = spawnSync("node", [script], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: { ...process.env, SCRATCH_DIR: SCRATCH, ...extraEnv },
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = (result.stdout || "") + (result.stderr || "");
  writeFileSync(logPath, out + `\nexit=${result.status ?? 1}\n`, { flag: "a" });
  if (result.status !== 0) {
    throw new Error(`node ${script} failed with ${result.status}`);
  }
  return result;
}

// Plan step 3: vitest only (no node --test on .ts)
runShell(
  "npx vitest run src/lib/ai/credentials.test.ts src/lib/ai/oauth-store.test.ts --reporter=verbose",
  unitCreds
);

// Plan step 7: single clean lint && build && test transcript
runShell(
  "npm run lint && npm run build && npm test && npm run test:oauth-script && npm run test:oauth-contract",
  finalGreen
);

runNode("scripts/verify-xai-oauth-endpoints.mjs", authRun);

append(authRun, "=== real OIDC token exchange (invalid code, no mock) ===");
append(authRun, `token_url: ${TOKEN_URL}`);
append(authRun, `browser_authorize: ${BROWSER_AUTHORIZE_URL}`);
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

writeFileSync(execModes, "");
runNode("scripts/capture-exec-modes-http.mjs", execModes);

append(authRun, "=== manual-paste PKCE save path (mock token server, real ~/.aetherforge) ===");

const realTokenPath = join(homedir(), ".aetherforge", "xai-auth.json");
const hadPriorToken = existsSync(realTokenPath);
const priorToken = hadPriorToken ? readFileSync(realTokenPath, "utf8") : null;

await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    if (req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          access_token: "capture-access",
          refresh_token: "capture-refresh",
          expires_in: 3600,
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    append(authRun, `mock_token_server: http://127.0.0.1:${port}/token (harness only — validates saveTokens path)`);
    const child = spawn("node", ["scripts/xai-oauth-login.mjs", "--manual-paste"], {
      env: {
        ...process.env,
        XAI_OAUTH_TOKEN_URL: `http://127.0.0.1:${port}/token`,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.stdin.write("capture-auth-code\n");
    child.stdin.end();

    child.on("close", (code) => {
      server.close();
      append(authRun, stdout);
      if (stderr) append(authRun, `stderr: ${stderr}`);
      append(authRun, `login --manual-paste exit=${code}`);
      append(authRun, `token path: ${realTokenPath}`);

      if (code !== 0) {
        reject(new Error(`login --manual-paste failed: ${code}`));
        return;
      }
      if (!existsSync(realTokenPath)) {
        reject(new Error(`expected token at ${realTokenPath}`));
        return;
      }
      const saved = JSON.parse(readFileSync(realTokenPath, "utf8"));
      if (!saved.obtained_at || !saved.expires_at) {
        reject(new Error("token missing obtained_at/expires_at"));
        return;
      }
      if (stdout.includes("capture-access")) {
        reject(new Error("stdout leaked access token"));
        return;
      }
      if (!stdout.includes(BROWSER_AUTHORIZE_URL)) {
        reject(new Error(`authorize URL must use browser entry ${BROWSER_AUTHORIZE_URL}`));
      }
      append(authRun, `obtained_at=${saved.obtained_at} expires_at=${saved.expires_at}`);

      if (hadPriorToken && priorToken) {
        writeFileSync(realTokenPath, priorToken, { mode: 0o600 });
        append(authRun, "restored prior token file");
      } else {
        rmSync(realTokenPath, { force: true });
        append(authRun, "removed capture token file");
      }
      resolve();
    });
  });
});

writeFileSync(
  finalEvidence,
  [
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
    "browser authorize: accounts.x.ai; OIDC token: auth.x.ai (see oauth-contract.json VERIFICATION_NOTE)",
  ].join("\n") + "\n"
);

console.log(`Evidence captured to ${SCRATCH}`);