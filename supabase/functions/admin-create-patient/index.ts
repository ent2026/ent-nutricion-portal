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
const newTemporaryPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
};

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
  let email = cleanString(input.email, 320).toLowerCase();
  let phone = cleanString(input.phone, 40);
  let planCode = cleanString(input.plan_code, 20);
  let planMonths = Number(input.plan_months);
  let applicationId = cleanString(input.application_id, 50);

  if (applicationId) {
    const { data: application, error } = await service.from('patient_applications')
      .select('id,full_name,email,phone,plan_code,plan_months,status')
      .eq('id', applicationId).maybeSingle();
    if (error || !application || application.status !== 'new') return json({ error: 'La solicitud ya se procesó o no existe.' }, 409);
    fullName = application.full_name;
    email = application.email.toLowerCase();
    phone = application.phone;
    planCode = application.plan_code;
    planMonths = application.plan_months;
  }

  if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 7 || !['light', 'weight', 'best'].includes(planCode) || ![6, 12].includes(planMonths)) {
    return json({ error: 'Revisa nombre, correo, teléfono y membresía.' }, 400);
  }

  const password = newTemporaryPassword();
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { role: 'patient' },
    user_metadata: { full_name: fullName, must_change_password: true },
  });
  if (createError || !created.user) return json({ error: 'No se pudo crear la cuenta. Verifica si el correo ya está registrado.' }, 409);

  const { error: profileError } = await service.from('patient_profiles').insert({
    user_id: created.user.id, full_name: fullName, phone, plan_code: planCode,
    plan_months: planMonths, status: 'pending',
  });
  if (profileError) {
    await service.auth.admin.deleteUser(created.user.id);
    return json({ error: 'No se pudo crear el expediente. La cuenta temporal se eliminó.' }, 500);
  }
  if (applicationId) {
    const { error } = await service.from('patient_applications').update({ status: 'accepted' }).eq('id', applicationId);
    if (error) {
      await service.from('patient_profiles').delete().eq('user_id', created.user.id);
      await service.auth.admin.deleteUser(created.user.id);
      return json({ error: 'No se pudo actualizar la solicitud. El alta se revirtió.' }, 500);
    }
  }

  return json({ email, temporary_password: password, full_name: fullName });
});
