import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://ent2026.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const cleanString = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const normalizeUsername = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
const serviceMonths: Record<string, number> = { initial: 1, followup: 1, bimonthly: 2, quarterly: 3, semester: 6, couple: 1 };
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  const authorization = request.headers.get('Authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sesión requerida.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Configuración incompleta del servicio.' }, 500);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: authError } = await authClient.auth.getUser(token);
  if (authError || !caller.user || caller.user.app_metadata?.role !== 'admin') return json({ error: 'Acceso exclusivo para administración.' }, 403);

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json({ error: 'Solicitud inválida.' }, 400); }
  let fullName = cleanString(input.full_name, 160);
  let username = normalizeUsername(cleanString(input.username, 40));
  let phone = cleanString(input.phone, 40);
  let age = Number(input.age);
  let scheduledAt = '';
  let appointmentType = '';
  let locationOrLink = '';
  let planCode = cleanString(input.plan_code, 20);
  let planMonths = serviceMonths[planCode] || 0;
  let applicationId = cleanString(input.application_id, 50);
  let hasWhatsappConsent = false;
  const password = typeof input.initial_password === 'string' ? input.initial_password : '';

  if (applicationId) {
    const { data: application, error } = await service.from('patient_applications')
      .select('id,full_name,username,phone,age,plan_code,plan_months,status,whatsapp_consent_at')
      .eq('id', applicationId).maybeSingle();
    if (error || !application || application.status !== 'new') return json({ error: 'La solicitud ya se procesó o no existe.' }, 409);
    hasWhatsappConsent = Boolean(application.whatsapp_consent_at);
    fullName = application.full_name;
    username = normalizeUsername(application.username || fullName.replace(/\s+/g, '.'));
    phone = application.phone;
    age = Number(application.age);
    scheduledAt = cleanString(input.scheduled_at, 80);
    appointmentType = cleanString(input.appointment_type, 20);
    locationOrLink = cleanString(input.location_or_link, 500);
    planCode = application.plan_code;
    planMonths = serviceMonths[planCode] || 0;
  }

  if (fullName.length < 2 || username.length < 3 || !/^[a-z0-9._-]+$/.test(username) || phone.length < 7 || !Number.isInteger(age) || age < 1 || age > 120 || !Object.hasOwn(serviceMonths, planCode) || planMonths !== serviceMonths[planCode] || password.length < 5 || password.length > 15) {
    return json({ error: 'Revisa nombre, edad, usuario, teléfono, membresía y contraseña (5 a 15 caracteres).' }, 400);
  }

  if (applicationId) {
    const appointmentDate = new Date(scheduledAt);
    if (!scheduledAt || Number.isNaN(appointmentDate.getTime()) || appointmentDate.getTime() <= Date.now() || !['in_person','online'].includes(appointmentType) || locationOrLink.length < 3) {
      return json({ error: 'Para aprobar la solicitud debes asignar una fecha futura, modalidad y dirección o enlace de consulta.' }, 400);
    }
  }
  const requestedUsername = username;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const { data: existing, error } = await service.from('patient_profiles').select('user_id').eq('username', username).maybeSingle();
    if (error) return json({ error: 'No se pudo comprobar la disponibilidad del usuario.' }, 500);
    if (!existing) break;
    const ending = String(suffix);
    username = `${requestedUsername.slice(0, 40 - ending.length)}${ending}`;
  }

  // Supabase Auth password sign-in accepts email or phone. ENT exposes only the
  // stable username; this non-deliverable internal address is never shown to patients.
  const email = `${username}@paciente.ent.invalid`;
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { role: 'patient' },
    user_metadata: { full_name: fullName, username },
  });
  if (createError || !created.user) return json({ error: 'No se pudo crear la cuenta. El usuario podría estar ocupado; intenta con otra variante.' }, 409);

  const { error: profileError } = await service.from('patient_profiles').insert({
    user_id: created.user.id, full_name: fullName, username, phone, age, plan_code: planCode,
    plan_months: planMonths, status: applicationId ? 'active' : 'pending',
  });
  if (profileError) {
    await service.auth.admin.deleteUser(created.user.id);
    return json({ error: 'No se pudo crear el expediente. La cuenta temporal se eliminó.' }, 500);
  }
  let appointmentId: string | null = null;
  if (applicationId) {
    const { data: appointment, error: appointmentError } = await service.from('appointments').insert({
      patient_id: created.user.id, scheduled_at: new Date(scheduledAt).toISOString(), appointment_type: appointmentType,
      location_or_link: locationOrLink, status: 'scheduled', created_by: caller.user.id,
    }).select('id').single();
    if (appointmentError || !appointment) {
      await service.from('patient_profiles').delete().eq('user_id', created.user.id);
      await service.auth.admin.deleteUser(created.user.id);
      return json({ error: 'No se pudo guardar la cita. No se creó el acceso; revisa la fecha e inténtalo de nuevo.' }, 500);
    }
    appointmentId = appointment.id;
    const { error } = await service.from('patient_applications').update({ status: 'accepted' }).eq('id', applicationId);
    if (error) {
      if (appointmentId) await service.from('appointments').delete().eq('id', appointmentId);
      await service.from('patient_profiles').delete().eq('user_id', created.user.id);
      await service.auth.admin.deleteUser(created.user.id);
      return json({ error: 'No se pudo actualizar la solicitud. El alta se revirtió.' }, 500);
    }
  }
  return json({
    username, initial_password: password, full_name: fullName, phone, age,
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    appointment_type: appointmentType || null, location_or_link: locationOrLink || null,
    whatsapp_consent: hasWhatsappConsent,
  });
});
