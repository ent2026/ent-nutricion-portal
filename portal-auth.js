(() => {
  const config = window.ENT_SUPABASE_CONFIG;
  const clientFactory = window.supabase?.createClient;
  const client = window.ENT_SUPABASE_CLIENT || (config && clientFactory
    ? clientFactory(config.url, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null);
  if (client) window.ENT_SUPABASE_CLIENT = client;
  const dedicatedView = document.body.dataset.portalView || '';
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
          ${admin ? '<div><label class="form-label" for="ent-login-email">Correo de administración</label><input class="input" id="ent-login-email" name="email" type="email" autocomplete="username" required /></div>' : '<div><label class="form-label" for="ent-login-username">Usuario</label><input class="input" id="ent-login-username" name="username" type="text" autocomplete="username" minlength="3" maxlength="40" required /></div>'}
          <div><label class="form-label" for="ent-login-password">Contraseña</label><input class="input" id="ent-login-password" name="password" type="password" autocomplete="current-password" required /></div>
        </div>
        <p class="login-error" id="ent-login-error" role="alert" hidden></p>
        <button class="button button-dark form-submit" id="ent-login-submit" type="submit">Ingresar <span>→</span></button>
      </form>
      <p class="form-note">Si aún no tienes acceso, solicita tus credenciales directamente a ENT.</p>
      ${dedicatedView ? '' : `<div class="live-demo-entry"><span>¿Solo quieres revisar el diseño?</span><button class="button button-outline" type="button" data-open-demo="${admin ? 'admin' : 'patient'}">Ver vista de muestra</button><small>Usa datos ficticios y no guarda cambios.</small></div>`}
      ${dedicatedView ? '<a class="portal-return" href="./index.html">← Volver al sitio ENT</a>' : ''}
    </div>`);
  };
  const showFirstPasswordForm = () => showModal(`<div class="dashboard login-wrap"><div class="modal-kicker">ACTIVA TU ACCESO</div><h2 id="modal-title">Crea una contraseña personal</h2><p class="modal-lede">Por seguridad, reemplaza tu clave temporal antes de entrar a tu perfil.</p><form id="ent-first-password-form"><label class="form-label" for="new-patient-password">Nueva contraseña</label><input class="input" id="new-patient-password" name="password" type="password" autocomplete="new-password" minlength="12" required /><label class="form-label" for="confirm-patient-password">Confirma la contraseña</label><input class="input" id="confirm-patient-password" name="confirm_password" type="password" autocomplete="new-password" minlength="12" required /><p class="login-error" id="ent-login-error" role="alert" hidden></p><button class="button button-dark form-submit" type="submit">Guardar y continuar →</button></form></div>`);
  const metric = (label, value, unit) => `<div class="metric"><small>${label}</small><strong>${value ?? '—'} <i>${unit}</i></strong></div>`;
  const patientTabs = ['resumen', 'mediciones', 'dieta', 'entrenamiento', 'citas', 'avisos'];
  const tabTitle = { resumen: 'Resumen', mediciones: 'Mediciones', dieta: 'Mi dieta', entrenamiento: 'Entrenamiento', citas: 'Consultas', avisos: 'Avisos' };

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
      inner = data?.length ? data.map((item) => `<section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>${escapeHtml(item.title)}</h3><span>${escapeHtml(dateLabel(item.published_at || item.created_at))}</span></div><div class="live-plan-text">${escapeHtml(item.diet_content)}</div>${item.recommendations ? `<div class="panel-note">${escapeHtml(item.recommendations)}</div>` : ''}</section>`).join('') : '<section class="dash-panel dash-content-wide"><h3>Aún no hay una dieta publicada</h3><p class="panel-note">La actualización aparecerá aquí cuando tu nutriólogo la publique.</p></section>';
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

  const renderAdmin = async () => {
    const [profiles, applications, appointments, configuration] = await Promise.all([
      client.from('patient_profiles').select('user_id,full_name,phone,plan_code,status,created_at').order('created_at', { ascending: false }).limit(100),
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
    const priceField = (label, name) => `<div><label class="form-label" for="${name}">${label}</label><input class="input" id="${name}" name="${name}" type="number" min="0" step="1" value="${settings[name] ?? ''}" placeholder="MXN" /></div>`;
    showModal(`<div class="dashboard">
      <div class="dashboard-header"><div><div class="modal-kicker">PANEL DEL PROFESIONAL</div><h2 id="modal-title">Administración ENT</h2><p class="modal-lede" style="margin:4px 0 0">Expedientes y solicitudes reales</p></div><button class="button button-outline" data-live-logout>Salir</button></div>
      <div class="admin-summary-grid"><div><small>SOLICITUDES</small><strong>${requests.length}</strong><span>En bandeja</span></div><div><small>PACIENTES</small><strong>${patients.length}</strong><span>Expedientes</span></div><div><small>CONSULTAS</small><strong>${upcoming.length}</strong><span>Próximas</span></div></div>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Alta manual de paciente</h3><span>CUENTA CON ACCESO AL PORTAL</span></div><form class="live-admin-form" id="admin-create-patient-form"><div class="form-grid"><div><label class="form-label" for="manual-full-name">Nombre completo</label><input class="input" id="manual-full-name" name="full_name" maxlength="160" required /></div><div><label class="form-label" for="manual-username">Usuario</label><input class="input" id="manual-username" name="username" maxlength="40" pattern="[a-zA-Z0-9._-]+" required /></div><div><label class="form-label" for="manual-phone">Teléfono / WhatsApp</label><input class="input" id="manual-phone" name="phone" maxlength="40" required /></div><div><label class="form-label" for="manual-plan">Plan</label><select class="select" id="manual-plan" name="plan_code"><option value="light">Light</option><option value="weight">Weight</option><option value="best">Best</option></select></div><div><label class="form-label" for="manual-months">Duración</label><select class="select" id="manual-months" name="plan_months"><option value="6">6 meses</option><option value="12">1 año</option></select></div></div><p class="form-note">El usuario se sugiere con nombre y apellido. La contraseña temporal se genera de forma segura al crear la cuenta.</p><button class="button button-dark" type="submit">Crear cuenta y generar clave</button></form></section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Precios y datos de pago</h3><span>VISIBLE EN LA PORTADA</span></div><form class="live-admin-form" id="admin-config-form"><div class="form-grid">${priceField('Light · 6 meses','price_light_6_months')}${priceField('Light · 1 año','price_light_12_months')}${priceField('Weight · 6 meses','price_weight_6_months')}${priceField('Weight · 1 año','price_weight_12_months')}${priceField('Best · 6 meses','price_best_6_months')}${priceField('Best · 1 año','price_best_12_months')}</div><div class="form-grid"><div><label class="form-label" for="bank-account-holder">Titular de la cuenta</label><input class="input" id="bank-account-holder" name="bank_account_holder" value="${escapeHtml(settings.bank_account_holder||'')}" maxlength="180" /></div><div><label class="form-label" for="bank-name">Banco</label><input class="input" id="bank-name" name="bank_name" value="${escapeHtml(settings.bank_name||'')}" maxlength="120" /></div><div><label class="form-label" for="bank-clabe">CLABE interbancaria</label><input class="input" id="bank-clabe" name="bank_clabe" value="${escapeHtml(settings.bank_clabe||'')}" maxlength="18" inputmode="numeric" /></div><div><label class="form-label" for="admin-whatsapp">WhatsApp ENT (código de país + número)</label><input class="input" id="admin-whatsapp" name="admin_whatsapp" value="${escapeHtml(settings.admin_whatsapp||'')}" maxlength="20" placeholder="5219990000000" /></div></div><label class="form-label" for="transfer-instructions">Instrucciones de transferencia</label><textarea class="input live-textarea" id="transfer-instructions" name="transfer_instructions" maxlength="1000">${escapeHtml(settings.transfer_instructions||'')}</textarea><label class="form-label" for="office-address">Dirección del consultorio</label><textarea class="input live-textarea" id="office-address" name="office_address" maxlength="500">${escapeHtml(settings.office_address||'')}</textarea><hr><div class="dash-panel-head"><h3>Aviso general público</h3><label class="switch-label"><input type="checkbox" name="announcement_active" ${settings.announcement_active?'checked':''}> Publicar aviso</label></div><label class="form-label" for="announcement-title">Título del aviso</label><input class="input" id="announcement-title" name="announcement_title" value="${escapeHtml(settings.announcement_title||'')}" maxlength="180" /><label class="form-label" for="announcement-body">Mensaje</label><textarea class="input live-textarea" id="announcement-body" name="announcement_body" maxlength="1500">${escapeHtml(settings.announcement_body||'')}</textarea><div class="form-grid"><div><label class="form-label" for="announcement-start">Mostrar desde (opcional)</label><input class="input" id="announcement-start" name="announcement_starts_at" type="datetime-local" value="${settings.announcement_starts_at?new Date(settings.announcement_starts_at).toISOString().slice(0,16):''}" /></div><div><label class="form-label" for="announcement-end">Ocultar después de (opcional)</label><input class="input" id="announcement-end" name="announcement_ends_at" type="datetime-local" value="${settings.announcement_ends_at?new Date(settings.announcement_ends_at).toISOString().slice(0,16):''}" /></div></div><button class="button button-dark" type="submit">Guardar configuración</button></form></section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Solicitudes nuevas</h3><span>${requests.filter((row) => row.status === 'new').length} POR REVISAR</span></div>
        ${requests.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>NOMBRE</th><th>USUARIO SOLICITADO</th><th>PLAN</th><th>DURACIÓN</th><th>TELÉFONO</th><th>ESTADO</th><th></th></tr></thead><tbody>${requests.map((row) => `<tr><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(row.username)}</td><td>${escapeHtml(planLabel(row.plan_code))}</td><td>${row.plan_months} meses</td><td>${escapeHtml(row.phone)}</td><td>${escapeHtml(row.status)}</td><td>${row.status==='new'?`<button class="text-link" data-create-account="${escapeHtml(row.id)}">Revisar / crear acceso</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">No hay solicitudes registradas.</p>'}
      </section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Pacientes activos</h3><span>${patients.length} EXPEDIENTES</span></div>
        ${patients.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>PACIENTE</th><th>PLAN</th><th>ESTADO</th><th>ALTA</th></tr></thead><tbody>${patients.map((row) => `<tr><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(planLabel(row.plan_code))}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(dateLabel(row.created_at))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">Todavía no hay expedientes.</p>'}
      </section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Registrar valoración</h3><span>MEDICIONES</span></div>
        <form class="live-admin-form" id="admin-measurement-form"><label class="form-label" for="measurement-patient">Paciente</label><select class="select" id="measurement-patient" name="patient_id" required>${emptyPatientOption}${patientOptions}</select>
          <div class="form-grid"><div><label class="form-label" for="measurement-date">Fecha</label><input class="input" id="measurement-date" name="measured_on" type="date" required value="${new Date().toISOString().slice(0, 10)}" /></div><div><label class="form-label" for="measurement-weight">Peso (kg)</label><input class="input" id="measurement-weight" name="weight_kg" type="number" min="0" max="500" step="0.01" /></div><div><label class="form-label" for="measurement-height">Estatura (cm)</label><input class="input" id="measurement-height" name="height_cm" type="number" min="0" max="300" step="0.01" /></div><div><label class="form-label" for="measurement-fat">Grasa corporal (%)</label><input class="input" id="measurement-fat" name="body_fat_pct" type="number" min="0" max="100" step="0.01" /></div><div><label class="form-label" for="measurement-muscle">Masa muscular (kg)</label><input class="input" id="measurement-muscle" name="muscle_mass_kg" type="number" min="0" max="300" step="0.01" /></div><div><label class="form-label" for="measurement-visceral">Índice visceral</label><input class="input" id="measurement-visceral" name="visceral_fat_index" type="number" min="0" max="100" step="0.01" /></div><div><label class="form-label" for="measurement-waist">Cintura (cm)</label><input class="input" id="measurement-waist" name="waist_cm" type="number" min="0" max="300" step="0.01" /></div><div><label class="form-label" for="measurement-hip">Cadera (cm)</label><input class="input" id="measurement-hip" name="hip_cm" type="number" min="0" max="300" step="0.01" /></div></div>
          <button class="button button-dark" type="submit" ${patients.length ? '' : 'disabled'}>Guardar medición</button>
        </form>
      </section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Publicar dieta</h3><span>ACTUALIZACIÓN PARA PACIENTE</span></div>
        <form class="live-admin-form" id="admin-diet-form"><label class="form-label" for="diet-patient">Paciente</label><select class="select" id="diet-patient" name="patient_id" required>${emptyPatientOption}${patientOptions}</select>
          <label class="form-label" for="diet-title">Título</label><input class="input" id="diet-title" name="title" maxlength="180" required placeholder="Ej. Plan de alimentación · noviembre" />
          <label class="form-label" for="diet-content">Dieta e indicaciones</label><textarea class="input live-textarea" id="diet-content" name="diet_content" required></textarea>
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
  };

  const setLoginError = (message) => {
    const box = content.querySelector('#ent-login-error');
    if (box) { box.textContent = message; box.hidden = false; return; }
    const panel = content.querySelector('#patient-live-content');
    if (panel) panel.innerHTML = `<section class="dash-panel"><p class="login-error" role="alert">${escapeHtml(message)}</p></section>`;
    else content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<p class="login-error live-notice" role="alert">${escapeHtml(message)}</p>`);
  };
  const createPatientAccount = async (payload) => {
    const { data, error } = await client.functions.invoke('admin-create-patient', { body: payload });
    if (error) throw error;
    if (!data || data.error) throw new Error(data?.error || 'No fue posible crear la cuenta.');
    await renderAdmin();
    content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<section class="credential-reveal" role="status"><b>Acceso creado · comparte estos datos de forma privada</b><span>Usuario: <strong>${escapeHtml(data.username)}</strong></span><span>Clave temporal: <code>${escapeHtml(data.temporary_password)}</code></span><small>La contraseña temporal se muestra solo esta vez. El paciente debe cambiarla al iniciar.</small></section>`);
  };
  const enterPortal = async (user) => {
    activeUser = user;
    if (requestedView === 'admin') {
      if (user.app_metadata?.role !== 'admin') {
        await client.auth.signOut();
        setLoginError('Esta cuenta no tiene permisos de administrador.');
        return;
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
    const tabButton = event.target.closest('[data-live-tab]');
    if (tabButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      content.querySelectorAll('[data-live-tab]').forEach((button) => button.classList.toggle('active', button === tabButton));
      patientView(tabButton.dataset.liveTab).catch((error) => setLoginError(error.message || 'No se pudo cargar esta sección.'));
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
      event.preventDefault();event.stopImmediatePropagation();createAccess.disabled=true;createAccess.textContent='Creando acceso…';
      try { await createPatientAccount({ application_id: createAccess.dataset.createAccount }); }
      catch (error) { createAccess.disabled=false;createAccess.textContent='Reintentar alta';setLoginError(error.message || 'No se pudo crear el acceso.'); }
      return;
    }
    if (event.target.closest('[data-live-logout]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      client?.auth.signOut().finally(() => { activeUser = null; activeProfile = null; closeModal(); showLogin(requestedView); });
    }
  }, true);

  document.addEventListener('input', (event) => {
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
    if (form.id === 'admin-create-patient-form') {
      event.preventDefault();event.stopImmediatePropagation();
      const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Creando cuenta…';
      const values=Object.fromEntries(new FormData(form).entries());
      try { await createPatientAccount({ full_name: values.full_name, username: values.username, phone: values.phone, plan_code: values.plan_code, plan_months: Number(values.plan_months) }); }
      catch (error) { setLoginError(error.message || 'No se pudo crear la cuenta.');button.disabled=false;button.textContent='Reintentar alta'; }
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
          diet_content: values.diet_content.trim(),
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
        const selectedPatient = form.querySelector('select[name="patient_id"]')?.selectedOptions?.[0];
        const patientPhone = (selectedPatient?.dataset.phone || '').replace(/\D/g, '');
        const patientName = selectedPatient?.textContent.split(' · ')[0] || 'paciente';
        const { error } = await client.from(table).insert(record);
        if (error) throw error;
        await renderAdmin();
        if (patientPhone) {
          const waMessage = encodeURIComponent(`Hola ${patientName}. Hay una nueva notificación en tu perfil ENT. Ingresa a https://ent2026.github.io/ent-nutricion-portal/ para consultar tu actualización.`);
          content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<section class="credential-reveal whatsapp-ready"><b>Actualización publicada para ${escapeHtml(patientName)}</b><span>La notificación ya está en su perfil.</span><a class="button button-outline" href="https://wa.me/${patientPhone}?text=${waMessage}" target="_blank" rel="noopener">Abrir WhatsApp con aviso preparado</a><small>El mensaje se abrirá para que ENT lo revise y toque Enviar. No incluye información nutricional.</small></section>`);
        }
      } catch (error) {
        const notice = content.querySelector('.live-notice');
        if (notice) notice.remove();
        content.querySelector('.dashboard')?.insertAdjacentHTML('afterbegin', `<p class="login-error live-notice" role="alert">No se pudo guardar. Revisa los campos y vuelve a intentarlo.</p>`);
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
      if (data.user.user_metadata?.must_change_password) { pendingUser=data.user;showFirstPasswordForm();return; }
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
