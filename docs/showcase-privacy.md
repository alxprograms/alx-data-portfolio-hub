# Showcase contact privacy

The public showcase reads only display columns from approved submissions. Contact
emails are private even when a submission is approved. RLS restricts rows, while
column grants separately restrict which fields callers can select.

`20261014170000_restrict_showcase_contact_access.sql` revokes table-wide and previous
column SELECT grants for browser roles and grants only the public display fields,
embedding key and ordering fields. `learner_email` is excluded. Existing RLS and
staff update permissions remain unchanged. No records or email values are changed.

Staff list/detail pages read emails with `createAdminClient()` only after
`requireStaff()` verifies the staff session. Cover-image signing continues to use
the staff session and its storage policies. Project embedding also uses the staff
session; the secret client fetches only IDs and private emails, without joining
`projects`. The public gallery, individual
showcase pages, home-page images and project-related showcases keep their existing
queries and public cover URLs. This uses the existing `SUPABASE_SECRET_KEY`; no new
environment variables are required.

## Rollout

Deploy the application change before pushing the migration. Older staff code reads
emails using an authenticated browser-role client and will be blocked after the
migration. The updated application works with both the old and restricted schema.
Then apply the migration with `npx supabase db push` after verifying the linked
project. Live contact privacy takes effect when the migration is applied.

## Verification

Run `npm run test:showcase-privacy`, lint and TypeScript checks. The focused database
checks should verify anonymous/nonstaff SELECT of learner_email, SELECT *, filters
on learner_email and empty-result queries all fail; explicit public projections,
approved-row filtering, project joins, public covers and staff decisions still work.
Only staff-validated server code may use the secret client to read private emails.

When checking the live Data API, use HEAD with `limit=0` to verify permissions without
retrieving learner data. Public display-field queries should succeed and email
queries should fail for an unauthenticated publishable-key request.
