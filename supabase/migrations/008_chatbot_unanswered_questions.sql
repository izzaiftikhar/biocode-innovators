-- 008: Store chatbot questions that need BioCode support review.

create table if not exists public.chatbot_unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 1 and 500),
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  answer text check (answer is null or char_length(answer) <= 2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists chatbot_unanswered_questions_status_created_idx
  on public.chatbot_unanswered_questions (status, created_at desc);

alter table public.chatbot_unanswered_questions enable row level security;

drop policy if exists "admin manage chatbot unanswered questions"
  on public.chatbot_unanswered_questions;

create policy "admin manage chatbot unanswered questions"
  on public.chatbot_unanswered_questions
  for all
  using (public.is_admin())
  with check (public.is_admin());
