-- Storage buckets for orbit logos and project imagery.
--
-- Both buckets are public-read (the portfolio serves the files straight from
-- the CDN) and admin-write. MIME types and size limits are enforced by the
-- bucket itself as well as by the upload action, so a hand-rolled request
-- cannot smuggle in a non-image file.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stack-logos',
  'stack-logos',
  true,
  512000, -- 500 KB, these are icons
  array['image/svg+xml', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images',
  'project-images',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read -----------------------------------------------------------------

drop policy if exists "portfolio assets are publicly readable" on storage.objects;
create policy "portfolio assets are publicly readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id in ('stack-logos', 'project-images'));

-- Admin write -----------------------------------------------------------------

drop policy if exists "admins upload portfolio assets" on storage.objects;
create policy "admins upload portfolio assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('stack-logos', 'project-images') and public.is_admin()
  );

drop policy if exists "admins replace portfolio assets" on storage.objects;
create policy "admins replace portfolio assets"
  on storage.objects
  for update
  to authenticated
  using (bucket_id in ('stack-logos', 'project-images') and public.is_admin())
  with check (
    bucket_id in ('stack-logos', 'project-images') and public.is_admin()
  );

drop policy if exists "admins delete portfolio assets" on storage.objects;
create policy "admins delete portfolio assets"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id in ('stack-logos', 'project-images') and public.is_admin());
