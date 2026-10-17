-- Portal notice three calendar days before a scheduled appointment.
alter table public.appointments add column if not exists reminder_sent_at timestamptz;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;
create or replace function private.ent_publish_appointment_reminders()
returns integer language plpgsql security definer set search_path='' as $function$
declare due record; created_count integer := 0;
begin
 if auth.uid() is not null then raise exception 'This task is scheduler only'; end if;
 for due in
  select a.id,a.patient_id,a.scheduled_at,p.full_name
  from public.appointments a join public.patient_profiles p on p.user_id=a.patient_id
  where a.status='scheduled' and a.reminder_sent_at is null
   and (a.scheduled_at at time zone 'America/Mexico_City')::date=(now() at time zone 'America/Mexico_City')::date+3
 loop
  insert into public.patient_notifications(patient_id,category,title,message)
  values(due.patient_id,'appointment','Confirma tu próxima consulta',
   'Hola '||split_part(due.full_name,' ',1)||'. Te recordamos tu consulta ENT el '||
   to_char(due.scheduled_at at time zone 'America/Mexico_City','FMDay DD "de" FMMonth "a las" HH12:MI AM')||
   '. Este espacio está reservado para ti. Confirma o solicita reagenda en tu portal dentro de las próximas 48 horas. Los cambios solicitados con menos de 48 horas pueden requerir pago anticipado, conforme a las políticas del consultorio.');
  update public.appointments set reminder_sent_at=now() where id=due.id and reminder_sent_at is null;
  created_count:=created_count+1;
 end loop;
 return created_count;
end $function$;
revoke all on function private.ent_publish_appointment_reminders() from public,anon,authenticated;
grant execute on function private.ent_publish_appointment_reminders() to postgres,service_role;
create extension if not exists pg_cron with schema extensions;
select cron.schedule('ent-appointment-reminders-daily','0 15 * * *','select private.ent_publish_appointment_reminders();');
