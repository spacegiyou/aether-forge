/**
 * Re-exports from scripts/oauth-contract.json — single source of truth.
 * Structural sync enforced by scripts/oauth-contract.test.mjs.
 */
import contract from "../../../scripts/oauth-contract.json";

export const XAI_OAUTH_ISSUER = contract.OIDC_ISSUER;
export const XAI_OAUTH_DISCOVERY_URL = `${contract.OIDC_ISSUER}/.well-known/openid-configuration`;
export const XAI_OAUTH_AUTHORIZE_URL = `${contract.OIDC_ISSUER}/oauth2/authorize`;
export const XAI_OAUTH_TOKEN_URL = `${contract.OIDC_ISSUER}/oauth2/token`;
export const XAI_OAUTH_CLIENT_ID = contract.CLIENT_ID;
export const XAI_OAUTH_SCOPE = contract.SCOPE;
export const XAI_OAUTH_REDIRECT_HOST = contract.REDIRECT_HOST;
export const XAI_OAUTH_REDIRECT_PORT = contract.REDIRECT_PORT;
export const XAI_OAUTH_REDIRECT_PATH = contract.REDIRECT_PATH;
export const XAI_OAUTH_REDIRECT_URI = `http://${contract.REDIRECT_HOST}:${contract.REDIRECT_PORT}${contract.REDIRECT_PATH}`;
export const XAI_OAUTH_REFRESH_SKEW_SECONDS = contract.REFRESH_SKEW_SECONDS;

export const XAI_OAUTH_BROWSER_UI_HOST = contract.BROWSER_UI_HOST;
export const XAI_OAUTH_BROWSER_AUTHORIZE_URL = `https://${contract.BROWSER_UI_HOST}/oauth2/authorize`;
export const XAI_OAUTH_ACCOUNTS_DISCOVERY_URL = `https://${contract.BROWSER_UI_HOST}/.well-known/openid-configuration`;