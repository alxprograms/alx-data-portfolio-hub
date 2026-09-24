update public.projects
set content_markdown = replace(
  replace(
    replace(
      replace(content_markdown, ' │ ├──', E'\n│   ├──'),
      ' │ └──', E'\n│   └──'
    ),
    ' ├──', E'\n├──'
  ),
  ' └──', E'\n└──'
)
where content_markdown like '%~~~text%'
  and content_markdown like '% ├──%';
