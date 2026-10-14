-- RLS filters rows, not columns. Approved showcase rows must not expose the
-- private follow-up email through the public Data API.
revoke select on public.showcase_submissions from public, anon, authenticated;
revoke select (
  id, slug, project_id, project_title, learner_name, learner_email, title,
  summary, tools, github_url, live_url, cover_image_path,
  public_cover_image_path, status, consented_at, submitted_at, decided_at, decided_by
) on public.showcase_submissions from public, anon, authenticated;

-- Keep the public catalogue's explicit projection, embedding keys and sorting
-- available. Existing row policies still restrict public reads to approved work.
grant select (
  id, slug, project_id, project_title, learner_name, title, summary, tools,
  github_url, live_url, cover_image_path, public_cover_image_path,
  status, submitted_at, decided_at
) on public.showcase_submissions to anon, authenticated;

-- Private contact fields are read by staff-validated server code only.
grant select on public.showcase_submissions to service_role;

comment on column public.showcase_submissions.learner_email is
  'Private follow-up email. Available only through staff-authorized server code; never grant SELECT to browser roles.';
