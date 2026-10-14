export type GmailConnection = {
  version: string;
  sender_email: string | null;
  status: "connected" | "needs_reconnection" | "disconnected";
  connected_by_email: string | null;
  connected_at: string | null;
  last_successful_send_at: string | null;
  last_test_at: string | null;
  last_test_recipient: string | null;
  last_test_status: "pending" | "sent" | "failed" | "unknown" | null;
  last_test_message_id: string | null;
  last_safe_error: string | null;
};

export type GmailEvent = {
  id: string;
  action: "connected" | "replaced" | "disconnected" | "test";
  previous_sender_email: string | null;
  sender_email: string | null;
  performed_by_email: string;
  recipient_email: string | null;
  result: "pending" | "sent" | "failed" | "unknown" | null;
  message_id: string | null;
  safe_error: string | null;
  created_at: string;
};

export type GmailActionResult = { ok: boolean; message: string; messageId?: string };
