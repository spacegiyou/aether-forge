#!/usr/bin/env node
/**
 * xAI Grok OAuth 2.0 PKCE login — mirrors NousResearch/hermes-agent xai-oauth provider.
 */

import { createServer } from "http";
import { randomBytes } from "crypto";
import { exec } from "child_process";
import {
  REDIRECT_HOST,
  REDIRECT_PORT,
  REDIRECT_PATH,
  REDIRECT_URI,
  TIMEOUT_MS,
  base64Url,
  buildAuthorizeUrl,
  exchangeCode,
  saveTokens,
  printHelp,
} from "./xai-oauth-lib.mjs";

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

async function manualPasteCli(state, verifier) {
  const url = buildAuthorizeUrl(state, verifier);
  console.log("\nOpen this URL in your browser and sign in:\n");
  console.log(url);
  console.log("\nPaste the callback URL, query string, or bare authorization code:\n");
  const input = await readLine("Callback URL: ");
  const { manualPasteFlow } = await import("./xai-oauth-lib.mjs");
  const result = await manualPasteFlow(state, verifier, input);
  console.log(`Saved tokens to ${result.path}`);
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
        const saved = saveTokens(tokens);
        console.log(`Saved tokens to ${saved.path}`);
        resolve();
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, REDIRECT_HOST, () => {
      const url = buildAuthorizeUrl(state, verifier);
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
    console.log(printHelp());
    process.exit(0);
  }

  const manual = args.includes("--manual-paste");
  const state = base64Url(randomBytes(16));
  const verifier = base64Url(randomBytes(32));

  if (manual) {
    await manualPasteCli(state, verifier);
  } else {
    await loopbackFlow(state, verifier);
  }

  console.log("Sign-in complete. Run AI_MODE=auto npm run dev to use OAuth.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});