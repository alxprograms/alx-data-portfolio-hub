# Written showcase reviews

Staff can save a review draft, email it to the learner and inspect review history
on `/staff/showcase/[slug]`. Approval and decline remain separate: approval makes
the project visible in the public showcase; a written review emails feedback only.
Neither publication decision automatically sends an email.

## Setup

Apply `20261014150000_showcase_written_reviews.sql` with the existing linked-project
migration workflow (`npx supabase db push`). It depends on the Gmail connection
migration. No additional environment variables or OAuth scopes are required.
The shared sender must be connected in Email settings before sending reviews.

## Workflow and storage

- `showcase_review_drafts` stores one draft per submission and staff author. Drafts
  use random versions to protect against stale tabs. Send review saves the current
  text before preparing the email. Save draft is optional for finishing later and
  does not send. Each staff member sees their own draft.
- `showcase_reviews` stores the exact review body, author, recipient, learner name,
  submission title and send state. All staff can inspect this history. Text and
  recipient are frozen before contacting Gmail; the draft is consumed at that point.
- `showcase_review_sends` stores each send attempt, including sender mailbox,
  initiating staff member, connection version, timestamps, safe errors and Gmail ID.
  Retry uses the same immutable review and recipient through the current sender.
- All three tables have RLS enabled and no access for browser roles. Server actions
  verify staff through Supabase Auth before using the server-only secret client.
  Public showcase queries never include reviews.
- Only confirmed failed sends may be retried. Concurrent attempts, already-sent
  reviews and unknown outcomes cannot be retried through the retry action. A lost
  transport response or Gmail server error is uncertain and is not automatically
  retried. Staff should confirm receipt before composing the same review again.
- Gmail accepting a message is recorded as sent; inbox delivery is not independently
  confirmed. A server interruption can leave an awaiting-confirmation record. Staff
  should check before starting another send.
- Reviews are plain text. The email includes a greeting, submission title, the exact
  review and team signature. It does not infer publication decisions or add claims
  that the staff member did not write.

## Checks

Run `npm run lint`, `npx tsc --noEmit`, `npm run test:gmail` and
`npm run test:reviews`. Review tests mock Google/database adapters and never send
real mail. Verify on a controlled submission that drafts survive reload, both
publication states allow feedback, send results remain in history and changing
showcase status does not generate an email.
