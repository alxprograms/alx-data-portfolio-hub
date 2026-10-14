-- Written feedback is private and independent of showcase publication status.
create table public.showcase_review_drafts (
  submission_id uuid not null references public.showcase_submissions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_email text not null,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  version uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  primary key (submission_id, author_id)
);

create table public.showcase_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.showcase_submissions(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_email text not null,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  submission_title text not null,
  learner_name text not null,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','unknown')),
  created_at timestamptz not null default now()
);

create table public.showcase_review_sends (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.showcase_reviews(id) on delete cascade,
  sender_email text not null,
  connection_version uuid not null,
  sent_by uuid references auth.users(id) on delete set null,
  sent_by_email text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','unknown')),
  message_id text,
  safe_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index showcase_reviews_submission_idx on public.showcase_reviews(submission_id, created_at desc);
create unique index showcase_review_one_pending_send on public.showcase_review_sends(review_id) where status = 'pending';

alter table public.showcase_review_drafts enable row level security;
alter table public.showcase_reviews enable row level security;
alter table public.showcase_review_sends enable row level security;
revoke all on public.showcase_review_drafts, public.showcase_reviews, public.showcase_review_sends from public, anon, authenticated;
grant all on public.showcase_review_drafts, public.showcase_reviews, public.showcase_review_sends to service_role;
grant select on public.showcase_submissions to service_role;

create function public.showcase_save_review_draft(p_submission uuid, p_body text, p_version uuid, p_actor uuid, p_actor_email text)
returns uuid language plpgsql set search_path = '' as $$
declare current_version uuid; new_version uuid := gen_random_uuid();
begin
  -- Serialize same-author drafts, including when the first draft doesn't exist yet.
  perform pg_advisory_xact_lock(hashtextextended(p_submission::text || p_actor::text, 0));
  if not exists (select 1 from public.showcase_submissions where id = p_submission) then raise exception 'REVIEW_NOT_FOUND'; end if;
  select version into current_version from public.showcase_review_drafts
    where submission_id = p_submission and author_id = p_actor for update;
  if current_version is distinct from p_version then raise exception 'REVIEW_DRAFT_CHANGED'; end if;
  insert into public.showcase_review_drafts(submission_id, author_id, author_email, body, version)
    values (p_submission, p_actor, p_actor_email, trim(p_body), new_version)
    on conflict (submission_id, author_id) do update set body = excluded.body,
      author_email = excluded.author_email, version = excluded.version, updated_at = now();
  return new_version;
end;
$$;

-- Freeze the exact saved review and recipient before making an external request.
create function public.showcase_begin_review_send(p_submission uuid, p_version uuid, p_actor uuid, p_actor_email text)
returns jsonb language plpgsql set search_path = '' as $$
declare draft public.showcase_review_drafts; submission public.showcase_submissions;
  sender public.gmail_sender_connection; review_id uuid; attempt_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_submission::text || p_actor::text, 0));
  select * into draft from public.showcase_review_drafts where submission_id = p_submission and author_id = p_actor for update;
  if not found or draft.version is distinct from p_version then raise exception 'REVIEW_DRAFT_CHANGED'; end if;
  select * into submission from public.showcase_submissions where id = p_submission;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  select * into sender from public.gmail_sender_connection where id = true for share;
  if not found or sender.status <> 'connected' then raise exception 'REVIEW_SENDER_UNAVAILABLE'; end if;
  insert into public.showcase_reviews(submission_id, author_id, author_email, body, submission_title, learner_name, recipient_email)
    values (p_submission, p_actor, p_actor_email, draft.body, submission.title, submission.learner_name, submission.learner_email)
    returning id into review_id;
  insert into public.showcase_review_sends(review_id, sender_email, connection_version, sent_by, sent_by_email)
    values (review_id, sender.sender_email, sender.version, p_actor, p_actor_email) returning id into attempt_id;
  delete from public.showcase_review_drafts where submission_id = p_submission and author_id = p_actor;
  return jsonb_build_object('review_id',review_id,'attempt_id',attempt_id,'connection_version',sender.version,
    'sender_email',sender.sender_email,'recipient_email',submission.learner_email,'learner_name',submission.learner_name,
    'title',submission.title,'body',draft.body);
end;
$$;

create function public.showcase_retry_review_send(p_review uuid, p_actor uuid, p_actor_email text)
returns jsonb language plpgsql set search_path = '' as $$
declare review public.showcase_reviews; sender public.gmail_sender_connection; attempt_id uuid;
begin
  select * into review from public.showcase_reviews where id = p_review for update;
  if not found or review.status <> 'failed' then raise exception 'REVIEW_CANNOT_RETRY'; end if;
  select * into sender from public.gmail_sender_connection where id = true for share;
  if not found or sender.status <> 'connected' then raise exception 'REVIEW_SENDER_UNAVAILABLE'; end if;
  update public.showcase_reviews set status = 'pending' where id = p_review;
  insert into public.showcase_review_sends(review_id, sender_email, connection_version, sent_by, sent_by_email)
    values (p_review,sender.sender_email,sender.version,p_actor,p_actor_email) returning id into attempt_id;
  return jsonb_build_object('review_id',p_review,'attempt_id',attempt_id,'connection_version',sender.version,
    'sender_email',sender.sender_email,'recipient_email',review.recipient_email,'learner_name',review.learner_name,
    'title',review.submission_title,'body',review.body);
end;
$$;

create function public.showcase_finish_review_send(p_review uuid, p_attempt uuid, p_status text, p_message_id text, p_error text, p_reconnect boolean)
returns void language plpgsql set search_path = '' as $$
declare connection_version uuid;
begin
  if p_status not in ('sent','failed','unknown') then raise exception 'Invalid send status'; end if;
  perform 1 from public.showcase_reviews where id = p_review for update;
  update public.showcase_review_sends set status = p_status, message_id = p_message_id,
    safe_error = p_error, completed_at = now()
    where id = p_attempt and review_id = p_review and status = 'pending'
    returning showcase_review_sends.connection_version into connection_version;
  if not found then return; end if;
  update public.showcase_reviews set status = p_status where id = p_review;
  update public.gmail_sender_connection set updated_at = now(),
    last_successful_send_at = case when p_status = 'sent' then now() else last_successful_send_at end,
    last_safe_error = case when p_status = 'sent' then null else p_error end,
    status = case when p_reconnect then 'needs_reconnection' else status end
    where id = true and version = connection_version;
end;
$$;

revoke all on function public.showcase_save_review_draft(uuid,text,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.showcase_begin_review_send(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.showcase_retry_review_send(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.showcase_finish_review_send(uuid,uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.showcase_save_review_draft(uuid,text,uuid,uuid,text) to service_role;
grant execute on function public.showcase_begin_review_send(uuid,uuid,uuid,text) to service_role;
grant execute on function public.showcase_retry_review_send(uuid,uuid,text) to service_role;
grant execute on function public.showcase_finish_review_send(uuid,uuid,text,text,text,boolean) to service_role;
