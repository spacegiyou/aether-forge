#!/usr/bin/env node
/**
 * POST /api/execute against next start — drain full NDJSON, assert last meta source.
 */

import { spawn, spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

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

async function drainStream(label, env, opts = {}) {
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
  if (label === "oauth" || label === "oauth-recovery") {
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
    const events = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (!line.trim()) continue;
        events.push(JSON.parse(line));
      }
    }
    if (buffer.trim()) events.push(JSON.parse(buffer));

    const metas = events.filter((e) => e.type === "meta");
    if (metas.length === 0) throw new Error(`no meta events for ${label}`);
    const lastMeta = metas.at(-1);

    log(`CAPTURE_NDJSON_META [${label}]: ${JSON.stringify(lastMeta)}`);
    log(`ASSERT_SOURCE [${label}]: ${lastMeta.source}`);
    log(`META_COUNT [${label}]: ${metas.length}`);
    log(`TERMINAL [${label}]: ${events.at(-1)?.type ?? "none"}`);

    if (lastMeta.source !== opts.expectSource) {
      throw new Error(
        `${label}: expected last meta source ${opts.expectSource}, got ${lastMeta.source}`
      );
    }
    if (opts.expectMetaCount !== undefined && metas.length !== opts.expectMetaCount) {
      throw new Error(
        `${label}: expected META_COUNT ${opts.expectMetaCount}, got ${metas.length}`
      );
    }
    return lastMeta;
  } finally {
    server.kill("SIGTERM");
    await new Promise((r) => server.on("close", r));
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const build = spawnSync("npm", ["run", "build"], { encoding: "utf8", cwd: process.cwd() });
if (build.status !== 0) {
  console.error(build.stdout + build.stderr);
  process.exit(build.status ?? 1);
}

log(`=== HTTP POST /api/execute full-stream meta (next start :${PORT}) ===`);

await drainStream("mock", { AI_MODE: "auto" }, { dropKey: true, expectSource: "mock" });
await drainStream(
  "key",
  { AI_MODE: "auto", XAI_API_KEY: "xai-http-capture-key" },
  { expectSource: "key" }
);
await drainStream("oauth", { AI_MODE: "auto" }, {
  dropKey: true,
  expectSource: "oauth",
  expectMetaCount: 1,
});

// Real api.x.ai 401 → OAuth refresh (real token URL) → key escape; unmocked network
await drainStream(
  "oauth-recovery",
  { AI_MODE: "auto", XAI_API_KEY: "xai-http-recovery-escape" },
  { expectSource: "key", expectMetaCount: 2 }
);

log("=== HTTP exec-modes capture complete ===");