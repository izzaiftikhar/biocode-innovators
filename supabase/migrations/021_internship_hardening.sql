-- 021_internship_hardening.sql
-- Students can no longer write internship data or files directly from the browser.
-- All student actions go through server APIs (service role). Admin policies stay.
-- NOTE: never re-run 019 after this; it would recreate the dropped policies.

drop policy if exists enroll_insert_own       on public.internship_enrollments;
drop policy if exists sub_insert_own          on public.internship_submissions;
drop policy if exists sub_update_own          on public.internship_submissions;
drop policy if exists tasks_read              on public.internship_tasks;
drop policy if exists settings_read           on public.internship_settings;
drop policy if exists pay_insert_own          on public.internship_payments;
drop policy if exists pay_update_rejected     on public.internship_payments;
drop policy if exists internship_files_own_insert on storage.objects;

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf','application/zip','image/png','image/jpeg']
where id = 'internship-files';