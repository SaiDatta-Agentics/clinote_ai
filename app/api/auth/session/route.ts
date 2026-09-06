import { readSessionCookie } from "../entra";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await readSessionCookie();
  return Response.json({
    authenticated: Boolean(user),
    user,
  });
}
