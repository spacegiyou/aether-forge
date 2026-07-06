#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { chromium } from "playwright";

const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, ".verify-scratch", "launch-assets");
const PUBLIC_DIR = join(ROOT, "public");
const URL = process.argv[2] || process.env.LAUNCH_URL || "http://localhost:3456";

const slides = [
  {
    source: "home",
    title: "AetherForge",
    subtitle: "A Grok-built agentic AI studio prototype.",
  },
  {
    source: "execute",
    title: "Agent Swarm Canvas",
    subtitle: "Drag agents, set a goal, and stream execution in mock-safe mode.",
  },
  {
    source: "execute",
    title: "Code, Images, Threads, Metrics",
    subtitle: "One run produces shareable outputs without requiring credentials.",
  },
  {
    source: "multimodal",
    title: "Optional Live xAI Routes",
    subtitle: "Bring your own XAI_API_KEY when you want real model output.",
  },
  {
    source: "deploy",
    title: "GitHub and Vercel Ready",
    subtitle: "README, CI, security notes, launch assets, and deploy scaffolding.",
  },
  {
    source: "viral",
    title: "Open Source Demo",
    subtitle: "MIT licensed and ready to throw onto X.",
  },
];

function dataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function captureAppScreens(page) {
  const shots = {};
  await page.goto(URL, { waitUntil: "networkidle" });
  shots.home = await page.screenshot({ fullPage: false });

  await page.locator('[data-testid="goal-input"]').fill("Forge a launch-ready agentic AI demo for GitHub");
  await page.locator('[data-testid="execute-btn"]').click();
  await page.locator('[data-testid="output-panel"]').waitFor({ timeout: 25000 });
  await page.waitForTimeout(400);
  shots.execute = await page.screenshot({ fullPage: false });

  await page.locator('[data-testid="tab-multimodal"]').click();
  await page.locator('[data-testid="multimodal-prompt"]').fill("Cosmic agent swarm building a product");
  await page.locator('[data-testid="multimodal-generate"]').click();
  await page.locator('[data-testid="fake-video-player"]').waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  shots.multimodal = await page.screenshot({ fullPage: false });

  await page.locator('[data-testid="tab-deploy"]').click();
  await page.locator('[data-testid="generate-readme-btn"]').click();
  await page.locator('[data-testid="readme-output"]').waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  shots.deploy = await page.screenshot({ fullPage: false });

  await page.locator('[data-testid="tab-viral"]').click();
  await page.locator('[data-testid="viral-topic"]').fill("Grok Build shipped AetherForge");
  await page.locator('[data-testid="viral-generate"]').click();
  await page.locator('[data-testid="viral-thread"]').waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  shots.viral = await page.screenshot({ fullPage: false });
  return shots;
}

async function renderSlide(page, slide, image, index) {
  await page.setContent(`<!doctype html>
<html>
<head>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1280px;
      height: 720px;
      overflow: hidden;
      background: #030712;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #f8fafc;
    }
    .screen {
      position: absolute;
      inset: 0;
      background-image: linear-gradient(90deg, rgba(3, 7, 18, 0.68), rgba(3, 7, 18, 0.08) 52%, rgba(3, 7, 18, 0.25)), url("${dataUrl(image)}");
      background-size: cover;
      background-position: center;
      filter: saturate(1.08);
    }
    .caption {
      position: absolute;
      left: 56px;
      bottom: 56px;
      width: 700px;
      padding: 0;
      text-shadow: 0 4px 24px rgba(0, 0, 0, 0.55);
    }
    .eyebrow {
      display: inline-block;
      margin-bottom: 18px;
      padding: 8px 14px;
      border: 1px solid rgba(34, 211, 238, 0.55);
      border-radius: 999px;
      color: #67e8f9;
      background: rgba(8, 47, 73, 0.55);
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      max-width: 760px;
      font-size: 70px;
      line-height: 0.95;
      letter-spacing: 0;
    }
    p {
      margin: 20px 0 0;
      max-width: 720px;
      color: #dbeafe;
      font-size: 29px;
      line-height: 1.22;
      font-weight: 600;
    }
    .bar {
      position: absolute;
      left: 56px;
      right: 56px;
      bottom: 28px;
      height: 3px;
      background: rgba(255, 255, 255, 0.14);
    }
    .progress {
      width: ${((index + 1) / slides.length) * 100}%;
      height: 100%;
      background: linear-gradient(90deg, #22d3ee, #8b5cf6);
    }
  </style>
</head>
<body>
  <div class="screen"></div>
  <section class="caption">
    <div class="eyebrow">Grok Build Showcase</div>
    <h1>${slide.title}</h1>
    <p>${slide.subtitle}</p>
  </section>
  <div class="bar"><div class="progress"></div></div>
</body>
</html>`);
  const path = join(OUT_DIR, `launch-${String(index + 1).padStart(2, "0")}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const appPage = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const shots = await captureAppScreens(appPage);

  const slidePage = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const framePaths = [];
  for (const [index, slide] of slides.entries()) {
    framePaths.push(await renderSlide(slidePage, slide, shots[slide.source], index));
  }
  await browser.close();

  writeFileSync(join(OUT_DIR, "frames.txt"), framePaths.map((frame) => `file '${frame}'\nduration 3.2`).join("\n") + `\nfile '${framePaths.at(-1)}'\n`);

  const poster = join(PUBLIC_DIR, "launch-video-poster.png");
  const video = join(PUBLIC_DIR, "launch-video.mp4");
  spawnSync("cp", [framePaths[0], poster], { stdio: "inherit" });
  const ffmpeg = spawnSync("ffmpeg", [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", join(OUT_DIR, "frames.txt"),
    "-vf", "fps=30,format=yuv420p",
    "-movflags", "+faststart",
    "-c:v", "libx264",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    video,
  ], { stdio: "inherit" });
  if (ffmpeg.status !== 0) process.exit(ffmpeg.status ?? 1);
  console.log(`Wrote ${video}`);
  console.log(`Wrote ${poster}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
