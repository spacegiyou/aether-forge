/**
 * Single OAuth contract — NousResearch/hermes-agent hermes_cli/auth.py + live probes.
 * BROWSER_UI_HOST (accounts.x.ai) = directive login UI; OIDC_ISSUER (auth.x.ai) = token/authorize.
 */

import contract from "./oauth-contract.json" with { type: "json" };

export const BROWSER_UI_HOST = contract.BROWSER_UI_HOST;
export const OIDC_ISSUER = contract.OIDC_ISSUER;
export const OIDC_DISCOVERY_URL = `${OIDC_ISSUER}/.well-known/openid-configuration`;
export const AUTHORIZE_URL = `${OIDC_ISSUER}/oauth2/authorize`;
export const TOKEN_URL = `${OIDC_ISSUER}/oauth2/token`;
export const ACCOUNTS_DISCOVERY_URL = `https://${BROWSER_UI_HOST}/.well-known/openid-configuration`;
export const ACCOUNTS_AUTHORIZE_URL = `https://${BROWSER_UI_HOST}/oauth2/authorize`;

export const CLIENT_ID = contract.CLIENT_ID;
export const SCOPE = contract.SCOPE;
export const REDIRECT_HOST = contract.REDIRECT_HOST;
export const REDIRECT_PORT = contract.REDIRECT_PORT;
export const REDIRECT_PATH = contract.REDIRECT_PATH;
export const REDIRECT_URI = `http://${REDIRECT_HOST}:${REDIRECT_PORT}${REDIRECT_PATH}`;
export const PKCE_METHOD = contract.PKCE_METHOD;
export const REFRESH_SKEW_SECONDS = contract.REFRESH_SKEW_SECONDS;
export const AUTHORIZE_PLAN = contract.AUTHORIZE_PLAN;

/** Legacy aliases used by xai-oauth-lib / oauth-store */
export const XAI_OAUTH_ISSUER = OIDC_ISSUER;
export const XAI_OAUTH_DISCOVERY_URL = OIDC_DISCOVERY_URL;
export const XAI_OAUTH_AUTHORIZE_URL = AUTHORIZE_URL;
export const XAI_OAUTH_TOKEN_URL = TOKEN_URL;
export const XAI_OAUTH_CLIENT_ID = CLIENT_ID;
export const XAI_OAUTH_SCOPE = SCOPE;

/**
 * Probe accounts.x.ai (directive UI host) + auth.x.ai OIDC (hermes issuer).
 * @param {typeof fetch} fetcher
 */
export async function verifyOAuthContract(fetcher = fetch) {
  const lines = [];
  const log = (s) => {
    lines.push(s);
  };

  log("=== OAuth contract verification ===");
  log(`contract BROWSER_UI_HOST: ${BROWSER_UI_HOST}`);
  log(`contract OIDC_ISSUER: ${OIDC_ISSUER}`);
  log(`contract AUTHORIZE_URL: ${AUTHORIZE_URL}`);
  log(`contract TOKEN_URL: ${TOKEN_URL}`);
  log(`contract CLIENT_ID: ${CLIENT_ID}`);

  const accountsDiscovery = await fetcher(ACCOUNTS_DISCOVERY_URL);
  log(`accounts discovery: ${ACCOUNTS_DISCOVERY_URL}`);
  log(`accounts discovery status: ${accountsDiscovery.status}`);
  if (accountsDiscovery.status !== 404) {
    throw new Error(`expected accounts discovery 404, got ${accountsDiscovery.status}`);
  }

  const accountsAuthorize = await fetcher(ACCOUNTS_AUTHORIZE_URL, {
    method: "HEAD",
    redirect: "manual",
  });
  log(`accounts authorize HEAD: ${accountsAuthorize.status}`);

  const authDiscovery = await fetcher(OIDC_DISCOVERY_URL);
  log(`auth discovery: ${OIDC_DISCOVERY_URL}`);
  log(`auth discovery status: ${authDiscovery.status}`);
  if (!authDiscovery.ok) {
    throw new Error(`auth discovery failed: ${authDiscovery.status}`);
  }

  const discovery = await authDiscovery.json();
  log(`discovery issuer: ${discovery.issuer}`);
  log(`discovery authorization: ${discovery.authorization_endpoint}`);
  log(`discovery token: ${discovery.token_endpoint}`);

  if (discovery.issuer !== OIDC_ISSUER) {
    throw new Error(`issuer mismatch: ${discovery.issuer}`);
  }
  if (discovery.authorization_endpoint !== AUTHORIZE_URL) {
    throw new Error(`authorize mismatch: ${discovery.authorization_endpoint}`);
  }
  if (discovery.token_endpoint !== TOKEN_URL) {
    throw new Error(`token mismatch: ${discovery.token_endpoint}`);
  }
  for (const scope of ["grok-cli:access", "api:access", "offline_access"]) {
    if (!discovery.scopes_supported?.includes(scope)) {
      throw new Error(`discovery missing scope: ${scope}`);
    }
  }

  const authAuthorize = await fetcher(AUTHORIZE_URL, { method: "HEAD", redirect: "manual" });
  log(`auth authorize HEAD: ${authAuthorize.status}`);

  log(
    "note: accounts.x.ai = browser login UI (directive); auth.x.ai = OIDC issuer (hermes-agent)"
  );

  return { lines, discovery };
}