import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStaffUser } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken, equalSecret, validEmail } from "@/lib/gmail/security";
import { EMAIL_SETTINGS, GMAIL_CALLBACK, GMAIL_COOKIE, GMAIL_SCOPE, gmailConfig, oauthClient } from "@/lib/gmail/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const saved = cookieStore.get(GMAIL_COOKIE)?.value;
  cookieStore.set(GMAIL_COOKIE, "", { path: GMAIL_CALLBACK, maxAge: 0 });
  const finish = (result: string) => {
    const response = NextResponse.redirect(new URL(`${EMAIL_SETTINGS}?result=${result}`, request.url));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isStaffUser(user)) return finish("expired");
  try {
    const flow = JSON.parse(saved ?? "null");
    const state = request.nextUrl.searchParams.get("state");
    if (!flow || typeof flow.state !== "string" || typeof flow.verifier !== "string" ||
      typeof flow.nonce !== "string" || typeof flow.expires !== "number" || flow.expires < Date.now() ||
      flow.userId !== user.id || !state || !equalSecret(flow.state, state)) return finish("expired");
    if (request.nextUrl.searchParams.has("error")) return finish("cancelled");
    const code = request.nextUrl.searchParams.get("code");
    if (!code) return finish("connect_failed");
    const config = gmailConfig();
    const client = oauthClient(flow.redirectUri);
    const { tokens } = await client.getToken({ code, codeVerifier: flow.verifier });
    if (!tokens.id_token || !tokens.refresh_token || !tokens.scope?.split(" ").includes(GMAIL_SCOPE)) return finish("permission_missing");
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
    const identity = ticket.getPayload();
    if (!identity?.email_verified || !validEmail(identity.email) || !identity.email.toLowerCase().endsWith("@alxafrica.com") ||
      identity.nonce !== flow.nonce) return finish("wrong_account");
    if (flow.expectedSender && identity.email.toLowerCase() !== flow.expectedSender) return finish("wrong_sender");
    const { error } = await createAdminClient().rpc("gmail_change_sender", {
      p_version: flow.version, p_email: identity.email.toLowerCase(),
      p_token: encryptToken(tokens.refresh_token, config.key), p_actor: user.id, p_actor_email: user.email,
    });
    if (error) return finish(error.message.includes("GMAIL_CONNECTION_CHANGED") ? "changed" : "connect_failed");
    revalidatePath(EMAIL_SETTINGS);
    return finish("connected");
  } catch {
    return finish("connect_failed");
  }
}
