#!/usr/bin/env node
/** Verify OAuth endpoints against accounts.x.ai + auth.x.ai discovery fallback. */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  XAI_OAUTH_DISCOVERY_URL,
  XAI_OAUTH_DISCOVERY_FALLBACK_URL,
  XAI_OAUTH_ACCOUNTS_HOST,
  XAI_OAUTH_AUTHORIZE_URL,
  XAI_OAUTH_TOKEN_URL,
  XAI_OAUTH_CLIENT_ID,
} from "./xai-oauth-lib.mjs";

const SCRATCH = process.env.SCRATCH_DIR;
const lines = [];

function log(s) {
  lines.push(s);
  console.log(s);
}

log("=== xAI OAuth endpoint verification ===");
log(`accounts discovery: ${XAI_OAUTH_DISCOVERY_URL}`);
const accountsRes = await fetch(XAI_OAUTH_DISCOVERY_URL);
log(`accounts discovery status: ${accountsRes.status}`);

log(`auth discovery fallback: ${XAI_OAUTH_DISCOVERY_FALLBACK_URL}`);
const authRes = await fetch(XAI_OAUTH_DISCOVERY_FALLBACK_URL);
log(`auth discovery status: ${authRes.status}`);
const discovery = await authRes.json();
log(`discovery token: ${discovery.token_endpoint}`);
log(`configured authorize (accounts): ${XAI_OAUTH_AUTHORIZE_URL}`);
log(`configured token (auth.x.ai): ${XAI_OAUTH_TOKEN_URL}`);
log(`hermes client_id: ${XAI_OAUTH_CLIENT_ID}`);

if (discovery.token_endpoint !== XAI_OAUTH_TOKEN_URL) {
  throw new Error(`token mismatch: ${discovery.token_endpoint}`);
}
if (!discovery.scopes_supported?.includes("grok-cli:access")) {
  throw new Error("discovery missing grok-cli:access scope");
}

const accountsAuthorizeProbe = await fetch(`${XAI_OAUTH_ACCOUNTS_HOST}/oauth2/authorize`, {
  method: "HEAD",
  redirect: "manual",
});
log(`accounts authorize HEAD status: ${accountsAuthorizeProbe.status}`);

if (SCRATCH) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, "oauth-endpoints.log"), lines.join("\n") + "\n");
}