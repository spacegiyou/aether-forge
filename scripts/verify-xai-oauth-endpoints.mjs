#!/usr/bin/env node
/** Verify OAuth endpoints: accounts.x.ai discovery 404, auth.x.ai discovery matches constants. */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  XAI_OAUTH_DISCOVERY_URL,
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
log(`accounts discovery: ${XAI_OAUTH_ACCOUNTS_HOST}/.well-known/openid-configuration`);
const accountsRes = await fetch(`${XAI_OAUTH_ACCOUNTS_HOST}/.well-known/openid-configuration`);
log(`accounts discovery status: ${accountsRes.status}`);

log(`auth discovery: ${XAI_OAUTH_DISCOVERY_URL}`);
const authRes = await fetch(XAI_OAUTH_DISCOVERY_URL);
log(`auth discovery status: ${authRes.status}`);
const discovery = await authRes.json();
log(`discovery issuer: ${discovery.issuer}`);
log(`discovery authorize: ${discovery.authorization_endpoint}`);
log(`discovery token: ${discovery.token_endpoint}`);
log(`hermes client_id: ${XAI_OAUTH_CLIENT_ID}`);

if (discovery.authorization_endpoint !== XAI_OAUTH_AUTHORIZE_URL) {
  throw new Error(`authorize mismatch: ${discovery.authorization_endpoint} vs ${XAI_OAUTH_AUTHORIZE_URL}`);
}
if (discovery.token_endpoint !== XAI_OAUTH_TOKEN_URL) {
  throw new Error(`token mismatch: ${discovery.token_endpoint} vs ${XAI_OAUTH_TOKEN_URL}`);
}
if (!discovery.scopes_supported?.includes("grok-cli:access")) {
  throw new Error("discovery missing grok-cli:access scope");
}

log("accounts.x.ai hosts browser login UI; OIDC discovery verified on auth.x.ai (hermes-agent source).");

if (SCRATCH) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, "oauth-endpoints.log"), lines.join("\n") + "\n");
}