# AetherForge — 2026 Agentic AI Studio

> **A stunning, production-ready agentic AI studio built with Next.js 16, React Flow, Three.js, and Grok Build.**

![Demo GIF Placeholder](./public/demo.gif)

## ✨ What is AetherForge?

AetherForge is an interactive demonstration of the future of agentic AI tooling. Drag four specialized agents onto a collaboration canvas, set a goal, and watch the swarm execute — generating code, visuals, X threads, and analytics in real time.

Built as proof of **Grok Build** power for sharing on X.

## 🎯 Core Features

| Feature | Description |
|---------|-------------|
| **Agent Sidebar** | 4 draggable agents — Researcher (X sim), Designer (Imagine), Coder, Analyst |
| **React Flow Canvas** | Connect agents, collaborate visually |
| **Goal Execution** | "Set your goal" → animated step logs + 4 output types |
| **Live Swarm Viz** | Real-time telemetry charts (Recharts) |
| **Multimodal Lab** | Prompt → fake video player + audio narration |
| **One-Click Deploy** | Vercel button + README generator |
| **Viral Kit** | Auto X thread + image pack |
| **PWA** | Installable, offline shell |
| **Themes** | Dark cosmic glassmorphism (default) + light mode |

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🛠 Stack

- **Next.js 16** — App Router + Server Actions
- **TypeScript** — Strict typing throughout
- **Tailwind CSS v4** — Cosmic glassmorphism theme
- **shadcn/ui** — Accessible component primitives
- **Framer Motion** — Execution animations
- **React Flow** — Agent collaboration canvas
- **Recharts** — Live swarm metrics
- **Three.js** — Cosmic particle background
- **Supabase Mock** — localStorage session persistence

## 📦 Deploy

```bash
chmod +x scripts/deploy-vercel.sh
./scripts/deploy-vercel.sh
```

Or deploy manually:

```bash
npm run build
npx vercel --prod
```

## 🧪 Tests

```bash
npm test
```

## 📸 Demo GIF

Replace `public/demo.gif` with a screen recording of:
1. Dragging agents onto the canvas
2. Executing a goal
3. Browsing all four tabs

## 📁 Project Structure

```
src/
├── actions/          # Server Actions (goal execution)
├── components/
│   ├── canvas/       # React Flow + goal executor
│   ├── layout/       # Header, particles, theme
│   ├── sidebar/      # Draggable agent cards
│   ├── tabs/         # 4 feature tabs
│   └── ui/           # shadcn primitives
└── lib/
    ├── generators/   # Pure mock output functions
    ├── storage/      # Supabase mock (localStorage)
    └── export/       # Repo zip exporter
```

## 🌌 Theme

Dark cosmic xAI-inspired glassmorphism with cyan/violet accents. Toggle light mode via the header sun/moon button.

---

*Forged with Grok Build — share on X and tag @Grok*