"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retryReviewAction, saveReviewDraftAction, sendReviewAction } from "@/app/actions/reviews";
import type { ReviewActionResult, ReviewPanelData, ReviewSend } from "@/types/review";

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: ReviewSend["status"]) {
  return { pending: "Awaiting confirmation", sent: "Sent", failed: "Failed", unknown: "Unconfirmed" }[status];
}

export function WrittenReviewPanel({ submissionId, learnerEmail, data }: {
  submissionId: string; learnerEmail: string; data: ReviewPanelData;
}) {
  const router = useRouter();
  const [body, setBody] = useState(data.draft?.body ?? "");
  const [savedBody, setSavedBody] = useState(data.draft?.body ?? "");
  const [version, setVersion] = useState<string | null>(data.draft?.version ?? null);
  const [savedAt, setSavedAt] = useState(data.draft?.updated_at ?? null);
  const [result, setResult] = useState<ReviewActionResult | null>(null);
  const [operation, setOperation] = useState<"save" | "send" | string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = body.trim() !== savedBody;
  const ready = Boolean(body.trim() && data.canSend);

  function run(kind: "save" | "send" | "retry", reviewId?: string) {
    setResult(null);
    setOperation(kind === "retry" ? reviewId ?? "retry" : kind);
    startTransition(async () => {
      try {
        const response = kind === "save"
          ? await saveReviewDraftAction({ submissionId, body, version })
          : kind === "send" ? await sendReviewAction({ submissionId, body, version })
            : await retryReviewAction(reviewId!);
        setResult(response);
        if (kind !== "retry" && response.version) {
          setVersion(response.version); setSavedBody(body.trim()); setBody(body.trim());
          setSavedAt(response.updatedAt ?? new Date().toISOString());
        }
        if (kind === "send" && response.consumed) {
          setVersion(null); setBody(""); setSavedBody(""); setSavedAt(null);
        }
      } catch {
        setResult({ ok: false, message: "The request was interrupted. Refresh and check review history before trying again. Your text is still here." });
      }
      setOperation(null);
      router.refresh();
    });
  }

  return (
    <section className="written-review" aria-labelledby="written-review-heading">
      <p className="staff-kicker">Learner feedback</p>
      <h2 id="written-review-heading">Review for the learner</h2>
      <p className="written-review__intro">Ask for improvements, highlight good work, or let the learner know you&apos;re showcasing their project. Sending a review does not approve or decline the showcase.</p>
      {data.problem ? <p className="email-notice email-notice--error" role="alert">{data.problem}</p> : <>
        {result && <p className={`email-notice ${result.ok ? "email-notice--success" : "email-notice--error"}`} role={result.ok ? "status" : "alert"}>{result.message}</p>}
        <div className="written-review__addresses">
          <div><span>To</span><strong>{learnerEmail}</strong></div>
          <div><span>From</span>{data.senderEmail ? <strong>{data.senderEmail}</strong> : <Link href="/staff/settings/email">Connect sender mailbox →</Link>}</div>
        </div>
        {!data.canSend && <p className="written-review__connection">You can save a draft. To email it, <Link href="/staff/settings/email">connect or reconnect the sender mailbox</Link>.</p>}
        <form onSubmit={(event) => { event.preventDefault(); run("save"); }}>
          <label htmlFor="learner-review">Your review</label>
          <textarea id="learner-review" value={body} onChange={(event) => setBody(event.target.value)} maxLength={10000} rows={8} required disabled={pending} aria-describedby="review-draft-hint" placeholder="Share what worked well and any improvements you would suggest…" />
          <div className="written-review__draft-state" id="review-draft-hint">
            <span>{dirty ? "Unsaved changes. Send now or save a draft for later." : savedAt ? `Draft saved ${date(savedAt)}. Not sent yet.` : "Send your review, or save a draft to finish later."}</span>
            <span>{body.length.toLocaleString()} / 10,000</span>
          </div>
          <div className="email-actions">
            <button type="submit" className="email-button" disabled={pending || !body.trim() || (!dirty && Boolean(version))}>{pending && operation === "save" ? "Saving…" : "Save draft"}</button>
            <button type="button" className="staff-primary-action" disabled={pending || !ready} onClick={() => run("send")}>{pending && operation === "send" ? "Sending…" : "Send review"}<span aria-hidden="true">→</span></button>
          </div>
        </form>
      </>}

      <div className="written-review__history">
        <h3>Review history</h3>
        {!data.problem && data.reviews.length === 0 && <p className="email-description">Sent reviews and email results will appear here. Drafts stay private to their author.</p>}
        {data.reviews.map((review, index) => {
          const attempts = [...review.showcase_review_sends].sort((a, b) => b.created_at.localeCompare(a.created_at));
          const latest = attempts[0];
          return <article className="review-history-item" key={review.id}>
            <div className="review-history-item__heading"><strong>{review.author_email}</strong><span className={`review-send-status review-send-status--${review.status}`}>{statusLabel(review.status)}</span></div>
            <p className="review-history-item__meta"><time dateTime={review.created_at}>{date(review.created_at)}</time> · To {review.recipient_email}</p>
            <details open={index === 0}><summary>Read review</summary><p className="review-history-item__body">{review.body}</p></details>
            {latest && <div className="review-history-item__delivery">
              <p>From {latest.sender_email} · Sent by {latest.sent_by_email}</p>
              {latest.completed_at && <p>{statusLabel(latest.status)} {date(latest.completed_at)}</p>}
              {latest.message_id && <small>Gmail message ID: {latest.message_id}</small>}
              {latest.safe_error && <p className="review-history-item__error">{latest.safe_error}</p>}
              {review.status === "pending" && <p>Sending confirmation is pending. If this persists, check whether the learner received it before sending another review.</p>}
            </div>}
            {review.status === "failed" && <button type="button" className="email-button" disabled={pending || !data.canSend} onClick={() => run("retry", review.id)}>{pending && operation === review.id ? "Retrying…" : "Retry sending"}</button>}
            {attempts.length > 1 && <details className="review-history-item__attempts"><summary>Send attempts ({attempts.length})</summary><ol>{attempts.map((attempt) => <li key={attempt.id}>
              <strong>{statusLabel(attempt.status)}</strong> · {date(attempt.created_at)}
              <p>{attempt.sender_email} · {attempt.sent_by_email}</p>{attempt.safe_error && <p>{attempt.safe_error}</p>}
            </li>)}</ol></details>}
          </article>;
        })}
      </div>
    </section>
  );
}
