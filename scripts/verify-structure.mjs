#!/usr/bin/env node
/**
 * Static + fetched DOM verification for AetherForge.
 * Run against a live dev server: node scripts/verify-structure.mjs [url]
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCRATCH = process.env.SCRATCH || join(ROOT, ".verify-scratch");
const URL = process.argv[2] || "http://localhost:3456";

const checks = [];

function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  let html = "";
  try {
    const res = await fetch(URL);
    html = await res.text();
    check("HTTP 200", res.ok, `status=${res.status}`);
  } catch (e) {
    check("HTTP fetch", false, String(e));
  }

  const required = [
    ["title", /AetherForge - 2026 Agentic AI Studio/],
    ["agent-sidebar", /data-testid="agent-sidebar"/],
    ["agent-researcher", /data-testid="agent-card-researcher"/],
    ["agent-designer", /data-testid="agent-card-designer"/],
    ["agent-coder", /data-testid="agent-card-coder"/],
    ["agent-analyst", /data-testid="agent-card-analyst"/],
    ["x-sim-btn", /data-testid="x-sim-btn"/],
    ["imagine-btn", /data-testid="imagine-btn"/],
    ["flow-canvas", /data-testid="flow-canvas"/],
    ["goal-input", /data-testid="goal-input"/],
    ["execute-btn", /data-testid="execute-btn"/],
    ["particle-canvas", /data-testid="particle-canvas"/],
    ["tab-panel", /data-testid="tab-panel"/],
    ["tab-swarm", /data-testid="tab-swarm"/],
    ["export-repo", /data-testid="export-repo-btn"/],
    ["react-flow", /react-flow/],
    ["three-canvas", /<canvas/],
  ];

  for (const [name, re] of required) {
    check(`DOM: ${name}`, re.test(html));
  }

  // Source file checks
  const files = [
    "public/manifest.json",
    "public/sw.js",
    "scripts/deploy-vercel.sh",
    "README.md",
    "src/lib/generators/goal-processor.ts",
    "src/actions/execute-goal.ts",
  ];
  for (const f of files) {
    try {
      readFileSync(join(ROOT, f));
      check(`file: ${f}`, true);
    } catch {
      check(`file: ${f}`, false);
    }
  }

  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  check("README GIF placeholder", readme.includes("demo.gif"));

  const manifest = JSON.parse(readFileSync(join(ROOT, "public/manifest.json"), "utf8"));
  check("PWA manifest name", manifest.name.includes("AetherForge"));

  const allOk = checks.every((c) => c.ok);
  const report = [
    `# AetherForge Verification — ${new Date().toISOString()}`,
    `URL: ${URL}`,
    `Result: ${allOk ? "PASS" : "FAIL"}`,
    "",
    ...checks.map((c) => `- [${c.ok ? "x" : " "}] ${c.name}${c.detail ? ` (${c.detail})` : ""}`),
  ].join("\n");

  writeFileSync(join(SCRATCH, "canvas-evidence.txt"), report);
  writeFileSync(join(SCRATCH, "tab-outputs.txt"), report);
  console.log(`\nReport written to ${SCRATCH}`);
  process.exit(allOk ? 0 : 1);
}

main();