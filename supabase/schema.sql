-- ENT bootstrap schema (no patient data).
-- Apply only to the dedicated ENT Supabase project.
-- Patient/admin authorization is enforced by RLS; admin role must be assigned
-- through a trusted server-side Supabase Auth Admin workflow in app_metadata.

create table public.patient_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 160),
  phone text,
  avatar_path text,
  plan_code text not null default 'light' check (plan_code in ('light', 'weight', 'best')),
  plan_months smallint not null default 6 check (plan_months in (6, 12)),
  membership_started_on date,
  membership_ends_on date,
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patient_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 160),
  email text not null check (length(email) <= 320),
  phone text not null check (length(phone) <= 40),
  plan_code text not null check (plan_code in ('light', 'weight', 'best')),
  plan_months smallint not null check (plan_months in (6, 12)),
  payment_preference text not null check (payment_preference in ('transfer', 'office_cash')),
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'accepted', 'declined')),
  admin_notes text,
  created_at timestamptz not null default now()
);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg between 0 and 500),
  height_cm numeric(5,2) check (height_cm is null or height_cm between 0 and 300),
  body_fat_pct numeric(5,2) check (body_fat_pct is null or body_fat_pct between 0 and 100),
  muscle_mass_kg numeric(6,2) check (muscle_mass_kg is null or muscle_mass_kg between 0 and 300),
  visceral_fat_index numeric(5,2) check (visceral_fat_index is null or visceral_fat_index between 0 and 100),
  waist_cm numeric(5,2) check (waist_cm is null or waist_cm between 0 and 300),
  hip_cm numeric(5,2) check (hip_cm is null or hip_cm between 0 and 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.nutrition_updates (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 180),
  diet_content text not null,
  recommendations text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 180),
  plan_content text not null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  appointment_type text not null default 'in_person' check (appointment_type in ('in_person', 'online')),
  location_or_link text,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index body_measurements_patient_date_idx on public.body_measurements (patient_id, measured_on desc);
create index nutrition_updates_patient_published_idx on public.nutrition_updates (patient_id, is_published, created_at desc);
create index training_plans_patient_published_idx on public.training_plans (patient_id, is_published, created_at desc);
create index appointments_patient_schedule_idx on public.appointments (patient_id, scheduled_at desc);
create index patient_applications_status_created_idx on public.patient_applications (status, created_at desc);
create index appointments_created_by_idx on public.appointments(created_by);
create index body_measurements_created_by_idx on public.body_measurements(created_by);
create index nutrition_updates_created_by_idx on public.nutrition_updates(created_by);
create index training_plans_created_by_idx on public.training_plans(created_by);

alter table public.patient_profiles enable row level security;
alter table public.patient_applications enable row level security;
alter table public.body_measurements enable row level security;
alter table public.nutrition_updates enable row level security;
alter table public.training_plans enable row level security;
alter table public.appointments enable row level security;

revoke all on public.patient_profiles, public.patient_applications, public.body_measurements, public.nutrition_updates, public.training_plans, public.appointments from anon;
grant select, insert, update, delete on public.patient_profiles, public.patient_applications, public.body_measurements, public.nutrition_updates, public.training_plans, public.appointments to authenticated;

create policy "patient or admin reads profiles" on public.patient_profiles for select to authenticated
using ((select auth.uid()) = user_id or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin inserts profiles" on public.patient_profiles for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin updates profiles" on public.patient_profiles for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin deletes profiles" on public.patient_profiles for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin reads applications" on public.patient_applications for select to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin inserts applications" on public.patient_applications for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin updates applications" on public.patient_applications for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin deletes applications" on public.patient_applications for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "patient or admin reads measurements" on public.body_measurements for select to authenticated
using ((select auth.uid()) = patient_id or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin inserts measurements" on public.body_measurements for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin updates measurements" on public.body_measurements for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin deletes measurements" on public.body_measurements for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "patient or admin reads nutrition updates" on public.nutrition_updates for select to authenticated
using (((select auth.uid()) = patient_id and is_published) or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin inserts nutrition updates" on public.nutrition_updates for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin updates nutrition updates" on public.nutrition_updates for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin deletes nutrition updates" on public.nutrition_updates for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "patient or admin reads training plans" on public.training_plans for select to authenticated
using (((select auth.uid()) = patient_id and is_published) or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin inserts training plans" on public.training_plans for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin updates training plans" on public.training_plans for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin deletes training plans" on public.training_plans for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "patient or admin reads appointments" on public.appointments for select to authenticated
using ((select auth.uid()) = patient_id or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin inserts appointments" on public.appointments for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin updates appointments" on public.appointments for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin deletes appointments" on public.appointments for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- Private progress-photo storage. Patient objects are isolated by their auth UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-progress', 'patient-progress', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ent_progress_photos_read on storage.objects;
create policy ent_progress_photos_read on storage.objects for select to authenticated
using (
  bucket_id = 'patient-progress'
  and (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);
drop policy if exists ent_progress_photos_admin_upload on storage.objects;
create policy ent_progress_photos_admin_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'patient-progress'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);
drop policy if exists ent_progress_photos_admin_delete on storage.objects;
create policy ent_progress_photos_admin_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'patient-progress'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);
