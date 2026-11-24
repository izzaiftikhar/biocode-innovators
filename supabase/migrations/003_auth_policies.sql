-- Run after 001 and 002.
-- Lets each logged-in user read their OWN roles (the middleware needs this to check for "admin").
-- Nobody can insert or change roles from the website, so users cannot make themselves admin.
alter table user_roles enable row level security;
create policy "read own roles" on user_roles for select using (auth.uid() = user_id);

-- Users may update their own profile (name, institution, etc.)
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- MAKE YOURSELF ADMIN: register on the site first, then run this once with your email.
-- insert into user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'YOUR_EMAIL_HERE'
-- on conflict do nothing;
