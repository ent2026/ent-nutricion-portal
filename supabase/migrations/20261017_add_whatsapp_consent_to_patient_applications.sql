alter table public.patient_applications
  add column if not exists whatsapp_consent_at timestamptz;

comment on column public.patient_applications.whatsapp_consent_at is
  'Timestamp when the applicant explicitly opted in to appointment and portal access WhatsApp messages.';
