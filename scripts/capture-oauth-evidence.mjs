#!/usr/bin/env node
/**
 * Single evidence capture — lint+build+test, HTTP exec modes, OAuth verify + login.
 * Tee to SCRATCH_DIR/final-green.log, exec-modes.log, auth-run.log
 */

import { spawnSync, spawn } from "child_process";
import { createServer } from "http";
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { exchangeCode, XAI_OAUTH_TOKEN_URL } from "./xai-oauth-lib.mjs";

const SCRATCH = process.env.SCRATCH_DIR || join(process.cwd(), ".scratch-oauth-evidence");
mkdirSync(SCRATCH, { recursive: true });

const finalGreen = join(SCRATCH, "final-green.log");
const execModes = join(SCRATCH, "exec-modes.log");
const authRun = join(SCRATCH, "auth-run.log");
const finalEvidence = join(SCRATCH, "final-evidence.txt");

for (const f of [finalGreen, execModes, authRun]) {
  writeFileSync(f, "");
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

// 1: single clean lint && build && test transcript
runShell("npm run lint && npm run build && npm test && npm run test:oauth-script", finalGreen);

// 2: OAuth endpoint verification (accounts + auth)
append(authRun, "=== verify-xai-oauth-endpoints (accounts.x.ai + auth.x.ai) ===");
runNode("scripts/verify-xai-oauth-endpoints.mjs", authRun);

// 3: real token endpoint probe (invalid code — proves auth.x.ai reachable, no secrets)
append(authRun, "=== real auth.x.ai token endpoint probe (invalid code) ===");
try {
  await exchangeCode("invalid-capture-code", "capture-verifier-abc");
  throw new Error("expected token exchange to fail for invalid code");
} catch (e) {
  append(authRun, `token_url: ${XAI_OAUTH_TOKEN_URL}`);
  append(authRun, `expected_token_exchange_error: ${e instanceof Error ? e.message : String(e)}`);
}

// 4: HTTP POST /api/execute meta (next start)
writeFileSync(execModes, "");
runNode("scripts/capture-exec-modes-http.mjs", execModes);

// 5: login --manual-paste saves to real ~/.aetherforge (mock token server for code exchange only)
append(authRun, "=== npm run auth:xai --manual-paste (real ~/.aetherforge path) ===");

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
      append(authRun, `authorize URL host: auth.x.ai (browser UI may show accounts.x.ai)`);

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

// 6: final evidence
writeFileSync(
  finalEvidence,
  [
    "=== git status ===",
    spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" }).stdout.trim(),
    "",
    "=== package.json auth scripts ===",
    spawnSync("grep", ["-A2", "auth:xai", "package.json"], { encoding: "utf8" }).stdout.trim(),
    "",
    "=== .gitignore token patterns ===",
    spawnSync("grep", ["-E", "xai-auth|aetherforge", ".gitignore"], { encoding: "utf8" }).stdout.trim(),
    "",
    `default home token path: ${realTokenPath}`,
    "accounts.x.ai discovery: 404 (login UI host)",
    "auth.x.ai discovery: canonical OIDC (hermes-agent)",
  ].join("\n") + "\n"
);

console.log(`Evidence captured to ${SCRATCH}`);