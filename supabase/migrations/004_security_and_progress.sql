-- 004: progress rules + Row Level Security. Safe to re-run.
-- Run in the Supabase SQL editor. Read the notes at the top of each block.

-- Admin check usable inside policies (security definer avoids recursion on user_roles).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 1. The app uses 'changes_requested'; the original schema only allowed 'needs_revision'.
alter table public.submissions drop constraint if exists submissions_review_status_check;
update public.submissions set review_status = 'changes_requested' where review_status = 'needs_revision';
alter table public.submissions
  add constraint submissions_review_status_check
  check (review_status in ('pending','approved','changes_requested'));

-- 2. Remember which video a student's watch coverage belongs to, so replacing
--    the YouTube URL in the admin area resets coverage instead of reusing it.
alter table public.module_watch_progress add column if not exists youtube_id text;
update public.module_watch_progress p
   set youtube_id = m.youtube_id
  from public.modules m
 where m.id = p.module_id and p.youtube_id is null;

-- 3. Replace every policy on the student-data tables with a known, minimal set.
do $$
declare t text; p record;
begin
  foreach t in array array['submissions','module_progress','module_watch_progress',
                           'module_watch_intervals','enrolments','certificates',
                           'user_roles','assignments'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Students can only READ their own rows. All writes go through the server (service key).
create policy "own submissions" on public.submissions for select using (auth.uid() = user_id);
create policy "admin read submissions" on public.submissions for select using (public.is_admin());

create policy "own progress" on public.module_progress for select using (auth.uid() = user_id);
create policy "admin read progress" on public.module_progress for select using (public.is_admin());

create policy "own watch progress" on public.module_watch_progress for select using (auth.uid() = user_id);
create policy "own watch intervals" on public.module_watch_intervals for select using (auth.uid() = user_id);

create policy "own enrolments" on public.enrolments for select using (auth.uid() = user_id);
create policy "admin read enrolments" on public.enrolments for select using (public.is_admin());

create policy "own certificates" on public.certificates for select using (auth.uid() = user_id);
create policy "admin read certificates" on public.certificates for select using (public.is_admin());

create policy "read own roles" on public.user_roles for select using (auth.uid() = user_id);

-- Assignments: admins manage them; students read them only for modules they have unlocked.
create policy "admin manage assignments" on public.assignments for all
  using (public.is_admin()) with check (public.is_admin());
create policy "unlocked students read assignments" on public.assignments for select using (
  exists (select 1 from public.module_progress mp
           where mp.module_id = assignments.module_id
             and mp.user_id = auth.uid()
             and mp.status <> 'locked')
);

-- 4. Private storage bucket 'course-assignments'.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and (coalesce(qual,'') ilike '%course-assignments%' or coalesce(with_check,'') ilike '%course-assignments%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "course-assignments admin all" on storage.objects for all to authenticated
  using (bucket_id = 'course-assignments' and public.is_admin())
  with check (bucket_id = 'course-assignments' and public.is_admin());

-- Question PDFs (problems/<assignment id>/...) only for students who unlocked that module.
create policy "course-assignments read problems" on storage.objects for select to authenticated
  using (
    bucket_id = 'course-assignments'
    and (storage.foldername(name))[1] = 'problems'
    and exists (
      select 1 from public.assignments a
        join public.module_progress mp on mp.module_id = a.module_id and mp.user_id = auth.uid()
       where a.id::text = (storage.foldername(name))[2] and mp.status <> 'locked')
  );

-- Students can read their OWN submitted files. They cannot upload directly:
-- uploads use one-time signed URLs issued by /api/assignments/submit.
create policy "course-assignments read own submissions" on storage.objects for select to authenticated
  using (
    bucket_id = 'course-assignments'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
