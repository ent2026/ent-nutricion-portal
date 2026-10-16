alter table public.nutrition_updates
  add column if not exists diet_pdf_path text,
  add column if not exists diet_pdf_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nutrition-files', 'nutrition-files', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "nutrition files visible to owner and admin" on storage.objects;
create policy "nutrition files visible to owner and admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'nutrition-files'
  and (
    ((select auth.jwt())->'app_metadata'->>'role') = 'admin'
    or exists (
      select 1
      from public.nutrition_updates as n
      where n.diet_pdf_path = storage.objects.name
        and n.patient_id = (select auth.uid())
        and n.is_published = true
    )
  )
);

drop policy if exists "admins upload nutrition files" on storage.objects;
create policy "admins upload nutrition files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nutrition-files'
  and ((select auth.jwt())->'app_metadata'->>'role') = 'admin'
);

drop policy if exists "admins delete nutrition files" on storage.objects;
create policy "admins delete nutrition files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'nutrition-files'
  and ((select auth.jwt())->'app_metadata'->>'role') = 'admin'
);
