# AetherForge — Grok OAuth Directive (local demo) + API-key fallback

## Goal

Let AetherForge call Grok **without an API key** for the user's **local demo**, by
signing in with a **SuperGrok / X Premium+** subscription via xAI's browser OAuth
(PKCE) flow — while keeping the existing **`XAI_API_KEY`** path working for when the
repo is pushed to git / deployed. CI/tests keep using **mock**.

Three credential sources, resolved automatically:

| Source | When | Used for |
|--------|------|----------|
| `oauth` | a local OAuth token file exists | the user's local demo (no key, uses subscription quota) |
| `key`  | `XAI_API_KEY` is set (and no OAuth token) | git / Vercel / anyone cloning the repo |
| `mock` | neither is present | CI, tests, first-run without creds |

---

## ⚠️ Read first — constraints & honesty

1. **The subscription-OAuth surface is unofficial / reverse-engineered.** It logs in
   against `accounts.x.ai` reusing the official Grok client. It may violate xAI's
   ToS, is subject to an allowlist (can return **HTTP 403** even for active
   subscribers), and can break without notice. Treat it as **local-demo-only**.
2. **Never commit tokens.** The OAuth token file must be git-ignored. The supported,
   committable path is the API key.
3. **Do NOT invent OAuth endpoints, client IDs, scopes, or the loopback port.**
   Take the exact `authorize` URL, `token` URL, `client_id`, scopes, PKCE method,
   and redirect/loopback port from a current open-source implementation and verify
   against `accounts.x.ai`. Reference implementations to read:
   - `NousResearch/hermes-agent` (provider `xai-oauth`)
   - the `opencode` / OpenClaw xAI providers
   - `diegosouzapw/OmniRoute` issue #2760 (Grok OAuth provider)
   Known fixed facts from these: auth server `https://accounts.x.ai`, API base
   `https://api.x.ai/v1`, **OAuth 2.0 PKCE with a 127.0.0.1 loopback callback**
   (Hermes uses `127.0.0.1:56121/callback`), tokens refreshed via `refresh_token`,
   and a **manual-paste** fallback when the consent page shows the code instead of
   redirecting.
4. **Keep `npm run lint` / `npm run build` / `npm test` green**, keep all
   `data-testid`s, keep secrets server-only. Default `AI_MODE` stays mock so CI
   needs no creds.

---

## 1. Credential resolver (the core change)

Create `src/lib/ai/credentials.ts` (server-only). It centralizes "what bearer token
do we send to xAI, and in which mode":

```ts
import "server-only";
export type CredentialSource = "oauth" | "key" | "mock";

export interface XaiCredential {
  source: CredentialSource;
  token?: string;        // bearer to put in Authorization / OpenAI apiKey
}

// Resolution order (unless AI_MODE forces one):
//   1. AI_MODE=mock  -> { source: "mock" }
//   2. AI_MODE=key OR (no oauth token & XAI_API_KEY set) -> { source: "key", token: XAI_API_KEY }
//   3. valid/refreshable OAuth token on disk -> { source: "oauth", token: accessToken }
//   4. XAI_API_KEY set -> { source: "key", token: XAI_API_KEY }
//   5. else -> { source: "mock" }
export async function resolveXaiCredential(): Promise<XaiCredential> { /* ... */ }
```

- `AI_MODE` becomes `mock | key | oauth | auto` (default `auto`; `auto` = the order
  above). Update `src/lib/ai/env.ts` Zod enum + `.env.example`.
- OAuth must be **preferred over key** in `auto` so the local demo uses the
  subscription, exactly as the reference tools do.

## 2. `getGrokClient()` → use the resolved bearer

Refactor `src/lib/ai/grok-client.ts` so the OpenAI client's `apiKey` is the resolved
bearer (works for both an `xai-...` API key and an OAuth access token — both are just
`Authorization: Bearer <token>`):

```ts
const cred = await resolveXaiCredential();
if (cred.source === "mock" || !cred.token) throw new Error("No xAI credential");
return new OpenAI({ apiKey: cred.token, baseURL: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1" });
```

Make `getGrokClient()` async and update callers (`execute-live.ts`,
`generate-image.ts`).

**Verify the OAuth surface endpoint.** The Hermes docs note the OAuth path uses a
**Responses-style** endpoint. So: try `client.chat.completions.create` with the
OAuth bearer first; if xAI rejects it for OAuth tokens, switch OAuth calls to
`client.responses.create` (OpenAI SDK v6 supports it) against `/v1/responses`, while
the API-key path may keep `chat.completions`. Abstract the call behind one function
so the rest of the code doesn't care.

**Model per source.** The OAuth subscription catalog is `grok-4.3` and
`grok-4.20-*` — it does **not** include `grok-code-fast-1` (that's an API-platform
model). So:
- `oauth` source → use `GROK_TEXT_MODEL` (`grok-4.3`).
- `key` source → may use `GROK_FAST_MODEL` (`grok-code-fast-1`) as today.
Pick the model from the resolved source.

