"use server";

import { randomBytes } from "node:crypto";
import { CodeChallengeMethod } from "google-auth-library";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, validEmail, testMessage } from "@/lib/gmail/security";
import { EMAIL_SETTINGS, GMAIL_CALLBACK, GMAIL_COOKIE, GMAIL_SCOPE, gmailConfig, googleError, oauthClient } from "@/lib/gmail/server";
import type { GmailActionResult } from "@/types/gmail";

export async function connectGmailAction(form: FormData) {
  const { user } = await requireStaff();
  let url: string;
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("gmail_sender_connection").select("version,sender_email").eq("id", true).single();
    if (error || !data || data.version !== form.get("version")) throw new Error("Connection changed.");
    const origin = (await headers()).get("origin");
    if (!origin) throw new Error("Missing request origin.");
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) throw new Error("Invalid origin.");
    const redirectUri = `${parsed.origin}${GMAIL_CALLBACK}`;
    const client = oauthClient(redirectUri);
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const expectedSender = form.get("intent") === "replace" ? null : data.sender_email;
    (await cookies()).set(GMAIL_COOKIE, JSON.stringify({ state, nonce, verifier: codeVerifier, userId: user.id, version: data.version, expectedSender, redirectUri, expires: Date.now() + 600_000 }), {
      httpOnly: true, secure: parsed.protocol === "https:", sameSite: "lax", path: GMAIL_CALLBACK, maxAge: 600,
    });
    url = client.generateAuthUrl({
      access_type: "offline", prompt: "consent select_account", scope: ["openid", "email", GMAIL_SCOPE],
      state, nonce, code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256,
    });
  } catch {
    redirect(`${EMAIL_SETTINGS}?result=connect_failed`);
  }
  redirect(url);
}

export async function disconnectGmailAction(version: string): Promise<GmailActionResult> {
  const { user } = await requireStaff();
  try {
    const { error } = await createAdminClient().rpc("gmail_change_sender", {
      p_version: version, p_email: null, p_token: null, p_actor: user.id, p_actor_email: user.email,
    });
    if (error) return { ok: false, message: "The connection could not be removed. Refresh the page and try again." };
    revalidatePath(EMAIL_SETTINGS);
    return { ok: true, message: "Sender disconnected. The saved credential has been removed." };
  } catch {
    return { ok: false, message: "Email settings are unavailable. Please try again later." };
  }
}

export async function sendGmailTestAction(input: { mode: string; recipient?: string; version: string }): Promise<GmailActionResult> {
  const { user } = await requireStaff();
  const recipient = input.mode === "me" ? user.email : input.mode === "other" ? input.recipient?.trim() : null;
  if (!validEmail(recipient)) return { ok: false, message: "Enter a valid recipient email address." };

  let db: ReturnType<typeof createAdminClient>;
  let row: { version: string; sender_email: string; encrypted_refresh_token: string; status: string };
  let event: string;
  let key: Buffer;
  try {
    key = gmailConfig().key;
    db = createAdminClient();
    const { data, error } = await db.from("gmail_sender_connection").select("version,sender_email,encrypted_refresh_token,status").eq("id", true).single();
    if (error || !data || data.status !== "connected" || data.version !== input.version) {
      return { ok: false, message: "The sender connection changed or needs attention. Refresh the page before sending." };
    }
    row = data;
    const reservation = await db.rpc("gmail_begin_test", { p_version: row.version, p_recipient: recipient, p_actor: user.id, p_actor_email: user.email });
    if (reservation.error) return { ok: false, message: reservation.error.message.includes("GMAIL_TEST_COOLDOWN") ? "Please wait 30 seconds between test emails." : "The sender connection changed. Refresh the page and try again." };
    event = reservation.data;
  } catch {
    return { ok: false, message: "Email sending is not configured. Check the server settings and migration." };
  }

  let sending = false;
  let result: "sent" | "failed" | "unknown" = "failed";
  let messageId: string | null = null;
  let message = "";
  let reconnect = false;
  try {
    const client = oauthClient();
    client.setCredentials({ refresh_token: decryptToken(row.encrypted_refresh_token, key) });
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("Missing access token.");
    // Check again after refreshing: don't start sending if another staff member changed the mailbox.
    const { data: current } = await db.from("gmail_sender_connection").select("version,status").eq("id", true).single();
    if (current?.version !== row.version || current.status !== "connected") throw new Error("Connection changed.");
    sending = true;
    // No automatic retries: a network timeout may follow a successful send.
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: testMessage(row.sender_email, recipient) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      sending = false;
      throw { response: { status: response.status } };
    }
    const data = await response.json();
    if (typeof data.id !== "string") throw new Error("Missing message ID.");
    result = "sent";
    messageId = data.id;
    message = `Test email sent to ${recipient}. Check the inbox or spam folder to confirm receipt.`;
  } catch (error) {
    const safe = googleError(error);
    reconnect = safe.reconnect;
    result = sending ? "unknown" : "failed";
    message = sending ? "Gmail may have accepted the test, but confirmation was lost. Check the recipient's inbox before trying again." : safe.message;
  }
  const { error: saveError } = await db.rpc("gmail_finish_test", {
    p_version: row.version, p_event: event, p_result: result, p_message_id: messageId,
    p_error: result === "sent" ? null : message, p_reconnect: reconnect,
  });
  revalidatePath(EMAIL_SETTINGS);
  if (saveError) message += " The test history could not be updated. Refresh before sending again.";
  return { ok: result === "sent", message, messageId: messageId ?? undefined };
}
