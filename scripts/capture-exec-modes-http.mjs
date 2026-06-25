#!/usr/bin/env node
/**
 * POST /api/execute against a running next start server — captures NDJSON meta per mode.
 * Plan step 4: real HTTP to /api/execute (not vitest route handler).
 */

import { spawn, spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const SCRATCH = process.env.SCRATCH_DIR || join(tmpdir(), "aetherforge-exec-modes");
const PORT = Number(process.env.EXEC_MODES_PORT || 3456);
const BASE = `http://127.0.0.1:${PORT}`;

function log(line) {
  console.log(line);
}

async function waitForServer(ms = 30_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(`${BASE}/api/auth/xai/status`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server not ready on ${BASE}`);
}

async function captureMeta(label, env, opts = {}) {
  const tmpDir = mkdtempSync(join(tmpdir(), `aetherforge-http-${label}-`));
  const tokenFile = join(tmpDir, "xai-auth.json");

  const childEnv = {
    ...process.env,
    ...env,
    PORT: String(PORT),
    NODE_ENV: "production",
  };
  if (opts.dropKey) delete childEnv.XAI_API_KEY;
  delete childEnv.XAI_AUTH_FILE;
  if (label === "oauth") {
    childEnv.XAI_AUTH_FILE = tokenFile;
    writeFileSync(
      tokenFile,
      JSON.stringify({
        access_token: "oauth-http-capture",
        refresh_token: "oauth-http-refresh",
        obtained_at: Date.now(),
        expires_at: Date.now() + 7_200_000,
      }),
      "utf8"
    );
  }

  const server = spawn("npm", ["run", "start"], {
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
    cwd: process.cwd(),
  });

  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));

  try {
    await waitForServer();
    const res = await fetch(`${BASE}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: `http capture ${label}` }),
    });
    if (!res.ok) {
      throw new Error(`POST /api/execute ${label} status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (const line of buffer.split("\n")) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "meta") {
          const ndjson = JSON.stringify(event);
          log(`CAPTURE_NDJSON_META [${label}]: ${ndjson}`);
          log(`ASSERT_SOURCE [${label}]: ${event.source}`);
          await reader.cancel();
          return ndjson;
        }
      }
    }
    throw new Error(`no meta event for ${label}`);
  } finally {
    server.kill("SIGTERM");
    await new Promise((r) => server.on("close", r));
    rmSync(tmpDir, { recursive: true, force: true });
    if (serverLog && process.env.DEBUG_SERVER) log(serverLog);
  }
}

// Ensure production build exists
const build = spawnSync("npm", ["run", "build"], { encoding: "utf8", cwd: process.cwd() });
if (build.status !== 0) {
  console.error(build.stdout + build.stderr);
  process.exit(build.status ?? 1);
}

log(`=== HTTP POST /api/execute meta capture (next start :${PORT}) ===`);
log(`scratch: ${SCRATCH}`);

const scenarios = [
  { label: "mock", env: { AI_MODE: "auto" }, dropKey: true },
  { label: "key", env: { AI_MODE: "auto", XAI_API_KEY: "xai-http-capture-key" } },
  { label: "oauth", env: { AI_MODE: "auto", XAI_API_KEY: "xai-http-capture-key" } },
];

for (const s of scenarios) {
  const env = { ...s.env };
  await captureMeta(s.label, env, { dropKey: s.dropKey });
}

log("=== HTTP exec-modes capture complete ===");