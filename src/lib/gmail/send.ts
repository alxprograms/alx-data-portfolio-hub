import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/gmail/security";
import { gmailConfig, googleError, oauthClient } from "@/lib/gmail/server";

export type GmailSendResult = {
  status: "sent" | "failed" | "unknown"; messageId: string | null;
  error: string | null; reconnect: boolean;
};

// Internal server helper. The staff action validates authorization and reserves
// the immutable message in the database before calling this function.
export async function sendGmailMessage(version: string, raw: string): Promise<GmailSendResult> {
  let sending = false;
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("gmail_sender_connection").select("version,status,encrypted_refresh_token").eq("id", true).single();
    if (error || !data || data.version !== version || data.status !== "connected") {
      return { status: "failed", messageId: null, error: "The sender connection changed or needs reconnection. Check Email settings before retrying.", reconnect: false };
    }
    const client = oauthClient();
    client.setCredentials({ refresh_token: decryptToken(data.encrypted_refresh_token, gmailConfig().key) });
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("Missing access token.");
    const { data: current } = await db.from("gmail_sender_connection").select("version,status").eq("id", true).single();
    if (current?.version !== version || current.status !== "connected") {
      return { status: "failed", messageId: null, error: "The sender changed while preparing the email. Please try again.", reconnect: false };
    }
    sending = true;
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }), signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      sending = response.status >= 500;
      throw { response: { status: response.status } };
    }
    const message = await response.json();
    if (typeof message.id !== "string") throw new Error("Missing Gmail message ID.");
    return { status: "sent", messageId: message.id, error: null, reconnect: false };
  } catch (error) {
    const safe = googleError(error);
    return {
      status: sending ? "unknown" : "failed", messageId: null, reconnect: safe.reconnect,
      error: sending ? "Gmail may have accepted this email, but confirmation was lost. Check before sending the same review again." : safe.message,
    };
  }
}
