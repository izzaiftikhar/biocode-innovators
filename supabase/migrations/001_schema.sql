-- Biocode Research Wing: core schema (run in Supabase SQL editor)

create extension if not exists "pgcrypto";

create type app_role as enum ('visitor','member','student','research_member','fellow','intern','mentor','admin');
create type progress_status as enum ('locked','unlocked','submitted','under_review','completed');
create type application_type as enum ('research','fellowship','internship','journal');
create type application_status as enum ('received','under_review','accepted','rejected');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  country text, institution text, photo_url text,
  public_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create table user_roles (
  user_id uuid references profiles(id) on delete cascade,
  role app_role not null,
  primary key (user_id, role)
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, title text not null, summary text,
  level text, duration text, delivery text, is_free boolean default true,
  published boolean default false, created_at timestamptz default now()
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  position int not null, title text not null,
  youtube_id text, notes_md text,
  completion_rule text not null default 'quiz' check (completion_rule in ('quiz','mentor','both')),
  pass_mark int default 70, max_attempts int default 3,
  unique (course_id, position)
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  kind text not null check (kind in ('quiz','written','upload','watch')),
  prompt text, config jsonb default '{}'::jsonb
);

create table enrolments (
  user_id uuid references profiles(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  enrolled_at timestamptz default now(),
  primary key (user_id, course_id)
);

create table module_progress (
  user_id uuid references profiles(id) on delete cascade,
  module_id uuid references modules(id) on delete cascade,
  status progress_status not null default 'locked',
  attempts int default 0, completed_at timestamptz,
  primary key (user_id, module_id)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  answer jsonb, file_path text, score int,
  review_status text default 'pending' check (review_status in ('pending','approved','needs_revision')),
  mentor_comment text, created_at timestamptz default now()
);

create table certificate_templates (
  course_id uuid primary key references courses(id) on delete cascade,
  file_path text not null,
  layout jsonb not null  -- name_x, name_y, name_size, id_x, id_y, qr_x, qr_y, qr_size
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  cert_code text unique not null,
  user_id uuid not null references profiles(id),
  course_id uuid references courses(id),
  holder_name text not null, course_title text not null,
  pdf_path text, status text not null default 'valid' check (status in ('valid','revoked')),
  issued_at timestamptz not null default now()
);

create table publications (
  id uuid primary key default gen_random_uuid(),
  title text not null, authors text[] not null, year int, journal text,
  doi text, external_url text not null, abstract text, type text, tags text[] default '{}'
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  type application_type not null, status application_status not null default 'received',
  name text not null, email text not null, message text, payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, message text not null,
  created_at timestamptz default now()
);

create table internships (
  id uuid primary key default gen_random_uuid(),
  title text not null, department text, duration text, mode text,
  is_paid boolean not null default false, stipend_details text,
  contact_email text, deadline date, is_open boolean default true
);

-- Row level security: users see only their own rows; public content is readable.
alter table profiles enable row level security;
alter table module_progress enable row level security;
alter table submissions enable row level security;
alter table enrolments enable row level security;
alter table certificates enable row level security;

create policy "own profile" on profiles for select using (auth.uid() = id);
create policy "own progress" on module_progress for select using (auth.uid() = user_id);
create policy "own submissions" on submissions for select using (auth.uid() = user_id);
create policy "own enrolments" on enrolments for select using (auth.uid() = user_id);
create policy "own certificates" on certificates for select using (auth.uid() = user_id);

-- Storage buckets to create in the Supabase dashboard:
--   certificate-templates (private), certificates (private), assignments (private)
