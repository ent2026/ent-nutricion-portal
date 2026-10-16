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

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const normalizeUsername = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
  const planLabel = (value) => ({ light: 'Light', weight: 'Weight', best: 'Best' }[value] || 'Sin plan asignado');
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
          <div><label class="form-label" for="ent-login-password">Contraseña</label><input class="input" id="ent-login-password" name="password" type="password" autocomplete="current-password" required /></div>
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
  const showFirstPasswordForm = () => showModal(`<div class="dashboard login-wrap"><div class="modal-kicker">ACTIVA TU ACCESO</div><h2 id="modal-title">Crea una contraseña personal</h2><p class="modal-lede">Por seguridad, reemplaza tu clave temporal antes de entrar a tu perfil.</p><form id="ent-first-password-form"><label class="form-label" for="new-patient-password">Nueva contraseña</label><input class="input" id="new-patient-password" name="password" type="password" autocomplete="new-password" minlength="12" required /><label class="form-label" for="confirm-patient-password">Confirma la contraseña</label><input class="input" id="confirm-patient-password" name="confirm_password" type="password" autocomplete="new-password" minlength="12" required /><p class="login-error" id="ent-login-error" role="alert" hidden></p><button class="button button-dark form-submit" type="submit">Guardar y continuar →</button></form></div>`);
  const metric = (label, value, unit) => `<div class="metric"><small>${label}</small><strong>${value ?? '—'} <i>${unit}</i></strong></div>`;
  const photoBucket = 'patient-progress';
  const isSupportedPhoto = (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024;
  const photoExtension = (file) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type] || 'jpg');
  const renderPhotoCards = async (patientId, isAdmin = false) => {
    const { data, error } = await client.storage.from(photoBucket).list(patientId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;
    const files = (data || []).filter((file) => file.id && /\.(jpe?g|png|webp)$/i.test(file.name));
    const cards = await Promise.all(files.map(async (file) => {
      const path = `${patientId}/${file.name}`;
      const { data: signed, error: urlError } = await client.storage.from(photoBucket).createSignedUrl(path, 600);
      if (urlError) throw urlError;
      return `<article class="progress-photo"><img src="${escapeHtml(signed.signedUrl)}" alt="Foto de progreso del paciente" loading="lazy" /><small>${escapeHtml(dateLabel(file.created_at || file.updated_at))}</small>${isAdmin ? `<div class="progress-photo-actions"><button class="button button-outline" type="button" data-replace-patient-photo="${escapeHtml(file.name)}">Reemplazar</button><button class="button button-outline" type="button" data-delete-patient-photo="${escapeHtml(file.name)}">Eliminar</button></div>` : ''}</article>`;
    }));
    return cards;
  };
  const renderAdminPhotoGallery = async (patientId) => {
    const gallery = content.querySelector('#admin-photo-gallery');
    if (!gallery) return;
    if (!patientId) { gallery.innerHTML = '<p class="panel-note">Selecciona un paciente para ver sus fotos.</p>'; return; }
    gallery.innerHTML = '<p class="panel-note">Cargando fotos privadas…</p>';
    try {
      const cards = await renderPhotoCards(patientId, true);
      gallery.innerHTML = cards.length ? `<div class="progress-photo-grid">${cards.join('')}</div>` : '<p class="panel-note">Este expediente aún no tiene fotos de progreso.</p>';
    } catch (error) {
      gallery.innerHTML = '<p class="login-error" role="alert">No se pudieron cargar las fotos de este expediente.</p>';
    }
  };
  const setPhotoFeedback = (message, isError = false) => {
    const box = content.querySelector('#admin-photo-status');
    if (box) { box.textContent = message; box.classList.toggle('error', isError); }
  };
  const patientTabs = ['resumen', 'mediciones', 'dieta', 'entrenamiento', 'fotos', 'citas', 'avisos'];
  const tabTitle = { resumen: 'Resumen', mediciones: 'Mediciones', dieta: 'Mi dieta', entrenamiento: 'Entrenamiento', citas: 'Consultas', avisos: 'Avisos', fotos: 'Fotos de progreso' };

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
        <div class="metric-grid">${metric('PESO', latest?.weight_kg, 'kg')}${metric('GRASA CORPORAL', latest?.body_fat_pct, '%')}${metric('MASA MUSCULAR', latest?.muscle_mass_kg, 'kg')}${metric('IMC', latest?.weight_kg && latest?.height_cm ? (Number(latest.weight_kg)/(Number(latest.height_cm)/100)**2).toFixed(1) : null, '')}${metric('ÍNDICE VISCERAL', latest?.visceral_fat_index, '')}</div>
        ${data?.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>FECHA</th><th>PESO</th><th>ESTATURA</th><th>IMC</th><th>GRASA</th><th>MÚSCULO</th><th>CINTURA</th><th>CADERA</th></tr></thead><tbody>${data.map((row) => `<tr><td>${escapeHtml(dateLabel(row.measured_on))}</td><td>${row.weight_kg ?? '—'} kg</td><td>${row.height_cm ?? '—'} cm</td><td>${row.weight_kg && row.height_cm ? (Number(row.weight_kg)/(Number(row.height_cm)/100)**2).toFixed(1) : '—'}</td><td>${row.body_fat_pct ?? '—'} %</td><td>${row.muscle_mass_kg ?? '—'} kg</td><td>${row.waist_cm ?? '—'} cm</td><td>${row.hip_cm ?? '—'} cm</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">Tu nutriólogo todavía no publica mediciones.</p>'}
      </section>`;
      if (tab === 'resumen') {
        const { data: diet, error: dietError } = await client.from('nutrition_updates').select('id,title,published_at,created_at').eq('patient_id', userId).eq('is_published', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (dietError) throw dietError;
        const { data: appointment, error: appointmentError } = await client.from('appointments').select('scheduled_at,status').eq('patient_id', userId).in('status', ['scheduled', 'confirmed']).order('scheduled_at', { ascending: true }).limit(1).maybeSingle();
        if (appointmentError) throw appointmentError;
        inner += `<section class="dash-panel"><div class="dash-panel-head"><h3>Seguimiento actual</h3><span>${escapeHtml(planLabel(activeProfile.plan_code)).toUpperCase()}</span></div><div class="meal"><span class="meal-time">DIETA</span><div><b>${diet ? escapeHtml(diet.title) : 'Sin actualización publicada'}</b><small>${diet ? `Disponible desde ${escapeHtml(dateLabel(diet.published_at || diet.created_at))}` : 'Tu nutriólogo te avisará cuando esté lista.'}</small></div></div><div class="nutrition-summary">Próxima consulta <b>${appointment ? escapeHtml(dateTimeLabel(appointment.scheduled_at)) : 'Por confirmar'}</b></div></section>`;
      }
    } else if (tab === 'dieta') {
      const { data, error } = await client.from('nutrition_updates').select('*').eq('patient_id', userId).eq('is_published', true).order('created_at', { ascending: false });
      if (error) throw error;
      inner = data?.length ? (await Promise.all(data.map(async (item) => {
        let pdfUrl = '';
        if (item.diet_pdf_path) {
          const { data: signed, error: signedError } = await client.storage.from('nutrition-files').createSignedUrl(item.diet_pdf_path, 1800);
          if (signedError) throw signedError;
          pdfUrl = signed.signedUrl;
        }
        const dietText = item.diet_content && item.diet_content !== 'Consulta el PDF adjunto de tu dieta.' ? `<div class="live-plan-text">${escapeHtml(item.diet_content)}</div>` : '';
        const pdfViewer = pdfUrl ? `<div class="diet-pdf-actions"><a class="button button-dark" href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">Abrir PDF de dieta ↗</a><small>${escapeHtml(item.diet_pdf_name || 'Documento PDF')}</small></div><iframe class="diet-pdf-viewer" src="${escapeHtml(pdfUrl)}#view=FitH" title="Dieta en PDF: ${escapeHtml(item.title)}" loading="lazy"></iframe>` : '';
        return `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>${escapeHtml(item.title)}</h3><span>${escapeHtml(dateLabel(item.published_at || item.created_at))}</span></div>${pdfViewer}${dietText}${item.recommendations ? `<div class="panel-note">${escapeHtml(item.recommendations)}</div>` : ''}</section>`;
      }))).join('') : '<section class="dash-panel dash-content-wide"><h3>Aún no hay una dieta publicada</h3><p class="panel-note">La actualización aparecerá aquí cuando tu nutriólogo la publique.</p></section>';
    } else if (tab === 'entrenamiento') {
      const { data, error } = await client.from('training_plans').select('*').eq('patient_id', userId).eq('is_published', true).order('created_at', { ascending: false });
      if (error) throw error;
      inner = data?.length ? data.map((item) => `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>${escapeHtml(item.title)}</h3><span>${escapeHtml(dateLabel(item.published_at || item.created_at))}</span></div><div class="live-plan-text">${escapeHtml(item.plan_content)}</div></section>`).join('') : '<section class="dash-panel dash-content-wide"><h3>Sin plan de entrenamiento publicado</h3><p class="panel-note">Si tu membresía lo incluye, consulta con ENT cuándo estará disponible.</p></section>';
    } else if (tab === 'citas') {
      const { data, error } = await client.from('appointments').select('scheduled_at,appointment_type,location_or_link,status').eq('patient_id', userId).order('scheduled_at', { ascending: false });
      if (error) throw error;
      inner = `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Mis consultas</h3><span>HISTORIAL</span></div>${data?.length ? data.map((item) => `<div class="hist-row"><span><b>${escapeHtml(dateTimeLabel(item.scheduled_at))}</b><br><small>${item.appointment_type === 'online' ? 'En línea' : 'Presencial'} · ${escapeHtml(item.status)}</small></span><small>${escapeHtml(item.location_or_link || 'Lugar por confirmar')}</small></div>`).join('') : '<p class="panel-note">Aún no hay consultas registradas.</p>'}</section>`;
    } else if (tab === 'avisos') {
      const [{ data: notices, error }, { data: reads, error: readsError }] = await Promise.all([
        client.from('patient_notifications').select('id,category,title,message,created_at').eq('patient_id', userId).order('created_at', { ascending: false }).limit(50),
        client.from('patient_notification_reads').select('notification_id').eq('patient_id', userId)
      ]);
      if (error) throw error;if(readsError)throw readsError;
      const seen = new Set((reads || []).map((row) => row.notification_id));
      inner = `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Notificaciones de tu perfil</h3><span>${(notices||[]).filter(row=>!seen.has(row.id)).length} NUEVAS</span></div>${notices?.length ? notices.map((item) => `<article class="notice-row ${seen.has(item.id)?'is-read':'is-unread'}"><span class="notice-dot"></span><div><small>${escapeHtml(dateTimeLabel(item.created_at))} · ${escapeHtml(item.category)}</small><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.message)}</p>${seen.has(item.id)?'':'<button class="text-link" data-mark-read="'+escapeHtml(item.id)+'">Marcar como leída</button>'}</div></article>`).join('') : '<p class="panel-note">Aquí aparecerán los avisos de tu plan, mediciones y consultas.</p>'}</section>`;
    } else if (tab === 'fotos') {
      const cards = await renderPhotoCards(userId, false);
      inner = `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Mis fotos de progreso</h3><span>SOLO VISIBLES PARA TI Y ENT</span></div>${cards.length ? `<div class="progress-photo-grid patient-photo-grid">${cards.join('')}</div>` : '<p class="panel-note">Aún no hay fotos de progreso en tu perfil. Tu nutriólogo las añadirá cuando lo considere útil para tu seguimiento.</p>'}</section>`;
    }
    content.querySelector('#patient-live-content').innerHTML = inner;
  };

  const renderPatient = async () => {
    const name = activeProfile.full_name || activeUser.email || 'Paciente';
    showModal(`<div class="dashboard">
      <div class="dashboard-header"><div><div class="modal-kicker">PORTAL DE PACIENTE</div><div class="profile-head"><div class="avatar"><span>${escapeHtml(name.slice(0, 1).toUpperCase())}</span></div><div><h2 id="modal-title">${escapeHtml(name)}</h2><p>${escapeHtml(planLabel(activeProfile.plan_code))} · ${escapeHtml(activeProfile.status)}</p></div></div></div><button class="button button-outline" data-live-logout>Salir</button></div>
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
      client.from('training_plans').select('title,plan_content,is_published,published_at,created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20),
      client.from('appointments').select('scheduled_at,appointment_type,location_or_link,status').eq('patient_id', patientId).order('scheduled_at', { ascending: false }).limit(20),
      client.from('patient_notifications').select('category,title,message,created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(30)
    ]);
    for (const result of results) if (result.error) throw result.error;
    const [profileResult, measurementsResult, dietsResult, trainingResult, appointmentsResult, noticesResult] = results;
    const profile = profileResult.data;
    const measurements = measurementsResult.data || [];
    const diets = dietsResult.data || [];
    const dietsWithPdf = await Promise.all(diets.map(async (item) => {
      if (!item.diet_pdf_path) return { ...item, pdf_url: '' };
      const { data: signed, error: signedError } = await client.storage.from('nutrition-files').createSignedUrl(item.diet_pdf_path, 1800);
      if (signedError) throw signedError;
      return { ...item, pdf_url: signed.signedUrl };
    }));
    const training = trainingResult.data || [];
    const appointments = appointmentsResult.data || [];
    const notices = noticesResult.data || [];
    const latest = measurements[0];
    const bmi = (row) => row?.weight_kg && row?.height_cm ? (Number(row.weight_kg)/(Number(row.height_cm)/100)**2).toFixed(1) : '—';
    const photos = await renderPhotoCards(patientId, false);
    showModal(`<div class="dashboard patient-record">
      <button class="button button-outline" type="button" data-back-patient-directory>← Volver al directorio</button>
      <div class="dashboard-header"><div><div class="modal-kicker">EXPEDIENTE INDIVIDUAL</div><div class="profile-head"><div class="avatar"><span>${escapeHtml(String(profile.full_name||'P').slice(0,1).toUpperCase())}</span></div><div><h2 id="modal-title">${escapeHtml(profile.full_name)}</h2><p>${escapeHtml(profile.username||'Sin usuario')} · ${escapeHtml(planLabel(profile.plan_code))} · ${escapeHtml(profile.status)}</p></div></div></div></div>
      <section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Datos del paciente</h3><span>PERFIL</span></div><div class="patient-record-facts"><div><small>USUARIO</small><strong>${escapeHtml(profile.username||'—')}</strong></div><div><small>TELÉFONO / WHATSAPP</small><strong>${escapeHtml(profile.phone||'—')}</strong></div><div><small>PLAN</small><strong>${escapeHtml(planLabel(profile.plan_code))} · ${escapeHtml(profile.plan_months)} meses</strong></div><div><small>ESTADO</small><strong>${escapeHtml(profile.status)}</strong></div><div><small>INICIO DE MEMBRESÍA</small><strong>${escapeHtml(dateLabel(profile.membership_started_on))}</strong></div><div><small>FIN DE MEMBRESÍA</small><strong>${escapeHtml(dateLabel(profile.membership_ends_on))}</strong></div><div><small>ALTA</small><strong>${escapeHtml(dateLabel(profile.created_at))}</strong></div></div></section>
      <section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Última valoración</h3><span>${latest ? escapeHtml(dateLabel(latest.measured_on)) : 'SIN VALORACIONES'}</span></div><div class="metric-grid">${metric('PESO',latest?.weight_kg,'kg')}${metric('GRASA CORPORAL',latest?.body_fat_pct,'%')}${metric('MASA MUSCULAR',latest?.muscle_mass_kg,'kg')}${metric('IMC',bmi(latest),'')}${metric('GRASA VISCERAL',latest?.visceral_fat_index,'')}${metric('CINTURA',latest?.waist_cm,'cm')}</div>${measurements.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>FECHA</th><th>PESO</th><th>IMC</th><th>GRASA</th><th>MÚSCULO</th><th>VISCERAL</th><th>CINTURA</th><th>CADERA</th></tr></thead><tbody>${measurements.map((row)=>`<tr><td>${escapeHtml(dateLabel(row.measured_on))}</td><td>${row.weight_kg??'—'} kg</td><td>${bmi(row)}</td><td>${row.body_fat_pct??'—'} %</td><td>${row.muscle_mass_kg??'—'} kg</td><td>${row.visceral_fat_index??'—'}</td><td>${row.waist_cm??'—'} cm</td><td>${row.hip_cm??'—'} cm</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">Todavía no hay mediciones registradas.</p>'}</section>
      <section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Dietas e indicaciones</h3><span>${diets.length} ACTUALIZACIONES</span></div>${dietsWithPdf.length ? dietsWithPdf.map((item)=>`<article class="patient-record-item"><div class="dash-panel-head"><h4>${escapeHtml(item.title)}</h4><span>${escapeHtml(dateLabel(item.published_at||item.created_at))} · ${item.is_published?'PUBLICADA':'BORRADOR'}</span></div>${item.diet_pdf_path?`<p><a class="button button-outline" href="${escapeHtml(item.pdf_url)}" target="_blank" rel="noopener">Abrir PDF adjunto ↗</a> <small>${escapeHtml(item.diet_pdf_name||'Documento PDF')}</small></p>`:''}<div class="live-plan-text">${escapeHtml(item.diet_content)}</div>${item.recommendations?`<p class="panel-note">${escapeHtml(item.recommendations)}</p>`:''}</article>`).join('') : '<p class="panel-note">Todavía no hay dietas registradas.</p>'}</section>
      <section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Entrenamiento</h3><span>${training.length} PLANES</span></div>${training.length ? training.map((item)=>`<article class="patient-record-item"><div class="dash-panel-head"><h4>${escapeHtml(item.title)}</h4><span>${escapeHtml(dateLabel(item.published_at||item.created_at))} · ${item.is_published?'PUBLICADO':'BORRADOR'}</span></div><div class="live-plan-text">${escapeHtml(item.plan_content)}</div></article>`).join('') : '<p class="panel-note">No hay planes de entrenamiento registrados.</p>'}</section>
      <section class="dash-panel"><div class="dash-panel-head"><h3>Consultas</h3><span>HISTORIAL</span></div>${appointments.length ? appointments.map((item)=>`<div class="hist-row"><span><b>${escapeHtml(dateTimeLabel(item.scheduled_at))}</b><br><small>${item.appointment_type==='online'?'En línea':'Presencial'} · ${escapeHtml(item.status)}</small></span><small>${escapeHtml(item.location_or_link||'Lugar por confirmar')}</small></div>`).join('') : '<p class="panel-note">No hay consultas registradas.</p>'}</section>
      <section class="dash-panel"><div class="dash-panel-head"><h3>Avisos enviados</h3><span>${notices.length}</span></div>${notices.length ? notices.map((item)=>`<article class="notice-row"><span class="notice-dot"></span><div><small>${escapeHtml(dateTimeLabel(item.created_at))} · ${escapeHtml(item.category)}</small><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.message)}</p></div></article>`).join('') : '<p class="panel-note">No hay avisos registrados.</p>'}</section>
      <section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Fotos de progreso</h3><span>ARCHIVO PRIVADO</span></div>${photos.length ? `<div class="progress-photo-grid patient-photo-grid">${photos.join('')}</div>` : '<p class="panel-note">No hay fotos registradas.</p>'}</section>
    </div>`);
  };

  const renderAdmin = async () => {
    const [profiles, applications, appointments, configuration] = await Promise.all([
      client.from('patient_profiles').select('user_id,full_name,username,phone,plan_code,plan_months,membership_started_on,membership_ends_on,status,created_at').order('created_at', { ascending: false }).limit(100),
      client.from('patient_applications').select('id,full_name,username,phone,plan_code,plan_months,payment_preference,status,created_at').order('created_at', { ascending: false }).limit(100),
      client.from('appointments').select('id,patient_id,scheduled_at,status,appointment_type').in('status', ['scheduled', 'confirmed']).order('scheduled_at', { ascending: true }).limit(100),
      client.from('site_configuration').select('*').eq('id', 1).single()
    ]);
    for (const result of [profiles, applications, appointments, configuration]) if (result.error) throw result.error;
    const patients = profiles.data || [];
    const requests = applications.data || [];
    const upcoming = appointments.data || [];
    const patientOptions = patients.map((row) => `<option value="${escapeHtml(row.user_id)}" data-phone="${escapeHtml(row.phone||'')}">${escapeHtml(row.full_name)} · ${escapeHtml(planLabel(row.plan_code))}</option>`).join('');
    const emptyPatientOption = patients.length ? '' : '<option value="">Primero crea una cuenta de paciente</option>';
    const settings = configuration.data;
    const sortedPatients = [...patients].sort((a,b) => String(a.full_name||'').localeCompare(String(b.full_name||''), 'es', { sensitivity: 'base' }));
    const patientDirectory = `<section class="dash-panel admin-section patient-directory-section"><div class="dash-panel-head"><div><h3>Directorio de pacientes</h3><p class="panel-note">Selecciona un nombre para abrir su expediente individual.</p></div><span>${patients.length} EXPEDIENTES</span></div><label class="sr-only" for="admin-patient-search">Buscar paciente por nombre</label><input class="input patient-search" id="admin-patient-search" type="search" placeholder="Buscar por nombre…" autocomplete="off" /><div class="patient-directory-list" id="admin-patient-directory">${sortedPatients.length ? sortedPatients.map((row) => `<button class="patient-directory-item" type="button" data-open-patient="${escapeHtml(row.user_id)}"><span class="patient-directory-avatar">${escapeHtml(String(row.full_name||'P').slice(0,1).toUpperCase())}</span><span class="patient-directory-copy"><strong>${escapeHtml(row.full_name)}</strong><small>${escapeHtml(row.username||'Sin usuario')} · ${escapeHtml(planLabel(row.plan_code))} · ${escapeHtml(row.status)}</small></span><span class="patient-directory-arrow">Ver expediente →</span></button>`).join('') : '<p class="panel-note">Aún no hay pacientes dados de alta.</p>'}</div></section>`;
    const priceField = (label, name) => `<div><label class="form-label" for="${name}">${label}</label><input class="input" id="${name}" name="${name}" type="number" min="0" step="1" value="${settings[name] ?? ''}" placeholder="MXN" /></div>`;
    showModal(`<div class="dashboard">
      <div class="dashboard-header"><div><div class="modal-kicker">PANEL DEL PROFESIONAL</div><div class="profile-head admin-profile"><img class="avatar-photo" src="assets/esteban-tellez.jpg" alt="Esteban Téllez" /><div><h2 id="modal-title">Esteban Téllez</h2><p>Administración ENT</p></div></div><p class="modal-lede" style="margin:4px 0 0">Expedientes y solicitudes reales</p></div><button class="button button-outline" data-live-logout>Salir</button></div>
      <div class="admin-summary-grid"><div><small>SOLICITUDES</small><strong>${requests.length}</strong><span>En bandeja</span></div><div><small>PACIENTES</small><strong>${patients.length}</strong><span>Expedientes</span></div><div><small>CONSULTAS</small><strong>${upcoming.length}</strong><span>Próximas</span></div></div>
      ${patientDirectory}
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Alta manual de paciente</h3><span>CUENTA CON ACCESO AL PORTAL</span></div><form class="live-admin-form" id="admin-create-patient-form"><div class="form-grid"><div><label class="form-label" for="manual-full-name">Nombre completo</label><input class="input" id="manual-full-name" name="full_name" maxlength="160" required /></div><div><label class="form-label" for="manual-username">Usuario</label><input class="input" id="manual-username" name="username" maxlength="40" pattern="[a-zA-Z0-9._-]+" required /></div><div><label class="form-label" for="manual-phone">Teléfono / WhatsApp</label><input class="input" id="manual-phone" name="phone" maxlength="40" required /></div><div><label class="form-label" for="manual-plan">Plan</label><select class="select" id="manual-plan" name="plan_code"><option value="light">Light</option><option value="weight">Weight</option><option value="best">Best</option></select></div><div><label class="form-label" for="manual-months">Duración</label><select class="select" id="manual-months" name="plan_months"><option value="6">6 meses</option><option value="12">1 año</option></select></div><div><label class="form-label" for="manual-password">Contraseña de acceso</label><div class="password-entry"><input class="input" id="manual-password" name="initial_password" type="password" minlength="12" maxlength="72" autocomplete="new-password" required /><button class="button button-outline password-action" type="button" data-toggle-password="manual-password" aria-label="Mostrar contraseña">Ver</button><button class="button button-outline password-action" type="button" data-copy-from="manual-password">Copiar</button></div></div></div><p class="form-note">Tú defines la contraseña (mínimo 12 caracteres). Se establece al crear la cuenta; ENT no la guarda ni podrá consultarla después.</p><button class="button button-dark" type="submit">Crear acceso de paciente</button></form></section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Precios y datos de pago</h3><span>VISIBLE EN LA PORTADA</span></div><form class="live-admin-form" id="admin-config-form"><div class="form-grid">${priceField('Light · 6 meses','price_light_6_months')}${priceField('Light · 1 año','price_light_12_months')}${priceField('Weight · 6 meses','price_weight_6_months')}${priceField('Weight · 1 año','price_weight_12_months')}${priceField('Best · 6 meses','price_best_6_months')}${priceField('Best · 1 año','price_best_12_months')}</div><div class="form-grid"><div><label class="form-label" for="bank-account-holder">Titular de la cuenta</label><input class="input" id="bank-account-holder" name="bank_account_holder" value="${escapeHtml(settings.bank_account_holder||'')}" maxlength="180" /></div><div><label class="form-label" for="bank-name">Banco</label><input class="input" id="bank-name" name="bank_name" value="${escapeHtml(settings.bank_name||'')}" maxlength="120" /></div><div><label class="form-label" for="bank-clabe">CLABE interbancaria</label><input class="input" id="bank-clabe" name="bank_clabe" value="${escapeHtml(settings.bank_clabe||'')}" maxlength="18" inputmode="numeric" /></div><div><label class="form-label" for="admin-whatsapp">WhatsApp ENT (código de país + número)</label><input class="input" id="admin-whatsapp" name="admin_whatsapp" value="${escapeHtml(settings.admin_whatsapp||'')}" maxlength="20" placeholder="5219990000000" /></div></div><label class="form-label" for="transfer-instructions">Instrucciones de transferencia</label><textarea class="input live-textarea" id="transfer-instructions" name="transfer_instructions" maxlength="1000">${escapeHtml(settings.transfer_instructions||'')}</textarea><label class="form-label" for="office-address">Dirección del consultorio</label><textarea class="input live-textarea" id="office-address" name="office_address" maxlength="500">${escapeHtml(settings.office_address||'')}</textarea><hr><div class="dash-panel-head"><h3>Aviso general público</h3><label class="switch-label"><input type="checkbox" name="announcement_active" ${settings.announcement_active?'checked':''}> Publicar aviso</label></div><label class="form-label" for="announcement-title">Título del aviso</label><input class="input" id="announcement-title" name="announcement_title" value="${escapeHtml(settings.announcement_title||'')}" maxlength="180" /><label class="form-label" for="announcement-body">Mensaje</label><textarea class="input live-textarea" id="announcement-body" name="announcement_body" maxlength="1500">${escapeHtml(settings.announcement_body||'')}</textarea><div class="form-grid"><div><label class="form-label" for="announcement-start">Mostrar desde (opcional)</label><input class="input" id="announcement-start" name="announcement_starts_at" type="datetime-local" value="${settings.announcement_starts_at?new Date(settings.announcement_starts_at).toISOString().slice(0,16):''}" /></div><div><label class="form-label" for="announcement-end">Ocultar después de (opcional)</label><input class="input" id="announcement-end" name="announcement_ends_at" type="datetime-local" value="${settings.announcement_ends_at?new Date(settings.announcement_ends_at).toISOString().slice(0,16):''}" /></div></div><button class="button button-dark" type="submit">Guardar configuración</button></form></section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Solicitudes nuevas</h3><span>${requests.filter((row) => row.status === 'new').length} POR REVISAR</span></div>
        ${requests.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>NOMBRE</th><th>USUARIO SOLICITADO</th><th>PLAN</th><th>DURACIÓN</th><th>TELÉFONO</th><th>ESTADO</th><th></th></tr></thead><tbody>${requests.map((row) => `<tr><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(row.username)}</td><td>${escapeHtml(planLabel(row.plan_code))}</td><td>${row.plan_months} meses</td><td>${escapeHtml(row.phone)}</td><td>${escapeHtml(row.status)}</td><td>${row.status==='new'?`<button class="text-link" data-create-account="${escapeHtml(row.id)}" data-app-name="${escapeHtml(row.full_name)}" data-app-username="${escapeHtml(row.username||'')}" data-app-phone="${escapeHtml(row.phone)}" data-app-plan="${escapeHtml(row.plan_code)}" data-app-months="${row.plan_months}">Revisar / crear acceso</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">No hay solicitudes registradas.</p>'}
      </section>

      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Fotos de progreso</h3><span>ARCHIVO PRIVADO POR PACIENTE</span></div><label class="form-label" for="admin-photo-patient">Paciente</label><select class="select" id="admin-photo-patient"><option value="">Selecciona un paciente</option>${patientOptions}</select><form class="live-admin-form" id="admin-photo-form"><label class="form-label" for="admin-photo-files">Agregar fotografías</label><input class="input" id="admin-photo-files" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required /><small class="photo-upload-hint">JPG, PNG o WebP · máximo 5 MB por archivo y hasta 8 fotos por carga. Solo ENT y el paciente pueden verlas.</small><button class="button button-dark" type="submit" ${patients.length ? '' : 'disabled'}>Guardar fotos</button><p id="admin-photo-status" class="photo-feedback" role="status" aria-live="polite"></p></form><div id="admin-photo-gallery"><p class="panel-note">Selecciona un paciente para ver sus fotos.</p></div></section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Registrar valoración</h3><span>MEDICIONES</span></div>
        <form class="live-admin-form" id="admin-measurement-form"><label class="form-label" for="measurement-patient">Paciente</label><select class="select" id="measurement-patient" name="patient_id" required>${emptyPatientOption}${patientOptions}</select>
          <div class="form-grid"><div><label class="form-label" for="measurement-date">Fecha</label><input class="input" id="measurement-date" name="measured_on" type="date" required value="${new Date().toISOString().slice(0, 10)}" /></div><div><label class="form-label" for="measurement-weight">Peso (kg)</label><input class="input" id="measurement-weight" name="weight_kg" type="number" min="0" max="500" step="0.01" /></div><div><label class="form-label" for="measurement-height">Estatura (cm)</label><input class="input" id="measurement-height" name="height_cm" type="number" min="0" max="300" step="0.01" /></div><div><label class="form-label" for="measurement-fat">Grasa corporal (%)</label><input class="input" id="measurement-fat" name="body_fat_pct" type="number" min="0" max="100" step="0.01" /></div><div><label class="form-label" for="measurement-muscle">Masa muscular (kg)</label><input class="input" id="measurement-muscle" name="muscle_mass_kg" type="number" min="0" max="300" step="0.01" /></div><div><label class="form-label" for="measurement-visceral">Índice visceral</label><input class="input" id="measurement-visceral" name="visceral_fat_index" type="number" min="0" max="100" step="0.01" /></div><div><label class="form-label" for="measurement-waist">Cintura (cm)</label><input class="input" id="measurement-waist" name="waist_cm" type="number" min="0" max="300" step="0.01" /></div><div><label class="form-label" for="measurement-hip">Cadera (cm)</label><input class="input" id="measurement-hip" name="hip_cm" type="number" min="0" max="300" step="0.01" /></div></div>
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
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Publicar entrenamiento</h3><span>PLAN WEIGHT / BEST</span></div>
        <form class="live-admin-form" id="admin-training-form"><label class="form-label" for="training-patient">Paciente</label><select class="select" id="training-patient" name="patient_id" required>${emptyPatientOption}${patientOptions}</select>
          <label class="form-label" for="training-title">Título</label><input class="input" id="training-title" name="title" maxlength="180" required placeholder="Ej. Rutina · bloque 1" />
          <label class="form-label" for="training-content">Entrenamiento e indicaciones</label><textarea class="input live-textarea" id="training-content" name="plan_content" required></textarea>
          <button class="button button-dark" type="submit" ${patients.length ? '' : 'disabled'}>Publicar entrenamiento</button>
        </form>
      </section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Agendar consulta</h3><span>AGENDA</span></div>
        <form class="live-admin-form" id="admin-appointment-form"><label class="form-label" for="appointment-patient">Paciente</label><select class="select" id="appointment-patient" name="patient_id" required>${emptyPatientOption}${patientOptions}</select>
          <div class="form-grid"><div><label class="form-label" for="appointment-date-time">Fecha y hora</label><input class="input" id="appointment-date-time" name="scheduled_at" type="datetime-local" required /></div><div><label class="form-label" for="appointment-type">Modalidad</label><select class="select" id="appointment-type" name="appointment_type"><option value="in_person">Presencial</option><option value="online">En línea</option></select></div></div>
          <label class="form-label" for="appointment-location">Dirección o enlace</label><input class="input" id="appointment-location" name="location_or_link" maxlength="500" />
          <button class="button button-dark" type="submit" ${patients.length ? '' : 'disabled'}>Guardar consulta</button>
        </form>
      </section>
      <div class="preview-callout">Las mediciones, dietas, entrenamientos y consultas que guardes aquí se asociarán al expediente seleccionado. Las cuentas nuevas todavía deben habilitarse por separado.</div>
    </div>`);
    if (patients.length) {
      const photoSelect = content.querySelector('#admin-photo-patient');
      if (photoSelect) { photoSelect.value = patients[0].user_id; await renderAdminPhotoGallery(photoSelect.value); }
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
    <p class="modal-lede">Confirma el usuario solicitado y establece la contraseña que compartirás con el paciente.</p>
    <form id="admin-application-create-form" class="live-admin-form">
      <input type="hidden" name="application_id" value="${escapeHtml(application.id)}" />
      <div class="form-grid"><div><label class="form-label" for="application-username">Usuario</label><input class="input" id="application-username" value="${escapeHtml(application.username)}" readonly /></div><div><label class="form-label" for="application-phone">WhatsApp</label><input class="input" id="application-phone" value="${escapeHtml(application.phone)}" readonly /></div></div>
      <p class="form-note">Plan ${escapeHtml(planLabel(application.plan))} · ${escapeHtml(application.months)} meses.</p>
      <label class="form-label" for="application-password">Contraseña de acceso · mínimo 12 caracteres</label><div class="password-entry"><input class="input" id="application-password" name="initial_password" type="password" minlength="12" maxlength="72" autocomplete="new-password" required /><button class="button button-outline password-action" type="button" data-toggle-password="application-password" aria-label="Mostrar contraseña">Ver</button><button class="button button-outline password-action" type="button" data-copy-from="application-password">Copiar</button></div>
      <button class="button button-dark form-submit" type="submit">Crear cuenta y expediente →</button>
    </form><button class="button button-outline form-submit" type="button" data-cancel-create-access>Volver al administrador</button>
  </div>`);
  const createPatientAccount = async (payload) => {
    const { data, error } = await client.functions.invoke('admin-create-patient', { body: payload });
    if (error) throw error;
    if (!data || data.error) throw new Error(data?.error || 'No fue posible crear la cuenta.');
    await renderAdmin();
    const phone = String(data.phone || '').replace(/\D/g, '');
    const whatsappPhone = phone.length === 10 ? `52${phone}` : phone;
    const message = encodeURIComponent(`Hola ${data.full_name}. Tu acceso al portal ENT está listo. Usuario: ${data.username}. Contraseña: ${data.initial_password}. Ingresa en https://ent2026.github.io/ent-nutricion-portal/paciente.html`);
    const whatsapp = whatsappPhone ? `<a class="button button-outline" href="https://wa.me/${whatsappPhone}?text=${message}" target="_blank" rel="noopener">Preparar WhatsApp para el paciente</a>` : '';
    content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<section class="credential-reveal" role="status"><b>Acceso creado · comparte las credenciales de forma privada</b><span>Usuario</span><div class="password-entry"><input class="input" id="created-username" value="${escapeHtml(data.username)}" readonly /><button class="button button-outline password-action" type="button" data-copy-from="created-username">Copiar</button></div><span>Contraseña</span><div class="password-entry"><input class="input" id="created-password" type="text" value="${escapeHtml(data.initial_password)}" readonly /><button class="button button-outline password-action" type="button" data-toggle-password="created-password" aria-label="Ocultar contraseña">Ocultar</button><button class="button button-outline password-action" type="button" data-copy-from="created-password">Copiar</button></div>${whatsapp}<small>La contraseña no se guarda en ENT y esta es la única pantalla donde podrás verla. El paciente puede cambiarla por decisión propia desde su cuenta.</small></section>`);
  };
  const promoteInitialAdmin = async () => {
    const { data, error } = await client.functions.invoke('ent-admin-bootstrap');
    if (error || data?.error) throw new Error('No se pudo habilitar el acceso inicial. Confirma el correo autorizado e inténtalo otra vez.');
    const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
    if (refreshError || !refreshed?.session?.user) throw new Error('Se habilitó la cuenta, pero no se pudo actualizar la sesión. Inicia sesión de nuevo.');
    return refreshed.session.user;
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
      await renderAdmin();
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
    await renderPatient();
  };

  document.addEventListener('click', async (event) => {
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
    const replacePhoto = event.target.closest('[data-replace-patient-photo]');
    if (replacePhoto) {
      event.preventDefault(); event.stopImmediatePropagation();
      const patientId = content.querySelector('#admin-photo-patient')?.value;
      const oldName = replacePhoto.dataset.replacePatientPhoto;
      const picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'image/jpeg,image/png,image/webp';
      picker.onchange = async () => {
        const file = picker.files?.[0]; if (!file) return;
        if (!isSupportedPhoto(file)) { setPhotoFeedback('Usa una imagen JPG, PNG o WebP de máximo 5 MB.', true); return; }
        setPhotoFeedback('Subiendo la foto nueva…');
        const newName = `${Date.now()}-${crypto.randomUUID()}.${photoExtension(file)}`;
        const { error: uploadError } = await client.storage.from(photoBucket).upload(`${patientId}/${newName}`, file, { cacheControl: '3600', contentType: file.type, upsert: false });
        if (uploadError) { setPhotoFeedback('No se pudo cargar la nueva foto; la anterior se conserva.', true); return; }
        const { error: removeError } = await client.storage.from(photoBucket).remove([`${patientId}/${oldName}`]);
        if (removeError) setPhotoFeedback('La foto nueva se cargó; la anterior sigue guardada y puedes eliminarla después.', true);
        else setPhotoFeedback('Foto reemplazada correctamente.');
        await renderAdminPhotoGallery(patientId);
      };
      picker.click(); return;
    }
    const deletePhoto = event.target.closest('[data-delete-patient-photo]');
    if (deletePhoto) {
      event.preventDefault(); event.stopImmediatePropagation();
      const patientId = content.querySelector('#admin-photo-patient')?.value;
      if (!patientId || !window.confirm('¿Eliminar esta foto de progreso?')) return;
      const { error } = await client.storage.from(photoBucket).remove([`${patientId}/${deletePhoto.dataset.deletePatientPhoto}`]);
      if (error) { setPhotoFeedback('No se pudo eliminar la foto.'); return; }
      setPhotoFeedback('Foto eliminada del expediente.');
      await renderAdminPhotoGallery(patientId); return;
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
      showApplicationAccessForm({ id: createAccess.dataset.createAccount, name: createAccess.dataset.appName, username: createAccess.dataset.appUsername, phone: createAccess.dataset.appPhone, plan: createAccess.dataset.appPlan, months: createAccess.dataset.appMonths });
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
    if (event.target.id === 'admin-photo-patient') renderAdminPhotoGallery(event.target.value);
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'admin-patient-search') {
      const query=String(event.target.value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('es');
      content.querySelectorAll('[data-open-patient]').forEach((button) => {
        const name=String(button.textContent||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('es');
        button.hidden=!name.includes(query);
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
    if (form.id === 'ent-first-password-form') {
      event.preventDefault();event.stopImmediatePropagation();
      const values=Object.fromEntries(new FormData(form).entries());
      if(values.password!==values.confirm_password){setLoginError('Las contraseñas no coinciden.');return;}
      if(String(values.password).length<12){setLoginError('Usa al menos 12 caracteres.');return;}
      const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Guardando…';
      const { error }=await client.auth.updateUser({password:values.password,data:{must_change_password:false}});
      if(error){setLoginError('No se pudo actualizar la contraseña. Intenta de nuevo.');button.disabled=false;button.textContent='Guardar y continuar →';return;}
      const user=pendingUser;pendingUser=null;await enterPortal(user);return;
    }
    if (form.id === 'admin-create-patient-form' || form.id === 'admin-application-create-form') {
      event.preventDefault();event.stopImmediatePropagation();
      const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Creando acceso…';
      const values=Object.fromEntries(new FormData(form).entries());
      if (String(values.initial_password||'').length < 12 || String(values.initial_password||'').length > 72) { setLoginError('La contraseña debe tener entre 12 y 72 caracteres.');button.disabled=false;button.textContent='Crear acceso de paciente';return; }
      try {
        if (form.id === 'admin-application-create-form') await createPatientAccount({ application_id: values.application_id, initial_password: values.initial_password });
        else await createPatientAccount({ full_name: values.full_name, username: values.username, phone: values.phone, plan_code: values.plan_code, plan_months: Number(values.plan_months), initial_password: values.initial_password });
      } catch (error) { setLoginError(error.message || 'No se pudo crear la cuenta.');button.disabled=false;button.textContent='Reintentar alta'; }
      return;
    }
    if (form.id === 'admin-photo-form') {
      event.preventDefault(); event.stopImmediatePropagation();
      const patientId = content.querySelector('#admin-photo-patient')?.value;
      const files = Array.from(form.elements.photos.files || []);
      if (!patientId) { setPhotoFeedback('Selecciona el expediente al que pertenecen las fotos.', true); return; }
      if (!files.length || files.length > 8) { setPhotoFeedback('Selecciona de 1 a 8 fotografías por carga.', true); return; }
      if (files.some((file) => !isSupportedPhoto(file))) { setPhotoFeedback('Cada imagen debe ser JPG, PNG o WebP y pesar máximo 5 MB.', true); return; }
      const button = form.querySelector('[type="submit"]'); button.disabled = true; button.textContent = 'Subiendo…';
      let uploaded = 0;
      try {
        for (const file of files) {
          const name = `${Date.now()}-${crypto.randomUUID()}.${photoExtension(file)}`;
          const { error } = await client.storage.from(photoBucket).upload(`${patientId}/${name}`, file, { cacheControl: '3600', contentType: file.type, upsert: false });
          if (error) throw error;
          uploaded++;
        }
        form.reset();
        setPhotoFeedback(`${uploaded} ${uploaded === 1 ? 'foto guardada' : 'fotos guardadas'} en el expediente privado.`);
        await renderAdminPhotoGallery(patientId);
      } catch (error) {
        setPhotoFeedback(`Se guardaron ${uploaded} fotos; hubo un problema con la siguiente carga. Revisa el expediente y vuelve a intentar.`, true);
        await renderAdminPhotoGallery(patientId);
      } finally { button.disabled = false; button.textContent = 'Guardar fotos'; }
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
          price_light_6_months: numericOrNull(values.price_light_6_months), price_light_12_months: numericOrNull(values.price_light_12_months),
          price_weight_6_months: numericOrNull(values.price_weight_6_months), price_weight_12_months: numericOrNull(values.price_weight_12_months),
          price_best_6_months: numericOrNull(values.price_best_6_months), price_best_12_months: numericOrNull(values.price_best_12_months),
          bank_account_holder: values.bank_account_holder.trim() || null, bank_name: values.bank_name.trim() || null,
          bank_clabe: values.bank_clabe.trim() || null, transfer_instructions: values.transfer_instructions.trim() || null,
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
      } else if (form.id === 'admin-measurement-form') {
        table = 'body_measurements';
        record = {
          patient_id: values.patient_id,
          measured_on: values.measured_on,
          weight_kg: numericOrNull(values.weight_kg),
          body_fat_pct: numericOrNull(values.body_fat_pct),
          muscle_mass_kg: numericOrNull(values.muscle_mass_kg),
          height_cm: numericOrNull(values.height_cm),
          visceral_fat_index: numericOrNull(values.visceral_fat_index),
          waist_cm: numericOrNull(values.waist_cm),
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
          plan_content: values.plan_content.trim(),
          is_published: true,
          published_at: new Date().toISOString(),
          created_by: activeUser.id
        };
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
        }
        const selectedPatient = form.querySelector('select[name="patient_id"]')?.selectedOptions?.[0];
        const patientPhone = (selectedPatient?.dataset.phone || '').replace(/\D/g, '');
        const patientName = selectedPatient?.textContent.split(' · ')[0] || 'paciente';
        const { error } = await client.from(table).insert(record);
        if (error) throw error;
        if (form.id === 'admin-diet-form') dietRecordSaved = true;
        await renderAdmin();
        if (patientPhone) {
          const waMessage = encodeURIComponent(`Hola ${patientName}. Hay una nueva notificación en tu perfil ENT. Ingresa a https://ent2026.github.io/ent-nutricion-portal/ para consultar tu actualización.`);
          content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<section class="credential-reveal whatsapp-ready"><b>Actualización publicada para ${escapeHtml(patientName)}</b><span>La notificación ya está en su perfil.</span><a class="button button-outline" href="https://wa.me/${patientPhone}?text=${waMessage}" target="_blank" rel="noopener">Abrir WhatsApp con aviso preparado</a><small>El mensaje se abrirá para que ENT lo revise y toque Enviar. No incluye información nutricional.</small></section>`);
        }
      } catch (error) {
        if (uploadedDietPdfPath && !dietRecordSaved) {
          await client.storage.from('nutrition-files').remove([uploadedDietPdfPath]).catch(() => {});
        }
        const notice = content.querySelector('.live-notice');
        if (notice) notice.remove();
        content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<p class="login-error live-notice" role="alert">${escapeHtml(error.message || 'No se pudo guardar. Revisa los campos y vuelve a intentarlo.')}</p>`);
        submit.disabled = false;
        submit.textContent = 'Intentar de nuevo';
      }
      return;
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
