alter table public.internships
  add column if not exists end_date date,
  add column if not exists instructions text;

create table if not exists public.internship_final_submissions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique
    references public.internship_enrollments(id) on delete cascade,
  file_path text,
  link_url text,
  notes text,
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'needs_revision')),
  score integer check (score between 0 and 100),
  feedback text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  is_late boolean not null default false,
  version integer not null default 1,
  submitted_at timestamptz not null default now()
);

-- RLS on with no policies: only the server (service role) can touch this table.
alter table public.internship_final_submissions enable row level security;

create or replace function public.internship_final_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_end date;
begin
  -- Reviews (status/score/feedback changes) are always allowed.
  if tg_op = 'UPDATE'
     and new.file_path is not distinct from old.file_path
     and new.link_url is not distinct from old.link_url then
    return new;
  end if;

  select i.end_date into v_end
  from public.internship_enrollments e
  join public.internships i on i.id = e.internship_id
  where e.id = new.enrollment_id;

  if v_end is null then
    raise exception 'The internship end date has not been set.';
  end if;

  if now() >= ((v_end + 1)::timestamp at time zone 'Asia/Karachi') then
    raise exception 'The internship end date has passed.';
  end if;

  return new;
end;
$$;

drop trigger if exists internship_final_guard on public.internship_final_submissions;
create trigger internship_final_guard
  before insert or update on public.internship_final_submissions
  for each row execute function public.internship_final_guard();

-- Payment + certificate routes already call this. It now means:
-- "the student's combined submission is approved".
create or replace function public.internship_all_tasks_approved(p_enrollment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.internship_final_submissions
    where enrollment_id = p_enrollment and status = 'approved'
  );
$$;

notify pgrst, 'reload schema';