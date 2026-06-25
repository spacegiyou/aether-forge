/**
 * xAI OAuth constants — from NousResearch/hermes-agent hermes_cli/auth.py.
 * Verified 2026-06-25 against accounts.x.ai + auth.x.ai:
 * - accounts.x.ai/oauth2/authorize → browser login (directive + accounts host)
 * - auth.x.ai/.well-known/openid-configuration → token endpoint (accounts discovery 404s)
 */
export const XAI_OAUTH_ACCOUNTS_HOST = "https://accounts.x.ai";
export const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ACCOUNTS_HOST}/.well-known/openid-configuration`;
export const XAI_OAUTH_DISCOVERY_FALLBACK_URL = "https://auth.x.ai/.well-known/openid-configuration";
export const XAI_OAUTH_AUTHORIZE_URL = `${XAI_OAUTH_ACCOUNTS_HOST}/oauth2/authorize`;
export const XAI_OAUTH_TOKEN_URL = "https://auth.x.ai/oauth2/token";
export const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_SCOPE =
  "openid profile email offline_access grok-cli:access api:access";
export const XAI_OAUTH_REDIRECT_HOST = "127.0.0.1";
export const XAI_OAUTH_REDIRECT_PORT = 56121;
export const XAI_OAUTH_REDIRECT_PATH = "/callback";
export const XAI_OAUTH_REDIRECT_URI = `http://${XAI_OAUTH_REDIRECT_HOST}:${XAI_OAUTH_REDIRECT_PORT}${XAI_OAUTH_REDIRECT_PATH}`;
export const XAI_OAUTH_REFRESH_SKEW_SECONDS = 3600;