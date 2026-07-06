# AetherForge — Grok Build Directive

## From "beautiful simulation" to "genuinely agentic, production-grade"

**Read this whole file before writing any code. Then execute Phases A → B → C in order.**

---

## 0. Context (what this repo is today)

AetherForge is a Next.js 16 / React 19 single-page "agentic AI studio" UI. The
front end is strong: React Flow agent canvas, Three.js particle background,
Recharts metrics, Framer Motion animations, Tailwind v4 cosmic-glassmorphism
theme, shadcn-style primitives, strict TypeScript, Vitest unit tests, and a
Playwright E2E verification script.

**The problem: every "AI" feature is faked.** There are zero real model calls.
Concretely, today:

- `src/actions/execute-goal.ts` → `setTimeout(400)` then returns deterministic data.
- `src/lib/generators/*` → `generateLorem()` shuffles a fixed word list; "code",
  "thread", "chart", and "image prompt" are templated strings.
- `OneClickDeploy.tsx` → "Deploy to Vercel" is a 2-second `setTimeout`.
- `MultimodalLab.tsx` → fake `<video>` player + lorem "audio narration".
- `src/lib/storage/supabase-mock.ts` → "Supabase" is just `localStorage`.

The app is honest-ish (some "Simulated" badges), but it is not a working product.

**Goal of this directive (full scope):** keep the visual identity and UX exactly
as-is, fix the real defects, and replace every simulated subsystem with a real
implementation powered by the **xAI Grok API**, so the app actually does what it
claims. Ship it deployable on Vercel.

---

## 1. Non-negotiable ground rules

1. **Next.js 16 is not the Next.js in your training data.** Before using any
   Next API, read the relevant guide under `node_modules/next/dist/docs/` and
   heed deprecation notices (see `AGENTS.md`).
2. **Keep the build green at every step.** After each task, all three must pass:
   `npm run lint` (0 errors), `npm run build` (success), `npm test` (green).
   Do not move to the next task while any is red.
3. **TypeScript stays strict.** No `any`, no `@ts-ignore`. Add precise types and
   Zod schemas for all external/AI data.
4. **Secrets are server-only.** API keys live in environment variables and are
   only ever read inside Server Actions / Route Handlers. Never import a key into
   a `"use client"` module. After the build, `grep` the client bundle to prove no
   key leaked.
5. **Do not break existing `data-testid` attributes.** The Playwright script in
   `scripts/verify-interactions.mjs` depends on them. If you add features, add new
   test ids; don't rename old ones.
6. **Honesty rule.** A feature may show a "Live" badge only once it is wired to a
   real backend. Anything still simulated must keep a visible "Demo" / "Simulated"
   label. Update `README.md` to state plainly what is real vs. demo.
7. **Preserve the design system.** Cosmic glassmorphism, cyan/violet accents,
   the React Flow canvas, the four-agent model, and the overall three-column
   layout must remain. This is a refactor of internals, not a redesign.

---

## 2. Phase A — Fix existing defects (do this first; small, safe PRs)

These are real bugs found in the current code. Fix before adding anything.

