import "server-only";

import { requireStaff } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { gmailConfig } from "@/lib/gmail/server";
import type { ReviewPanelData, ReviewDraft, WrittenReview } from "@/types/review";

export async function getSubmissionReviews(submissionId: string): Promise<ReviewPanelData> {
  const { user } = await requireStaff();
  try {
    const db = createAdminClient();
    const [draft, reviews, sender] = await Promise.all([
      db.from("showcase_review_drafts").select("body,version,updated_at").eq("submission_id", submissionId).eq("author_id", user.id).maybeSingle(),
      db.from("showcase_reviews").select("id,body,author_email,recipient_email,status,created_at,showcase_review_sends(id,sender_email,sent_by_email,status,message_id,safe_error,created_at,completed_at)").eq("submission_id", submissionId).order("created_at", { ascending: false }),
      db.from("gmail_sender_connection").select("sender_email,status").eq("id", true).single(),
    ]);
    if (draft.error || reviews.error) throw new Error("Review data unavailable.");
    let configured = true;
    try { gmailConfig(); } catch { configured = false; }
    return {
      draft: draft.data as ReviewDraft | null, reviews: (reviews.data ?? []) as WrittenReview[],
      senderEmail: sender.data?.sender_email ?? null,
      canSend: configured && !sender.error && sender.data?.status === "connected", problem: null,
    };
  } catch {
    return { draft: null, reviews: [], senderEmail: null, canSend: false, problem: "Reviews are unavailable. Check that the written-review migration has been applied and server database access is configured." };
  }
}
