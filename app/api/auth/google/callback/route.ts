import {
  clearLoginCookies,
  decodeJwtPayload,
  getGoogleConfig,
  getGoogleRedirectUri,
  readLoginCookies,
  setSessionCookie,
} from "../../entra";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getGoogleConfig();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const { state, verifier } = await readLoginCookies();

  if (!config) return Response.redirect(new URL("/?auth=google-missing-config", request.url));
  if (error) return Response.redirect(new URL(`/?auth=google-error&message=${encodeURIComponent(error)}`, request.url));
  if (!code || !returnedState || !state || returnedState !== state || !verifier) {
    return Response.redirect(new URL("/?auth=google-invalid-state", request.url));
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: getGoogleRedirectUri(request),
      code_verifier: verifier,
    }),
  });

  if (!tokenResponse.ok) {
    await clearLoginCookies();
    return Response.redirect(new URL("/?auth=google-token-error", request.url));
  }

  const tokenData = await tokenResponse.json() as { id_token?: string };
  const claims = tokenData.id_token ? decodeJwtPayload(tokenData.id_token) : null;
  const email = String(claims?.email ?? "doctor@example.com");
  const userId = String(claims?.sub ?? email);

  await setSessionCookie({
    userId: `google:${userId}`,
    email,
    name: "Doctor",
  });
  await clearLoginCookies();

  return Response.redirect(new URL("/", request.url));
}
