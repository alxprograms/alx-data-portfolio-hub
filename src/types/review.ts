export type ReviewDraft = { body: string; version: string; updated_at: string };
export type ReviewSend = {
  id: string; sender_email: string; sent_by_email: string;
  status: "pending" | "sent" | "failed" | "unknown";
  message_id: string | null; safe_error: string | null;
  created_at: string; completed_at: string | null;
};
export type WrittenReview = {
  id: string; body: string; author_email: string; recipient_email: string;
  status: ReviewSend["status"]; created_at: string; showcase_review_sends: ReviewSend[];
};
export type ReviewPanelData = {
  draft: ReviewDraft | null; reviews: WrittenReview[];
  senderEmail: string | null; canSend: boolean; problem: string | null;
};
export type ReviewActionResult = {
  ok: boolean; message: string; version?: string; updatedAt?: string; consumed?: boolean;
};
