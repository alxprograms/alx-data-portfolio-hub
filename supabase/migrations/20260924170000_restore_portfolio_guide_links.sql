update public.projects
set content_markdown = replace(
  content_markdown,
  'Full GitHub Guide →',
  '[Full GitHub Guide →](/guides/github)'
)
where content_markdown like '%Full GitHub Guide →%'
  and content_markdown not like '%[Full GitHub Guide →](/guides/github)%';

update public.projects
set content_markdown = replace(
  content_markdown,
  'Full LinkedIn Guide →',
  '[Full LinkedIn Guide →](/guides/linkedin)'
)
where content_markdown like '%Full LinkedIn Guide →%'
  and content_markdown not like '%[Full LinkedIn Guide →](/guides/linkedin)%';
