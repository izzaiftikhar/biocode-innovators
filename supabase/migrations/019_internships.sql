-- =====================================================================
-- 019_internships.sql  (corrected: extends your EXISTING internships table)
-- Safe to run more than once.
-- Adds: tasks, enrollments (offer letter), submissions + grading,
--       payments (certificate), certificates, payment settings.
-- Requires the existing public.is_admin() function (from migration 004).
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'is_admin') then
    raise exception 'public.is_admin() not found. Tell Claude how admin is checked in your RLS and adjust this file.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. EXISTING internships TABLE: add file columns only
--    (department = domain shown on the letter, duration = text shown on the letter)
--    No RLS changes here: your current internships policies stay as they are.
-- ---------------------------------------------------------------------

alter table public.internships
  add column if not exists tasks_pdf_path           text,
  add column if not exists letter_template_path     text,
  add column if not exists certificate_template_path text;

-- ---------------------------------------------------------------------
-- 2. NEW TABLES
-- ---------------------------------------------------------------------

create table if not exists public.internship_tasks (
  id            uuid primary key default gen_random_uuid(),
  internship_id uuid not null references public.internships(id) on delete cascade,
  position      int  not null,
  title         text not null,
  summary       text,
  deadline_day  int  not null check (deadline_day >= 1),   -- last day, counted from enrollment start
  created_at    timestamptz not null default now(),
  unique (internship_id, position)
);

