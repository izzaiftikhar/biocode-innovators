-- 005: enrolment backfill + certificate rules. Safe to re-run.

-- Students who already have module progress count as enrolled.
insert into public.enrolments (user_id, course_id)
select distinct mp.user_id, m.course_id
  from public.module_progress mp
  join public.modules m on m.id = mp.module_id
on conflict do nothing;

-- A student can hold only ONE valid certificate per course (revoke first to reissue).
create unique index if not exists certificates_one_valid_per_course
  on public.certificates (user_id, course_id) where status = 'valid';

-- Certificate templates are admin-only (the server uses the service key).
alter table public.certificate_templates enable row level security;
drop policy if exists "admin manage certificate templates" on public.certificate_templates;
create policy "admin manage certificate templates" on public.certificate_templates for all
  using (public.is_admin()) with check (public.is_admin());