### A1. `Math.random()` called during render (ESLint error, React rule violation)
- **File:** `src/components/layout/ParticleBackground.tsx` (lines ~12–17).
- Particle positions are generated with `Math.random()` inside the `useMemo`
  render path, which ESLint flags as `react-hooks/purity` ("Cannot call impure
  function during render"). It produces unstable output across re-renders.
- **Fix:** generate positions deterministically (seeded PRNG) or once in a
  `useState(() => …)` lazy initializer / `useEffect`, so render stays pure.
- **Done when:** `npm run lint` reports 0 errors.

### A2. Test runner is environment-fragile
- `vitest@4` pulls a native `rolldown` binding that fails to resolve on some
  platforms/CI (`MODULE_NOT_FOUND … rolldown/...binding`).
- **Fix:** pin a Vitest configuration that installs/builds the correct native
  binary in CI (or pin to a Vitest version with prebuilt binaries for linux-x64
  and darwin-arm64). Verify `npm test` runs green in a clean CI container, not
  just locally.
- Add a **GitHub Actions CI** workflow (`.github/workflows/ci.yml`) running
  `npm ci && npm run lint && npm run build && npm test` on push/PR.

### A3. Broken/placeholder assets
- `README.md` references `./public/demo.gif`, which is a placeholder. Either
  record a real demo GIF or remove the broken image reference until you have one.
- Confirm `public/icon-192.png` / `icon-512.png` / `manifest.json` are coherent
  (PWA install). Fix any 404s.

### A4. Simulated side-features wired to lorem
- `AgentSidebar.tsx` wires `onXSim` / `onImagine` / `xSimActive` to a fake "X Live
  Feed" and "Imagine" message, both produced by `generateLorem()` on a 2s
  interval. These are not dead, but they are fake. Leave them in place for now and
  replace their data sources with real calls in Phase B (B4 research feed, B6
  multimodal). Until then, label them "Demo".

### A5. Silent error path
- In `GoalExecutor.handleExecute`, when `executeGoalAction` returns `{ error }`,
  the UI just stops with no feedback. Add a visible error state (toast / inline
  alert with `role="alert"`).

### A6. Accessibility baseline
- Drag-and-drop (`AgentCard` → canvas) has no keyboard path. Add a keyboard
  alternative (e.g., "Add to canvas" button + `aria` roles) and visible focus
  rings. Add `aria-label`s to icon-only buttons. Respect
  `prefers-reduced-motion` (disable particle spin + pulse animations).

---

## 3. Phase B — Real Grok integration (the core upgrade)

Replace each simulated subsystem with real xAI Grok API calls. **All AI calls run
server-side** (Server Actions or Route Handlers), never from the client.

### B0. API client + environment

xAI exposes an **OpenAI-compatible REST API** at `https://api.x.ai/v1`, so use the
official OpenAI SDK with a swapped `baseURL` and key.

> **Verify current model names and endpoints at https://docs.x.ai before coding** —
> xAI ships fast and renames models. As of this writing (June 2026) the relevant
> models are:
> - `grok-4.3` — primary chat + coding model (1M-token context).
> - `grok-build-0.1` — fast agentic coding, 256K context (`grok-code-fast-1` is an alias/migration source).
> - `grok-4.20` — reasoning / multi-agent, 2M-token context.
> - **Images:** `POST https://api.x.ai/v1/images/generations`, model
>   `grok-imagine-image-quality` (recommended; `grok-imagine-image-pro` is being
>   deprecated). Check docs for current video/"Imagine" capabilities.

Steps:
1. `npm i openai zod`.
2. Create `src/lib/ai/grok-client.ts` (server-only — add `import "server-only"`):
   ```ts
   import OpenAI from "openai";
   export const grok = new OpenAI({
     apiKey: process.env.XAI_API_KEY,            // server-only
     baseURL: "https://api.x.ai/v1",
   });
   export const GROK_TEXT_MODEL = process.env.GROK_TEXT_MODEL ?? "grok-4.3";
   export const GROK_FAST_MODEL = process.env.GROK_FAST_MODEL ?? "grok-build-0.1";
   export const GROK_IMAGE_MODEL = process.env.GROK_IMAGE_MODEL ?? "grok-imagine-image-quality";
   ```
3. Add `src/lib/ai/env.ts` that validates `process.env` with Zod at startup and
   throws a clear error if `XAI_API_KEY` is missing.
4. Add `.env.example` documenting every variable (see §7).
5. Add a thin error/retry wrapper (timeout, 1 retry on 429/5xx, typed errors) and
   a simple per-IP rate limit on the route handlers.

### B1. Real goal execution (replace `processGoal` / `buildExecutionSteps`)
- **Files:** `src/actions/execute-goal.ts`, `src/lib/generators/goal-processor.ts`.
- Call Grok with the user's goal and a **structured JSON schema** (use
  `response_format` / function-calling) returning:
  `{ steps: {agent, message}[], code, imagePrompt, thread, chartData, summary }`.
- **Stream** the response so the canvas animation reflects real progress instead
  of `sleep(600)`. Convert the Server Action to a streaming Route Handler
  (`app/api/execute/route.ts`) returning SSE / a `ReadableStream`, and have
  `GoalExecutor` consume the stream and animate steps as they arrive.
