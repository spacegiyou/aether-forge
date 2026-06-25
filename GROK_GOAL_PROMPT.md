# Paste-ready Grok Build `/goal` prompt

Copy everything in the block below and paste it into Grok Build on this repo.

---

```
/goal Transform this repo (AetherForge) from a simulated UI demo into a genuinely working, production-grade agentic AI studio powered by the real xAI Grok API — without changing its visual design.

FIRST: open and read GROK_BUILD_DIRECTIVE.md in the repo root and execute it fully, Phases A -> B -> C in order. That file is the source of truth; this message is the summary.

HARD RULES (non-negotiable):
- Keep `npm run lint` (0 errors), `npm run build`, and `npm test` green after every task. Do not proceed while any is red.
- This Next.js 16 has breaking changes — read node_modules/next/dist/docs before using any Next API (see AGENTS.md).
- TypeScript stays strict (no `any`). Validate all external/AI data with Zod.
- Secrets are server-only: every xAI call runs inside Server Actions / Route Handlers, never in a "use client" module. Prove no key leaks into the client bundle.
- Do NOT change the cosmic-glassmorphism design, the React Flow agent canvas, the 3-column layout, or any existing data-testid attribute (the Playwright script depends on them).

WHAT TO DO:
1. Phase A — fix real bugs: Math.random() during render in src/components/layout/ParticleBackground.tsx (ESLint react-hooks/purity); fix the vitest/rolldown native-binding test failure and add a GitHub Actions CI workflow; fix the broken public/demo.gif reference; add an accessible keyboard alternative to the drag-and-drop; surface execute() errors to the user.
2. Phase B — replace EVERY simulation with real xAI Grok calls: streaming goal execution (replace the setTimeout + lorem in src/actions/execute-goal.ts and src/lib/generators/*), real code generation, a real X thread (remove the fake engagement numbers), a real research feed, real image generation, real Supabase persistence (replace src/lib/storage/supabase-mock.ts), and a real Vercel deploy/export (replace the 2s setTimeout in OneClickDeploy.tsx and the stub in repo-exporter.ts).
3. Phase C — production polish: responsive layout, performance (Lighthouse >= 90), accessibility (WCAG AA), security, observability, and an honesty pass so every README feature is marked Real vs Demo.

xAI API: OpenAI-compatible at https://api.x.ai/v1 with env var XAI_API_KEY. Verify current model names at https://docs.x.ai (as of June 2026: grok-4.3 for chat/coding, grok-code-fast-1 for fast agentic coding, grok-imagine-image-quality for images). Add the `openai` and `zod` packages and provide a .env.example.

Ship in 5 incremental PRs as laid out in the directive. DEFINITION OF DONE = the acceptance checklist in GROK_BUILD_DIRECTIVE.md section 5: real, goal-specific Grok output visible in the browser network tab, no secret in the client bundle, lint/build/test all green, Lighthouse >= 90, and an accurate README.

Report what you changed after each phase.
```

---

**Tip:** if Grok Build can't read files from the repo, paste the full contents of
`GROK_BUILD_DIRECTIVE.md` directly after this prompt.
