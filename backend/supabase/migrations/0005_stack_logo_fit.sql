-- Non-destructive logo framing for the Stack Orbit nodes.
--
-- Run this on any database created before the "Logo fit" editor existed.
-- Databases created from `0001_portfolio_schema.sql` after this change already
-- have the columns, and re-running this file is harmless either way.
--
-- Nothing is rewritten and no upload is touched: the three columns only record
-- how an already-stored `logo_path` is framed inside its circular node, so
-- every existing row keeps its logo and simply gains the centred default
-- transform (scale 1, offsets 0) that reproduces today's rendering exactly.
--
--   logo_scale     0.5 .. 4    1 = the node's own base logo size
--   logo_offset_x  -100 .. 100 percent of the node diameter, positive = right
--   logo_offset_y  -100 .. 100 percent of the node diameter, positive = down

-- `add column if not exists ... not null default` backfills existing rows with
-- the default in one pass, so no separate update is needed here.
alter table public.stack_technologies
  add column if not exists logo_scale numeric(4, 2) not null default 1,
  add column if not exists logo_offset_x numeric(5, 2) not null default 0,
  add column if not exists logo_offset_y numeric(5, 2) not null default 0;

-- Defensive: if a database already carried these columns as nullable or
-- without a default -- an editor round-trip, or a hand-written earlier
-- attempt -- bring them up to the contract the application relies on rather
-- than leaving nulls the mapper would have to paper over.
do $$
begin
  update public.stack_technologies
     set logo_scale = coalesce(logo_scale, 1),
         logo_offset_x = coalesce(logo_offset_x, 0),
         logo_offset_y = coalesce(logo_offset_y, 0)
   where logo_scale is null
      or logo_offset_x is null
      or logo_offset_y is null;

  alter table public.stack_technologies
    alter column logo_scale set default 1,
    alter column logo_scale set not null,
    alter column logo_offset_x set default 0,
    alter column logo_offset_x set not null,
    alter column logo_offset_y set default 0,
    alter column logo_offset_y set not null;
end
$$;

-- Named constraints, added only when absent, so the file stays idempotent.
-- The ranges are the same ones `stackTechInput` enforces in the application.
do $$
begin
  if not exists (
    select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'stack_technologies'
       and con.conname = 'stack_technologies_logo_scale_check'
  ) then
    alter table public.stack_technologies
      add constraint stack_technologies_logo_scale_check
      check (logo_scale >= 0.5 and logo_scale <= 4);
  end if;

  if not exists (
    select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'stack_technologies'
       and con.conname = 'stack_technologies_logo_offset_x_check'
  ) then
    alter table public.stack_technologies
      add constraint stack_technologies_logo_offset_x_check
      check (logo_offset_x >= -100 and logo_offset_x <= 100);
  end if;

  if not exists (
    select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'stack_technologies'
       and con.conname = 'stack_technologies_logo_offset_y_check'
  ) then
    alter table public.stack_technologies
      add constraint stack_technologies_logo_offset_y_check
      check (logo_offset_y >= -100 and logo_offset_y <= 100);
  end if;
end
$$;

comment on column public.stack_technologies.logo_scale is
  'Display-only zoom for the stored logo inside its node. 1 = the node base size.';
comment on column public.stack_technologies.logo_offset_x is
  'Display-only horizontal nudge, percent of the node diameter. Positive = right.';
comment on column public.stack_technologies.logo_offset_y is
  'Display-only vertical nudge, percent of the node diameter. Positive = down.';