- The four canvas agents (Researcher / Designer / Coder / Analyst) should map to
  real sub-calls or a single multi-step tool-calling plan — your choice, but the
  step log must reflect what actually happened.

### B2. Real code generation (replace `code-generator.ts`)
- Ask `grok-build-0.1` to generate **real, runnable** code for the user's goal.
- Render with real syntax highlighting (`shiki`), keep the copy button, and make
  the "download repo" path real (see B8). Show the true filename/language Grok
  returns.

### B3. Real X thread (replace `thread-generator.ts`)
- Grok writes a genuine thread from the goal. **Remove the fake engagement
  numbers** (`♥ 120 + length*3`) or relabel them as "projected" — don't display
  invented metrics as if real.
- Add a real **"Post to X"** action: at minimum an `https://x.com/intent/post?text=…`
  deep link per tweet; optionally full X API v2 posting behind OAuth (gated by env).

### B4. Real research (the Researcher agent / "Start X real-time sim" button)
- Wire to a real signal source: xAI **Live Search** (if enabled on the account)
  or the X API search endpoint. Return real, cited results.
- If the account has no live-search entitlement, keep the button but label it
  "Demo data" honestly rather than implying a live scan.

### B5. Real image generation (replace the "Generated Image" placeholder)
- **Files:** `OutputPanel.tsx` image card, `MultimodalLab.tsx`.
- Call `POST https://api.x.ai/v1/images/generations` with `grok-imagine-image-quality`
  using the `imagePrompt` from B1. Render the real returned image (Next
  `<Image>`), with a loading skeleton and graceful failure state.

### B6. Real multimodal (MultimodalLab)
- If real text-to-video isn't available on the account, **stop faking a video
  player**. Either: (a) use xAI "Imagine" video if entitled, or (b) generate a
  real image (B5) + real **audio narration** via a TTS API or the Web Speech API,
  and label the section accurately. No fake `<video>` UI presented as real output.

### B7. Real persistence (replace `supabase-mock.ts`)
- Wire real **Supabase** (or Vercel Postgres / KV). Persist sessions
  (`id, goal, created_at, outputs`), with a history view to reload past runs.
- Keep `localStorage` only as an offline fallback, clearly separated behind the
  same `getSessions()/saveSession()` interface so callers don't change.

### B8. Real deploy + export (OneClickDeploy + repo-exporter)
- **Files:** `OneClickDeploy.tsx`, `src/lib/export/repo-exporter.ts`.
- Replace the 2-second `setTimeout` with a **real Vercel "Deploy" button**
  (`https://vercel.com/new/clone?repository-url=…`) and/or the Vercel Deploy API.
- Expand `repo-exporter.ts` to zip the **actual** generated project (real
  `package.json`, the B2 code, working scripts) — not a one-line stub `page.tsx`.
- Remove the hardcoded fake URL `https://aetherforge-demo.vercel.app (simulated)`
  unless it is a real deployment.

---

## 4. Phase C — Production polish

### C1. UX states
Loading skeletons, streaming indicators, optimistic UI, empty states, and visible
error/`role="alert"` messaging for every async action.

### C2. Responsive
Make the canvas + sidebar + tab panel usable on mobile (the current three-column
layout collapses awkwardly). Test at 360px, 768px, 1280px.

### C3. Performance
Dynamic-import Three.js, React Flow, and Recharts (`next/dynamic`, `ssr:false`).
Drop particle count and disable the R3F loop under `prefers-reduced-motion` and on
mobile. Target Lighthouse **Performance ≥ 90**.

### C4. Accessibility — target WCAG AA
Keyboard nav for all interactions (incl. drag alternative from A6), focus
management, color-contrast check on the glass panels, `prefers-reduced-motion`
respected everywhere. Target Lighthouse **Accessibility ≥ 90**.

### C5. SEO / sharing
Real OG image and `demo.gif`; verify `metadata`/`viewport` in `app/layout.tsx`.

### C6. Observability & resilience
Add a React **error boundary**, structured server logging, and optional Sentry.
Every AI call has a typed failure path that surfaces to the user.

