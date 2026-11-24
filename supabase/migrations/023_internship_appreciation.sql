alter table public.internships
  add column if not exists appreciation_template_path text,
  add column if not exists appreciation_layout jsonb;

alter table public.internship_certificates
  add column if not exists appreciation_path text;

notify pgrst, 'reload schema';