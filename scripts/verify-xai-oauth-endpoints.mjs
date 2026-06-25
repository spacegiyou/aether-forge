#!/usr/bin/env node
/** Verify OAuth endpoints against auth.x.ai OIDC discovery (canonical issuer). */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  XAI_OAUTH_DISCOVERY_URL,
  XAI_OAUTH_AUTHORIZE_URL,
  XAI_OAUTH_TOKEN_URL,
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_SCOPE,
} from "./xai-oauth-lib.mjs";

const SCRATCH = process.env.SCRATCH_DIR;
const lines = [];

function log(s) {
  lines.push(s);
  console.log(s);
}

log("=== xAI OAuth endpoint verification ===");
log(`discovery: ${XAI_OAUTH_DISCOVERY_URL}`);
const discoveryRes = await fetch(XAI_OAUTH_DISCOVERY_URL);
log(`discovery status: ${discoveryRes.status}`);
if (!discoveryRes.ok) {
  throw new Error(`discovery failed: ${discoveryRes.status}`);
}

const discovery = await discoveryRes.json();
log(`discovery issuer: ${discovery.issuer}`);
log(`discovery authorization: ${discovery.authorization_endpoint}`);
log(`discovery token: ${discovery.token_endpoint}`);
log(`configured authorize: ${XAI_OAUTH_AUTHORIZE_URL}`);
log(`configured token: ${XAI_OAUTH_TOKEN_URL}`);
log(`hermes client_id: ${XAI_OAUTH_CLIENT_ID}`);
log(`configured scope: ${XAI_OAUTH_SCOPE}`);

if (discovery.authorization_endpoint !== XAI_OAUTH_AUTHORIZE_URL) {
  throw new Error(`authorize mismatch: ${discovery.authorization_endpoint}`);
}
if (discovery.token_endpoint !== XAI_OAUTH_TOKEN_URL) {
  throw new Error(`token mismatch: ${discovery.token_endpoint}`);
}
if (!discovery.scopes_supported?.includes("grok-cli:access")) {
  throw new Error("discovery missing grok-cli:access scope");
}
if (!discovery.scopes_supported?.includes("api:access")) {
  throw new Error("discovery missing api:access scope");
}

const authorizeProbe = await fetch(XAI_OAUTH_AUTHORIZE_URL, {
  method: "HEAD",
  redirect: "manual",
});
log(`authorize HEAD status: ${authorizeProbe.status}`);

if (SCRATCH) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, "oauth-endpoints.log"), lines.join("\n") + "\n");
}