import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set(['https://ent2026.github.io', 'http://localhost:5173', 'http://127.0.0.1:5500']);
const corsFor = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://ent2026.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsFor(origin), 'Content-Type': 'application/json' } });
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const normalizeUsername = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9._-]/g, '.').replace(/[.]{2,}/g, '.').replace(/^[.]|[.]$/g, '').slice(0, 40);
const services: Record<string, { months: number; price: string; label: string }> = {
  initial: { months: 1, price: 'consult_initial_price', label: 'Consulta inicial' },
  followup: { months: 1, price: 'consult_followup_price', label: 'Consulta de seguimiento' },
  bimonthly: { months: 2, price: 'consult_bimonthly_price', label: 'Paquete bimestral · 2 consultas' },
  quarterly: { months: 3, price: 'consult_quarterly_price', label: 'Paquete trimestral · 3 consultas' },
  semester: { months: 6, price: 'consult_semester_price', label: 'Paquete semestral · 6 consultas' },
  couple: { months: 1, price: 'consult_couple_price', label: 'Consulta en pareja · 2 personas' },
};
const fileTypes: Record<string, { ext: string; signature: (b: Uint8Array) => boolean }> = {
  'application/pdf': { ext: 'pdf', signature: (b) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  'image/jpeg': { ext: 'jpg', signature: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', signature: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/webp': { ext: 'webp', signature: (b) => b.length > 12 && String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP' },
};

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsFor(origin) });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405, origin);
  const url = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'No se pudo conectar con ENT. Intenta de nuevo.' }, 500, origin);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: 'No se pudo leer el formulario.' }, 400, origin); }
  const fullName = clean(form.get('full_name'), 160);
  const phone = clean(form.get('phone'), 40);
  const age = Number(form.get('age'));
  const objective = clean(form.get('objective'), 500);
  const planCode = clean(form.get('plan_code'), 20);
  const service = services[planCode];
  if (fullName.length < 2 || phone.length < 7 || !Number.isInteger(age) || age < 1 || age > 120 || !service || form.get('payment_preference') !== 'transfer' || form.get('consent') !== 'on' || form.get('whatsapp_consent') !== 'on') {
    return json({ error: 'Revisa tu nombre, teléfono, consulta y autorización de datos.' }, 400, origin);
  }
  const rawFile = form.get('payment_proof');
  const proof = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
  if (!proof) return json({ error: 'Adjunta el comprobante de transferencia para enviar la solicitud.' }, 400, origin);
  if (proof.size > 5 * 1024 * 1024 || !fileTypes[proof.type]) {
    return json({ error: 'El comprobante debe ser PDF, JPG, PNG o WebP y pesar máximo 5 MB.' }, 400, origin);
  }
  let username = normalizeUsername(fullName.replace(/\s+/g, '.')).slice(0, 40) || 'paciente';
  if (username.length < 3) username = (username + '.paciente').slice(0, 40);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let proofPath: string | null = null;
  if (proof) {
    const bytes = new Uint8Array(await proof.arrayBuffer());
    const type = fileTypes[proof.type];
    if (!type.signature(bytes)) return json({ error: 'El archivo no parece ser un comprobante válido. Intenta con otro archivo.' }, 400, origin);
    proofPath = `requests/${crypto.randomUUID()}.${type.ext}`;
    const { error } = await admin.storage.from('payment-proofs').upload(proofPath, bytes, { contentType: proof.type, upsert: false });
    if (error) return json({ error: 'No se pudo guardar el comprobante. Intenta de nuevo.' }, 500, origin);
  }
  const record = {
    full_name: fullName, username, phone, age, objective,
    plan_code: planCode, plan_months: service.months,
    payment_preference: 'transfer', consent_at: new Date().toISOString(), whatsapp_consent_at: new Date().toISOString(),
    status: 'new', payment_proof_path: proofPath,
  };
  const { data: application, error: insertError } = await admin.from('patient_applications').insert(record).select('id').single();
  if (insertError) {
    if (proofPath) await admin.storage.from('payment-proofs').remove([proofPath]);
    return json({ error: 'No se pudo registrar la solicitud. Revisa los datos e inténtalo otra vez.' }, 400, origin);
  }
  const { data: config } = await admin.from('site_configuration').select(service.price).eq('id', 1).maybeSingle();
  return json({ success: true, application_id: application.id, username, service: service.label, price: config?.[service.price] ?? null }, 200, origin);
});