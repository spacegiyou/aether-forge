/** Generate a beautiful README with embedded demo GIF placeholder */
export function generateReadme(projectName: string, goal: string): string {
  return `# ${projectName}

> **AetherForge — 2026 Agentic AI Studio**  
> Forged by an autonomous agent swarm. This README was auto-generated.

![Demo GIF Placeholder](./public/demo.gif)

## 🎯 Mission

${goal || "Ship production-ready agentic experiences at the speed of thought."}

## ✨ Features

- **Live Swarm Viz** — Real-time agent collaboration canvas
- **Multimodal Lab** — Prompt → video + audio synthesis (simulated)
- **One-Click Deploy** — Vercel-ready in seconds
- **Viral Kit** — Auto-generated X threads + image packs

## 🚀 Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to enter the forge.

## 🛠 Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| UI | Tailwind + shadcn/ui + Framer Motion |
| Canvas | React Flow |
| Viz | Recharts + Three.js |
| Storage | Supabase mock (localStorage) |

## 📦 Deploy

\`\`\`bash
./scripts/deploy-vercel.sh
\`\`\`

## 📸 Demo

> Replace \`public/demo.gif\` with your screen recording for the full Awwwards effect.

---

*Built with Grok Build — proof of agentic creation power.*
`;
}