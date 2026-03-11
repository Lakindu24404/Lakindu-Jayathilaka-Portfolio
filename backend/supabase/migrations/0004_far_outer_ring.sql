-- Adds the fourth orbit ring, `farOuter`, to `stack_technologies.ring`.
--
-- Run this on any database created before the fourth ring existed. Databases
-- created from `0001_portfolio_schema.sql` after this change already allow the
-- value, and re-running this file is harmless either way.
--
-- Nothing is rewritten: existing rows keep `outer`, `middle` or `inner`, all of
-- which stay valid, so stored technologies continue to work with no manual
-- migration. The constraint is only widened.

do $$
declare
  constraint_name text;
begin
  -- Postgres names an inline column check `<table>_<column>_check`, but a
  -- database that has been through an editor round-trip may carry a different
  -- name, so the check is looked up by the column it guards.
  select con.conname
    into constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'public'
     and rel.relname = 'stack_technologies'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%ring%'
     and pg_get_constraintdef(con.oid) ilike '%outer%'
   limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.stack_technologies drop constraint %I',
      constraint_name
    );
  end if;
end
$$;

alter table public.stack_technologies
  add constraint stack_technologies_ring_check
  check (ring in ('farOuter', 'outer', 'middle', 'inner'));
