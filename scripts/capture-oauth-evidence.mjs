#!/usr/bin/env node
/**
 * Single evidence capture — lint, build, test, verbose execute meta, login --manual-paste.
 * Tee to SCRATCH_DIR/final-green.log and exec-modes.log
 */

import { spawnSync, spawn } from "child_process";
import { createServer } from "http";
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";

const SCRATCH = process.env.SCRATCH_DIR || join(tmpdir(), "aetherforge-oauth-evidence");
mkdirSync(SCRATCH, { recursive: true });

const finalGreen = join(SCRATCH, "final-green.log");
const execModes = join(SCRATCH, "exec-modes.log");
const authRun = join(SCRATCH, "auth-run.log");
const finalEvidence = join(SCRATCH, "final-evidence.txt");

// Fresh capture each run
for (const f of [finalGreen, execModes, authRun]) {
  writeFileSync(f, "");
}

function run(cmd, args, logPath, opts = {}) {
  const header = `\n=== ${cmd} ${args.join(" ")} ===\n`;
  writeFileSync(logPath, readFileSync(logPath, "utf8") + header, { flag: "a" });
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    cwd: process.cwd(),
    env: { ...process.env, ...opts.env },
    input: opts.input,
    ...opts,
  });
  const out = (result.stdout || "") + (result.stderr || "");
  writeFileSync(logPath, out + `\nexit=${result.status}\n`, { flag: "a" });
  if (result.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${args.join(" ")} failed with ${result.status}`);
  }
  return result;
}

function append(path, text) {
  writeFileSync(path, text + "\n", { flag: "a" });
}

// 1–3: lint, build, test
run("npm", ["run", "lint"], finalGreen);
run("npm", ["run", "build"], finalGreen);
run("npm", ["test"], finalGreen);
run("npm", ["run", "test:oauth-script"], finalGreen);

// 4: NDJSON meta capture (mock / key / oauth)
append(execModes, "=== POST /api/execute NDJSON meta capture ===");
run(
  "npx",
  ["vitest", "run", "src/app/api/execute/exec-meta-capture.test.ts", "--reporter=verbose"],
  execModes
);

// 5: login --manual-paste with mock token server + real ~/.aetherforge path
append(authRun, "=== npm run auth:xai --manual-paste (real ~/.aetherforge) ===");

const realTokenDir = join(homedir(), ".aetherforge");
const realTokenPath = join(realTokenDir, "xai-auth.json");
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
    const callback = "capture-auth-code\n";
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
    child.stdin.write(callback);
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
      append(authRun, `obtained_at=${saved.obtained_at} expires_at=${saved.expires_at}`);

      // Restore prior token state — evidence run must not leave test tokens behind
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
    `default home token path example: ${join(homedir(), ".aetherforge", "xai-auth.json")}`,
  ].join("\n") + "\n"
);

console.log(`Evidence captured to ${SCRATCH}`);