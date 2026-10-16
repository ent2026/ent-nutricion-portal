import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://ent2026.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isMissingAuthUser = (error: any) =>
  error?.status === 404 || error?.statusCode === 404 || /user not found|not found/i.test(String(error?.message || ''));

async function removePatientFiles(service: ReturnType<typeof createClient>, bucket: string, patientId: string) {
  const paths: string[] = [];
  const walk = async (prefix: string): Promise<void> => {
    let offset = 0;
    while (true) {
      const { data, error } = await service.storage.from(bucket).list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error('No se pudieron revisar los archivos privados.');
      const entries = data || [];
      for (const entry of entries) {
        const path = prefix + '/' + entry.name;
        if (entry.id) paths.push(path);
        else await walk(path);
      }
      if (entries.length < 100) break;
      offset += entries.length;
    }
  };

  await walk(patientId);
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await service.storage.from(bucket).remove(paths.slice(index, index + 100));
    if (error) throw new Error('No se pudieron eliminar todos los archivos privados.');
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sesión requerida.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Configuración incompleta del servicio.' }, 500);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: authError } = await authClient.auth.getUser(token);
  if (authError || !caller.user || caller.user.app_metadata?.role !== 'admin') {
    return json({ error: 'Acceso exclusivo para administración.' }, 403);
  }

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json({ error: 'Solicitud inválida.' }, 400); }
  const patientId = typeof input.patient_id === 'string' ? input.patient_id.trim() : '';
  const confirmUsername = typeof input.confirm_username === 'string' ? input.confirm_username.trim() : '';
  if (!uuidPattern.test(patientId) || confirmUsername.length < 3) {
    return json({ error: 'Datos de confirmación inválidos.' }, 400);
  }
  if (patientId === caller.user.id) return json({ error: 'No puedes eliminar la cuenta administradora.' }, 400);

  const { data: profile, error: profileError } = await service.from('patient_profiles')
    .select('user_id,username').eq('user_id', patientId).maybeSingle();
  if (profileError || !profile) return json({ error: 'No se encontró el expediente del paciente.' }, 404);
  if (profile.username !== confirmUsername) return json({ error: 'El usuario de confirmación no coincide.' }, 400);

  try {
    await removePatientFiles(service, 'nutrition-files', patientId);
    await removePatientFiles(service, 'patient-progress', patientId);

    const tables = [
      'patient_notification_reads',
      'patient_notifications',
      'body_measurements',
      'nutrition_updates',
      'training_plans',
      'appointments',
    ];
    for (const table of tables) {
      const { error } = await service.from(table).delete().eq('patient_id', patientId);
      if (error) throw new Error('No se pudo eliminar el historial completo del paciente.');
    }

    const { error: applicationsError } = await service.from('patient_applications')
      .delete().eq('username', profile.username);
    if (applicationsError) throw new Error('No se pudo eliminar la solicitud asociada al paciente.');

    const { data: authRecord, error: lookupError } = await service.auth.admin.getUserById(patientId);
    if (lookupError && !isMissingAuthUser(lookupError)) {
      throw new Error('No se pudo comprobar la cuenta de acceso del paciente.');
    }
    if (authRecord?.user) {
      const { error } = await service.auth.admin.deleteUser(patientId);
      if (error) throw new Error('No se pudo eliminar la cuenta de acceso del paciente.');
    }

    const { error: deleteProfileError } = await service.from('patient_profiles').delete().eq('user_id', patientId);
    if (deleteProfileError) throw new Error('Falta eliminar el perfil del paciente. Puedes volver a intentar.');
    return json({ success: true });
  } catch (error) {
    console.error('admin-delete-patient failed:', error);
    return json({ error: error instanceof Error ? error.message : 'No se pudo completar la eliminación. Puedes volver a intentar.' }, 500);
  }
});