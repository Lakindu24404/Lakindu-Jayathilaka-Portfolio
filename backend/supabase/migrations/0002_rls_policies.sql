-- Row level security.
--
-- The public site reads with the anon key, so these policies — not the app —
-- are what stop a draft project or a disabled orbit node from leaking. Writes
-- are limited to rows-of-any-kind for members of admin_users.

alter table public.admin_users enable row level security;
alter table public.stack_technologies enable row level security;
alter table public.projects enable row level security;

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------

-- Administrators can see the list; nobody can edit it from the client. Add and
-- remove administrators from the Supabase SQL editor.
drop policy if exists "admins read admin list" on public.admin_users;
create policy "admins read admin list"
  on public.admin_users
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- stack_technologies
-- ---------------------------------------------------------------------------

drop policy if exists "public reads enabled technologies" on public.stack_technologies;
create policy "public reads enabled technologies"
  on public.stack_technologies
  for select
  to anon, authenticated
  using (enabled);

drop policy if exists "admins read all technologies" on public.stack_technologies;
create policy "admins read all technologies"
  on public.stack_technologies
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins insert technologies" on public.stack_technologies;
create policy "admins insert technologies"
  on public.stack_technologies
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins update technologies" on public.stack_technologies;
create policy "admins update technologies"
  on public.stack_technologies
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete technologies" on public.stack_technologies;
create policy "admins delete technologies"
  on public.stack_technologies
  for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

drop policy if exists "public reads published projects" on public.projects;
create policy "public reads published projects"
  on public.projects
  for select
  to anon, authenticated
  using (published);

drop policy if exists "admins read all projects" on public.projects;
create policy "admins read all projects"
  on public.projects
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins insert projects" on public.projects;
create policy "admins insert projects"
  on public.projects
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins update projects" on public.projects;
create policy "admins update projects"
  on public.projects
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete projects" on public.projects;
create policy "admins delete projects"
  on public.projects
  for delete
  to authenticated
  using (public.is_admin());
