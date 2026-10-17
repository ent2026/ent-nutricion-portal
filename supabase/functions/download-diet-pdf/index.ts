import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ent2026.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const safeFilename = (value: unknown, fallback: string) => {
  const cleaned = String(value || fallback).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 150);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : cleaned + ".pdf";
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método no permitido." });
  const token = (req.headers.get("Authorization") || "").match(/^Bearer\\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: "Inicia sesión para descargar el archivo." });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json(500, { error: "El servicio de descarga no está configurado." });
  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json(401, { error: "La sesión expiró. Inicia sesión de nuevo." });
  if (user.app_metadata?.role !== "patient") return json(403, { error: "Esta descarga está disponible para el paciente asignado." });
  let id = ""; let kind = "diet";
  try { const body = await req.json(); id = String(body?.update_id || ""); kind = body?.type === "training" ? "training" : "diet"; }
  catch (_) { return json(400, { error: "Solicitud inválida." }); }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return json(400, { error: "Actualización inválida." });
  const cfg = kind === "training"
    ? { table: "training_plans", bucket: "training-files", path: "training_pdf_path", name: "training_pdf_name", downloaded: "training_pdf_downloaded_at", fallback: "Entrenamiento ENT.pdf" }
    : { table: "nutrition_updates", bucket: "nutrition-files", path: "diet_pdf_path", name: "diet_pdf_name", downloaded: "diet_pdf_downloaded_at", fallback: "Dieta ENT.pdf" };
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const claimedAt = new Date().toISOString();
  const claim = { [cfg.downloaded]: claimedAt };
  const { data: claimed, error: claimError } = await admin.from(cfg.table)
    .update(claim).eq("id", id).eq("patient_id", user.id).eq("is_published", true)
    .is(cfg.downloaded, null).not(cfg.path, "is", null)
    .select(`id,${cfg.path},${cfg.name}`).maybeSingle();
  if (claimError) return json(500, { error: "No se pudo preparar la descarga. Intenta otra vez." });
  if (!claimed?.[cfg.path]) return json(409, { error: "Este PDF ya se descargó o ya no está disponible. Solicita a ENT una copia nueva." });
  const releaseClaim = async () => { await admin.from(cfg.table).update({ [cfg.downloaded]: null }).eq("id", id).eq("patient_id", user.id).eq(cfg.downloaded, claimedAt); };
  const { data: file, error: downloadError } = await admin.storage.from(cfg.bucket).download(claimed[cfg.path]);
  if (downloadError || !file) { await releaseClaim(); return json(503, { error: "No se pudo leer el PDF. Vuelve a intentarlo." }); }
  const { error: deleteError } = await admin.storage.from(cfg.bucket).remove([claimed[cfg.path]]);
  if (deleteError) { await releaseClaim(); return json(503, { error: "No se pudo liberar el archivo. Vuelve a intentarlo." }); }
  const { error: clearPathError } = await admin.from(cfg.table).update({ [cfg.path]: null }).eq("id", id).eq("patient_id", user.id).eq(cfg.downloaded, claimedAt);
  if (clearPathError) console.error("Downloaded PDF was removed but DB path remained", id);
  const filename = safeFilename(claimed[cfg.name], cfg.fallback);
  const encodedFilename = encodeURIComponent(filename).replace(/['()*]/g, char => "%" + char.charCodeAt(0).toString(16).toUpperCase());
  return new Response(await file.arrayBuffer(), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="ent.pdf"; filename*=UTF-8''${encodedFilename}`, "Content-Length": String(file.size) } });
});