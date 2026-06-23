#!/usr/bin/env node
/**
 * Live interaction verification via Playwright.
 * Exercises Execute, drag, and all 4 tabs; captures real outputs to scratch.
 *
 * Usage: SCRATCH=/path node scripts/verify-interactions.mjs [url]
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCRATCH = process.env.SCRATCH || join(ROOT, ".verify-scratch");
const URL = process.argv[2] || "http://localhost:3456";

const canvasLines = [];
const tabLines = [];

function logCanvas(msg) {
  canvasLines.push(msg);
  console.log(`[canvas] ${msg}`);
}

function logTab(msg) {
  tabLines.push(msg);
  console.log(`[tab] ${msg}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(URL, { waitUntil: "networkidle" });

  // ── Error alert path (A5): empty goal triggers server validation error ──
  const goalInput = page.locator('[data-testid="goal-input"]');
  await goalInput.fill("   ");
  await page.locator('[data-testid="execute-btn"]').click();
  await page.locator('[data-testid="execute-error"]').waitFor({ timeout: 10000 });
  const emptyError = await page.locator('[data-testid="execute-error"]').innerText();
  logCanvas(`Empty goal error alert: ${emptyError}`);
  if (!emptyError.toLowerCase().includes("goal")) throw new Error(`Expected empty-goal error, got: ${emptyError}`);

  // ── Error alert path (A5): oversized goal triggers server validation error ──
  const oversizedGoal = "x".repeat(2001);
  await goalInput.fill(oversizedGoal);
  await page.locator('[data-testid="execute-btn"]').click();
  const errorAlert = page.locator('[data-testid="execute-error"]');
  await errorAlert.waitFor({ timeout: 10000 });
  const errorText = await errorAlert.innerText();
  logCanvas(`Error alert (role=alert): ${errorText}`);
  if (!errorText.includes("2000")) throw new Error(`Expected max-length error, got: ${errorText}`);

  // ── Canvas: default swarm ──
  const flowCanvas = page.locator('[data-testid="flow-canvas"]');
  await flowCanvas.waitFor();
  const initialNodes = await flowCanvas.locator(".react-flow__node").count();
  const initialEdges = await flowCanvas.locator(".react-flow__edge").count();
  logCanvas(`Initial swarm: ${initialNodes} nodes, ${initialEdges} edges`);
  if (initialNodes < 4) throw new Error(`Expected >=4 default nodes, got ${initialNodes}`);
  if (initialEdges < 4) throw new Error(`Expected >=4 default edges, got ${initialEdges}`);

  // ── Canvas: drag simulation ──
  const researcher = page.locator('[data-testid="agent-card-researcher"]');
  const canvasBox = await flowCanvas.boundingBox();
  const cardBox = await researcher.boundingBox();
  if (canvasBox && cardBox) {
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const afterDragNodes = await flowCanvas.locator(".react-flow__node").count();
    logCanvas(`After drag-drop: ${afterDragNodes} nodes (was ${initialNodes})`);
    if (afterDragNodes <= initialNodes) throw new Error("Drag-drop did not add a node");
  }

  // ── Canvas: Execute success flow ──
  await goalInput.fill("Verify agent swarm collaboration end-to-end");
  await page.locator('[data-testid="execute-btn"]').click();

  await page.locator('[data-testid="output-panel"]').waitFor({ timeout: 25000 });
  const stepCount = await page.locator('[data-testid="execution-step"]').count();
  logCanvas(`Execution steps rendered: ${stepCount}`);
  if (stepCount < 6) throw new Error(`Expected 6 execution steps, got ${stepCount}`);

  const codeSnippet = await page.locator('[data-testid="output-code"] pre').innerText();
  const threadSnippet = await page.locator('[data-testid="output-thread"]').innerText();
  const chartPresent = await page.locator('[data-testid="output-chart"] .recharts-bar').count();
  const imagePresent = await page.locator('[data-testid="output-image"]').isVisible();

  logCanvas(`Output code (first 120 chars): ${codeSnippet.slice(0, 120)}…`);
  logCanvas(`Output thread (first 120 chars): ${threadSnippet.slice(0, 120)}…`);
  logCanvas(`Recharts bars rendered: ${chartPresent}`);
  logCanvas(`Image placeholder visible: ${imagePresent}`);

  if (!codeSnippet.includes("export async function")) throw new Error("Mock code not rendered");
  if (chartPresent < 1) throw new Error("Recharts chart not rendered");
  if (!imagePresent) throw new Error("Image placeholder not rendered");
  if (!threadSnippet.includes("AetherForge")) throw new Error("X thread not rendered");

  const postExecNodes = await flowCanvas.locator(".react-flow__node").count();
  const postExecEdges = await flowCanvas.locator(".react-flow__edge").count();
  logCanvas(`Post-execute canvas: ${postExecNodes} nodes, ${postExecEdges} edges`);

  // ── Tab: Live Swarm Viz (default) ──
  await page.locator('[data-testid="tab-swarm"]').click();
  await page.locator('[data-testid="tab-swarm-viz"]').waitFor();
  const swarmMetric = await page.locator('[data-testid="tab-swarm-viz"] .text-lg.font-bold').first().innerText();
  logTab(`Swarm Viz metric: ${swarmMetric.trim()}`);

  // ── Tab: Multimodal Lab ──
  await page.locator('[data-testid="tab-multimodal"]').click();
  await page.locator('[data-testid="multimodal-prompt"]').fill("Cosmic particle swarm in deep space");
  await page.locator('[data-testid="multimodal-generate"]').click();
  await page.locator('[data-testid="fake-video-player"]').waitFor({ timeout: 5000 });
  const audioNote = await page.locator('[data-testid="audio-note"]').innerText();
  logTab(`Multimodal audio note: ${audioNote.slice(0, 150)}…`);

  // ── Tab: One-Click Deploy ──
  await page.locator('[data-testid="tab-deploy"]').click();
  await page.locator('[data-testid="generate-readme-btn"]').click();
  await page.locator('[data-testid="readme-output"]').waitFor({ timeout: 5000 });
  const readme = await page.locator('[data-testid="readme-output"]').inputValue();
  logTab(`README generated (${readme.length} chars), contains GIF: ${readme.includes("demo.gif")}`);
  await page.locator('[data-testid="vercel-deploy-btn"]').click();
  await page.locator('[data-testid="deploy-success"]').waitFor({ timeout: 5000 });
  const deployMsg = await page.locator('[data-testid="deploy-success"]').innerText();
  logTab(`Deploy result: ${deployMsg.replace(/\s+/g, " ").trim()}`);

  // ── Tab: Viral Kit ──
  await page.locator('[data-testid="tab-viral"]').click();
  await page.locator('[data-testid="viral-topic"]').fill("Grok Build shipped AetherForge");
  await page.locator('[data-testid="viral-generate"]').click();
  await page.locator('[data-testid="viral-thread"]').waitFor({ timeout: 5000 });
  const viralThread = await page.locator('[data-testid="viral-thread"]').innerText();
  const imagePackCount = await page.locator('[data-testid="image-pack"] > div').count();
  logTab(`Viral thread (first 150 chars): ${viralThread.slice(0, 150)}…`);
  logTab(`Image pack items: ${imagePackCount}`);

  if (errors.length) logCanvas(`Page errors: ${errors.join("; ")}`);

  const canvasReport = [
    `# Canvas Interaction Evidence — ${new Date().toISOString()}`,
    `URL: ${URL}`,
    "",
    ...canvasLines.map((l) => `- ${l}`),
    "",
    `Runtime errors: ${errors.length === 0 ? "none" : errors.join("; ")}`,
  ].join("\n");

  const tabReport = [
    `# Tab Interaction Outputs — ${new Date().toISOString()}`,
    `URL: ${URL}`,
    "",
    ...tabLines.map((l) => `- ${l}`),
  ].join("\n");

  writeFileSync(join(SCRATCH, "canvas-evidence.txt"), canvasReport);
  writeFileSync(join(SCRATCH, "tab-outputs.txt"), tabReport);

  await browser.close();
  console.log(`\nEvidence written to ${SCRATCH}`);
  if (errors.length) process.exit(1);
}

main().catch((e) => {
  console.error("VERIFY FAILED:", e);
  process.exit(1);
});