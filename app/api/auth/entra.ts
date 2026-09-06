import { cookies } from "next/headers";

const STATE_COOKIE = "clinote.entra.state";
const VERIFIER_COOKIE = "clinote.entra.verifier";
const SESSION_COOKIE = "clinote.entra.session";

export type EntraUser = {
  userId: string;
  email: string;
  name: string;
};

export function getBaseUrl(request: Request) {
  const configured = process.env.ENTRA_REDIRECT_URI;
  if (configured) return new URL(configured).origin;
  const url = new URL(request.url);
  return url.origin;
}

export function getRedirectUri(request: Request) {
  return process.env.ENTRA_REDIRECT_URI ?? `${getBaseUrl(request)}/api/auth/callback`;
}

export function getEntraConfig() {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  if (!tenantId || !clientId) return null;
  return { tenantId, clientId, clientSecret };
}

export function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function getGoogleRedirectUri(request: Request) {
  return process.env.GOOGLE_REDIRECT_URI ?? `${getBaseUrl(request)}/api/auth/google/callback`;
}

export function jsonSetupError() {
  return Response.json({
    ok: false,
    error: "Microsoft sign-in is not configured yet.",
    requiredEnv: ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "ENTRA_REDIRECT_URI"],
    optionalEnv: ["ENTRA_CLIENT_SECRET"],
  }, { status: 501 });
}

export function jsonProviderSetupError(provider: "Microsoft" | "Google", requiredEnv: string[]) {
  return Response.json({
    ok: false,
    error: `${provider} sign-in is not configured yet.`,
    requiredEnv,
  }, { status: 501 });
}

export function randomToken(bytes = 32) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return base64Url(values);
}

export function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

export function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");
  if (!payload) return null;
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
}

export async function setLoginCookies(state: string, verifier: string) {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
  cookieStore.set(STATE_COOKIE, state, options);
  cookieStore.set(VERIFIER_COOKIE, verifier, options);
}

export async function readLoginCookies() {
  const cookieStore = await cookies();
  return {
    state: cookieStore.get(STATE_COOKIE)?.value,
    verifier: cookieStore.get(VERIFIER_COOKIE)?.value,
  };
}

export async function clearLoginCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(VERIFIER_COOKIE);
}

export async function setSessionCookie(user: EntraUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, Buffer.from(JSON.stringify(user), "utf8").toString("base64url"), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function readSessionCookie() {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as EntraUser;
  } catch {
    return null;
  }
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
