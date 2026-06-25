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
export const ACCOUNTS_TOKEN_URL = `https://${BROWSER_UI_HOST}/oauth2/token`;
/** Directive browser entry — login UI at accounts.x.ai */
export const BROWSER_AUTHORIZE_URL = ACCOUNTS_AUTHORIZE_URL;
export const VERIFICATION_NOTE = contract.VERIFICATION_NOTE ?? "";

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

  const accountsAuthorizeHead = await fetcher(ACCOUNTS_AUTHORIZE_URL, {
    method: "HEAD",
    redirect: "manual",
  });
  log(`accounts authorize HEAD: ${accountsAuthorizeHead.status}`);

  const accountsAuthorizeGet = await fetcher(
    `${ACCOUNTS_AUTHORIZE_URL}?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}&state=probe&code_challenge_method=${PKCE_METHOD}&plan=${AUTHORIZE_PLAN}`,
    {
      redirect: "manual",
      headers: { "User-Agent": "AetherForge-OAuth-Verify/1.0" },
    }
  );
  log(`accounts authorize GET (browser UI): ${accountsAuthorizeGet.status}`);
  const okBrowser =
    (accountsAuthorizeGet.status >= 200 && accountsAuthorizeGet.status < 400) ||
    accountsAuthorizeGet.status === 403;
  if (!okBrowser) {
    throw new Error(`accounts authorize GET unexpected status: ${accountsAuthorizeGet.status}`);
  }

  const accountsTokenHead = await fetcher(ACCOUNTS_TOKEN_URL, {
    method: "HEAD",
    redirect: "manual",
  });
  log(`accounts token HEAD: ${accountsTokenHead.status}`);

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

  log(`verification_note: ${VERIFICATION_NOTE}`);
  log(`browser_authorize: ${BROWSER_AUTHORIZE_URL}`);
  log(`oidc_authorize: ${AUTHORIZE_URL}`);
  log(`oidc_token: ${TOKEN_URL}`);

  return { lines, discovery };
}