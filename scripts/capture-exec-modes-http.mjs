#!/usr/bin/env node
/**
 * POST /api/execute against next start — drain full NDJSON, assert meta source.
 * oauth: unmocked real api.x.ai rejection (no key, META_COUNT=1).
 * oauth-recovery: unmocked when XAI_API_KEY looks real; else harness proxy for key leg only.
 */

import { spawn, spawnSync } from "child_process";
import { createServer } from "http";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const PORT = Number(process.env.EXEC_MODES_PORT || 3456);
const BASE = `http://127.0.0.1:${PORT}`;
const REAL_XAI_ORIGIN = "https://api.x.ai";

const MOCK_EXECUTION = JSON.stringify({
  steps: [{ agent: "coder", message: "http capture ok" }],
  code: {
    language: "typescript",
    filename: "goal.ts",
    content: "export async function run() { return true; }",
  },
  imagePrompt: "test",
  thread: [{ index: 1, text: "post" }],
  chartData: [{ name: "Speed", value: 80, agents: 2 }],
  summary: "done",
});

function log(line) {
  console.log(line);
}

function isRealXaiApiKey(key) {
  return typeof key === "string" && key.startsWith("xai-") && key.length >= 24;
}

function mockChatCompletion(content) {
  return JSON.stringify({
    id: "chatcmpl-http-capture",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "grok-code-fast-1",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  });
}

/** Proxy: OAuth bearer → real api.x.ai; key bearer → mock success (harness only) */
function createXaiRecoveryProxy({ keyBearer, oauthBearerPrefix = "oauth-http" }) {
  const hits = [];

  const server = createServer(async (req, res) => {
    const auth = req.headers.authorization ?? "";
    const bearer = auth.replace(/^Bearer\s+/i, "");

    if (bearer === keyBearer) {
      hits.push(`mock_key: ${req.method} ${req.url}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(mockChatCompletion(MOCK_EXECUTION));
      return;
    }

    const path = req.url?.startsWith("/v1/") ? req.url : `/v1${req.url ?? ""}`;
    const target = `${REAL_XAI_ORIGIN}${path}`;
    hits.push(`real_forward: ${req.method} ${target} oauth=${bearer.startsWith(oauthBearerPrefix)}`);

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    const forward = await fetch(target, {
      method: req.method,
      headers: {
        authorization: auth,
        "content-type": req.headers["content-type"] ?? "application/json",
      },
      body: body.length > 0 ? body : undefined,
    });

    const responseBody = Buffer.from(await forward.arrayBuffer());
    res.writeHead(forward.status, {
      "Content-Type": forward.headers.get("content-type") ?? "application/json",
    });
    res.end(responseBody);
  });

  return {
    server,
    hits,
    listen: () =>
      new Promise((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => {
          const addr = server.address();
          if (!addr || typeof addr === "string") {
            reject(new Error("proxy listen failed"));
            return;
          }
          resolve(`http://127.0.0.1:${addr.port}/v1`);
        });
        server.on("error", reject);
      }),
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      }),
  };
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
  if (opts.oauthToken) {
    childEnv.XAI_AUTH_FILE = tokenFile;
    writeFileSync(tokenFile, JSON.stringify(opts.oauthToken), "utf8");
  }
  if (opts.xaiBaseUrl) {
    childEnv.XAI_BASE_URL = opts.xaiBaseUrl;
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
    if (opts.mode) log(`MODE [${label}]: ${opts.mode}`);

    if (opts.proxyHits?.length) {
      for (const hit of opts.proxyHits) log(`PROXY_HIT [${label}]: ${hit}`);
    }

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
    if (opts.expectTerminal && events.at(-1)?.type !== opts.expectTerminal) {
      throw new Error(
        `${label}: expected terminal ${opts.expectTerminal}, got ${events.at(-1)?.type}`
      );
    }
    return lastMeta;
  } finally {
    server.kill("SIGTERM");
    await new Promise((r) => server.on("close", r));
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

const oauthToken = {
  access_token: "oauth-http-capture",
  refresh_token: "oauth-http-refresh",
  obtained_at: Date.now(),
  expires_at: Date.now() + 7_200_000,
};

const build = spawnSync("npm", ["run", "build"], { encoding: "utf8", cwd: process.cwd() });
if (build.status !== 0) {
  console.error(build.stdout + build.stderr);
  process.exit(build.status ?? 1);
}

log(`=== HTTP POST /api/execute full-stream meta (next start :${PORT}) ===`);

await drainStream("mock", { AI_MODE: "auto" }, {
  dropKey: true,
  expectSource: "mock",
  expectTerminal: "done",
  mode: "unmocked",
});

await drainStream(
  "key",
  { AI_MODE: "auto", XAI_API_KEY: "xai-http-capture-key" },
  { expectSource: "key", mode: "unmocked-real-api.x.ai-fake-key" }
);

// Unmocked: real api.x.ai rejects fake oauth token, no key to escape → META_COUNT=1, terminal error
await drainStream("oauth-unmocked", { AI_MODE: "auto" }, {
  dropKey: true,
  oauthToken,
  expectSource: "oauth",
  expectMetaCount: 1,
  expectTerminal: "error",
  mode: "unmocked-real-api.x.ai-no-key",
});

// Harness uses proxy by default. Set EVIDENCE_USE_LIVE_KEY=1 + EVIDENCE_LIVE_XAI_KEY=xai-...
// for fully unmocked oauth-recovery (optional manual bar).
const liveKey = process.env.EVIDENCE_LIVE_XAI_KEY?.trim() ?? "";
const useLiveKey =
  process.env.EVIDENCE_USE_LIVE_KEY === "1" && isRealXaiApiKey(liveKey);
const recoveryKey = useLiveKey ? liveKey : "xai-http-recovery-escape";

log(`RECOVERY_KEY_SOURCE: ${useLiveKey ? "env XAI_API_KEY (unmocked key leg)" : "harness fake key (proxy mock key leg)"}`);

let proxy = null;
let proxyBase = undefined;

if (!useLiveKey) {
  proxy = createXaiRecoveryProxy({ keyBearer: recoveryKey });
  proxyBase = await proxy.listen();
  log(`RECOVERY_PROXY_BASE: ${proxyBase}`);
}

try {
  await drainStream(
    useLiveKey ? "oauth-recovery-live" : "oauth-recovery-harness",
    { AI_MODE: "auto", XAI_API_KEY: recoveryKey },
    {
      oauthToken,
      expectSource: "key",
      expectMetaCount: 2,
      expectTerminal: "done",
      xaiBaseUrl: proxyBase,
      proxyHits: proxy?.hits ?? [],
      mode: useLiveKey ? "unmocked-real-api+oidc-refresh" : "real-oauth-rejection+proxy-key-mock",
    }
  );

  if (proxy) {
    const hadRealForward = proxy.hits.some((h) => h.startsWith("real_forward:"));
    const hadMockKey = proxy.hits.some((h) => h.startsWith("mock_key:"));
    if (!hadRealForward) throw new Error("oauth-recovery-harness: expected real api.x.ai forward for oauth");
    if (!hadMockKey) throw new Error("oauth-recovery-harness: expected mock key success after escape");
  }
} finally {
  if (proxy) await proxy.close();
}

log("=== HTTP exec-modes capture complete ===");