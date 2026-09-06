import {
  getGoogleConfig,
  getGoogleRedirectUri,
  jsonProviderSetupError,
  randomToken,
  setLoginCookies,
  sha256Base64Url,
} from "../entra";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getGoogleConfig();
  if (!config) return jsonProviderSetupError("Google", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]);

  const state = randomToken();
  const verifier = randomToken(64);
  const challenge = await sha256Base64Url(verifier);
  await setLoginCookies(state, verifier);

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", getGoogleRedirectUri(request));
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("prompt", "select_account");

  return Response.redirect(authorizeUrl);
}
