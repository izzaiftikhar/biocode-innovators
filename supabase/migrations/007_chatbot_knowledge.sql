-- 007: facts the website chatbot may use, managed from /admin/chatbot-knowledge. Safe to re-run.

create table if not exists public.chatbot_knowledge (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null check (char_length(topic) between 3 and 150),
  answer      text not null check (char_length(answer) between 3 and 2000),
  link_href   text check (link_href is null or link_href ~ '^(/|https://)'),
  link_label  text check (link_label is null or char_length(link_label) <= 60),
  is_published boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.chatbot_knowledge enable row level security;

-- Only admins touch this table directly. The chatbot reads it on the server with the service key.
drop policy if exists "admin manage chatbot knowledge" on public.chatbot_knowledge;
create policy "admin manage chatbot knowledge" on public.chatbot_knowledge for all
  using (public.is_admin()) with check (public.is_admin());
