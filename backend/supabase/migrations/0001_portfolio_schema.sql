-- Portfolio dashboard schema: Stack Orbit + Projects.
--
-- Run this first, then 0002_rls_policies.sql, then 0003_storage.sql, then the
-- incremental files 0004_far_outer_ring.sql and 0005_stack_logo_fit.sql.
-- Everything is idempotent so the file can be re-applied safely.
--
-- `create table if not exists` does not alter a table that already exists, so
-- an established database still needs the incremental files: this one only
-- describes the shape a brand new database is created with.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Administrators
-- ---------------------------------------------------------------------------

-- Membership table rather than a role claim, so access can be granted and
-- revoked from the SQL editor without touching auth metadata.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Users allowed to manage portfolio content. Every write policy checks this.';

-- `security definer` so the function can read admin_users while that table is
-- itself locked down. The empty search_path prevents search-path hijacking.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stack Orbit
-- ---------------------------------------------------------------------------

create table if not exists public.stack_technologies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  brand_key text not null unique
    check (brand_key ~ '^[a-z0-9-]{1,48}$'),
  logo_path text not null check (char_length(logo_path) between 1 and 2048),
  -- Four rings, outermost first. `0004_far_outer_ring.sql` widens this same
  -- constraint on databases created before `farOuter` existed.
  ring text not null default 'outer'
    check (ring in ('farOuter', 'outer', 'middle', 'inner')),
  display_order integer not null default 0,
  enabled boolean not null default true,
  -- Optional per-node disc colour. NULL keeps the stylesheet's brand rule.
  node_background text
    check (node_background is null
           or node_background ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$'),
  icon_mode text not null default 'original'
    check (icon_mode in ('original', 'dark', 'white')),
  -- When false the app distributes angles evenly around the ring.
  manual_angle boolean not null default false,
  angle numeric(6, 2) check (angle is null or (angle >= 0 and angle <= 360)),
  -- Non-destructive logo framing. The uploaded file is never rewritten; these
  -- three numbers only say how it is displayed inside the circular node, so a
  -- reframe is a cheap update and the original asset stays reusable.
  -- `0005_stack_logo_fit.sql` adds these same columns, with the same defaults
  -- and checks, to databases created before the "Logo fit" editor existed.
  logo_scale numeric(4, 2) not null default 1
    constraint stack_technologies_logo_scale_check
    check (logo_scale >= 0.5 and logo_scale <= 4),
  -- Percent of the node diameter, so the framing stays proportional at every
  -- orbit size. Positive moves the logo right / down.
  logo_offset_x numeric(5, 2) not null default 0
    constraint stack_technologies_logo_offset_x_check
    check (logo_offset_x >= -100 and logo_offset_x <= 100),
  logo_offset_y numeric(5, 2) not null default 0
    constraint stack_technologies_logo_offset_y_check
    check (logo_offset_y >= -100 and logo_offset_y <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stack_manual_angle_needs_value
    check (not manual_angle or angle is not null)
);

create index if not exists stack_technologies_ring_order_idx
  on public.stack_technologies (ring, display_order);

create index if not exists stack_technologies_enabled_idx
  on public.stack_technologies (enabled)
  where enabled;

drop trigger if exists stack_technologies_touch on public.stack_technologies;
create trigger stack_technologies_touch
  before update on public.stack_technologies
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 1 and 200),
  tag text not null default '' check (char_length(tag) <= 80),
  image text not null check (char_length(image) between 1 and 2048),
  -- Ordered list of gallery image URLs.
  gallery jsonb not null default '[]'::jsonb
    check (jsonb_typeof(gallery) = 'array' and jsonb_array_length(gallery) <= 12),
  client text not null default '',
  duration text not null default '',
  preview_url text not null default '',
  template_label text not null default '',
  template_url text not null default '',
  intro text not null default '',
  approach text not null default '',
  -- Repeatable [{ heading, body }] content sections.
  sections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) <= 12),
  features text not null default '',
  a11y_notes text not null default '',
  conclusion text not null default '',
  published boolean not null default false,
  show_on_homepage boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_order_idx
  on public.projects (display_order, created_at);

create index if not exists projects_published_idx
  on public.projects (published)
  where published;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Reordering
-- ---------------------------------------------------------------------------

-- Reordering is a single statement so a drag never leaves gaps or duplicates
-- if two tabs save at once. Both functions run as the caller, so RLS applies.
create or replace function public.reorder_stack_technologies(
  target_ring text,
  ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  update public.stack_technologies as s
     set display_order = ordered.position,
         ring = target_ring
    from (
      select id, (ordinality - 1)::int as position
        from unnest(ordered_ids) with ordinality as t(id, ordinality)
    ) as ordered
   where s.id = ordered.id;
end;
$$;

create or replace function public.reorder_projects(ordered_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  update public.projects as p
     set display_order = ordered.position
    from (
      select id, (ordinality - 1)::int as position
        from unnest(ordered_ids) with ordinality as t(id, ordinality)
    ) as ordered
   where p.id = ordered.id;
end;
$$;

grant execute on function public.reorder_stack_technologies(text, uuid[]) to authenticated;
grant execute on function public.reorder_projects(uuid[]) to authenticated;
