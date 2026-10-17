-- Let a patient confirm, cancel or request a new time while protecting the appointment details.
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('scheduled','confirmed','completed','cancelled','reschedule_requested'));

drop policy if exists patient_appointment_response on public.appointments;
create policy patient_appointment_response on public.appointments for update to authenticated
using ((select auth.uid()) = patient_id)
with check ((select auth.uid()) = patient_id and status in ('confirmed','reschedule_requested','cancelled'));

create or replace function public.ent_protect_patient_appointment_update()
returns trigger language plpgsql as $function$
begin
  if coalesce((select auth.jwt()->'app_metadata'->>'role'),'')='admin' then return new; end if;
  if (select auth.uid()) is distinct from old.patient_id then raise exception 'No autorizado'; end if;
  if new.scheduled_at is distinct from old.scheduled_at or
     new.appointment_type is distinct from old.appointment_type or
     new.location_or_link is distinct from old.location_or_link or
     new.patient_id is distinct from old.patient_id or
     new.created_by is distinct from old.created_by or
     new.created_at is distinct from old.created_at or
     new.status not in ('confirmed','reschedule_requested','cancelled') then
    raise exception 'Los pacientes solo pueden confirmar o solicitar reagenda';
  end if;
  return new;
end $function$;
drop trigger if exists ent_protect_patient_appointment_update on public.appointments;
create trigger ent_protect_patient_appointment_update before update on public.appointments
for each row execute function public.ent_protect_patient_appointment_update();
