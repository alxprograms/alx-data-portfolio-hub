create or replace function public.create_project_commitment_with_projects(
  p_project_slug text,
  p_learner_name text,
  p_email text,
  p_consented boolean
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_project_slugs text[];
begin
  if not p_consented then
    raise exception 'Consent is required';
  end if;

  if char_length(trim(p_learner_name)) not between 2 and 120 then
    raise exception 'Enter a valid name';
  end if;

  if char_length(trim(p_email)) not between 5 and 320
    or position('@' in trim(p_email)) <= 1 then
    raise exception 'Enter a valid email address';
  end if;

  select id into v_project_id
  from public.projects
  where slug = p_project_slug and status = 'published';

  if v_project_id is null then
    raise exception 'Published project not found';
  end if;

  insert into public.project_builders (
    project_id,
    learner_name,
    email,
    consented_at
  ) values (
    v_project_id,
    trim(p_learner_name),
    lower(trim(p_email)),
    now()
  )
  on conflict (project_id, email_normalized)
  do update set
    learner_name = excluded.learner_name,
    email = excluded.email,
    consented_at = excluded.consented_at
  returning project_id into v_project_id;

  select coalesce(array_agg(project.slug order by (project.slug = p_project_slug) desc, builder.created_at desc), array[]::text[])
  into v_project_slugs
  from public.project_builders as builder
  join public.projects as project on project.id = builder.project_id
  where builder.email_normalized = lower(trim(p_email))
    and project.status = 'published';

  return v_project_slugs;
end;
$$;

revoke all on function public.create_project_commitment_with_projects(text, text, text, boolean) from public;
grant execute on function public.create_project_commitment_with_projects(text, text, text, boolean)
  to anon, authenticated;
