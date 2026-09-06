import {
  getEntraConfig,
  getRedirectUri,
  jsonSetupError,
  randomToken,
  setLoginCookies,
  sha256Base64Url,
} from "../entra";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getEntraConfig();
  if (!config) return jsonSetupError();

  const state = randomToken();
  const verifier = randomToken(64);
  const challenge = await sha256Base64Url(verifier);
  await setLoginCookies(state, verifier);

  const authorizeUrl = new URL(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", getRedirectUri(request));
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("prompt", "select_account");

  return Response.redirect(authorizeUrl);
}
