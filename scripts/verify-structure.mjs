#!/usr/bin/env node
/**
 * Static + fetched DOM verification for AetherForge.
 * SSR html checks stable shells; Playwright confirms client-hydrated Three.js canvas.
 *
 * Run against a live dev server: SCRATCH=/path node scripts/verify-structure.mjs [url]
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

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
    // particle-canvas wrapper is SSR-stable; <canvas> mounts client-only after hydration
    ["particle-canvas-ssr", /data-testid="particle-canvas"/],
  ];

  for (const [name, re] of required) {
    check(`DOM: ${name}`, re.test(html));
  }

  // Three.js integration — source proof (Canvas is client-only, not in fetch html)
  const particleSrc = readFileSync(join(ROOT, "src/components/layout/ParticleBackground.tsx"), "utf8");
  check("source: @react-three/fiber Canvas", particleSrc.includes("@react-three/fiber") && particleSrc.includes("Canvas"));
  check("source: generateParticlePositions", particleSrc.includes("generateParticlePositions"));

  // Client-hydrated Three.js <canvas> via Playwright (post-mount)
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.locator('[data-testid="particle-canvas"]').waitFor({ timeout: 10000 });
    const canvasCount = await page.locator('[data-testid="particle-canvas"] canvas').count();
    check("client: three-canvas element", canvasCount >= 1, `found=${canvasCount}`);
    await browser.close();
  } catch (e) {
    check("client: three-canvas element", false, String(e));
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

  writeFileSync(join(SCRATCH, "structure-check.txt"), report);
  console.log(`\nStructure report written to ${SCRATCH}/structure-check.txt`);
  console.log("Run scripts/verify-interactions.mjs for live canvas + tab evidence.");
  process.exit(allOk ? 0 : 1);
}

main();