### C7. Security
Zod-validate env at boot; key server-only (proven by bundle `grep`); per-IP rate
limit; sanitize user goal before echoing into prompts/markdown; cap request
size; never render model output as raw HTML.

### C8. Tests
- Unit-test the new AI wrappers with the network **mocked** (deterministic).
- Keep the Playwright E2E green by running it against a **mock-AI mode**
  (`AI_MODE=mock`) in CI so it doesn't need a live key or spend credits.
- Add tests for the streaming route and the persistence layer.

### C9. Honesty pass (do last)
Audit every screen. Flip badges to "Live" only where truly wired. Anything still
simulated keeps a "Demo" label. Rewrite `README.md` "Core Features" so each row
says **Real** or **Demo**, and document required env vars and setup.

---

## 5. Definition of Done (acceptance checklist)

- [ ] `npm run lint` → **0 errors** (ParticleBackground fixed).
- [ ] `npm run build` → success on a clean checkout.
- [ ] `npm test` → green in CI (rolldown/native-binding issue resolved).
- [ ] With a real `XAI_API_KEY`, "Execute" produces **real, varying** outputs
      (different goals → genuinely different code/thread/image/summary — not the
      fixed lorem word list).
- [ ] Generated image is a **real** image from the xAI images endpoint.
- [ ] Sessions persist to a **real** database and can be reloaded.
- [ ] "Post to X" and "Deploy" perform **real** actions (or are honestly labeled).
- [ ] No secret in the client bundle (`grep -r` the `.next` client chunks → none).
- [ ] Lighthouse Performance ≥ 90 and Accessibility ≥ 90.
- [ ] `README.md` accurately marks every feature Real vs Demo.
- [ ] Deploys to Vercel with env vars set; app works end-to-end in production.

---

## 6. Suggested PR breakdown (ship incrementally, keep green)

1. **PR1 — Phase A** defects + GitHub Actions CI.
2. **PR2 — B0–B2**: Grok client, env validation, streaming goal execution, real code gen.
3. **PR3 — B3–B5**: real X thread + research + image generation.
4. **PR4 — B6–B8**: multimodal, persistence, real deploy/export.
5. **PR5 — Phase C**: polish, a11y, perf, security, honesty pass + README.

---

## 7. Environment variables (`.env.example`)

```bash
# xAI / Grok (server-only — never expose to the client)
XAI_API_KEY=xai-...                     # https://console.x.ai  (free dev credits available)
GROK_TEXT_MODEL=grok-4.3                 # verify current name at https://docs.x.ai
GROK_FAST_MODEL=grok-build-0.1
GROK_IMAGE_MODEL=grok-imagine-image-quality

# Persistence (Supabase or Vercel Postgres/KV)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=               # server-only

# Optional integrations
X_API_BEARER_TOKEN=                      # only if doing real X posting/search
AI_MODE=live                             # "mock" in CI/E2E to avoid spending credits
```

---

## 8. Reference prompt + schema for B1 (starting point — refine as needed)

System prompt:
> You are AetherForge, an agentic AI studio. Given a user goal, produce a concrete
> execution plan and real deliverables. Respond ONLY as JSON matching the provided
> schema. The four agents are researcher, designer, coder, analyst. `code` must be
> real, runnable code for the goal. `thread` is a genuine X thread (no invented
> metrics). `chartData` are real, meaningful metric estimates with honest labels.

JSON schema (validate with Zod on the server):
```ts
{
  steps: { agent: "researcher"|"designer"|"coder"|"analyst", message: string }[],
  code: { language: string, filename: string, content: string },
  imagePrompt: string,
  thread: { index: number, text: string }[],
  chartData: { name: string, value: number, agents: number }[],
  summary: string
}
```

---

## 9. Do NOT change

- The cosmic-glassmorphism visual identity and cyan/violet palette.
- The React Flow agent canvas interaction model and the four-agent concept.
- The three-column layout (sidebar / canvas / tabs).
- Existing `data-testid` attributes used by `scripts/verify-interactions.mjs`.

**Definition of success:** a viewer who opens the deployed app and inspects the
network tab sees **real Grok API calls returning real, goal-specific output** —
and every claim in the README is true.
