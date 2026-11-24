-- 006: final course quiz (one attempt per student, 90% default pass mark). Safe to re-run.

create table if not exists public.course_quizzes (
  course_id    uuid primary key references public.courses(id) on delete cascade,
  pass_percent integer not null default 90 check (pass_percent between 1 and 100),
  published    boolean not null default false,
  updated_at   timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses(id) on delete cascade,
  position      integer not null default 0,
  prompt        text not null,
  options       jsonb not null,
  correct_index integer not null check (correct_index >= 0),
  created_at    timestamptz not null default now()
);
create index if not exists quiz_questions_course_idx on public.quiz_questions (course_id, position);

-- unique (user_id, course_id) is what enforces "one attempt only".
create table if not exists public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  uuid not null references public.courses(id) on delete cascade,
  score      integer not null,
  total      integer not null,
  percent    integer not null,
  passed     boolean not null,
  answers    jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

alter table public.course_quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts  enable row level security;

drop policy if exists "admin manage quizzes"   on public.course_quizzes;
drop policy if exists "admin manage questions" on public.quiz_questions;
drop policy if exists "own quiz attempts"      on public.quiz_attempts;
drop policy if exists "admin read attempts"    on public.quiz_attempts;

-- Students get NO direct access to questions (that would expose the correct answers).
-- The server hands out questions without answers and does all grading.
create policy "admin manage quizzes"   on public.course_quizzes for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage questions" on public.quiz_questions for all using (public.is_admin()) with check (public.is_admin());
create policy "own quiz attempts"      on public.quiz_attempts  for select using (auth.uid() = user_id);
create policy "admin read attempts"    on public.quiz_attempts  for select using (public.is_admin());
