(() => {
  const config = window.ENT_SUPABASE_CONFIG;
  const clientFactory = window.supabase?.createClient;
  const client = config && clientFactory
    ? clientFactory(config.url, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;
  const backdrop = document.querySelector('#modal');
  const content = document.querySelector('#modal-content');
  let requestedView = 'patient';
  let activeUser = null;
  let activeProfile = null;
  let activeTab = 'resumen';

  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const planLabel = (value) => ({ light: 'Light', weight: 'Weight', best: 'Best' }[value] || 'Sin plan asignado');
  const dateLabel = (value) => value
    ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
    : '—';
  const dateTimeLabel = (value) => value
    ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';
  const showModal = (html) => {
    content.innerHTML = html;
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    content.querySelector('input')?.focus();
  };
  const closeModal = () => {
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
      <p class="modal-lede">Ingresa con el correo y la contraseña asociados a tu cuenta.</p>
      <form id="ent-login-form" novalidate>
        <div class="form-grid login-grid">
          <div><label class="form-label" for="ent-login-email">Correo electrónico</label><input class="input" id="ent-login-email" name="email" type="email" autocomplete="username" required /></div>
          <div><label class="form-label" for="ent-login-password">Contraseña</label><input class="input" id="ent-login-password" name="password" type="password" autocomplete="current-password" required /></div>
        </div>
        <p class="login-error" id="ent-login-error" role="alert" hidden></p>
        <button class="button button-dark form-submit" id="ent-login-submit" type="submit">Ingresar <span>→</span></button>
      </form>
      <p class="form-note">Si aún no tienes acceso, solicita tus credenciales directamente a ENT.</p>
    </div>`);
  };
  const metric = (label, value, unit) => `<div class="metric"><small>${label}</small><strong>${value ?? '—'} <i>${unit}</i></strong></div>`;
  const patientTabs = ['resumen', 'mediciones', 'dieta', 'entrenamiento', 'citas'];
  const tabTitle = { resumen: 'Resumen', mediciones: 'Mediciones', dieta: 'Mi dieta', entrenamiento: 'Entrenamiento', citas: 'Consultas' };

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
        <div class="metric-grid">${metric('PESO', latest?.weight_kg, 'kg')}${metric('GRASA CORPORAL', latest?.body_fat_pct, '%')}${metric('MASA MUSCULAR', latest?.muscle_mass_kg, 'kg')}${metric('ÍNDICE VISCERAL', latest?.visceral_fat_index, '')}</div>
        ${data?.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>FECHA</th><th>PESO</th><th>GRASA</th><th>MÚSCULO</th></tr></thead><tbody>${data.map((row) => `<tr><td>${escapeHtml(dateLabel(row.measured_on))}</td><td>${row.weight_kg ?? '—'} kg</td><td>${row.body_fat_pct ?? '—'} %</td><td>${row.muscle_mass_kg ?? '—'} kg</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">Tu nutriólogo todavía no publica mediciones.</p>'}
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
    const [profiles, applications, appointments] = await Promise.all([
      client.from('patient_profiles').select('user_id,full_name,plan_code,status,created_at').order('created_at', { ascending: false }).limit(100),
      client.from('patient_applications').select('id,full_name,email,phone,plan_code,plan_months,payment_preference,status,created_at').order('created_at', { ascending: false }).limit(100),
      client.from('appointments').select('id,patient_id,scheduled_at,status,appointment_type').in('status', ['scheduled', 'confirmed']).order('scheduled_at', { ascending: true }).limit(100)
    ]);
    for (const result of [profiles, applications, appointments]) if (result.error) throw result.error;
    const patients = profiles.data || [];
    const requests = applications.data || [];
    const upcoming = appointments.data || [];
    showModal(`<div class="dashboard">
      <div class="dashboard-header"><div><div class="modal-kicker">PANEL DEL PROFESIONAL</div><h2 id="modal-title">Administración ENT</h2><p class="modal-lede" style="margin:4px 0 0">Expedientes y solicitudes reales</p></div><button class="button button-outline" data-live-logout>Salir</button></div>
      <div class="admin-summary-grid"><div><small>SOLICITUDES</small><strong>${requests.length}</strong><span>En bandeja</span></div><div><small>PACIENTES</small><strong>${patients.length}</strong><span>Expedientes</span></div><div><small>CONSULTAS</small><strong>${upcoming.length}</strong><span>Próximas</span></div></div>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Solicitudes nuevas</h3><span>${requests.filter((row) => row.status === 'new').length} POR REVISAR</span></div>
        ${requests.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>NOMBRE</th><th>PLAN</th><th>DURACIÓN</th><th>CONTACTO</th><th>ESTADO</th></tr></thead><tbody>${requests.map((row) => `<tr><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(planLabel(row.plan_code))}</td><td>${row.plan_months} meses</td><td>${escapeHtml(row.phone)}<br>${escapeHtml(row.email)}</td><td>${escapeHtml(row.status)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">No hay solicitudes registradas.</p>'}
      </section>
      <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Pacientes activos</h3><span>${patients.length} EXPEDIENTES</span></div>
        ${patients.length ? `<div class="table-scroll"><table class="admin-list"><thead><tr><th>PACIENTE</th><th>PLAN</th><th>ESTADO</th><th>ALTA</th></tr></thead><tbody>${patients.map((row) => `<tr><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(planLabel(row.plan_code))}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(dateLabel(row.created_at))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="panel-note">Todavía no hay expedientes.</p>'}
      </section>
      <div class="preview-callout">El panel ya consulta Supabase. Las altas de cuentas, captura de mediciones y publicación de planes se habilitarán en la siguiente etapa.</div>
    </div>`);
  };

  const setLoginError = (message) => {
    const box = content.querySelector('#ent-login-error');
    if (box) { box.textContent = message; box.hidden = false; return; }
    const panel = content.querySelector('#patient-live-content');
    if (panel) panel.innerHTML = `<section class="dash-panel"><p class="login-error" role="alert">${escapeHtml(message)}</p></section>`;
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

  document.addEventListener('click', (event) => {
    const entry = event.target.closest('[data-view="patient"], [data-view="admin"]');
    if (entry) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const view = entry.dataset.view;
      document.querySelector('#mobile-panel')?.classList.remove('open');
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
    if (event.target.closest('[data-live-logout]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      client?.auth.signOut().finally(() => { activeUser = null; activeProfile = null; closeModal(); showLogin(requestedView); });
    }
  }, true);

  document.addEventListener('submit', async (event) => {
    if (event.target.id !== 'ent-login-form') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Verificando…';
    try {
      const email = new FormData(form).get('email');
      const password = new FormData(form).get('password');
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
    if (event.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
  });
})();
