drop policy if exists "admin updates appointments" on public.appointments;
drop policy if exists patient_appointment_response on public.appointments;
create policy appointments_admin_or_patient_updates on public.appointments for update to authenticated
using ((select auth.jwt())->'app_metadata'->>'role'='admin' or (select auth.uid())=patient_id)
with check ((select auth.jwt())->'app_metadata'->>'role'='admin' or ((select auth.uid())=patient_id and status in ('confirmed','reschedule_requested','cancelled'));