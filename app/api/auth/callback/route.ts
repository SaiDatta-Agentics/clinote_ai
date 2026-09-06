import {
  clearLoginCookies,
  decodeJwtPayload,
  getEntraConfig,
  getRedirectUri,
  readLoginCookies,
  setSessionCookie,
} from "../entra";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const config = getEntraConfig();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const { state, verifier } = await readLoginCookies();

  if (!config) return Response.redirect(new URL("/?auth=missing-config", request.url));
  if (error) return Response.redirect(new URL(`/?auth=error&message=${encodeURIComponent(error)}`, request.url));
  if (!code || !returnedState || !state || returnedState !== state || !verifier) {
    return Response.redirect(new URL("/?auth=invalid-state", request.url));
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(request),
    code_verifier: verifier,
  });
  if (config.clientSecret) body.set("client_secret", config.clientSecret);

  const tokenResponse = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResponse.ok) {
    await clearLoginCookies();
    return Response.redirect(new URL("/?auth=token-error", request.url));
  }

  const tokenData = await tokenResponse.json() as { id_token?: string };
  const claims = tokenData.id_token ? decodeJwtPayload(tokenData.id_token) : null;
  const email = String(claims?.preferred_username ?? claims?.email ?? "doctor@example.com");
  const userId = String(claims?.oid ?? claims?.sub ?? email);

  await setSessionCookie({
    userId,
    email,
    name: "Doctor",
  });
  await clearLoginCookies();

  return Response.redirect(new URL("/", request.url));
}