create table if not exists public.internship_enrollments (
  id             uuid primary key default gen_random_uuid(),
  -- RESTRICT: an internship that already has students cannot be deleted by accident
  internship_id  uuid not null references public.internships(id) on delete restrict,
  user_id        uuid not null references auth.users(id) on delete cascade,
  full_name      text not null,                            -- locked after insert (only admin can update)
  email          text not null,
  reference_id   text unique not null
                 default ('BCI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  letter_path    text,                                     -- generated offer letter PNG
  letter_sent_at timestamptz,
  starts_at      timestamptz not null default now(),
  status         text not null default 'active' check (status in ('active','completed','withdrawn')),
  created_at     timestamptz not null default now(),
  unique (internship_id, user_id)
);

create table if not exists public.internship_submissions (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.internship_enrollments(id) on delete cascade,
  task_id       uuid not null references public.internship_tasks(id) on delete cascade,
  file_path     text,                                      -- pdf / zip in storage
  link_url      text,                                      -- GitHub / live link
  notes         text,
  status        text not null default 'submitted'
                check (status in ('submitted','approved','needs_revision')),
  score         int check (score between 0 and 100),
  feedback      text,
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  version       int  not null default 1,
  is_late       boolean not null default false,
  submitted_at  timestamptz not null default now(),
  unique (enrollment_id, task_id),
  check (file_path is not null or link_url is not null)
);

create table if not exists public.internship_payments (
  id               uuid primary key default gen_random_uuid(),
  enrollment_id    uuid not null unique references public.internship_enrollments(id) on delete cascade,
  certificate_name text not null,                          -- name confirmed by the student
  transaction_id   text not null unique,
  amount           numeric(10,2),
  screenshot_path  text not null,
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason    text,
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists public.internship_certificates (
  id                uuid primary key default gen_random_uuid(),
  enrollment_id     uuid not null unique references public.internship_enrollments(id) on delete cascade,
  certificate_name  text not null,
  verification_code text unique not null
                    default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
  file_path         text,
  issued_at         timestamptz not null default now()
);

-- single-row settings: payment details shown to students (admin editable)
create table if not exists public.internship_settings (
  id              int primary key default 1 check (id = 1),
  payment_method  text,
  account_title   text,
  account_number  text,
  certificate_fee numeric(10,2),
  instructions    text,
  updated_at      timestamptz not null default now()
);
insert into public.internship_settings (id) values (1) on conflict (id) do nothing;

create index if not exists idx_int_tasks_internship  on public.internship_tasks(internship_id);
create index if not exists idx_int_enroll_user       on public.internship_enrollments(user_id);
create index if not exists idx_int_sub_enrollment    on public.internship_submissions(enrollment_id);
create index if not exists idx_int_sub_status        on public.internship_submissions(status);
create index if not exists idx_int_pay_status        on public.internship_payments(status);

-- ---------------------------------------------------------------------
-- 3. HELPER FUNCTIONS
-- ---------------------------------------------------------------------

-- true only when every task of the internship is approved for this enrollment
create or replace function public.internship_all_tasks_approved(p_enrollment uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from internship_tasks t
            join internship_enrollments e on e.internship_id = t.internship_id
            where e.id = p_enrollment)
    and not exists (
      select 1 from internship_tasks t
      join internship_enrollments e on e.internship_id = t.internship_id
      where e.id = p_enrollment
        and not exists (select 1 from internship_submissions s
                        where s.enrollment_id = e.id and s.task_id = t.id and s.status = 'approved')
    );
$$;

-- public certificate verification (no login needed)
drop function if exists public.verify_internship_certificate(text);
create or replace function public.verify_internship_certificate(p_code text)
returns table (certificate_name text, domain text, duration text, issued_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.certificate_name, i.department, i.duration, c.issued_at
  from internship_certificates c
  join internship_enrollments e on e.id = c.enrollment_id
  join internships i on i.id = e.internship_id
  where c.verification_code = upper(trim(p_code));
$$;
grant execute on function public.verify_internship_certificate(text) to anon, authenticated;

-- students can only touch their own work fields; review fields are admin-only
create or replace function public.internship_submission_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service role / SQL editor (no auth.uid) and admins pass through
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'submitted';
    new.score := null; new.feedback := null;
    new.reviewed_by := null; new.reviewed_at := null;
    new.version := 1;
  else
    if old.status = 'approved' then
      raise exception 'Approved tasks cannot be changed';
    end if;
    new.enrollment_id := old.enrollment_id;
    new.task_id := old.task_id;
    new.score := old.score; new.feedback := old.feedback;
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
    new.status := 'submitted';
    new.version := old.version + 1;
  end if;

  new.submitted_at := now();
  select (now() > e.starts_at + make_interval(days => t.deadline_day))
    into new.is_late
  from internship_enrollments e, internship_tasks t
  where e.id = new.enrollment_id and t.id = new.task_id;

  return new;
end $$;

drop trigger if exists trg_internship_submission_guard on public.internship_submissions;
create trigger trg_internship_submission_guard
  before insert or update on public.internship_submissions
  for each row execute function public.internship_submission_guard();

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (new tables only)
-- ---------------------------------------------------------------------

alter table public.internship_tasks        enable row level security;
alter table public.internship_enrollments  enable row level security;
alter table public.internship_submissions  enable row level security;
alter table public.internship_payments     enable row level security;
alter table public.internship_certificates enable row level security;
alter table public.internship_settings     enable row level security;

-- makes this file re-runnable: remove only the policies on the NEW tables
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('internship_tasks','internship_enrollments','internship_submissions',
                        'internship_payments','internship_certificates','internship_settings')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- admin: full access
create policy int_admin_all on public.internship_tasks        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy int_admin_all on public.internship_enrollments  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy int_admin_all on public.internship_submissions  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy int_admin_all on public.internship_payments     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy int_admin_all on public.internship_certificates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy int_admin_all on public.internship_settings     for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- tasks and payment details: any logged-in student can read
create policy tasks_read on public.internship_tasks
  for select to authenticated using (true);
create policy settings_read on public.internship_settings
  for select to authenticated using (true);

-- enrollments: own rows; apply only to published + open internships; students cannot edit (name is locked)
create policy enroll_select_own on public.internship_enrollments
  for select to authenticated using (user_id = auth.uid());
create policy enroll_insert_own on public.internship_enrollments
  for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from internships i
                          where i.id = internship_id and i.published and coalesce(i.is_open, false)));

-- submissions: own enrollment only
create policy sub_select_own on public.internship_submissions
  for select to authenticated
  using (exists (select 1 from internship_enrollments e where e.id = enrollment_id and e.user_id = auth.uid()));
create policy sub_insert_own on public.internship_submissions
  for insert to authenticated
  with check (exists (select 1 from internship_enrollments e
                      where e.id = enrollment_id and e.user_id = auth.uid() and e.status = 'active'));
create policy sub_update_own on public.internship_submissions
  for update to authenticated
  using (exists (select 1 from internship_enrollments e where e.id = enrollment_id and e.user_id = auth.uid()))
  with check (exists (select 1 from internship_enrollments e where e.id = enrollment_id and e.user_id = auth.uid()));

-- payments: only after ALL tasks are approved; student may re-submit after a rejection
create policy pay_select_own on public.internship_payments
  for select to authenticated
  using (exists (select 1 from internship_enrollments e where e.id = enrollment_id and e.user_id = auth.uid()));
create policy pay_insert_own on public.internship_payments
  for insert to authenticated
  with check (exists (select 1 from internship_enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
              and public.internship_all_tasks_approved(enrollment_id)
              and status = 'pending');
create policy pay_update_rejected on public.internship_payments
  for update to authenticated
  using (status = 'rejected'
         and exists (select 1 from internship_enrollments e where e.id = enrollment_id and e.user_id = auth.uid()))
  with check (status = 'pending');

-- certificates: student reads own
create policy cert_select_own on public.internship_certificates
  for select to authenticated
  using (exists (select 1 from internship_enrollments e where e.id = enrollment_id and e.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- 5. STORAGE  (new PRIVATE bucket; your public internship-images bucket is untouched)
--    Student files live under <user_id>/submissions|payments/...
--    Admin files live under tasks/<internship_id>/... and templates/<internship_id>/...
--    Admin uploads and previews use signed URLs.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('internship-files', 'internship-files', false)
on conflict (id) do nothing;

drop policy if exists internship_files_own_read   on storage.objects;
drop policy if exists internship_files_own_insert on storage.objects;
drop policy if exists internship_files_admin_all  on storage.objects;

create policy internship_files_own_read on storage.objects
  for select to authenticated
  using (bucket_id = 'internship-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy internship_files_own_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'internship-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy internship_files_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'internship-files' and public.is_admin())
  with check (bucket_id = 'internship-files' and public.is_admin());