"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { gmailConfig, EMAIL_SETTINGS } from "@/lib/gmail/server";
import { reviewMessage, validEmail } from "@/lib/gmail/security";
import { sendGmailMessage, type GmailSendResult } from "@/lib/gmail/send";
import type { ReviewActionResult } from "@/types/review";

function refreshReviews() {
  revalidatePath("/staff/showcase", "layout");
  revalidatePath(EMAIL_SETTINGS);
}

function safeReviewError(message: string) {
  if (message.includes("REVIEW_DRAFT_CHANGED")) return "This draft changed or was already sent. Refresh the page before continuing.";
  if (message.includes("REVIEW_SENDER_UNAVAILABLE")) return "Connect or reconnect the sender in Email settings. Your draft is still saved.";
  if (message.includes("REVIEW_CANNOT_RETRY")) return "This review cannot be retried. Refresh the page to see its current status.";
  return "The review could not be saved or prepared. Refresh the page and try again.";
}

export async function saveReviewDraftAction(input: { submissionId: string; body: string; version: string | null }): Promise<ReviewActionResult> {
  const { user } = await requireStaff();
  if (typeof input.body !== "string" || input.body.trim().length < 1 || input.body.length > 10000) {
    return { ok: false, message: "Write a review of up to 10,000 characters." };
  }
  try {
    const { data, error } = await createAdminClient().rpc("showcase_save_review_draft", {
      p_submission: input.submissionId, p_body: input.body.trim(), p_version: input.version,
      p_actor: user.id, p_actor_email: user.email,
    });
    if (error) return { ok: false, message: safeReviewError(error.message) };
    refreshReviews();
    return { ok: true, message: "Review draft saved. It has not been emailed to the learner.", version: data, updatedAt: new Date().toISOString() };
  } catch { return { ok: false, message: "The review could not be saved. Please try again." }; }
}

type ReservedReview = {
  review_id: string; attempt_id: string; connection_version: string;
  sender_email: string; recipient_email: string; learner_name: string; title: string; body: string;
};

async function deliverReservedReview(record: ReservedReview): Promise<ReviewActionResult> {
  let delivery: GmailSendResult;
  try {
    delivery = await sendGmailMessage(record.connection_version, reviewMessage({
      sender: record.sender_email, recipient: record.recipient_email,
      learnerName: record.learner_name, title: record.title, body: record.body,
    }));
  } catch {
    delivery = { status: "failed", messageId: null, reconnect: false, error: "The review could not be prepared for email. Check the learner email before retrying." };
  }
  const db = createAdminClient();
  const { error } = await db.rpc("showcase_finish_review_send", {
    p_review: record.review_id, p_attempt: record.attempt_id, p_status: delivery.status,
    p_message_id: delivery.messageId, p_error: delivery.error, p_reconnect: delivery.reconnect,
  });
  refreshReviews();
  const message = delivery.status === "sent" ? `Review sent to ${record.recipient_email}.` : `The review is saved in history. ${delivery.error ?? "The email could not be sent."}`;
  return { ok: delivery.status === "sent", consumed: true, message: error ? `${message} History confirmation could not be saved. Refresh and check before sending again.` : message };
}

export async function sendReviewAction(input: { submissionId: string; version: string }): Promise<ReviewActionResult> {
  const { user } = await requireStaff();
  let record: ReservedReview;
  try {
    gmailConfig();
    const db = createAdminClient();
    const { data: submission, error: readError } = await db.from("showcase_submissions").select("learner_email").eq("id", input.submissionId).single();
    if (readError || !validEmail(submission?.learner_email)) return { ok: false, message: "The submission has no valid learner email. The review has not been sent." };
    const { data, error } = await db.rpc("showcase_begin_review_send", {
      p_submission: input.submissionId, p_version: input.version, p_actor: user.id, p_actor_email: user.email,
    });
    if (error) return { ok: false, message: safeReviewError(error.message) };
    record = data;
  } catch { return { ok: false, message: "Email sending is unavailable. Your draft is still saved. Check Email settings." }; }
  return deliverReservedReview(record);
}

export async function retryReviewAction(reviewId: string): Promise<ReviewActionResult> {
  const { user } = await requireStaff();
  let record: ReservedReview;
  try {
    gmailConfig();
    const { data, error } = await createAdminClient().rpc("showcase_retry_review_send", {
      p_review: reviewId, p_actor: user.id, p_actor_email: user.email,
    });
    if (error) return { ok: false, message: safeReviewError(error.message) };
    record = data;
  } catch { return { ok: false, message: "Email sending is unavailable. Check Email settings before retrying." }; }
  return deliverReservedReview(record);
}
