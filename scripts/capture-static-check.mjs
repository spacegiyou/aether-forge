#!/usr/bin/env node
/**
 * Plan step 5 — structural checks: credential injection, source propagation, no tokens in client bundle.
 */

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { spawnSync } from "child_process";

const ROOT = join(import.meta.dirname, "..");
const SCRATCH = process.env.SCRATCH_DIR || join(ROOT, ".scratch-oauth-evidence");
const out = [];

function log(line) {
  out.push(line);
  console.log(line);
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

log("=== static-check: server credential path ===");
const serverFiles = [
  "src/lib/ai/grok-client.ts",
  "src/lib/ai/credentials.ts",
  "src/lib/ai/execute-live.ts",
  "src/lib/ai/generate-image.ts",
  "src/lib/ai/execute-router.ts",
  "src/lib/ai/grok-errors.ts",
  "src/app/api/execute/route.ts",
];
for (const rel of serverFiles) {
  const text = readFileSync(join(ROOT, rel), "utf8");
  log(`${rel}: resolveXaiCredential=${text.includes("resolveXaiCredential")} withCredentialFallback=${text.includes("withCredentialFallback")} getGrokClient=${text.includes("getGrokClient")}`);
}

log("\n=== static-check: UI source badges ===");
const uiFiles = [
  "src/components/layout/GrokAuthControl.tsx",
  "src/components/canvas/GoalExecutor.tsx",
  "src/components/canvas/OutputPanel.tsx",
  "src/components/tabs/MultimodalLab.tsx",
];
for (const rel of uiFiles) {
  const text = readFileSync(join(ROOT, rel), "utf8");
  const hasOAuth = /OAuth|oauth/.test(text);
  const hasSource = /source/.test(text);
  log(`${rel}: oauth_ui=${hasOAuth} source_ref=${hasSource}`);
}

log("\n=== static-check: client bundle must not import oauth-store/credentials ===");
const clientRoots = ["src/components", "src/app"];
const forbidden = ["oauth-store", "credentials.ts", "xai-auth.json", ".aetherforge"];
const offenders = [];
for (const root of clientRoots) {
  for (const file of walk(join(ROOT, root))) {
    if (!/\.(tsx|ts|jsx|js)$/.test(file)) continue;
    if (file.includes("/api/")) continue;
    const rel = relative(ROOT, file);
    const text = readFileSync(file, "utf8");
    for (const needle of forbidden) {
      if (text.includes(needle)) offenders.push(`${rel}: ${needle}`);
    }
  }
}
log(offenders.length === 0 ? "no forbidden imports in client components" : offenders.join("\n"));
if (offenders.length > 0) process.exit(1);

log("\n=== static-check: grep token file literals in tracked src (expect 0) ===");
const grep = spawnSync("git", ["grep", "-n", "xai-auth.json", "--", "src"], { encoding: "utf8", cwd: ROOT });
log(grep.stdout.trim() || "(no matches in src/)");

log("\n=== static-check: auth API routes ===");
for (const rel of ["src/app/api/auth/xai/status/route.ts", "src/app/api/auth/xai/route.ts"]) {
  const text = readFileSync(join(ROOT, rel), "utf8");
  log(`${rel}: DELETE=${text.includes("DELETE") || text.includes("deleteOAuthToken")} status=${text.includes("resolveXaiCredential") || text.includes("loadOAuthToken")}`);
}

const logPath = join(SCRATCH, "static-check.log");
mkdirSync(SCRATCH, { recursive: true });
writeFileSync(logPath, out.join("\n") + "\n");
log(`\nWrote ${logPath}`);