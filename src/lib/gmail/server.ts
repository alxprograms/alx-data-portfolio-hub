import "server-only";

import { OAuth2Client } from "google-auth-library";
import { requireStaff } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptionKey } from "@/lib/gmail/security";
import type { GmailConnection, GmailEvent } from "@/types/gmail";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_COOKIE = "gmail-connect";
export const GMAIL_CALLBACK = "/api/google/gmail/callback";
export const EMAIL_SETTINGS = "/staff/settings/email";

export function gmailConfig() {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  const key = encryptionKey(process.env.GMAIL_TOKEN_ENCRYPTION_KEY);
  if (!clientId || !clientSecret || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("Gmail server configuration is incomplete.");
  }
  return { clientId, clientSecret, key };
}

export function oauthClient(redirectUri?: string) {
  const config = gmailConfig();
  return new OAuth2Client({ clientId: config.clientId, clientSecret: config.clientSecret, redirectUri });
}

export const connectionColumns = "version,sender_email,status,connected_by_email,connected_at,last_successful_send_at,last_test_at,last_test_recipient,last_test_status,last_test_message_id,last_safe_error";

export async function getEmailSettings() {
  await requireStaff();
  try { gmailConfig(); } catch {
    return { connection: null, events: [], problem: "Email sending has not been configured yet. Add the Gmail server settings to enable connection." };
  }
  const db = createAdminClient();
  const [connection, events] = await Promise.all([
    db.from("gmail_sender_connection").select(connectionColumns).eq("id", true).single(),
    db.from("gmail_sender_events").select("id,action,previous_sender_email,sender_email,performed_by_email,recipient_email,result,message_id,safe_error,created_at").order("created_at", { ascending: false }).limit(12),
  ]);
  if (connection.error || events.error) {
    return { connection: null, events: [], problem: "Email settings are unavailable. Check the database migration and server database configuration." };
  }
  return { connection: connection.data as GmailConnection, events: events.data as GmailEvent[], problem: null };
}

// Never surface Google's raw error: it can include request headers and tokens.
export function googleError(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { error?: string | { status?: string } } } })?.response;
  const reason = response?.data?.error;
  if (reason === "invalid_grant" || response?.status === 401) {
    return { message: "Google authorization has expired or been revoked. Reconnect the sender and try again.", reconnect: true };
  }
  if (response?.status === 403) return { message: "Google refused the request. Check that Gmail API is enabled and sending permission was granted, then reconnect if needed.", reconnect: false };
  if (response?.status === 429) return { message: "Google's sending limit was reached. Please try again later.", reconnect: false };
  return { message: "Google could not complete the request. Check the connection and try again.", reconnect: false };
}
