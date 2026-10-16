import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_EMAIL = "entestebantellez2026@gmail.com";
const ALLOWED_ORIGINS = new Set(["https://ent2026.github.io"]);

function response(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "null";
  if (req.method === "OPTIONS") return new Response("ok", { headers: {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  }});
  if (!ALLOWED_ORIGINS.has(origin)) return response({ error: "Origen no autorizado." }, 403, corsOrigin);
  if (req.method !== "POST") return response({ error: "Método no permitido." }, 405, corsOrigin);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return response({ error: "Inicia sesión para continuar." }, 401, corsOrigin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ error: "La función de acceso no está configurada." }, 500, corsOrigin);
  }

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return response({ error: "La sesión no es válida. Inicia sesión nuevamente." }, 401, corsOrigin);
  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) {
    return response({ error: "Este correo no está autorizado para administrar ENT." }, 403, corsOrigin);
  }
  if (!user.email_confirmed_at) {
    return response({ error: "Confirma el correo de administración antes de continuar." }, 403, corsOrigin);
  }

  if (user.app_metadata?.role === "admin") {
    return response({ ok: true, already_admin: true }, 200, corsOrigin);
  }

  for (let page = 1; page <= 100; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return response({ error: "No se pudo verificar la configuración inicial." }, 500, corsOrigin);
    const admins = (data?.users || []).filter((candidate) => candidate.app_metadata?.role === "admin");
    if (admins.some((candidate) => candidate.id !== user.id)) {
      return response({ error: "Ya existe una cuenta de administración. Solicita acceso al administrador actual." }, 409, corsOrigin);
    }
    if ((data?.users || []).length < 1000) break;
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata || {}), role: "admin" },
  });
  if (updateError) return response({ error: "No se pudo asignar el acceso profesional." }, 500, corsOrigin);
  return response({ ok: true }, 200, corsOrigin);
});
