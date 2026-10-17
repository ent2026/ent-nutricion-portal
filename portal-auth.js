(() => {
  const config = window.ENT_SUPABASE_CONFIG;
  const clientFactory = window.supabase?.createClient;
  const client = window.ENT_SUPABASE_CLIENT || (config && clientFactory
    ? clientFactory(config.url, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null);
  if (client) window.ENT_SUPABASE_CLIENT = client;
  const dedicatedView = document.body.dataset.portalView || '';
  const ADMIN_EMAIL = 'entestebantelleznutriologo@gmail.com';
  const backdrop = document.querySelector('#modal');
  const content = dedicatedView
    ? document.querySelector('#portal-root')
    : document.querySelector('#modal-content');
  let requestedView = 'patient';
  let activeUser = null;
  let activeProfile = null;
  let pendingUser = null;
  let activeTab = 'resumen';
  let activeAdminPanel = 'patients';

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const normalizeUsername = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
  const normalizeLifestyleVideoUrl = (raw = '') => {
    let value=String(raw).trim();
    if(!value)throw new Error('Pega el enlace del video de YouTube.');
    if(/^http:\/\//i.test(value))value=value.replace(/^http:\/\//i,'https://');
    else if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(value))value=`https://${value.replace(/^\/\//,'')}`;
    let url;
    try{url=new URL(value)}catch(_){throw new Error('Escribe un enlace válido de YouTube.')}
    const host=url.hostname.toLowerCase().replace(/\.$/,'');
    if(url.protocol!=='https:'||url.username||url.password||!(host==='youtu.be'||host==='youtube.com'||host.endsWith('.youtube.com'))){
      throw new Error('Usa un enlace seguro de YouTube: youtube.com o youtu.be.');
    }
    if(url.port&&url.port!=='443')throw new Error('El enlace de YouTube contiene un puerto no permitido.');
    let videoId='';
    if(host==='youtu.be')videoId=url.pathname.split('/').filter(Boolean)[0]||'';
    else if(url.pathname==='/watch')videoId=url.searchParams.get('v')||'';
    else{
      const match=url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]+)\/?$/);
      videoId=match?.[1]||'';
    }
    if(!/^[A-Za-z0-9_-]{6,20}$/.test(videoId))throw new Error('El enlace debe abrir un video de YouTube (watch, Shorts, Live o youtu.be).');
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  };
  const serviceLabels = { initial: 'Consulta inicial', followup: 'Consulta de seguimiento', bimonthly: 'Paquete bimestral · 2 consultas', quarterly: 'Paquete trimestral · 3 consultas', semester: 'Paquete semestral · 6 consultas', couple: 'Consulta en pareja · 2 personas' };
  const serviceMonths = { initial: 1, followup: 1, bimonthly: 2, quarterly: 3, semester: 6, couple: 1 };
  const serviceLabel = (value) => serviceLabels[value] || 'Consulta por definir';
  const dateLabel = (value) => value
    ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
    : '—';
  const dateTimeLabel = (value) => value
    ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';
  const showModal = (html) => {
    content.innerHTML = html;
    if (dedicatedView) return;
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    content.querySelector('input')?.focus();
  };
  const closeModal = () => {
    if (dedicatedView) return;
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };
  const showLogin = (view) => {
    requestedView = view;
    activeUser = null;
    activeProfile = null;
    if (!client) {
      showModal(`<div class="dashboard"><div class="modal-kicker">ACCESO ENT</div><h2 id="modal-title">No se pudo cargar el acceso</h2><p class="modal-lede">Revisa la conexión de autenticación e intenta de nuevo.</p></div>`);
      return;
    }
    const admin = view === 'admin';
    showModal(`<div class="dashboard login-wrap">
      <div class="modal-kicker">${admin ? 'ACCESO PROFESIONAL' : 'PORTAL DE PACIENTE'}</div>
      <h2 id="modal-title">${admin ? 'Administración ENT' : 'Bienvenido de nuevo'}</h2>
      <p class="modal-lede">${admin ? 'Ingresa con el correo y la contraseña de administración.' : 'Ingresa con tu usuario ENT y contraseña.'}</p>
      <form id="ent-login-form" novalidate>
        <div class="form-grid login-grid">
          ${admin ? `<div><label class="form-label" for="ent-login-email">Correo de administración</label><input class="input" id="ent-login-email" name="email" type="email" value="${ADMIN_EMAIL}" autocomplete="username" readonly required /></div>` : '<div><label class="form-label" for="ent-login-username">Usuario</label><input class="input" id="ent-login-username" name="username" type="text" autocomplete="username" minlength="3" maxlength="40" required /></div>'}
          <div><label class="form-label" for="ent-login-password">Contraseña</label><input class="input" id="ent-login-password" name="password" type="password" autocomplete="current-password" required /><button class="button button-outline password-action" type="button" data-toggle-password="ent-login-password">Ver</button></div>
        </div>
        <p class="login-error" id="ent-login-error" role="alert" hidden></p>
        <button class="button button-dark form-submit" id="ent-login-submit" type="submit">Ingresar <span>→</span></button>
      </form>
      <p class="form-note" id="ent-login-note">${admin ? 'El acceso ENT es independiente de GitHub. Si es tu primer acceso, crea la cuenta inicial aquí.' : 'Si aún no tienes acceso, solicita tus credenciales directamente a ENT.'}</p>
      ${admin ? '<button class="button button-outline form-submit" type="button" data-admin-setup>Crear cuenta inicial de administración</button>' : ''}
      ${dedicatedView ? '' : `<div class="live-demo-entry"><span>¿Solo quieres revisar el diseño?</span><button class="button button-outline" type="button" data-open-demo="${admin ? 'admin' : 'patient'}">Ver vista de muestra</button><small>Usa datos ficticios y no guarda cambios.</small></div>`}
      ${dedicatedView ? '<a class="portal-return" href="./index.html">← Volver al sitio ENT</a>' : ''}
    </div>`);
  };
  const showAdminSetup = () => showModal(`<div class="dashboard login-wrap">
    <div class="modal-kicker">CONFIGURACIÓN INICIAL</div>
    <h2 id="modal-title">Termina el acceso desde Supabase</h2>
    <p class="modal-lede">Supabase alcanzó el límite temporal de correos. Crear esta cuenta desde el panel evita enviar otro correo y permite que tú establezcas la contraseña.</p>
    <ol class="setup-steps">
      <li>Abre <b>Authentication → Users</b> en el proyecto ENT.</li>
      <li>Elimina solo la cuenta sin confirmar que quedó con el correo anterior.</li>
      <li>Selecciona <b>Add user → Create new user</b>, escribe <b>${ADMIN_EMAIL}</b>, establece tu nueva contraseña y activa <b>Auto Confirm User</b> si aparece esa opción.</li>
    </ol>
    <a class="button button-dark form-submit" href="https://supabase.com/dashboard/project/teqnarfiuwstxjycuchb/auth/users" target="_blank" rel="noopener">Abrir usuarios de Supabase →</a>
    <p class="form-note">Después vuelve aquí e inicia sesión con el correo y la contraseña que acabas de crear. ENT asignará el rol de administrador al primer acceso.</p>
    <button class="button button-outline form-submit" type="button" data-admin-login>Volver al inicio de sesión</button>
  </div>`);
  const showFirstPasswordForm = () => showModal(`<div class="dashboard login-wrap"><div class="modal-kicker">ACTIVA TU ACCESO</div><h2 id="modal-title">Crea una contraseña personal</h2><p class="modal-lede">Por seguridad, reemplaza tu clave temporal antes de entrar a tu perfil.</p><form id="ent-first-password-form"><label class="form-label" for="new-patient-password">Nueva contraseña</label><input class="input" id="new-patient-password" name="password" type="password" autocomplete="new-password" minlength="5" maxlength="15" required /><label class="form-label" for="confirm-patient-password">Confirma la contraseña</label><input class="input" id="confirm-patient-password" name="confirm_password" type="password" autocomplete="new-password" minlength="5" maxlength="15" required /><p class="login-error" id="ent-login-error" role="alert" hidden></p><button class="button button-dark form-submit" type="submit">Guardar y continuar →</button></form></div>`);
  const metric = (label, value, unit) => `<div class="metric"><small>${label}</small><strong>${value ?? '—'} <i>${unit}</i></strong></div>`;
  const patientTabs = ['resumen','mediciones','antropometria','dieta','entrenamiento','citas','faq','lifestyle','avisos'];
  const tabTitle = { resumen:'Resumen', mediciones:'Mediciones', antropometria:'Antropometría', dieta:'Mi dieta', entrenamiento:'Entrenamiento', citas:'Consultas', faq:'Preguntas frecuentes', lifestyle:'Lifestyle', avisos:'Avisos' };

  const patientView = async (tab = activeTab) => {
    activeTab = tab;
    if (!activeProfile) return;
    const userId = activeUser.id;
    let inner = '';
    if (tab === 'mediciones' || tab === 'resumen') {
      const { data, error } = await client.from('body_measurements').select('*').eq('patient_id', userId).order('measured_on', { ascending: false }).limit(24);
      if (error) throw error;
      const latest = data?.[0];
      inner = `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>${tab === 'resumen' ? 'Última valoración' : 'Mediciones y evolución'}</h3><span>${latest ? escapeHtml(dateLabel(latest.measured_on)) : 'SIN VALORACIONES'}</span></div>
        <div class="metric-grid">${metric('PESO', latest?.weight_kg, 'kg')}${metric('GRASA CORPORAL', latest?.body_fat_pct, '%')}${metric('MASA MUSCULAR', latest?.muscle_mass_kg, 'kg')}${metric('IMC', latest?.weight_kg && latest?.height_cm ? (Number(latest.weight_kg)/(Number(latest.height_cm)/100)**2).toFixed(1) : null, '')}${metric('CINTURA', latest?.waist_cm, 'cm')}</div>
        ${data?.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>FECHA</th><th>PESO</th><th>ESTATURA</th><th>IMC</th><th>GRASA</th><th>MÚSCULO</th><th>CINTURA</th><th>CADERA</th></tr></thead><tbody>${data.map((row) => `<tr><td>${escapeHtml(dateLabel(row.measured_on))}</td><td>${row.weight_kg ?? '—'} kg</td><td>${row.height_cm ?? '—'} cm</td><td>${row.weight_kg && row.height_cm ? (Number(row.weight_kg)/(Number(row.height_cm)/100)**2).toFixed(1) : '—'}</td><td>${row.body_fat_pct ?? '—'} %</td><td>${row.muscle_mass_kg ?? '—'} kg</td><td>${row.waist_cm ?? '—'} cm</td><td>${row.hip_cm ?? '—'} cm</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">Tu nutriólogo todavía no publica mediciones.</p>'}
      </section>`;
      if (tab === 'resumen') {
        const { data: diet, error: dietError } = await client.from('nutrition_updates').select('id,title,published_at,created_at').eq('patient_id', userId).eq('is_published', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (dietError) throw dietError;
        const { data: appointment, error: appointmentError } = await client.from('appointments').select('scheduled_at,status,appointment_type,location_or_link').eq('patient_id', userId).in('status', ['scheduled', 'confirmed','reschedule_requested']).order('scheduled_at', { ascending: true }).limit(1).maybeSingle();
        if (appointmentError) throw appointmentError;
        inner += `<section class="dash-panel"><div class="dash-panel-head"><h3>Seguimiento actual</h3><span>${escapeHtml(serviceLabel(activeProfile.plan_code)).toUpperCase()}</span></div><div class="meal"><span class="meal-time">DIETA</span><div><b>${diet ? escapeHtml(diet.title) : 'Sin actualización publicada'}</b><small>${diet ? `Disponible desde ${escapeHtml(dateLabel(diet.published_at || diet.created_at))}` : 'Tu nutriólogo te avisará cuando esté lista.'}</small></div></div><div class="nutrition-summary">Próxima consulta <b>${appointment ? escapeHtml(dateTimeLabel(appointment.scheduled_at)) : 'Por confirmar'}</b>${appointment ? `<small>${appointment.appointment_type === 'online' ? 'En línea' : 'Presencial'} · ${escapeHtml(appointment.location_or_link || 'Lugar por confirmar')}</small>` : ''}</div></section>`;
      }
    } else if (tab === 'dieta') {
      const { data, error } = await client.from('nutrition_updates').select('*').eq('patient_id', userId).eq('is_published', true).order('created_at', { ascending: false });
      if (error) throw error;
      inner = data?.length ? data.map((item) => {
        const available = Boolean(item.diet_pdf_path) && !item.diet_pdf_downloaded_at;
        const dietText = item.diet_content && item.diet_content !== 'Consulta el PDF adjunto de tu dieta.' ? `<div class="live-plan-text">${escapeHtml(item.diet_content)}</div>` : '';
        const pdfAction = available ? `<div class="diet-pdf-actions"><button class="button button-dark" type="button" data-download-diet="${escapeHtml(item.id)}" data-file-name="${escapeHtml(item.diet_pdf_name || 'Dieta ENT.pdf')}">Descargar archivo PDF ↓</button><small>${escapeHtml(item.diet_pdf_name || 'Documento PDF')} · se elimina del almacenamiento al descargar</small></div>` : item.diet_pdf_downloaded_at || !item.diet_pdf_path ? '<p class="panel-note">El archivo se retiró del almacenamiento después de descargarse. Si necesitas otra copia, solicítala a ENT.</p>' : '';
        return `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>${escapeHtml(item.title)}</h3><span>${escapeHtml(dateLabel(item.published_at || item.created_at))}</span></div>${pdfAction}${dietText}${item.recommendations ? `<div class="panel-note">${escapeHtml(item.recommendations)}</div>` : ''}</section>`;
      }).join('') : '<section class="dash-panel dash-content-wide"><h3>Aún no hay una dieta publicada</h3><p class="panel-note">La actualización aparecerá aquí cuando tu nutriólogo la publique.</p></section>';
    } else if (tab === 'entrenamiento') {
      const { data, error } = await client.from('training_plans').select('*').eq('patient_id', userId).eq('content_type', 'plan').eq('is_published', true).order('created_at', { ascending: false });
      if (error) throw error;
      inner = data?.length ? data.map((item) => `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>${escapeHtml(item.title)}</h3><span>${escapeHtml(dateLabel(item.published_at || item.created_at))}</span></div><div class="diet-pdf-actions"><button class="button button-dark" data-download-training="${escapeHtml(item.id)}" data-file-name="${escapeHtml(item.training_pdf_name||'Entrenamiento ENT.pdf')}">Descargar PDF ↓</button><small>El PDF se borra del almacenamiento al descargarlo.</small></div>${item.plan_content?`<div class="live-plan-text">${escapeHtml(item.plan_content)}</div>`:''}</section>`).join('') : '<section class="dash-panel dash-content-wide"><h3>Sin plan de entrenamiento publicado</h3><p class="panel-note">Tu nutriólogo publicará aquí una rutina personalizada cuando forme parte de tu seguimiento.</p></section>';
    } else if (tab === 'antropometria') {
      const { data, error } = await client.from('body_measurements').select('*').eq('patient_id',userId).order('measured_on',{ascending:false}).limit(24);
      if(error)throw error;
      const fields=[['triceps_skinfold_mm','Pliegue tricipital','mm'],['biceps_skinfold_mm','Pliegue bicipital','mm'],['subscapular_skinfold_mm','Pliegue subescapular','mm'],['suprailiac_skinfold_mm','Pliegue suprailiaco','mm'],['supraspinale_skinfold_mm','Pliegue supraespinal','mm'],['abdominal_skinfold_mm','Pliegue abdominal','mm'],['thigh_skinfold_mm','Pliegue muslo','mm'],['medial_calf_skinfold_mm','Pliegue pantorrilla medial','mm'],['arm_relaxed_cm','Circunferencia brazo relajado','cm'],['arm_flexed_cm','Circunferencia brazo contracción','cm'],['forearm_cm','Circunferencia antebrazo','cm'],['wrist_cm','Circunferencia muñeca','cm'],['waist_cm','Circunferencia cintura','cm'],['hip_cm','Circunferencia cadera','cm'],['thigh_cm','Circunferencia muslo','cm'],['calf_cm','Circunferencia pantorrilla','cm'],['humerus_breadth_cm','Diámetro húmero','cm'],['wrist_bistyloid_breadth_cm','Diámetro biestiloideo muñeca','cm'],['femur_breadth_cm','Diámetro fémur','cm']];
      inner=`<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Antropometría</h3><span>${data?.[0]?escapeHtml(dateLabel(data[0].measured_on)):'SIN VALORACIONES'}</span></div>${data?.length?data.map(row=>`<h4>${escapeHtml(dateLabel(row.measured_on))}</h4><div class="metric-grid">${fields.map(([key,label,unit])=>metric(label,row[key],unit)).join('')}</div>`).join(''):'<p class="panel-note">Tu nutriólogo todavía no publica mediciones antropométricas.</p>'}</section>`;
    } else if (tab === 'faq') {
      const {data,error}=await client.from('faq_visual').select('image_path,image_name,updated_at').eq('id',1).maybeSingle();
      if(error)throw error;
      let url=''; if(data?.image_path){const result=client.storage.from('ent-faq-images').getPublicUrl(data.image_path);url=result.data?.publicUrl||'';}
      inner=`<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Preguntas frecuentes</h3><span>GUÍA ENT</span></div>${url?`<img class="faq-visual" src="${escapeHtml(url)}" alt="Preguntas frecuentes ENT">`:'<p class="panel-note">ENT publicará aquí su guía de preguntas frecuentes.</p>'}</section>`;
    } else if (tab === 'lifestyle') {
      const { data, error } = await client.from('lifestyle_library').select('id,title,youtube_url,created_at').order('created_at',{ascending:false});
      if(error)throw error;
      inner=`<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Lifestyle</h3><span>PARA PACIENTES ACTIVOS</span></div>${data?.length?data.map(item=>{let safe='';try{const u=new URL(item.youtube_url);if(u.protocol==='https:'&&['youtube.com','www.youtube.com','youtu.be'].includes(u.hostname))safe=u.href}catch(_){}return `<article class="patient-record-item"><h4>${escapeHtml(item.title)}</h4>${safe?`<a class="button button-outline" href="${escapeHtml(safe)}" target="_blank" rel="noopener">Ver contenido en YouTube ↗</a>`:''}</article>`}).join(''):'<p class="panel-note">El contenido Lifestyle aparecerá aquí.</p>'}</section>`;
    } else if (tab === 'lifestyle') {
      const { data, error } = await client.from('patient_notifications').select('title,message,created_at').eq('patient_id', userId).eq('category', 'lifestyle').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      inner = `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Lifestyle</h3><span>CONTENIDO PARA TI</span></div>${data?.length ? data.map((item) => `<article class="patient-record-item"><div class="dash-panel-head"><h4>${escapeHtml(item.title)}</h4><span>${escapeHtml(dateLabel(item.created_at))}</span></div><div class="live-plan-text lifestyle-copy">${escapeHtml(item.message)}</div></article>`).join('') : '<p class="panel-note">El contenido Lifestyle que tu nutriólogo prepare aparecerá aquí.</p>'}</section>`;
    } else if (tab === 'citas') {
      const { data, error } = await client.from('appointments').select('scheduled_at,appointment_type,location_or_link,status').eq('patient_id', userId).order('scheduled_at', { ascending: false });
      if (error) throw error;
      inner = `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Mis consultas</h3><span>HISTORIAL</span></div>${data?.length ? data.map((item) => `<div class="hist-row"><span><b>${escapeHtml(dateTimeLabel(item.scheduled_at))}</b><br><small>${item.appointment_type === 'online' ? 'En línea' : 'Presencial'} · ${escapeHtml(item.status)}</small></span><small>${escapeHtml(item.location_or_link || 'Lugar por confirmar')}</small></div>`).join('') : '<p class="panel-note">Aún no hay consultas registradas.</p>'}</section>`;
    } else if (tab === 'avisos') {
      const {data:globalConfig,error:globalError}=await client.from('site_configuration').select('announcement_title,announcement_body,announcement_active,announcement_starts_at,announcement_ends_at').eq('id',1).maybeSingle();if(globalError)throw globalError;
      const now=new Date();const showAnnouncement=globalConfig?.announcement_active&&(!globalConfig.announcement_starts_at||new Date(globalConfig.announcement_starts_at)<=now)&&(!globalConfig.announcement_ends_at||new Date(globalConfig.announcement_ends_at)>=now);
      const {data:appointments,error:appointmentError}=await client.from('appointments').select('id,scheduled_at,status,appointment_type,location_or_link').eq('patient_id',userId).in('status',['scheduled','confirmed','reschedule_requested']).gte('scheduled_at',new Date().toISOString()).order('scheduled_at',{ascending:true}).limit(5);
      if(appointmentError)throw appointmentError;
      const [{ data: notices, error }, { data: reads, error: readsError }] = await Promise.all([
        client.from('patient_notifications').select('id,category,title,message,created_at').eq('patient_id', userId).neq('category', 'lifestyle').order('created_at', { ascending: false }).limit(50),
        client.from('patient_notification_reads').select('notification_id').eq('patient_id', userId)
      ]);
      if (error) throw error;if(readsError)throw readsError;
      const seen = new Set((reads || []).map((row) => row.notification_id));
      inner = `${showAnnouncement?`<section class="dash-panel dash-content-wide global-announcement"><div class="dash-panel-head"><h3>${escapeHtml(globalConfig.announcement_title||'Aviso de ENT')}</h3><span>AVISO GENERAL</span></div><p>${escapeHtml(globalConfig.announcement_body||'')}</p></section>`:''}<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Notificaciones de tu perfil</h3><span>${(notices||[]).filter(row=>!seen.has(row.id)).length} NUEVAS</span></div>${appointments?.map(a=>`<article class="notice-row is-unread"><span class="notice-dot"></span><div><small>RECORDATORIO DE CONSULTA</small><h4>Hola ${escapeHtml(activeProfile.full_name.split(' ')[0])}, reservamos este espacio para ti</h4><p>Tu consulta es el ${escapeHtml(dateTimeLabel(a.scheduled_at))}. Confirma o solicita reagenda con al menos 48 horas. Si ya falta menos tiempo, revisa las políticas del consultorio antes de pedir cambios.</p>${a.status==='scheduled'?'<button class="button button-dark" data-appointment-response="confirmed" data-appointment-id="'+escapeHtml(a.id)+'">Confirmar cita</button> <button class="button button-outline" data-appointment-response="reschedule_requested" data-appointment-id="'+escapeHtml(a.id)+'">Solicitar reagenda</button>':a.status==='confirmed'?'<b>✓ Cita confirmada</b>':'<b>Solicitud de reagenda recibida</b>'}</div></article>`).join('')||''}${notices?.length ? notices.map((item) => `<article class="notice-row ${seen.has(item.id)?'is-read':'is-unread'}"><span class="notice-dot"></span><div><small>${escapeHtml(dateTimeLabel(item.created_at))} · ${escapeHtml(item.category)}</small><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.message)}</p>${seen.has(item.id)?'':'<button class="text-link" data-mark-read="'+escapeHtml(item.id)+'">Marcar como leída</button>'}</div></article>`).join('') : '<p class="panel-note">Aquí aparecerán los avisos de tu plan, mediciones y consultas.</p>'}</section>`;
    }
    content.querySelector('#patient-live-content').innerHTML = inner;
  };

  const renderPatient = async () => {
    const name = activeProfile.full_name || activeUser.email || 'Paciente';
    showModal(`<div class="dashboard">
      <div class="dashboard-header"><div><div class="modal-kicker">PORTAL DE PACIENTE</div><div class="profile-head"><div class="avatar"><span>${escapeHtml(name.slice(0, 1).toUpperCase())}</span></div><div><h2 id="modal-title">${escapeHtml(name)}</h2><p>${escapeHtml(activeProfile.age ?? '—')} años · ${escapeHtml(serviceLabel(activeProfile.plan_code))} · ${escapeHtml(activeProfile.status)}</p></div></div></div><button class="button button-outline" data-live-logout>Salir</button></div>
      <nav class="dashboard-tabs" aria-label="Secciones del perfil">${patientTabs.map((tab) => `<button class="dash-tab ${tab === activeTab ? 'active' : ''}" data-live-tab="${tab}">${tabTitle[tab]}</button>`).join('')}</nav>
      <div class="dash-grid" id="patient-live-content"><section class="dash-panel"><p class="panel-note">Cargando tu seguimiento…</p></section></div>
    </div>`);
    await patientView(activeTab);
  };

  const renderPatientRecord = async (patientId) => {
    if (activeUser?.app_metadata?.role !== 'admin') throw new Error('Acceso exclusivo para administración.');
    const results = await Promise.all([
      client.from('patient_profiles').select('*').eq('user_id', patientId).single(),
      client.from('body_measurements').select('*').eq('patient_id', patientId).order('measured_on', { ascending: false }).limit(30),
      client.from('nutrition_updates').select('title,diet_content,recommendations,diet_pdf_path,diet_pdf_name,is_published,published_at,created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20),
      client.from('training_plans').select('title,plan_content,content_type,video_url,is_published,published_at,created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20),
      client.from('appointments').select('scheduled_at,appointment_type,location_or_link,status').eq('patient_id', patientId).order('scheduled_at', { ascending: false }).limit(20),
      client.from('patient_notifications').select('category,title,message,created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(30)
    ]);
    for (const result of results) if (result.error) throw result.error;
    const [profileResult, measurementsResult, dietsResult, trainingResult, appointmentsResult, noticesResult] = results;
    const profile = profileResult.data;
    const measurements = measurementsResult.data || [];
    const diets = dietsResult.data || [];
    const dietsForDisplay = diets;
    const training = trainingResult.data || [];
    const appointments = appointmentsResult.data || [];
    const notices = noticesResult.data || [];
    const latest = measurements[0];
    const bmi = (row) => row?.weight_kg && row?.height_cm ? (Number(row.weight_kg)/(Number(row.height_cm)/100)**2).toFixed(1) : '—';
    showModal(`<div class="dashboard patient-record">
      <div class="patient-record-actions"><button class="button button-outline" type="button" data-back-patient-directory>← Volver al directorio</button><button class="button button-danger" type="button" data-toggle-patient-delete>Dar de baja y eliminar</button></div>
      <form class="patient-delete-confirm" id="admin-delete-patient-form" data-patient-id="${escapeHtml(patientId)}" data-confirm-username="${escapeHtml(profile.username||'')}" hidden>
        <h3>Eliminar expediente definitivamente</h3>
        <p>Se borrarán la cuenta de acceso, mediciones, dietas, entrenamientos, consultas, avisos y archivos privados de este paciente. Esta acción no se puede deshacer.</p>
        <label class="form-label" for="patient-delete-confirmation">Para confirmar, escribe el usuario <strong>${escapeHtml(profile.username||'')}</strong></label>
        <input class="input" id="patient-delete-confirmation" name="confirmation" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" required />
        <p class="login-error" id="patient-delete-error" role="alert" hidden></p>
        <div class="patient-delete-actions"><button class="button button-danger" type="submit" disabled>Eliminar expediente</button><button class="button button-outline" type="button" data-cancel-patient-delete>Cancelar</button></div>
      </form>
      <div class="dashboard-header"><div><div class="modal-kicker">EXPEDIENTE INDIVIDUAL</div><div class="profile-head"><div class="avatar"><span>${escapeHtml(String(profile.full_name||'P').slice(0,1).toUpperCase())}</span></div><div><h2 id="modal-title">${escapeHtml(profile.full_name)}</h2><p>${escapeHtml(profile.username||'Sin usuario')} · ${escapeHtml(serviceLabel(profile.plan_code))} · ${escapeHtml(profile.status)}</p></div></div></div></div>
      <section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Datos del paciente</h3><span>PERFIL</span></div><div class="patient-record-facts"><div><small>USUARIO</small><strong>${escapeHtml(profile.username||'—')}</strong></div><div><small>TELÉFONO / WHATSAPP</small><strong>${escapeHtml(profile.phone||'—')}</strong></div><div><small>CONSULTA O PAQUETE</small><strong>${escapeHtml(serviceLabel(profile.plan_code))}</strong></div><div><small>ESTADO</small><strong>${escapeHtml(profile.status)}</strong></div><div><small>ALTA</small><strong>${escapeHtml(dateLabel(profile.created_at))}</strong></div></div></section>
      <section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Última valoración</h3><span>${latest ? escapeHtml(dateLabel(latest.measured_on)) : 'SIN VALORACIONES'}</span></div><div class="metric-grid">${metric('PESO',latest?.weight_kg,'kg')}${metric('GRASA CORPORAL',latest?.body_fat_pct,'%')}${metric('MASA MUSCULAR',latest?.muscle_mass_kg,'kg')}${metric('IMC',bmi(latest),'')}${metric('GRASA VISCERAL',latest?.visceral_fat_index,'')}${metric('CINTURA',latest?.waist_cm,'cm')}</div>${measurements.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>FECHA</th><th>PESO</th><th>IMC</th><th>GRASA</th><th>MÚSCULO</th><th>VISCERAL</th><th>CINTURA</th><th>CADERA</th></tr></thead><tbody>${measurements.map((row)=>`<tr><td>${escapeHtml(dateLabel(row.measured_on))}</td><td>${row.weight_kg??'—'} kg</td><td>${bmi(row)}</td><td>${row.body_fat_pct??'—'} %</td><td>${row.muscle_mass_kg??'—'} kg</td><td>${row.visceral_fat_index??'—'}</td><td>${row.waist_cm??'—'} cm</td><td>${row.hip_cm??'—'} cm</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">Todavía no hay mediciones registradas.</p>'}</section>
      <section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Dietas e indicaciones</h3><span>${diets.length} ACTUALIZACIONES</span></div>${dietsForDisplay.length ? dietsForDisplay.map((item)=>`<article class="patient-record-item"><div class="dash-panel-head"><h4>${escapeHtml(item.title)}</h4><span>${escapeHtml(dateLabel(item.published_at||item.created_at))} · ${item.is_published?'PUBLICADA':'BORRADOR'}</span></div>${item.diet_pdf_path?'<p class="panel-note">PDF disponible en el portal del paciente y se elimina del almacenamiento después de su descarga.</p>':item.diet_pdf_downloaded_at?'<p class="panel-note">PDF descargado y retirado del almacenamiento.</p>':''}<div class="live-plan-text">${escapeHtml(item.diet_content)}</div>${item.recommendations?`<p class="panel-note">${escapeHtml(item.recommendations)}</p>`:''}</article>`).join('') : '<p class="panel-note">Todavía no hay dietas registradas.</p>'}</section>
      <section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Entrenamiento y clases</h3><span>${training.length} PUBLICACIONES</span></div>${training.length ? training.map((item)=>`<article class="patient-record-item"><div class="dash-panel-head"><h4>${escapeHtml(item.title)}</h4><span>${item.content_type==='class'?'CLASE':'RUTINA'} · ${escapeHtml(dateLabel(item.published_at||item.created_at))}</span></div><div class="live-plan-text">${escapeHtml(item.plan_content||'')}</div>${item.video_url?`<p><a href="${escapeHtml(item.video_url)}" target="_blank" rel="noopener noreferrer">Abrir video ↗</a></p>`:''}</article>`).join('') : '<p class="panel-note">No hay planes de entrenamiento registrados.</p>'}</section>
      <section class="dash-panel"><div class="dash-panel-head"><h3>Consultas</h3><span>HISTORIAL</span></div>${appointments.length ? appointments.map((item)=>`<div class="hist-row"><span><b>${escapeHtml(dateTimeLabel(item.scheduled_at))}</b><br><small>${item.appointment_type==='online'?'En línea':'Presencial'} · ${escapeHtml(item.status)}</small></span><small>${escapeHtml(item.location_or_link||'Lugar por confirmar')}</small></div>`).join('') : '<p class="panel-note">No hay consultas registradas.</p>'}</section>
      <section class="dash-panel"><div class="dash-panel-head"><h3>Avisos enviados</h3><span>${notices.length}</span></div>${notices.length ? notices.map((item)=>`<article class="notice-row"><span class="notice-dot"></span><div><small>${escapeHtml(dateTimeLabel(item.created_at))} · ${escapeHtml(item.category)}</small><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.message)}</p></div></article>`).join('') : '<p class="panel-note">No hay avisos registrados.</p>'}</section>
    </div>`);
  };

  const organizeAdminWorkspace = () => {
    const dashboard = content.querySelector('.dashboard');
    if (!dashboard || dashboard.querySelector('.admin-workspace-tabs')) return;
    const sections = Array.from(dashboard.querySelectorAll('.admin-section'));
    const labels = { patients: 'Pacientes', followup: 'Seguimiento', settings: 'Sitio y precios' };
    const tabs = document.createElement('nav');
    tabs.className = 'admin-workspace-tabs';
    tabs.setAttribute('aria-label', 'Secciones del administrador');
    const panels = Object.fromEntries(Object.keys(labels).map((key) => {
      const panel = document.createElement('div');
      panel.className = 'admin-workspace-panel';
      panel.dataset.adminPanel = key;
      return [key, panel];
    }));
    for (const section of sections) {
      const title = (section.querySelector('h3')?.textContent || '').toLocaleLowerCase('es');
      const group = /precio|pago|aviso general/.test(title) ? 'settings'
        : /valoraci[oó]n|dieta|entrenamiento|consulta|lifestyle|clases/.test(title) ? 'followup' : 'patients';
      panels[group].append(section);
    }
    for (const [key, label] of Object.entries(labels)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-workspace-tab';
      button.dataset.adminWorkspace = key;
      button.textContent = label;
      tabs.append(button);
    }
    const summary = dashboard.querySelector('.admin-summary-grid');
    if (summary) summary.insertAdjacentElement('afterend', tabs);
    const preview = dashboard.querySelector('.preview-callout');
    for (const key of Object.keys(labels)) dashboard.insertBefore(panels[key], preview || null);
    const showPanel = (key) => {
      activeAdminPanel = labels[key] ? key : 'patients';
      dashboard.querySelectorAll('[data-admin-panel]').forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== activeAdminPanel; });
      dashboard.querySelectorAll('[data-admin-workspace]').forEach((button) => {
        const selected = button.dataset.adminWorkspace === activeAdminPanel;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-current', selected ? 'page' : 'false');
      });
    };
    showPanel(activeAdminPanel);
  };

  const renderAdmin = async () => {
    const [profiles, applications, appointments, configuration] = await Promise.all([
      client.from('patient_profiles').select('user_id,full_name,username,phone,age,plan_code,plan_months,membership_started_on,membership_ends_on,status,created_at').order('created_at', { ascending: false }).limit(100),
      client.from('patient_applications').select('id,full_name,username,phone,age,objective,plan_code,plan_months,payment_preference,payment_proof_path,status,created_at').order('created_at', { ascending: false }).limit(100),
      client.from('appointments').select('id,patient_id,scheduled_at,status,appointment_type').in('status', ['scheduled', 'confirmed']).order('scheduled_at', { ascending: true }).limit(100),
      client.from('site_configuration').select('*').eq('id', 1).single()
    ]);
    for (const result of [profiles, applications, appointments, configuration]) if (result.error) throw result.error;
    const patients = profiles.data || [];
    const requests = await Promise.all((applications.data || []).map(async (row) => {
      if (!row.payment_proof_path) return { ...row, payment_proof_url: null };
      const { data, error } = await client.storage.from('payment-proofs').createSignedUrl(row.payment_proof_path, 3600);
      return { ...row, payment_proof_url: error ? null : data?.signedUrl || null };
    }));
    const upcoming = appointments.data || [];
    const patientById=new Map(patients.map(x=>[x.user_id,x]));
    const appointmentDirectory=`<section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Agenda y reagendas</h3><span>${upcoming.length} PRÓXIMAS</span></div>${upcoming.length?upcoming.map(a=>{const patient=patientById.get(a.patient_id)||{};return `<div class="hist-row"><span><b>${escapeHtml(patient.full_name||'Paciente')}</b><br><small>${escapeHtml(dateTimeLabel(a.scheduled_at))} · ${escapeHtml(a.status)}</small></span><button class="button button-outline" data-open-reschedule data-id="${escapeHtml(a.id)}" data-patient-id="${escapeHtml(a.patient_id)}" data-patient-name="${escapeHtml(patient.full_name||'Paciente')}" data-phone="${escapeHtml(patient.phone||'')}" data-date="${escapeHtml(a.scheduled_at)}" data-type="${escapeHtml(a.appointment_type)}">Reagendar</button></div>`}).join(''):'<p class="panel-note">No hay consultas próximas.</p>'}</section>`;
    const patientOptions = patients.map((row) => `<option value="${escapeHtml(row.user_id)}" data-phone="${escapeHtml(row.phone||'')}">${escapeHtml(row.full_name)} · ${escapeHtml(serviceLabel(row.plan_code))}</option>`).join('');
    const emptyPatientOption = patients.length ? '' : '<option value="">Primero crea una cuenta de paciente</option>';
    const settings = configuration.data;
    const sortedPatients = [...patients].sort((a,b) => String(a.full_name||'').localeCompare(String(b.full_name||''), 'es', { sensitivity: 'base' }));
    const patientDirectory = `<section class="dash-panel admin-section patient-directory-section"><div class="dash-panel-head"><div><h3>Directorio de pacientes</h3><p class="panel-note">Busca, selecciona varios expedientes para dar de baja o abre un paciente para revisar su historial.</p></div><span>${patients.length} EXPEDIENTES</span></div><label class="sr-only" for="admin-patient-search">Buscar paciente por nombre</label><input class="input patient-search" id="admin-patient-search" type="search" placeholder="Buscar por nombre…" autocomplete="off" /><div class="bulk-patient-actions"><label><input type="checkbox" data-select-all-patients aria-label="Seleccionar todos los pacientes"> Seleccionar todos</label><span data-selection-count>0 seleccionados</span><button class="button button-danger" type="button" data-bulk-delete disabled>Dar de baja seleccionados</button></div><div class="patient-directory-list" id="admin-patient-directory">${sortedPatients.length ? sortedPatients.map((row) => `<div class="patient-directory-row"><label class="patient-select"><input type="checkbox" data-select-patient="${escapeHtml(row.user_id)}" data-patient-username="${escapeHtml(row.username||'')}" data-patient-name="${escapeHtml(row.full_name)}" aria-label="Seleccionar a ${escapeHtml(row.full_name)}"></label><button class="patient-directory-item" type="button" data-open-patient="${escapeHtml(row.user_id)}"><span class="patient-directory-avatar">${escapeHtml(String(row.full_name||'P').slice(0,1).toUpperCase())}</span><span class="patient-directory-copy"><strong>${escapeHtml(row.full_name)}</strong><small>${escapeHtml(row.username||'Sin usuario')} · ${escapeHtml(row.age ?? '—')} años · ${escapeHtml(serviceLabel(row.plan_code))} · ${escapeHtml(row.status)}</small></span><span class="patient-directory-arrow">Ver expediente →</span></button></div>`).join('') : '<p class="panel-note">Aún no hay pacientes dados de alta.</p>'}</div></section>`;
    const priceField = (label, name) => `<div><label class="form-label" for="${name}">${label}</label><input class="input" id="${name}" name="${name}" type="number" min="0" step="1" value="${settings[name] ?? ''}" placeholder="MXN" /></div>`;
    showModal(`<div class="dashboard">
      <div class="dashboard-header"><div><div class="modal-kicker">PANEL DEL PROFESIONAL</div><div class="profile-head admin-profile"><img class="avatar-photo" src="assets/esteban-tellez.jpg" alt="Esteban Téllez" /><div><h2 id="modal-title">Esteban Téllez</h2><p>Administración ENT</p></div></div><p class="modal-lede" style="margin:4px 0 0">Expedientes y solicitudes reales</p></div><button class="button button-outline" data-live-logout>Salir</button></div>
      <div class="admin-summary-grid"><div><small>SOLICITUDES</small><strong>${requests.length}</strong><span>En bandeja</span></div><div><small>PACIENTES</small><strong>${patients.length}</strong><span>Expedientes</span></div><div><small>CONSULTAS</small><strong>${upcoming.length}</strong><span>Próximas</span></div></div>
      ${patientDirectory}
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Alta manual de paciente</h3><span>CUENTA CON ACCESO AL PORTAL</span></div><form class="live-admin-form" id="admin-create-patient-form"><div class="form-grid"><div><label class="form-label" for="manual-full-name">Nombre completo</label><input class="input" id="manual-full-name" name="full_name" maxlength="160" required /></div><div><label class="form-label" for="manual-username">Usuario</label><input class="input" id="manual-username" name="username" maxlength="40" pattern="[a-zA-Z0-9._-]+" required /></div><div><label class="form-label" for="manual-phone">Teléfono / WhatsApp</label><input class="input" id="manual-phone" name="phone" maxlength="40" required /></div><div><label class="form-label" for="manual-age">Edad</label><input class="input" id="manual-age" name="age" type="number" min="1" max="120" step="1" required /></div><div><label class="form-label" for="manual-plan">Consulta o paquete</label><select class="select" id="manual-plan" name="plan_code" required><option value="initial">Consulta inicial</option><option value="followup">Consulta de seguimiento</option><option value="bimonthly">Paquete bimestral · 2 consultas</option><option value="quarterly">Paquete trimestral · 3 consultas</option><option value="semester">Paquete semestral · 6 consultas</option><option value="couple">Consulta en pareja · 2 personas</option></select></div><div><label class="form-label" for="manual-password">Contraseña de acceso</label><div class="password-entry"><input class="input" id="manual-password" name="initial_password" type="password" minlength="5" maxlength="15" autocomplete="new-password" required /><button class="button button-outline password-action" type="button" data-toggle-password="manual-password" aria-label="Mostrar contraseña">Ver</button><button class="button button-outline password-action" type="button" data-copy-from="manual-password">Copiar</button></div></div></div><p class="form-note">Tú defines la contraseña (5 a 15 caracteres). Se establece al crear la cuenta; ENT no la guarda ni podrá consultarla después.</p><button class="button button-dark" type="submit">Crear acceso de paciente</button></form></section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Precios y datos de pago</h3><span>VISIBLE EN LA PORTADA</span></div><form class="live-admin-form" id="admin-config-form"><div class="dash-panel-head"><h3>Consultas presenciales · 2026</h3><span>PRECIOS PÚBLICOS EDITABLES</span></div><div class="form-grid">${priceField('Consulta inicial individual','consult_initial_price')}${priceField('Consulta seguimiento individual','consult_followup_price')}${priceField('Paquete bimestral · 2 consultas','consult_bimonthly_price')}${priceField('Paquete trimestral · 3 consultas','consult_quarterly_price')}${priceField('Paquete semestral · 6 consultas','consult_semester_price')}${priceField('Consulta en pareja · 2 personas','consult_couple_price')}</div><div><label class="form-label" for="consult-prices-until">Vigencia de precios</label><input class="input" id="consult-prices-until" name="consult_prices_valid_until" type="date" value="${settings.consult_prices_valid_until ? String(settings.consult_prices_valid_until).slice(0,10) : ''}" /></div><p class="form-note">La portada muestra estos precios y guarda cada solicitud en esta bandeja. Después, el paciente puede abrir WhatsApp y confirmar el envío del mensaje.</p><div class="form-grid"><div><label class="form-label" for="bank-account-holder">Titular de la cuenta</label><input class="input" id="bank-account-holder" name="bank_account_holder" value="${escapeHtml(settings.bank_account_holder||'')}" maxlength="180" /></div><div><label class="form-label" for="bank-name">Banco</label><input class="input" id="bank-name" name="bank_name" value="${escapeHtml(settings.bank_name||'')}" maxlength="120" /></div><div><label class="form-label" for="bank-reference-type">Tipo de dato bancario</label><select class="select" id="bank-reference-type" name="bank_reference_type"><option value="CLABE interbancaria" ${settings.bank_reference_type==='CLABE interbancaria'?'selected':''}>CLABE interbancaria</option><option value="Número de tarjeta" ${settings.bank_reference_type==='Número de tarjeta'?'selected':''}>Número de tarjeta</option></select></div><div><label class="form-label" for="bank-reference-value">CLABE o número de tarjeta</label><input class="input" id="bank-reference-value" name="bank_reference_value" value="${escapeHtml(settings.bank_reference_value||'')}" maxlength="18" inputmode="numeric" /></div><div><label class="form-label" for="bank-secondary-name">Segundo banco (opcional)</label><input class="input" id="bank-secondary-name" name="bank_secondary_name" value="${escapeHtml(settings.bank_secondary_name||'')}" maxlength="120" /></div><div><label class="form-label" for="bank-secondary-reference-type">Tipo de dato · segundo banco</label><select class="select" id="bank-secondary-reference-type" name="bank_secondary_reference_type"><option value="CLABE interbancaria" ${settings.bank_secondary_reference_type==='CLABE interbancaria'?'selected':''}>CLABE interbancaria</option><option value="Número de tarjeta" ${settings.bank_secondary_reference_type==='Número de tarjeta'?'selected':''}>Número de tarjeta</option></select></div><div><label class="form-label" for="bank-secondary-reference-value">CLABE o número de tarjeta · segundo banco</label><input class="input" id="bank-secondary-reference-value" name="bank_secondary_reference_value" value="${escapeHtml(settings.bank_secondary_reference_value||'')}" maxlength="18" inputmode="numeric" /></div><div><label class="form-label" for="admin-whatsapp">WhatsApp ENT (código de país + número)</label><input class="input" id="admin-whatsapp" name="admin_whatsapp" value="${escapeHtml(settings.admin_whatsapp||'')}" maxlength="20" placeholder="5219990000000" /></div></div><label class="form-label" for="transfer-instructions">Instrucciones de transferencia</label><textarea class="input live-textarea" id="transfer-instructions" name="transfer_instructions" maxlength="1000">${escapeHtml(settings.transfer_instructions||'')}</textarea><label class="form-label" for="office-address">Dirección del consultorio</label><textarea class="input live-textarea" id="office-address" name="office_address" maxlength="500">${escapeHtml(settings.office_address||'')}</textarea><hr><div class="dash-panel-head"><h3>Aviso general público</h3><label class="switch-label"><input type="checkbox" name="announcement_active" ${settings.announcement_active?'checked':''}> Publicar aviso</label></div><label class="form-label" for="announcement-title">Título del aviso</label><input class="input" id="announcement-title" name="announcement_title" value="${escapeHtml(settings.announcement_title||'')}" maxlength="180" /><label class="form-label" for="announcement-body">Mensaje</label><textarea class="input live-textarea" id="announcement-body" name="announcement_body" maxlength="1500">${escapeHtml(settings.announcement_body||'')}</textarea><div class="form-grid"><div><label class="form-label" for="announcement-start">Mostrar desde (opcional)</label><input class="input" id="announcement-start" name="announcement_starts_at" type="datetime-local" value="${settings.announcement_starts_at?new Date(settings.announcement_starts_at).toISOString().slice(0,16):''}" /></div><div><label class="form-label" for="announcement-end">Ocultar después de (opcional)</label><input class="input" id="announcement-end" name="announcement_ends_at" type="datetime-local" value="${settings.announcement_ends_at?new Date(settings.announcement_ends_at).toISOString().slice(0,16):''}" /></div></div><button class="button button-dark" type="submit">Guardar configuración</button></form></section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Solicitudes nuevas</h3><span>${requests.filter((row) => row.status === 'new').length} POR REVISAR</span></div>
        ${requests.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>NOMBRE</th><th>EDAD</th><th>USUARIO SOLICITADO</th><th>CONSULTA O PAQUETE</th><th>OBJETIVO</th><th>TELÉFONO</th><th>COMPROBANTE</th><th>ESTADO</th><th></th></tr></thead><tbody>${requests.map((row) => `<tr><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(row.age ?? '—')} años</td><td>${escapeHtml(row.username)}</td><td>${escapeHtml(serviceLabel(row.plan_code))}</td><td>${escapeHtml(row.objective||'—')}</td><td>${escapeHtml(row.phone)}</td><td>${row.payment_proof_path ? (row.payment_proof_url ? `<a class="text-link" href="${escapeHtml(row.payment_proof_url)}" target="_blank" rel="noopener">Ver comprobante</a>` : 'No disponible') : 'No adjunto'}</td><td>${escapeHtml(row.status)}</td><td>${row.status==='new'?`<button class="text-link" data-create-account="${escapeHtml(row.id)}" data-app-name="${escapeHtml(row.full_name)}" data-app-age="${escapeHtml(row.age ?? '')}" data-app-username="${escapeHtml(row.username||'')}" data-app-phone="${escapeHtml(row.phone)}" data-app-objective="${escapeHtml(row.objective||'')}" data-app-plan="${escapeHtml(row.plan_code)}" data-app-months="${row.plan_months}">Revisar / crear acceso</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">No hay solicitudes registradas.</p>'}
      </section>

      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Registrar valoración</h3><span>MEDICIONES</span></div>
        <form class="live-admin-form" id="admin-measurement-form"><label class="form-label" for="measurement-patient">Paciente</label><select class="select" id="measurement-patient" name="patient_id" required>${emptyPatientOption}${patientOptions}</select>
          <div class="form-grid"><div><label class="form-label" for="measurement-date">Fecha</label><input class="input" id="measurement-date" name="measured_on" type="date" required value="${new Date().toISOString().slice(0, 10)}" /></div><div><label class="form-label" for="measurement-weight">Peso (kg)</label><input class="input" id="measurement-weight" name="weight_kg" type="number" min="0" max="500" step="0.01" /></div><div><label class="form-label" for="measurement-height">Estatura (cm)</label><input class="input" id="measurement-height" name="height_cm" type="number" min="0" max="300" step="0.01" /></div><div><label class="form-label" for="measurement-fat">Grasa corporal (%)</label><input class="input" id="measurement-fat" name="body_fat_pct" type="number" min="0" max="100" step="0.01" /></div><div><label class="form-label" for="measurement-muscle">Masa muscular (kg)</label><input class="input" id="measurement-muscle" name="muscle_mass_kg" type="number" min="0" max="300" step="0.01" /></div><div><label class="form-label" for="measurement-waist">Cintura (cm)</label><input class="input" id="measurement-waist" name="waist_cm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label" for="measurement-hip">Cadera (cm)</label><input class="input" id="measurement-hip" name="hip_cm" type="number" min="0" max="300" step="0.01" /></div></div><details class="anthro-fields"><summary>Antropometría detallada</summary><div class="form-grid"><div><label class="form-label">Pliegue tricipital (mm)</label><input class="input" name="triceps_skinfold_mm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Pliegue bicipital (mm)</label><input class="input" name="biceps_skinfold_mm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Pliegue subescapular (mm)</label><input class="input" name="subscapular_skinfold_mm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Pliegue suprailiaco (mm)</label><input class="input" name="suprailiac_skinfold_mm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Pliegue supraespinal (mm)</label><input class="input" name="supraspinale_skinfold_mm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Pliegue abdominal (mm)</label><input class="input" name="abdominal_skinfold_mm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Pliegue muslo (mm)</label><input class="input" name="thigh_skinfold_mm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Pliegue pantorrilla medial (mm)</label><input class="input" name="medial_calf_skinfold_mm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Circunferencia brazo relajado (cm)</label><input class="input" name="arm_relaxed_cm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Circunferencia brazo contraído (cm)</label><input class="input" name="arm_flexed_cm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Circunferencia antebrazo (cm)</label><input class="input" name="forearm_cm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Circunferencia muñeca (cm)</label><input class="input" name="wrist_cm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Circunferencia cadera (cm)</label><input class="input" name="hip_cm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Circunferencia muslo (cm)</label><input class="input" name="thigh_cm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Circunferencia pantorrilla (cm)</label><input class="input" name="calf_cm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Diámetro húmero (cm)</label><input class="input" name="humerus_breadth_cm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Diámetro biestiloideo muñeca (cm)</label><input class="input" name="wrist_bistyloid_breadth_cm" type="number" min="0" max="300" step="0.1" /></div><div><label class="form-label">Diámetro fémur (cm)</label><input class="input" name="femur_breadth_cm" type="number" min="0" max="300" step="0.1" /></div></div></details>
          <button class="button button-dark" type="submit" ${patients.length ? '' : 'disabled'}>Guardar medición</button>
        </form>
      </section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Publicar dieta</h3><span>ACTUALIZACIÓN PARA PACIENTE</span></div>
        <form class="live-admin-form" id="admin-diet-form"><label class="form-label" for="diet-patient">Paciente</label><select class="select" id="diet-patient" name="patient_id" required>${emptyPatientOption}${patientOptions}</select>
          <label class="form-label" for="diet-title">Título</label><input class="input" id="diet-title" name="title" maxlength="180" required placeholder="Ej. Plan de alimentación · noviembre" />
          <label class="form-label" for="diet-pdf">Archivo PDF de la dieta</label><input class="input" id="diet-pdf" name="diet_pdf" type="file" accept="application/pdf,.pdf" required /><small class="photo-upload-hint">PDF · máximo 10 MB · solo será visible para este paciente y ENT.</small>
          <label class="form-label" for="diet-content">Resumen e indicaciones (opcional)</label><textarea class="input live-textarea" id="diet-content" name="diet_content" placeholder="Puedes añadir aquí indicaciones breves que acompañen al PDF."></textarea>
          <label class="form-label" for="diet-recommendations">Recomendaciones adicionales</label><textarea class="input live-textarea" id="diet-recommendations" name="recommendations"></textarea>
          <button class="button button-dark" type="submit" ${patients.length ? '' : 'disabled'}>Publicar actualización</button>
        </form>
      </section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Publicar entrenamiento</h3><span>RUTINAS PERSONALIZADAS</span></div>
        <form class="live-admin-form" id="admin-training-form"><label class="form-label" for="training-patient">Paciente</label><select class="select" id="training-patient" name="patient_id" required>${emptyPatientOption}${patientOptions}</select>
          <label class="form-label" for="training-title">Título</label><input class="input" id="training-title" name="title" maxlength="180" required placeholder="Ej. Rutina · bloque 1" />
          <label class="form-label" for="training-content">Entrenamiento e indicaciones</label><textarea class="input live-textarea" id="training-content" name="plan_content"></textarea><label class="form-label" for="training-pdf">PDF del entrenamiento</label><input class="input" id="training-pdf" name="training_pdf" type="file" accept="application/pdf,.pdf" required /><small class="photo-upload-hint">Máximo 10 MB. Se elimina del almacenamiento tras la descarga del paciente.</small>
          <button class="button button-dark" type="submit" ${patients.length ? '' : 'disabled'}>Publicar entrenamiento</button>
        </form>
      </section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Lifestyle para todos</h3><span>CONTENIDO GENERAL</span></div>
        <form class="live-admin-form lifestyle-admin-form" id="admin-lifestyle-form">
          <p class="panel-note">Agrega uno o varios temas. Cada tema se publicará en el portal de todos los pacientes activos.</p>
          <div class="lifestyle-entry-list">
            <div class="lifestyle-entry">
              <label class="lifestyle-entry-label">Tema 1</label>
              <input class="input" name="title" maxlength="160" required placeholder="Título del tema" aria-label="Título del tema 1" />
              <input class="input" name="youtube_url" type="text" inputmode="url" autocomplete="url" maxlength="500" required placeholder="youtube.com/watch?v=… o youtu.be/…" aria-label="Enlace de YouTube del tema 1" />
              <button class="button button-outline lifestyle-remove" type="button" data-lifestyle-remove hidden>Quitar tema</button>
            </div>
          </div>
          <div class="lifestyle-form-actions">
            <button class="button button-outline" type="button" data-lifestyle-add>+ Agregar otro tema</button>
            <button class="button button-dark" type="submit">Guardar temas Lifestyle</button>
          </div>
        </form><div id="admin-lifestyle-list"></div>
      </section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Preguntas frecuentes</h3><span>IMAGEN COMPARTIDA</span></div>
        <form class="live-admin-form" id="admin-faq-form"><label class="form-label">Subir imagen de preguntas frecuentes</label><input class="input" name="faq_image" type="file" accept="image/*" required /><button class="button button-dark" type="submit">Publicar imagen</button></form><div id="admin-faq-preview"></div>
      </section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Agendar consulta</h3><span>AGENDA</span></div>
        <form class="live-admin-form" id="admin-appointment-form"><label class="form-label" for="appointment-patient">Paciente</label><select class="select" id="appointment-patient" name="patient_id" required>${emptyPatientOption}${patientOptions}</select>
          <div class="form-grid"><div><label class="form-label" for="appointment-date-time">Fecha y hora</label><input class="input" id="appointment-date-time" name="scheduled_at" type="datetime-local" lang="en-US" step="900" required /></div><div><label class="form-label" for="appointment-type">Modalidad</label><select class="select" id="appointment-type" name="appointment_type" required><option value="" disabled selected>Elige modalidad</option><option value="in_person">Presencial</option><option value="online">En línea</option></select></div></div>
          <label class="form-label" for="appointment-location">Dirección o enlace</label><input class="input" id="appointment-location" name="location_or_link" maxlength="500" minlength="3" required />
          <button class="button button-dark" type="submit" ${patients.length ? '' : 'disabled'}>Guardar consulta</button>
        </form>
      </section>
      ${appointmentDirectory}<div class="preview-callout">Cada valoración, dieta, entrenamiento, Lifestyle, aviso y consulta se guarda o comparte desde ENT.</div>
    </div>`);
    organizeAdminWorkspace();
    const lifeList=content.querySelector('#admin-lifestyle-list');
    if(lifeList){
      const {data,error}=await client.from('lifestyle_library').select('id,title,youtube_url,created_at').order('created_at',{ascending:false});
      if(error)throw error;
      lifeList.innerHTML=data?.length?data.map(x=>`<div class="hist-row"><b>${escapeHtml(x.title)}</b><a href="${escapeHtml(x.youtube_url)}" target="_blank" rel="noopener">Abrir ↗</a><button class="button button-danger" data-delete-lifestyle="${escapeHtml(x.id)}">Eliminar</button></div>`).join(''):'<p class="panel-note">Aún no hay temas Lifestyle. Agrega un título y un enlace de YouTube.</p>';
    }
  };

  const setLoginError = (message) => {
    const box = content.querySelector('#ent-login-error');
    if (box) { box.textContent = message; box.hidden = false; return; }
    const panel = content.querySelector('#patient-live-content');
    if (panel) panel.innerHTML = `<section class="dash-panel"><p class="login-error" role="alert">${escapeHtml(message)}</p></section>`;
    else content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<p class="login-error live-notice" role="alert">${escapeHtml(message)}</p>`);
  };
  const showApplicationAccessForm = (application) => showModal(`<div class="dashboard login-wrap">
    <div class="modal-kicker">ALTA DE PACIENTE · SOLICITUD EN LÍNEA</div><h2 id="modal-title">${escapeHtml(application.name)}</h2>
    <p class="modal-lede">Al confirmar, se creará el acceso y se abrirá WhatsApp con la contraseña, la cita y el enlace al portal listos. Pulsa Enviar en WhatsApp para entregarlos.</p>
    <form id="admin-application-create-form" class="live-admin-form">
      <input type="hidden" name="application_id" value="${escapeHtml(application.id)}" />
      <div class="form-grid"><div><label class="form-label" for="application-username">Usuario</label><input class="input" id="application-username" value="${escapeHtml(application.username)}" readonly /></div><div><label class="form-label" for="application-phone">WhatsApp</label><input class="input" id="application-phone" value="${escapeHtml(application.phone)}" readonly /></div><div><label class="form-label" for="application-age">Edad</label><input class="input" id="application-age" value="${escapeHtml(application.age ?? '—')} años" readonly /></div></div>
      <p class="form-note">Servicio: ${escapeHtml(serviceLabel(application.plan))} · ${escapeHtml(application.months)} mes(es).<br>Objetivo: ${escapeHtml(application.objective||'No especificado')}.</p><div class="form-grid"><div><label class="form-label" for="application-appointment-date">Fecha y hora de consulta</label><input class="input" id="application-appointment-date" name="scheduled_at" type="datetime-local" required /></div><div><label class="form-label" for="application-appointment-type">Modalidad</label><select class="select" id="application-appointment-type" name="appointment_type" required><option value="" disabled selected>Elige modalidad</option><option value="in_person">Presencial</option><option value="online">En línea</option></select></div></div><label class="form-label" for="application-appointment-location">Dirección o enlace</label><input class="input" id="application-appointment-location" name="location_or_link" maxlength="500" required minlength="3" placeholder="Dirección del consultorio o enlace de consulta" />
      <label class="form-label" for="application-password">Contraseña de acceso · 5 a 15 caracteres</label><div class="password-entry"><input class="input" id="application-password" name="initial_password" type="password" minlength="5" maxlength="15" autocomplete="new-password" required /><button class="button button-outline password-action" type="button" data-toggle-password="application-password" aria-label="Mostrar contraseña">Ver</button><button class="button button-outline password-action" type="button" data-copy-from="application-password">Copiar</button></div>
      <button class="button button-dark form-submit" type="submit">Crear cuenta y expediente →</button>
    </form><div class="patient-delete-confirm"><h3>Solicitud no aceptada</h3><p>Rechazar y eliminar quitará esta solicitud y el comprobante asociado de ENT.</p><button class="button button-danger" type="button" data-reject-application="${escapeHtml(application.id)}">Rechazar y eliminar solicitud</button></div><button class="button button-outline form-submit" type="button" data-cancel-create-access>Volver al administrador</button>
  </div>`);
  const createPatientAccount = async (payload) => {
    const opensWhatsApp = Boolean(payload.application_id);
    const notificationTab = opensWhatsApp ? window.open('about:blank', '_blank') : null;
    if (opensWhatsApp && !notificationTab) throw new Error('Permite ventanas emergentes para ENT e inténtalo de nuevo. No se creó el acceso.');
    const { data, error } = await client.functions.invoke('admin-create-patient', { body: payload });
    if (error) { notificationTab?.close(); throw error; }
    if (!data || data.error) { notificationTab?.close(); throw new Error(data?.error || 'No fue posible crear la cuenta.'); }
    await renderAdmin();
    const digits = String(data.phone || '').replace(/\D/g, '');
    const whatsappPhone = digits.length === 10 ? '52' + digits : digits;
    const notificationSent = opensWhatsApp && data.whatsapp_consent === true && /^\d{10,15}$/.test(whatsappPhone);
    if (notificationSent) {
      const appointmentDate = data.scheduled_at ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(data.scheduled_at)) : 'Pendiente';
      const appointmentMode = data.appointment_type === 'online' ? 'En línea' : 'Presencial';
      const message = [
        'Hola ' + data.full_name + ', tu acceso al portal ENT está listo.',
        'Usuario: ' + data.username,
        'Contraseña inicial: ' + data.initial_password,
        'Cita: ' + appointmentDate,
        'Modalidad: ' + appointmentMode,
        'Lugar o enlace: ' + (data.location_or_link || 'Por confirmar'),
        'Ingresa en https://ent2026.github.io/ent-nutricion-portal/paciente.html',
      ].join('\n');
      notificationTab.location.href = 'https://wa.me/' + whatsappPhone + '?text=' + encodeURIComponent(message);
    } else notificationTab?.close();
    const notificationText = notificationSent
      ? 'WhatsApp se abrió con la confirmación, la cita y las credenciales listas. Pulsa Enviar en WhatsApp para entregarlas al paciente.'
      : opensWhatsApp
        ? 'El acceso se creó, pero esta solicitud no tiene autorización de WhatsApp registrada.'
        : 'Alta manual: se creó el acceso. Esta cuenta no está vinculada a una solicitud con autorización de WhatsApp.';
    content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<section class="credential-reveal" role="status"><b>Acceso creado</b><span>${escapeHtml(notificationText)}</span><span>Usuario</span><div class="password-entry"><input class="input" id="created-username" value="${escapeHtml(data.username)}" readonly /><button class="button button-outline password-action" type="button" data-copy-from="created-username">Copiar</button></div><span>Contraseña</span><div class="password-entry"><input class="input" id="created-password" type="password" value="${escapeHtml(data.initial_password)}" readonly /><button class="button button-outline password-action" type="button" data-toggle-password="created-password" aria-label="Ocultar contraseña">Ocultar</button><button class="button button-outline password-action" type="button" data-copy-from="created-password">Copiar</button></div><small>La contraseña se muestra una sola vez en el administrador. ${data.scheduled_at ? 'La confirmación también incluye la fecha, hora, modalidad y ubicación de la cita.' : ''}</small></section>`);
  };
  const promoteInitialAdmin = async () => {
    const { data, error } = await client.functions.invoke('ent-admin-bootstrap');
    if (error || data?.error) throw new Error('No se pudo habilitar el acceso inicial. Confirma el correo autorizado e inténtalo otra vez.');
    const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
    if (refreshError || !refreshed?.session?.user) throw new Error('Se habilitó la cuenta, pero no se pudo actualizar la sesión. Inicia sesión de nuevo.');
    return refreshed.session.user;
  };
  let entRealtimeChannel=null, entRealtimeTimer=null;
  const startEntRealtime=()=>{
    if(!client||!activeUser)return;
    if(entRealtimeChannel)client.removeChannel(entRealtimeChannel);
    const role=activeUser.app_metadata?.role;
    const tables=['patient_profiles','patient_applications','body_measurements','nutrition_updates','training_plans','appointments','patient_notifications','patient_notification_reads','site_configuration','lifestyle_library','faq_visual'];
    let ch=client.channel('ent-live-'+activeUser.id);
    for(const table of tables){
      const ownerColumn=table==='patient_profiles'?'user_id':'patient_id';
      const filter=role==='patient'&&['patient_profiles','body_measurements','nutrition_updates','training_plans','appointments','patient_notifications','patient_notification_reads'].includes(table)?{event:'*',schema:'public',table,filter:ownerColumn+'=eq.'+activeUser.id}:{event:'*',schema:'public',table};
      ch=ch.on('postgres_changes',filter,()=>{
        clearTimeout(entRealtimeTimer);
        entRealtimeTimer=setTimeout(async()=>{
          if(!activeUser||content.querySelector('#created-password'))return;
          try{if(activeUser.app_metadata?.role==='admin')await renderAdmin();else await renderPatient(activeTab)}catch(err){console.error('ENT realtime refresh failed',err)}
        },180);
      });
    }
    entRealtimeChannel=ch.subscribe();
  };
  const enterPortal = async (user) => {
    activeUser = user;
    if (requestedView === 'admin') {
      if (user.app_metadata?.role !== 'admin') {
        if (String(user.email || '').toLowerCase() !== ADMIN_EMAIL) {
          await client.auth.signOut();
          setLoginError('Esta cuenta no tiene permisos de administrador.');
          return;
        }
        try { user = await promoteInitialAdmin(); activeUser = user; }
        catch (error) {
          await client.auth.signOut();
          setLoginError(error.message || 'No se pudo activar la cuenta de administración.');
          return;
        }
      }
      await renderAdmin();startEntRealtime();
      return;
    }
    if (user.app_metadata?.role === 'admin') {
      await client.auth.signOut();
      setLoginError('Usa el acceso de administrador para esta cuenta.');
      return;
    }
    const { data, error } = await client.from('patient_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      await client.auth.signOut();
      setLoginError('La cuenta todavía no tiene un expediente activo. Contacta a ENT.');
      return;
    }
    activeProfile = data;
    activeTab = 'resumen';
    await renderPatient();startEntRealtime();
  };

  document.addEventListener('click', async (event) => {
    const dietDownload = event.target.closest('[data-download-diet], [data-download-training]');
    if (dietDownload) {
      event.preventDefault(); event.stopImmediatePropagation();
      const button = dietDownload;
      const isTraining = button.hasAttribute('data-download-training');
      const updateId = isTraining ? button.dataset.downloadTraining : button.dataset.downloadDiet;
      const filename = String(button.dataset.fileName || (isTraining ? 'Entrenamiento ENT.pdf' : 'Dieta ENT.pdf')).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 150);
      button.disabled = true; button.textContent = 'Preparando descarga…';
      try {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError || !sessionData?.session?.access_token) throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
        const response = await fetch(`${config.url}/functions/v1/download-diet-pdf`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionData.session.access_token}`, 'apikey': config.publishableKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ update_id: updateId, type: isTraining ? 'training' : 'diet' })
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'No se pudo preparar el PDF. Intenta de nuevo o contacta a ENT.');
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = filename;
        document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
        await patientView(isTraining ? 'entrenamiento' : 'dieta');
        content.querySelector('#patient-live-content')?.insertAdjacentHTML('afterbegin', '<p class="admin-success" role="status">PDF descargado. El archivo ya se retiró del almacenamiento de ENT.</p>');
      } catch (error) {
        button.disabled = false; button.textContent = 'Reintentar descarga';
        content.querySelector('#patient-live-content')?.insertAdjacentHTML('afterbegin', `<p class="login-error" role="alert">${escapeHtml(error.message || 'No se pudo descargar el archivo.')}</p>`);
      }
      return;
    }
    const reschedule=event.target.closest('[data-open-reschedule]');
    if(reschedule){
      event.preventDefault();event.stopImmediatePropagation();
      const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
      const dt=fmt.format(new Date(reschedule.dataset.date)).replace(' ','T');
      const min=fmt.format(new Date()).replace(' ','T');
      showModal('<div class="dashboard login-wrap"><div class="modal-kicker">AGENDA ENT</div><h2 id="modal-title">Reagendar consulta</h2><p class="modal-lede">'+escapeHtml(reschedule.dataset.patientName)+'</p><form class="live-admin-form" id="admin-reschedule-form"><input type="hidden" name="appointment_id" value="'+escapeHtml(reschedule.dataset.id)+'"><input type="hidden" name="patient_id" value="'+escapeHtml(reschedule.dataset.patientId)+'"><input type="hidden" name="patient_name" value="'+escapeHtml(reschedule.dataset.patientName)+'"><label class="form-label" for="reschedule-date">Nueva fecha y hora</label><input class="input" id="reschedule-date" name="scheduled_at" type="datetime-local" lang="en-US" step="900" min="'+min+'" value="'+dt+'" required><button class="button button-dark form-submit" type="submit">Guardar nueva cita</button></form></div>');
      return;
    }
    const rejectApplication=event.target.closest('[data-reject-application]');
    if(rejectApplication){
      event.preventDefault();event.stopImmediatePropagation();
      if(!window.confirm('¿Rechazar y eliminar esta solicitud y su comprobante de pago? Esta acción no se puede deshacer.'))return;
      rejectApplication.disabled=true;rejectApplication.textContent='Eliminando…';
      const id=rejectApplication.dataset.rejectApplication;
      const {data:application,error:readError}=await client.from('patient_applications').select('payment_proof_path').eq('id',id).maybeSingle();
      if(readError||!application){setLoginError('No se pudo encontrar la solicitud.');return;}
      if(application.payment_proof_path){const {error:removeError}=await client.storage.from('payment-proofs').remove([application.payment_proof_path]);if(removeError){setLoginError('No se pudo borrar el comprobante. La solicitud sigue intacta.');rejectApplication.disabled=false;return;}}
      const {error}=await client.from('patient_applications').delete().eq('id',id);
      if(error){setLoginError('No se pudo borrar la solicitud. Intenta de nuevo.');rejectApplication.disabled=false;return;}
      await renderAdmin();content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin','<p class="admin-success">Solicitud y comprobante eliminados.</p>');return;
    }
    const lifestyleAdd=event.target.closest('[data-lifestyle-add]');
    if(lifestyleAdd){
      event.preventDefault();event.stopImmediatePropagation();
      const list=content.querySelector('#admin-lifestyle-form .lifestyle-entry-list');
      if(!list)return;
      const number=list.querySelectorAll('.lifestyle-entry').length+1;
      list.insertAdjacentHTML('beforeend',`<div class="lifestyle-entry">
        <label class="lifestyle-entry-label">Tema ${number}</label>
        <input class="input" name="title" maxlength="160" required placeholder="Título del tema" aria-label="Título del tema ${number}" />
        <input class="input" name="youtube_url" type="text" inputmode="url" autocomplete="url" maxlength="500" required placeholder="youtube.com/watch?v=… o youtu.be/…" aria-label="Enlace de YouTube del tema ${number}" />
        <button class="button button-outline lifestyle-remove" type="button" data-lifestyle-remove>Quitar tema</button>
      </div>`);
      return;
    }
    const lifestyleRemove=event.target.closest('[data-lifestyle-remove]');
    if(lifestyleRemove){
      event.preventDefault();event.stopImmediatePropagation();
      lifestyleRemove.closest('.lifestyle-entry')?.remove();
      const entries=content.querySelectorAll('#admin-lifestyle-form .lifestyle-entry');
      entries.forEach((entry,index)=>{
        const number=index+1;
        entry.querySelector('.lifestyle-entry-label').textContent=`Tema ${number}`;
        entry.querySelector('input[name="title"]').setAttribute('aria-label',`Título del tema ${number}`);
        entry.querySelector('input[name="youtube_url"]').setAttribute('aria-label',`Enlace de YouTube del tema ${number}`);
        entry.querySelector('[data-lifestyle-remove]').hidden=entries.length===1;
      });
      return;
    }
    const lifestyleDelete=event.target.closest('[data-delete-lifestyle]');
    if(lifestyleDelete){
      event.preventDefault();event.stopImmediatePropagation();
      if(!window.confirm('¿Eliminar este contenido Lifestyle para todos los pacientes?'))return;
      const {error}=await client.from('lifestyle_library').delete().eq('id',lifestyleDelete.dataset.deleteLifestyle);
      if(error){setLoginError('No se pudo eliminar el tema.');return;}
      await renderAdmin();return;
    }
    const bulkDelete = event.target.closest('[data-bulk-delete]');
    if (bulkDelete) {
      event.preventDefault(); event.stopImmediatePropagation();
      const selected = [...content.querySelectorAll('[data-select-patient]:checked')].map((check) => ({
        patient_id: check.dataset.selectPatient, confirm_username: check.dataset.patientUsername,
        full_name: check.dataset.patientName,
      }));
      if (!selected.length) return;
      const phrase = `ELIMINAR ${selected.length}`;
      if (window.prompt(`Se eliminarán permanentemente ${selected.length} expedientes, sus accesos, archivos privados y todo su historial. Escribe ${phrase} para continuar.`) !== phrase) return;
      if (!window.confirm(`Confirma la baja definitiva de: ${selected.map((patient) => patient.full_name).join(', ')}.`)) return;
      bulkDelete.disabled = true; bulkDelete.textContent = 'Procesando…';
      let removed = 0; const failed = [];
      for (const patient of selected) {
        try {
          const { data, error } = await client.functions.invoke('admin-delete-patient', { body: { patient_id: patient.patient_id, confirm_username: patient.confirm_username } });
          if (error || data?.error || !data?.success) throw new Error(data?.error || 'No se pudo eliminar.');
          removed += 1;
        } catch { failed.push(patient.full_name); }
      }
      await renderAdmin();
      const message = failed.length
        ? `Se eliminaron ${removed} expedientes. No se pudo completar la baja de: ${failed.join(', ')}. Revisa esos expedientes e inténtalo de nuevo.`
        : `Se eliminaron ${removed} expedientes con su acceso, archivos e historial.`;
      content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<p class="${failed.length ? 'login-error' : 'admin-success'}" role="status">${escapeHtml(message)}</p>`);
      return;
    }
    const workspaceTab = event.target.closest('[data-admin-workspace]');
    if (workspaceTab) {
      event.preventDefault(); event.stopImmediatePropagation();
      activeAdminPanel = workspaceTab.dataset.adminWorkspace;
      const dashboard = content.querySelector('.dashboard');
      dashboard?.querySelectorAll('[data-admin-panel]').forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== activeAdminPanel; });
      dashboard?.querySelectorAll('[data-admin-workspace]').forEach((button) => {
        const selected = button.dataset.adminWorkspace === activeAdminPanel;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-current', selected ? 'page' : 'false');
      });
      return;
    }
    const adminSetup = event.target.closest('[data-admin-setup]');
    if (adminSetup) { event.preventDefault(); event.stopImmediatePropagation(); showAdminSetup(); return; }
    const adminLogin = event.target.closest('[data-admin-login]');
    if (adminLogin) { event.preventDefault(); event.stopImmediatePropagation(); showLogin('admin'); return; }
    const demo = event.target.closest('[data-open-demo]');
    if (demo) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeModal();
      if (demo.dataset.openDemo === 'admin') window.adminDashboard?.();
      else window.patientDashboard?.();
      return;
    }
    const entry = event.target.closest('[data-view="patient"], [data-view="admin"]');
    if (entry) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const view = entry.dataset.view;
      document.querySelector('#mobile-panel')?.classList.remove('open');
      if (!dedicatedView) {
        window.location.href = view === 'admin' ? './administracion.html' : './paciente.html';
        return;
      }
      showLogin(view);
      return;
    }
    const backToDirectory = event.target.closest('[data-back-patient-directory]');
    if (backToDirectory) { event.preventDefault();event.stopImmediatePropagation();await renderAdmin();return; }
    const openPatient = event.target.closest('[data-open-patient]');
    if (openPatient) {
      event.preventDefault();event.stopImmediatePropagation();
      try { await renderPatientRecord(openPatient.dataset.openPatient); }
      catch (error) { setLoginError(error.message || 'No se pudo abrir el expediente.'); }
      return;
    }
    const tabButton = event.target.closest('[data-live-tab]');
    if (tabButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      content.querySelectorAll('[data-live-tab]').forEach((button) => button.classList.toggle('active', button === tabButton));
      patientView(tabButton.dataset.liveTab).catch((error) => setLoginError(error.message || 'No se pudo cargar esta sección.'));
      return;
    }
    const showDeleteForm = event.target.closest('[data-toggle-patient-delete]');
    if (showDeleteForm) {
      event.preventDefault(); event.stopImmediatePropagation();
      const form = content.querySelector('#admin-delete-patient-form');
      if (form) { form.hidden = false; form.querySelector('#patient-delete-confirmation')?.focus(); }
      return;
    }
    const cancelDelete = event.target.closest('[data-cancel-patient-delete]');
    if (cancelDelete) {
      event.preventDefault(); event.stopImmediatePropagation();
      const form = content.querySelector('#admin-delete-patient-form');
      form?.reset(); if (form) form.hidden = true;
      return;
    }
    const appointmentResponse=event.target.closest('[data-appointment-response]');
    if(appointmentResponse){
      event.preventDefault();event.stopImmediatePropagation();
      const status=appointmentResponse.dataset.appointmentResponse;
      const appointmentId=appointmentResponse.dataset.appointmentId;
      if(status==='reschedule_requested'&&!window.confirm('¿Enviar a ENT una solicitud para reagendar?'))return;
      appointmentResponse.disabled=true;
      const {error}=await client.from('appointments').update({status}).eq('id',appointmentId).eq('patient_id',activeUser.id);
      if(error){setLoginError('No se pudo actualizar la cita. Intenta otra vez.');appointmentResponse.disabled=false;return;}
      await client.from('patient_notifications').insert({patient_id:activeUser.id,category:'appointment',title:status==='confirmed'?'Consulta confirmada':'Reagenda solicitada',message:status==='confirmed'?'Tu consulta quedó confirmada.':'ENT recibió tu solicitud de reagenda y revisará nuevas opciones.'});
      patientView('avisos').catch(err=>setLoginError(err.message||'No se pudo actualizar el aviso.'));
      return;
    }
    const readNotice = event.target.closest('[data-mark-read]');
    if (readNotice) {
      event.preventDefault();event.stopImmediatePropagation();
      const { error } = await client.from('patient_notification_reads').upsert({ notification_id: readNotice.dataset.markRead, patient_id: activeUser.id }, { onConflict: 'notification_id,patient_id' });
      if (error) { setLoginError('No se pudo actualizar el aviso.'); return; }
      patientView('avisos').catch((error) => setLoginError(error.message || 'No se pudieron cargar los avisos.'));
      return;
    }
    const createAccess = event.target.closest('[data-create-account]');
    if (createAccess) {
      event.preventDefault();event.stopImmediatePropagation();
      showApplicationAccessForm({ id: createAccess.dataset.createAccount, name: createAccess.dataset.appName, age: createAccess.dataset.appAge, username: createAccess.dataset.appUsername, phone: createAccess.dataset.appPhone, objective: createAccess.dataset.appObjective, plan: createAccess.dataset.appPlan, months: createAccess.dataset.appMonths });
      return;
    }
    const cancelCreateAccess = event.target.closest('[data-cancel-create-access]');
    if (cancelCreateAccess) { event.preventDefault();event.stopImmediatePropagation();await renderAdmin();return; }
    const togglePassword = event.target.closest('[data-toggle-password]');
    if (togglePassword) {
      event.preventDefault();event.stopImmediatePropagation();
      const input = content.querySelector('#'+CSS.escape(togglePassword.dataset.togglePassword));
      if (input) { input.type = input.type === 'password' ? 'text' : 'password'; togglePassword.textContent = input.type === 'password' ? 'Ver' : 'Ocultar'; togglePassword.setAttribute('aria-label', input.type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña'); }
      return;
    }
    const copyField = event.target.closest('[data-copy-from]');
    if (copyField) {
      event.preventDefault();event.stopImmediatePropagation();
      const input = content.querySelector('#'+CSS.escape(copyField.dataset.copyFrom));
      if (!input) return;
      try { await navigator.clipboard.writeText(input.value); copyField.textContent='Copiado'; setTimeout(()=>{copyField.textContent='Copiar';},1400); }
      catch { input.focus();input.select();setLoginError('No se pudo copiar automáticamente. Selecciona el texto y cópialo.'); }
      return;
    }
    if (event.target.closest('[data-live-logout]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      client?.auth.signOut().finally(() => { activeUser = null; activeProfile = null; closeModal(); showLogin(requestedView); });
    }
  }, true);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!target.matches('[data-select-patient], [data-select-all-patients]')) return;
    if (target.matches('[data-select-all-patients]')) {
      content.querySelectorAll('[data-select-patient]').forEach((box) => { box.checked = target.checked; });
    }
    const boxes = [...content.querySelectorAll('[data-select-patient]')];
    const selectedCount = boxes.filter((box) => box.checked).length;
    const count = content.querySelector('[data-selection-count]');
    const deleteButton = content.querySelector('[data-bulk-delete]');
    const allBox = content.querySelector('[data-select-all-patients]');
    if (count) count.textContent = `${selectedCount} seleccionados`;
    if (deleteButton) deleteButton.disabled = selectedCount === 0;
    if (allBox) { allBox.checked = boxes.length > 0 && selectedCount === boxes.length; allBox.indeterminate = selectedCount > 0 && selectedCount < boxes.length; }
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'patient-delete-confirmation') {
      const form = event.target.closest('#admin-delete-patient-form');
      const submit = form?.querySelector('[type="submit"]');
      if (submit) submit.disabled = event.target.value.trim() !== form.dataset.confirmUsername;
      return;
    }
    if (event.target.id === 'admin-patient-search') {
      const query=String(event.target.value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('es');
      content.querySelectorAll('.patient-directory-row').forEach((row) => {
        const name=String(row.textContent||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('es');
        row.hidden=!name.includes(query);
      });
      return;
    }
    if (event.target.id === 'manual-username') event.target.dataset.userEdited = 'true';
    if (event.target.id === 'manual-full-name') {
      const username = content.querySelector('#manual-username');
      if (username && username.dataset.userEdited !== 'true') username.value = normalizeUsername(event.target.value.replace(/\s+/g, '.'));
    }
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (form.id === 'admin-delete-patient-form') {
      event.preventDefault(); event.stopImmediatePropagation();
      const input = form.querySelector('#patient-delete-confirmation');
      const button = form.querySelector('[type="submit"]');
      const errorBox = form.querySelector('#patient-delete-error');
      if (input.value.trim() !== form.dataset.confirmUsername) {
        errorBox.textContent = 'El usuario escrito no coincide.';
        errorBox.hidden = false; return;
      }
      const confirmed = window.confirm('¿Eliminar definitivamente este expediente y todos sus datos? Esta acción no se puede deshacer.');
      if (!confirmed) return;
      button.disabled = true; button.textContent = 'Eliminando…';
      errorBox.hidden = true;
      const { data, error } = await client.functions.invoke('admin-delete-patient', {
        body: { patient_id: form.dataset.patientId, confirm_username: input.value.trim() }
      });
      if (error || data?.error) {
        errorBox.textContent = data?.error || 'No se pudo completar la eliminación. El expediente sigue disponible para reintentar.';
        errorBox.hidden = false; button.disabled = false; button.textContent = 'Reintentar eliminación'; return;
      }
      await renderAdmin();
      content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', '<p class="credential-reveal" role="status">El paciente y su expediente fueron eliminados.</p>');
      return;
    }
    if (form.id === 'ent-first-password-form') {
      event.preventDefault();event.stopImmediatePropagation();
      const values=Object.fromEntries(new FormData(form).entries());
      if(values.password!==values.confirm_password){setLoginError('Las contraseñas no coinciden.');return;}
      if(String(values.password).length<5||String(values.password).length>15){setLoginError('Usa entre 5 y 15 caracteres.');return;}
      const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Guardando…';
      const { error }=await client.auth.updateUser({password:values.password,data:{must_change_password:false}});
      if(error){setLoginError('No se pudo actualizar la contraseña. Intenta de nuevo.');button.disabled=false;button.textContent='Guardar y continuar →';return;}
      const user=pendingUser;pendingUser=null;await enterPortal(user);return;
    }
    if (form.id === 'admin-create-patient-form' || form.id === 'admin-application-create-form') {
      event.preventDefault();event.stopImmediatePropagation();
      const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Creando acceso…';
      const values=Object.fromEntries(new FormData(form).entries());
      if (String(values.initial_password||'').length < 5 || String(values.initial_password||'').length > 15) { setLoginError('La contraseña debe tener entre 5 y 15 caracteres.');button.disabled=false;button.textContent='Crear acceso de paciente';return; }
      try {
        if (form.id === 'admin-application-create-form') await createPatientAccount({ application_id: values.application_id, initial_password: values.initial_password, scheduled_at: new Date(values.scheduled_at).toISOString(), appointment_type: values.appointment_type, location_or_link: values.location_or_link.trim() });
        else await createPatientAccount({ full_name: values.full_name, username: values.username, phone: values.phone, age: Number(values.age), plan_code: values.plan_code, plan_months: serviceMonths[values.plan_code], initial_password: values.initial_password });
      } catch (error) { setLoginError(error.message || 'No se pudo crear la cuenta.');button.disabled=false;button.textContent='Reintentar alta'; }
      return;
    }
    if(form.id==='admin-lifestyle-form'){
      event.preventDefault();event.stopImmediatePropagation();
      const submit=form.querySelector('[type="submit"]');
      submit.disabled=true;submit.textContent='Guardando…';
      try{
        const titles=[...form.querySelectorAll('input[name="title"]')];
        const urls=[...form.querySelectorAll('input[name="youtube_url"]')];
        if(!titles.length||titles.length!==urls.length)throw new Error('Completa título y enlace para cada tema Lifestyle.');
        const records=titles.map((titleField,index)=>{
          const title=titleField.value.trim();
          const youtubeUrl=normalizeLifestyleVideoUrl(urls[index].value);
          if(!title)throw new Error(`Escribe el título del tema ${index+1}.`);
          if(title.length>160)throw new Error(`El título del tema ${index+1} supera 160 caracteres.`);
          return {title,youtube_url:youtubeUrl,created_by:activeUser.id};
        });
        const {error}=await client.from('lifestyle_library').insert(records);
        if(error)throw error;
        await renderAdmin();
        content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin',`<p class="admin-success">Se guardaron ${records.length} tema(s) Lifestyle para los pacientes activos.</p>`);
      }catch(error){
        setLoginError(error.message||'No se pudieron guardar los temas Lifestyle. Revisa los enlaces y vuelve a intentarlo.');
        const liveNotice=content.querySelector('.live-notice');
        if(liveNotice)liveNotice.textContent=error.message||'No se pudieron guardar los temas Lifestyle.';
        submit.disabled=false;submit.textContent='Intentar de nuevo';
      }
      return;
    }
    if (form.id.startsWith('admin-') && form.id.endsWith('-form')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Guardando…';
      const values = Object.fromEntries(new FormData(form).entries());
      const numericOrNull = (value) => value === '' || value === undefined ? null : Number(value);
      let table;
      let record;
      let uploadedDietPdfPath = null;
      let dietRecordSaved = false;
      if (form.id === 'admin-config-form') {
        const datetimeOrNull = (value) => value ? new Date(value).toISOString() : null;
        record = {
          consult_initial_price: numericOrNull(values.consult_initial_price),
          consult_followup_price: numericOrNull(values.consult_followup_price),
          consult_bimonthly_price: numericOrNull(values.consult_bimonthly_price),
          consult_quarterly_price: numericOrNull(values.consult_quarterly_price),
          consult_semester_price: numericOrNull(values.consult_semester_price),
          consult_couple_price: numericOrNull(values.consult_couple_price),
          consult_prices_valid_until: values.consult_prices_valid_until || null,
          bank_account_holder: values.bank_account_holder.trim() || null, bank_name: values.bank_name.trim() || null,
          bank_clabe: null, bank_reference_type: values.bank_reference_type, bank_reference_value: values.bank_reference_value.trim() || null,
          bank_secondary_name: values.bank_secondary_name.trim() || null, bank_secondary_reference_type: values.bank_secondary_reference_type, bank_secondary_reference_value: values.bank_secondary_reference_value.trim() || null,
          transfer_instructions: values.transfer_instructions.trim() || null,
          office_address: values.office_address.trim() || null, admin_whatsapp: values.admin_whatsapp.replace(/\D/g, '') || null,
          announcement_title: values.announcement_title.trim() || null, announcement_body: values.announcement_body.trim() || null,
          announcement_active: form.elements.announcement_active.checked,
          announcement_starts_at: datetimeOrNull(values.announcement_starts_at), announcement_ends_at: datetimeOrNull(values.announcement_ends_at),
          updated_by: activeUser.id, updated_at: new Date().toISOString()
        };
        try {
          const { error } = await client.from('site_configuration').update(record).eq('id', 1);
          if (error) throw error;
          await renderAdmin();
        } catch (error) {
          setLoginError('No se pudo guardar la configuración. Revisa los datos e inténtalo de nuevo.');
          submit.disabled = false;submit.textContent = 'Reintentar guardado';
        }
        return;
      } else if(form.id==='admin-faq-form') {
        const file=values.faq_image;
        if(!(file instanceof File)||!file.size||!file.type.startsWith('image/')||file.size>10*1024*1024)throw new Error('Adjunta una imagen de máximo 10 MB.');
        const path=`faq/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const {error:uploadError}=await client.storage.from('ent-faq-images').upload(path,file,{upsert:false,contentType:file.type});if(uploadError)throw uploadError;
        const {data:old}=await client.from('faq_visual').select('image_path').eq('id',1).maybeSingle();
        const {error:saveError}=await client.from('faq_visual').upsert({id:1,image_path:path,image_name:file.name,updated_by:activeUser.id,updated_at:new Date().toISOString()});
        if(saveError){await client.storage.from('ent-faq-images').remove([path]);throw saveError;}
        if(old?.image_path)await client.storage.from('ent-faq-images').remove([old.image_path]);await renderAdmin();return;
      }
      if (form.id === 'admin-measurement-form') {
        table = 'body_measurements';
        record = {
          patient_id: values.patient_id,
          measured_on: values.measured_on,
          weight_kg: numericOrNull(values.weight_kg),
          body_fat_pct: numericOrNull(values.body_fat_pct),
          muscle_mass_kg: numericOrNull(values.muscle_mass_kg),
          height_cm: numericOrNull(values.height_cm),
          waist_cm: numericOrNull(values.waist_cm),
          triceps_skinfold_mm: numericOrNull(values.triceps_skinfold_mm),
          biceps_skinfold_mm: numericOrNull(values.biceps_skinfold_mm),
          subscapular_skinfold_mm: numericOrNull(values.subscapular_skinfold_mm),
          suprailiac_skinfold_mm: numericOrNull(values.suprailiac_skinfold_mm),
          supraspinale_skinfold_mm: numericOrNull(values.supraspinale_skinfold_mm),
          abdominal_skinfold_mm: numericOrNull(values.abdominal_skinfold_mm),
          thigh_skinfold_mm: numericOrNull(values.thigh_skinfold_mm),
          medial_calf_skinfold_mm: numericOrNull(values.medial_calf_skinfold_mm),
          arm_relaxed_cm: numericOrNull(values.arm_relaxed_cm),
          arm_flexed_cm: numericOrNull(values.arm_flexed_cm),
          forearm_cm: numericOrNull(values.forearm_cm),
          wrist_cm: numericOrNull(values.wrist_cm),
          hip_cm: numericOrNull(values.hip_cm),
          thigh_cm: numericOrNull(values.thigh_cm),
          calf_cm: numericOrNull(values.calf_cm),
          humerus_breadth_cm: numericOrNull(values.humerus_breadth_cm),
          wrist_bistyloid_breadth_cm: numericOrNull(values.wrist_bistyloid_breadth_cm),
          femur_breadth_cm: numericOrNull(values.femur_breadth_cm),
          hip_cm: numericOrNull(values.hip_cm),
          created_by: activeUser.id
        };
      } else if (form.id === 'admin-diet-form') {
        table = 'nutrition_updates';
        record = {
          patient_id: values.patient_id,
          title: values.title.trim(),
          diet_content: values.diet_content.trim() || 'Consulta el PDF adjunto de tu dieta.',
          recommendations: values.recommendations.trim() || null,
          is_published: true,
          published_at: new Date().toISOString(),
          created_by: activeUser.id
        };
      } else if (form.id === 'admin-training-form') {
        table = 'training_plans';
        record = {
          patient_id: values.patient_id,
          title: values.title.trim(),
          plan_content: values.plan_content.trim() || 'Descarga el PDF del entrenamiento.',
          content_type: 'plan',
          is_published: true,
          published_at: new Date().toISOString(),
          created_by: activeUser.id
        };
      } else if (form.id === 'admin-class-form') {
        let videoUrl;
        try { videoUrl = new URL(values.video_url.trim()); } catch (_) { throw new Error('Escribe un enlace válido de YouTube.'); }
        if (videoUrl.protocol !== 'https:' || !['youtube.com','www.youtube.com','youtu.be'].includes(videoUrl.hostname)) throw new Error('Usa un enlace seguro de youtube.com o youtu.be.');
        table = 'training_plans';
        record = { patient_id: values.patient_id, title: values.title.trim(), plan_content: values.plan_content.trim(), video_url: videoUrl.href, content_type: 'class', is_published: true, published_at: new Date().toISOString(), created_by: activeUser.id };
      } else if (form.id === 'admin-lifestyle-form') {
        table = 'lifestyle_library';
        let url; try { url = new URL(values.youtube_url.trim()); } catch (_) { throw new Error('Escribe un enlace válido de YouTube.'); }
        if(url.protocol!=='https:'||!['youtube.com','www.youtube.com','youtu.be'].includes(url.hostname))throw new Error('Usa un enlace seguro de YouTube.');
        record = { title: values.title.trim(), youtube_url: url.href, created_by: activeUser.id };
      } else {
        table = 'appointments';
        record = {
          patient_id: values.patient_id,
          scheduled_at: new Date(values.scheduled_at).toISOString(),
          appointment_type: values.appointment_type,
          location_or_link: values.location_or_link.trim() || null,
          created_by: activeUser.id
        };
      }
      try {
        if (form.id === 'admin-diet-form') {
          const file = values.diet_pdf;
          if (!(file instanceof File) || !file.size) throw new Error('Adjunta el PDF de la dieta antes de publicar.');
          if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) throw new Error('El archivo debe ser PDF y pesar máximo 10 MB.');
          if (await file.slice(0, 5).text() !== '%PDF-') throw new Error('El archivo seleccionado no parece ser un PDF válido.');
          uploadedDietPdfPath = `${values.patient_id}/${crypto.randomUUID()}.pdf`;
          const { error: uploadError } = await client.storage.from('nutrition-files').upload(uploadedDietPdfPath, file, { cacheControl: '3600', contentType: 'application/pdf', upsert: false });
          if (uploadError) throw uploadError;
          record.diet_pdf_path = uploadedDietPdfPath;
          record.diet_pdf_name = file.name.slice(0, 200);
        } else if(form.id==='admin-training-form') {
          const file=values.training_pdf;
          if(!(file instanceof File)||!file.size||file.type!=='application/pdf'||file.size>10*1024*1024||await file.slice(0,5).text()!=='%PDF-')throw new Error('Adjunta un PDF válido de máximo 10 MB.');
          uploadedDietPdfPath=`${values.patient_id}/${crypto.randomUUID()}.pdf`;
          const {error:uploadError}=await client.storage.from('training-files').upload(uploadedDietPdfPath,file,{cacheControl:'3600',contentType:'application/pdf',upsert:false});if(uploadError)throw uploadError;
          record.training_pdf_path=uploadedDietPdfPath;record.training_pdf_name=file.name.slice(0,200);
        }
        const selectedPatient = form.querySelector('select[name="patient_id"]')?.selectedOptions?.[0];
        let patientPhone = (selectedPatient?.dataset.phone || '').replace(/\D/g, ''); if (patientPhone.length === 10) patientPhone = `52${patientPhone}`;
        const patientName = selectedPatient?.textContent.split(' · ')[0] || 'paciente';
        const { error } = await client.from(table).insert(record);
        if (error) throw error;
        if(form.id==='admin-measurement-form'||form.id==='admin-diet-form'||form.id==='admin-training-form'||form.id==='admin-appointment-form'){
          const category=form.id==='admin-measurement-form'?'measurement':form.id==='admin-diet-form'?'diet':form.id==='admin-training-form'?'training':'appointment';
          const title=category==='measurement'?'Nueva medición publicada':category==='diet'?'Tu dieta está actualizada':category==='training'?'Nuevo entrenamiento publicado':'Consulta agendada';
          const message=category==='appointment'?'ENT registró una consulta en tu perfil. Revisa fecha y hora en Consultas.':'ENT actualizó información en tu perfil. Entra para revisarla.';
          const {error:noticeError}=await client.from('patient_notifications').insert({patient_id:values.patient_id,category,title,message});if(noticeError)throw noticeError;
        }
        if (form.id === 'admin-diet-form'||form.id==='admin-training-form') dietRecordSaved = true;
        await renderAdmin();
        if (patientPhone) {
          
          content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<section class="credential-reveal whatsapp-ready"><b>Actualización publicada para ${escapeHtml(patientName)}</b><span>La notificación está disponible en el perfil ENT del paciente.</span></section>`);
        }
      } catch (error) {
        if (uploadedDietPdfPath && !dietRecordSaved) {
          await client.storage.from(form.id==='admin-training-form'?'training-files':'nutrition-files').remove([uploadedDietPdfPath]).catch(() => {});
        }
        const notice = content.querySelector('.live-notice');
        if (notice) notice.remove();
        content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<p class="login-error live-notice" role="alert">${escapeHtml(error.message || 'No se pudo guardar. Revisa los campos y vuelve a intentarlo.')}</p>`);
        submit.disabled = false;
        submit.textContent = 'Intentar de nuevo';
      }
      return;
    }
    if(form.id==='admin-reschedule-form'){
      event.preventDefault();event.stopImmediatePropagation();
      const values=Object.fromEntries(new FormData(form).entries());const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Guardando…';
      const {error}=await client.from('appointments').update({scheduled_at:new Date(values.scheduled_at).toISOString(),status:'scheduled',reminder_sent_at:null}).eq('id',values.appointment_id);
      if(error){setLoginError('No se pudo reagendar la consulta.');button.disabled=false;return;}
      const {error:noticeError}=await client.from('patient_notifications').insert({patient_id:values.patient_id,category:'appointment',title:'Tu consulta fue reagendada',message:'Hola '+values.patient_name.split(' ')[0]+'. ENT actualizó tu consulta para el '+dateTimeLabel(values.scheduled_at)+'. Confirma tu asistencia desde Avisos en tu portal.'});
      if(noticeError)console.error('No se pudo crear aviso de reagenda',noticeError);
      await renderAdmin();content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin','<p class="admin-success">Nueva fecha guardada. El aviso ya está en el portal del paciente.</p>');return;
    }
    if (form.id !== 'ent-login-form') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Verificando…';
    try {
      const values = new FormData(form);
      const password = values.get('password');
      const username = requestedView === 'admin' ? '' : normalizeUsername(values.get('username'));
      const email = requestedView === 'admin' ? values.get('email') : `${username}@paciente.ent.invalid`;
      if (requestedView !== 'admin' && username.length < 3) throw new Error('Usuario inválido.');
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await enterPortal(data.user);
    } catch (error) {
      setLoginError('No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.');
      button.disabled = false;
      button.innerHTML = 'Ingresar <span>→</span>';
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && backdrop?.classList.contains('open')) closeModal();
  });

  if (dedicatedView === 'patient' || dedicatedView === 'admin') showLogin(dedicatedView);
})();