## 3. OAuth login flow (PKCE loopback) + token store

Add a standalone login script `scripts/xai-oauth-login.mjs`, run via
`npm run auth:xai`. Mirror the reference implementation:

1. Generate PKCE `code_verifier` + `code_challenge` (S256) and a random `state`.
2. Start a loopback HTTP listener on `127.0.0.1:<port>/callback` (use the port the
   reference client registers, e.g. `56121`).
3. Open the browser to the `accounts.x.ai` authorize URL (`client_id`,
   `redirect_uri=http://127.0.0.1:<port>/callback`, `code_challenge`, `state`,
   scopes — all from the reference impl).
4. On callback, verify `state`, exchange `code` + `code_verifier` at the token
   endpoint for `{ access_token, refresh_token, expires_in }`.
5. Save to `~/.aetherforge/xai-auth.json` (preferred) or
   `./.xai-auth.json` (project-local) — **git-ignored** either way. Include
   `obtained_at`/`expires_at`.
6. Support `--manual-paste` (print the URL, accept a pasted `code`/callback URL) for
   environments where the browser can't reach the loopback.
7. Timeout the listener (~180 s) and handle `state` mismatch (CSRF) like the
   reference.

Create `src/lib/ai/oauth-store.ts` (server-only): `loadOAuthToken()`,
`saveOAuthToken()`, `isExpired()`, and `refreshOAuthToken()` (POST `refresh_token`
to the token endpoint; on terminal `invalid_grant`, delete the file and report
"re-auth required"). `resolveXaiCredential()` calls this: if expired, refresh; if
refresh fails, fall through to `key`/`mock`.

## 4. Runtime error handling (401 / 403)

In the live execution + image paths:
- On **401**: refresh the OAuth token once and retry; if still failing, fall back to
  `key` if available, else surface "re-authentication required".
- On **403** with an OAuth token: this is the known xAI allowlist gate. Do **not**
  loop. Surface a clear message: *"Your Grok subscription tier isn't allowlisted for
  OAuth API access (HTTP 403). Set XAI_API_KEY to use the API path."* and, if
  `XAI_API_KEY` is present, auto-fall back to the `key` source for that request.

## 5. UI

- Add a **"Sign in with Grok (SuperGrok / X Premium+)"** control (Header or Agent
  sidebar). Since login is a local CLI step, the button can: (a) show current status
  from a `/api/auth/xai/status` route (`source: oauth|key|mock`, and for oauth an
  `expires_at`), and (b) link/instruct to run `npm run auth:xai`. (Optional nicer
  path: a `/api/auth/xai/login` route that performs the loopback flow when the app
  itself is the localhost origin — only if the reference client allows the app's
  redirect; otherwise keep the script.)
- Reuse the existing **credential-source badge**: extend the current `aiMode`
  Live/Demo badge to show `OAuth` / `API key` / `Demo` based on the resolved
  `source` returned by `/api/execute` (`meta` event already carries `aiMode` — add
  `source`).
- A "Sign out" action deletes the token file (`DELETE /api/auth/xai`).

## 6. Config / housekeeping

- **`.gitignore`**: add `.xai-auth.json` and `.aetherforge/` (and confirm `.env*`
  is ignored). Tokens must never be committed.
- **`.env.example`**: set `AI_MODE=auto`, document that local demo needs no key
  (run `npm run auth:xai`), and that git/Vercel uses `XAI_API_KEY`. Add optional
  `XAI_BASE_URL`.
- **`package.json`**: add `"auth:xai": "node scripts/xai-oauth-login.mjs"` and
  `"auth:xai:logout"`.
- **README**: a "Run the live demo" section — Option A (local, OAuth: run
  `npm run auth:xai`, sign in, `AI_MODE=auto`, demo) and Option B (deploy/git, API
  key: set `XAI_API_KEY`). State plainly that OAuth is unofficial/local-only.

## 7. Tests / acceptance

- Unit-test `resolveXaiCredential()` for all 5 branches (mock the token file + env);
  unit-test `oauth-store` expiry/refresh logic with a mocked token endpoint. **No
  real network in tests.**
- `npm run lint` 0 errors, `npm run build` ok, `npm test` green with no creds
  (mock).
- Manual check (local): `npm run auth:xai` → sign in → `AI_MODE=auto npm run dev`
  → Execute shows the **OAuth** badge and a real Grok response in the network tab.
- Remove the token file (or `AI_MODE=key` + `XAI_API_KEY`) → Execute shows the
  **API key** badge and still works.
- Confirm `.xai-auth.json` is git-ignored (`git status` clean after login) and no
  token appears in the client bundle.

## 8. Definition of done

A local user runs `npm run auth:xai`, signs in with SuperGrok / X Premium+, and the
app makes real Grok calls **with no API key** (subscription quota), badge = "OAuth".
After `git push` / Vercel deploy (no token file), the same app runs on `XAI_API_KEY`,
badge = "API key". With neither, it's mock, badge = "Demo". Lint/build/test stay
green and tokens are never committed.
