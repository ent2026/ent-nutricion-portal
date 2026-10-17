import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const safeFilename = (value: unknown) => {
  const cleaned = String(value || "Dieta ENT.pdf")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .slice(0, 150);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : cleaned + ".pdf";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método no permitido." });

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: "Inicia sesión para descargar tu dieta." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(500, { error: "El servicio de descarga no está configurado." });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json(401, { error: "La sesión expiró. Inicia sesión de nuevo." });
  if (user.app_metadata?.role !== "patient") {
    return json(403, { error: "Esta descarga está disponible para el paciente asignado." });
  }

  let updateId = "";
  try {
    const body = await req.json();
    updateId = String(body?.update_id || "");
  } catch (_) {
    return json(400, { error: "Solicitud inválida." });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(updateId)) {
    return json(400, { error: "Actualización inválida." });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("nutrition_updates")
    .update({ diet_pdf_downloaded_at: claimedAt })
    .eq("id", updateId)
    .eq("patient_id", user.id)
    .eq("is_published", true)
    .is("diet_pdf_downloaded_at", null)
    .not("diet_pdf_path", "is", null)
    .select("id,diet_pdf_path,diet_pdf_name")
    .maybeSingle();

  if (claimError) return json(500, { error: "No se pudo preparar la descarga. Intenta otra vez." });
  if (!claimed?.diet_pdf_path) {
    return json(409, { error: "Este PDF ya se descargó o ya no está disponible. Solicita a ENT que publique una copia nueva." });
  }

  const releaseClaim = async () => {
    await admin.from("nutrition_updates")
      .update({ diet_pdf_downloaded_at: null })
      .eq("id", updateId)
      .eq("patient_id", user.id)
      .eq("diet_pdf_downloaded_at", claimedAt);
  };

  const { data: file, error: downloadError } = await admin.storage
    .from("nutrition-files")
    .download(claimed.diet_pdf_path);
  if (downloadError || !file) {
    await releaseClaim();
    return json(503, { error: "No se pudo leer el PDF. Puedes volver a intentarlo." });
  }

  const { error: deleteError } = await admin.storage
    .from("nutrition-files")
    .remove([claimed.diet_pdf_path]);
  if (deleteError) {
    await releaseClaim();
    return json(503, { error: "No se pudo liberar el archivo. Puedes volver a intentarlo." });
  }

  const { error: clearPathError } = await admin.from("nutrition_updates")
    .update({ diet_pdf_path: null })
    .eq("id", updateId)
    .eq("patient_id", user.id)
    .eq("diet_pdf_downloaded_at", claimedAt);
  if (clearPathError) {
    // The storage object is already deleted; keep the consumed marker to prevent duplicate attempts.
    console.error("Diet PDF object removed but its database path could not be cleared", updateId);
  }

  const filename = safeFilename(claimed.diet_pdf_name);
  const encodedFilename = encodeURIComponent(filename).replace(/['()*]/g, (char) =>
    "%" + char.charCodeAt(0).toString(16).toUpperCase()
  );
  return new Response(await file.arrayBuffer(), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dieta-ent.pdf"; filename*=UTF-8''${encodedFilename}`,
      "Content-Length": String(file.size),
    },
  });
});
