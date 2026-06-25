#!/usr/bin/env node
/**
 * Verify xAI OAuth endpoints per GROK_OAUTH_DIRECTIVE.md:
 * - Probe accounts.x.ai (directive auth-server host; discovery may 404)
 * - Verify canonical OIDC on auth.x.ai matches shipped constants (hermes-agent)
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  XAI_OAUTH_DISCOVERY_URL,
  XAI_OAUTH_AUTHORIZE_URL,
  XAI_OAUTH_TOKEN_URL,
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_SCOPE,
} from "./xai-oauth-lib.mjs";

const ACCOUNTS_DISCOVERY = "https://accounts.x.ai/.well-known/openid-configuration";
const ACCOUNTS_AUTHORIZE = "https://accounts.x.ai/oauth2/authorize";
const SCRATCH = process.env.SCRATCH_DIR;
const lines = [];

function log(s) {
  lines.push(s);
  console.log(s);
}

log("=== xAI OAuth endpoint verification ===");

log(`accounts.x.ai discovery: ${ACCOUNTS_DISCOVERY}`);
const accountsDiscovery = await fetch(ACCOUNTS_DISCOVERY);
log(`accounts.x.ai discovery status: ${accountsDiscovery.status}`);

log(`accounts.x.ai authorize probe: ${ACCOUNTS_AUTHORIZE}`);
const accountsAuthorize = await fetch(ACCOUNTS_AUTHORIZE, { method: "HEAD", redirect: "manual" });
log(`accounts.x.ai authorize HEAD status: ${accountsAuthorize.status}`);

log(`auth.x.ai discovery (canonical): ${XAI_OAUTH_DISCOVERY_URL}`);
const authDiscovery = await fetch(XAI_OAUTH_DISCOVERY_URL);
log(`auth.x.ai discovery status: ${authDiscovery.status}`);
if (!authDiscovery.ok) {
  throw new Error(`auth.x.ai discovery failed: ${authDiscovery.status}`);
}

const discovery = await authDiscovery.json();
log(`discovery issuer: ${discovery.issuer}`);
log(`discovery authorization: ${discovery.authorization_endpoint}`);
log(`discovery token: ${discovery.token_endpoint}`);
log(`shipped authorize: ${XAI_OAUTH_AUTHORIZE_URL}`);
log(`shipped token: ${XAI_OAUTH_TOKEN_URL}`);
log(`hermes client_id: ${XAI_OAUTH_CLIENT_ID}`);
log(`shipped scope: ${XAI_OAUTH_SCOPE}`);

if (discovery.authorization_endpoint !== XAI_OAUTH_AUTHORIZE_URL) {
  throw new Error(`authorize mismatch: ${discovery.authorization_endpoint}`);
}
if (discovery.token_endpoint !== XAI_OAUTH_TOKEN_URL) {
  throw new Error(`token mismatch: ${discovery.token_endpoint}`);
}
for (const scope of ["grok-cli:access", "api:access", "offline_access"]) {
  if (!discovery.scopes_supported?.includes(scope)) {
    throw new Error(`discovery missing scope: ${scope}`);
  }
}

const authorizeProbe = await fetch(XAI_OAUTH_AUTHORIZE_URL, { method: "HEAD", redirect: "manual" });
log(`auth.x.ai authorize HEAD status: ${authorizeProbe.status}`);

log(
  "note: accounts.x.ai is the browser login UI host (directive §constraints); " +
    "OIDC discovery + token exchange use auth.x.ai per NousResearch/hermes-agent hermes_cli/auth.py"
);

if (SCRATCH) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, "oauth-endpoints.log"), lines.join("\n") + "\n");
}