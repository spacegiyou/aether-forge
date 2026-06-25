#!/usr/bin/env node
/**
 * xAI Grok OAuth 2.0 PKCE login — mirrors NousResearch/hermes-agent xai-oauth provider.
 * Saves tokens to ~/.aetherforge/xai-auth.json (git-ignored).
 */

import { createServer } from "http";
import { mkdirSync, writeFileSync, renameSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createHash, randomBytes } from "crypto";
import { exec } from "child_process";

const XAI_OAUTH_AUTHORIZE_URL = "https://auth.x.ai/oauth2/authorize";
const XAI_OAUTH_TOKEN_URL = "https://auth.x.ai/oauth2/token";
const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_OAUTH_SCOPE =
  "openid profile email offline_access grok-cli:access api:access";
const REDIRECT_HOST = "127.0.0.1";
const REDIRECT_PORT = 56121;
const REDIRECT_PATH = "/callback";
const REDIRECT_URI = `http://${REDIRECT_HOST}:${REDIRECT_PORT}${REDIRECT_PATH}`;
const TIMEOUT_MS = 180_000;

function printHelp() {
  console.log(`xAI Grok OAuth login for AetherForge

Usage:
  node scripts/xai-oauth-login.mjs [--manual-paste] [--help]

Options:
  --manual-paste  Print authorize URL and accept pasted callback URL or code
  --help          Show this help

Tokens are saved to ~/.aetherforge/xai-auth.json (never printed).`);
}

function base64Url(buf) {
  return buf.toString("base64url");
}

function pkceChallenge(verifier) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

function tokenPath() {
  if (process.env.XAI_AUTH_FILE?.trim()) {
    return process.env.XAI_AUTH_FILE.trim();
  }
  return join(homedir(), ".aetherforge", "xai-auth.json");
}

function saveTokens(body) {
  const now = Date.now();
  const data = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    obtained_at: now,
    expires_at: now + body.expires_in * 1000,
  };
  const path = tokenPath();
  const dir = join(path, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
  console.log(`Saved tokens to ${path}`);
}

async function exchangeCode(code, verifier) {
  const res = await fetch(XAI_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: XAI_OAUTH_CLIENT_ID,
      code_verifier: verifier,
    }).toString(),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error_description ?? body.error ?? `Token exchange failed (${res.status})`);
  }
  if (!body.access_token || !body.refresh_token || !body.expires_in) {
    throw new Error("Token exchange returned incomplete response");
  }
  return body;
}

function buildAuthorizeUrl(state, challenge) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: XAI_OAUTH_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: XAI_OAUTH_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${XAI_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function parseCallbackInput(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith("http")) {
    const u = new URL(trimmed);
    return {
      code: u.searchParams.get("code"),
      state: u.searchParams.get("state"),
    };
  }
  if (trimmed.startsWith("?")) {
    const params = new URLSearchParams(trimmed.slice(1));
    return { code: params.get("code"), state: params.get("state") };
  }
  return { code: trimmed, state: null };
}

async function readLine(prompt) {
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (chunk) => {
      buf += chunk;
      resolve(buf.trim());
    });
  });
}

async function manualPasteFlow(state, verifier) {
  const url = buildAuthorizeUrl(state, pkceChallenge(verifier));
  console.log("\nOpen this URL in your browser and sign in:\n");
  console.log(url);
  console.log("\nPaste the callback URL, query string, or bare authorization code:\n");
  const input = await readLine("Callback URL: ");
  const { code, state: returnedState } = parseCallbackInput(input);
  if (returnedState && returnedState !== state) {
    throw new Error("State mismatch (possible CSRF)");
  }
  if (!code) throw new Error("No authorization code found in input");
  const tokens = await exchangeCode(code, verifier);
  saveTokens(tokens);
}

function loopbackFlow(state, verifier) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        if (!req.url?.startsWith(REDIRECT_PATH)) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const u = new URL(req.url, REDIRECT_URI);
        const code = u.searchParams.get("code");
        const returnedState = u.searchParams.get("state");
        if (returnedState !== state) {
          res.writeHead(400);
          res.end("State mismatch");
          reject(new Error("State mismatch (possible CSRF)"));
          server.close();
          return;
        }
        if (!code) {
          res.writeHead(400);
          res.end("Missing code");
          reject(new Error("Missing authorization code"));
          server.close();
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h2>Sign-in complete. You can close this tab.</h2></body></html>");
        server.close();
        const tokens = await exchangeCode(code, verifier);
        saveTokens(tokens);
        resolve();
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, REDIRECT_HOST, () => {
      const url = buildAuthorizeUrl(state, pkceChallenge(verifier));
      console.log("Opening browser for Grok sign-in…");
      console.log(`If the browser does not open, visit:\n${url}\n`);
      openBrowser(url);
    });

    server.on("error", (err) => {
      reject(new Error(`Loopback server failed on ${REDIRECT_URI}: ${err.message}`));
    });

    setTimeout(() => {
      server.close();
      reject(new Error("Authorization timed out (180s)"));
    }, TIMEOUT_MS);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const manual = args.includes("--manual-paste");
  const state = base64Url(randomBytes(16));
  const verifier = base64Url(randomBytes(32));

  if (manual) {
    await manualPasteFlow(state, verifier);
  } else {
    await loopbackFlow(state, verifier);
  }

  console.log("Sign-in complete. Run AI_MODE=auto npm run dev to use OAuth.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});