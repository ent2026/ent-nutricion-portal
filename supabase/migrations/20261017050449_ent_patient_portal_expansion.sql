-- ENT patient workspace: expanded anthropometry, private training PDFs, global Lifestyle and FAQ media.
alter table public.body_measurements
  add column if not exists triceps_skinfold_mm numeric,
  add column if not exists biceps_skinfold_mm numeric,
  add column if not exists subscapular_skinfold_mm numeric,
  add column if not exists suprailiac_skinfold_mm numeric,
  add column if not exists supraspinale_skinfold_mm numeric,
  add column if not exists abdominal_skinfold_mm numeric,
  add column if not exists thigh_skinfold_mm numeric,
  add column if not exists medial_calf_skinfold_mm numeric,
  add column if not exists arm_relaxed_cm numeric,
  add column if not exists arm_flexed_cm numeric,
  add column if not exists forearm_cm numeric,
  add column if not exists wrist_cm numeric,
  add column if not exists thigh_cm numeric,
  add column if not exists calf_cm numeric,
  add column if not exists humerus_breadth_cm numeric,
  add column if not exists wrist_bistyloid_breadth_cm numeric,
  add column if not exists femur_breadth_cm numeric;

alter table public.training_plans
  add column if not exists training_pdf_path text,
  add column if not exists training_pdf_name text,
  add column if not exists training_pdf_downloaded_at timestamptz;

create table if not exists public.lifestyle_library(
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  youtube_url text not null check (youtube_url ~ '^https://(www\\.)?(youtube\\.com|youtu\\.be)/'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.lifestyle_library enable row level security;
drop policy if exists lifestyle_active_patients_read on public.lifestyle_library;
create policy lifestyle_active_patients_read on public.lifestyle_library for select to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin' or exists(select 1 from public.patient_profiles p where p.user_id=(select auth.uid()) and p.status='active'));
drop policy if exists lifestyle_admin_insert on public.lifestyle_library;
create policy lifestyle_admin_insert on public.lifestyle_library for insert to authenticated with check ((select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists lifestyle_admin_update on public.lifestyle_library;
create policy lifestyle_admin_update on public.lifestyle_library for update to authenticated using ((select auth.jwt()->'app_metadata'->>'role')='admin') with check ((select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists lifestyle_admin_delete on public.lifestyle_library;
create policy lifestyle_admin_delete on public.lifestyle_library for delete to authenticated using ((select auth.jwt()->'app_metadata'->>'role')='admin');

create table if not exists public.faq_visual(
  id integer primary key check (id=1),
  image_path text not null,
  image_name text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.faq_visual enable row level security;
drop policy if exists faq_active_patients_read on public.faq_visual;
create policy faq_active_patients_read on public.faq_visual for select to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin' or exists(select 1 from public.patient_profiles p where p.user_id=(select auth.uid()) and p.status='active'));
drop policy if exists faq_admin_update on public.faq_visual;
create policy faq_admin_update on public.faq_visual for update to authenticated using ((select auth.jwt()->'app_metadata'->>'role')='admin') with check ((select auth.jwt()->'app_metadata'->>'role')='admin');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('training-files','training-files',false,10485760,array['application/pdf']),
 ('ent-faq-images','ent-faq-images',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists ent_training_admin_upload on storage.objects;
create policy ent_training_admin_upload on storage.objects for insert to authenticated with check(bucket_id='training-files' and (select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists ent_training_admin_delete on storage.objects;
create policy ent_training_admin_delete on storage.objects for delete to authenticated using(bucket_id='training-files' and (select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists ent_faq_admin_upload on storage.objects;
create policy ent_faq_admin_upload on storage.objects for insert to authenticated with check(bucket_id='ent-faq-images' and (select auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists ent_faq_admin_delete on storage.objects;
create policy ent_faq_admin_delete on storage.objects for delete to authenticated using(bucket_id='ent-faq-images' and (select auth.jwt()->'app_metadata'->>'role')='admin');

do $$
declare t text;
begin
  foreach t in array array['body_measurements','training_plans','lifestyle_library','faq_visual','appointments','patient_notifications','patient_profiles','patient_applications','nutrition_updates','site_configuration'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
