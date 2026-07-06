/** Generate a README with the current demo GIF. */
export function generateReadme(projectName: string, goal: string): string {
  return `# ${projectName}

> **AetherForge - Grok-Built Agentic AI Studio**<br />
> Generated from the app's export flow.

![AetherForge demo](./public/demo.gif)

## 🎯 Mission

${goal || "Explore a mock-safe agentic AI workflow with optional live xAI execution."}

## ✨ Features

- **Live Swarm Viz** — Real-time agent collaboration canvas
- **Multimodal Lab** — Prompt → video + audio synthesis (simulated)
- **One-Click Deploy** — Vercel-oriented export flow
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

The bundled \`public/demo.gif\` gives readers a quick tour of the main workflow.

---

*Built with Grok Build.*
`;
}
