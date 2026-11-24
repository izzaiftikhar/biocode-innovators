-- 020_internship_layouts.sql  (safe to run more than once)
-- Stores where the name, domain, duration, date and reference ID are
-- written on each internship's offer letter / certificate template.

alter table public.internships
  add column if not exists letter_layout      jsonb,
  add column if not exists certificate_layout jsonb;