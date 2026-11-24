-- 018_featured_carousel.sql
-- Lets the admin choose which publications / journal entries appear in the
-- 3D carousel on /research and /student-journal.

alter table public.publications
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_order int not null default 0;

alter table public.student_journals
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_order int not null default 0;

-- Cap: at most 8 featured items per table, enforced in the database so it
-- cannot be bypassed from the UI.
create or replace function public.enforce_max_featured()
returns trigger
language plpgsql
as $$
declare
  featured_count int;
begin
  if new.is_featured is true then
    execute format(
      'select count(*) from public.%I where is_featured = true and id <> $1',
      tg_table_name
    )
    into featured_count
    using new.id;

    if featured_count >= 8 then
      raise exception 'Only 8 items can be featured at a time. Un-feature one first.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists publications_max_featured on public.publications;
create trigger publications_max_featured
  before insert or update of is_featured on public.publications
  for each row execute function public.enforce_max_featured();

drop trigger if exists student_journals_max_featured on public.student_journals;
create trigger student_journals_max_featured
  before insert or update of is_featured on public.student_journals
  for each row execute function public.enforce_max_featured();