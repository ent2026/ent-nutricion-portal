const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
const toast = document.querySelector('#toast');
let toastTimer;

const consultationServices = {
  initial: { label: 'Consulta inicial', detail: 'Primera valoración y programa personalizado.', months: 1, price: 'consult_initial_price' },
  followup: { label: 'Consulta de seguimiento', detail: 'Consulta subsecuente para revisar y ajustar el proceso.', months: 1, price: 'consult_followup_price' },
  bimonthly: { label: 'Paquete bimestral · 2 consultas', detail: 'Dos consultas individuales, una por mes.', months: 2, price: 'consult_bimonthly_price' },
  quarterly: { label: 'Paquete trimestral · 3 consultas', detail: 'Tres consultas individuales, una por mes.', months: 3, price: 'consult_quarterly_price' },
  semester: { label: 'Paquete semestral · 6 consultas', detail: 'Seis consultas individuales, una por mes.', months: 6, price: 'consult_semester_price' },
  couple: { label: 'Consulta en pareja · 2 personas', detail: 'Una valoración individual para cada persona.', months: 1, price: 'consult_couple_price' }
};
const publicClient = window.ENT_SUPABASE_CLIENT || (window.ENT_SUPABASE_CONFIG && window.supabase?.createClient ? window.supabase.createClient(window.ENT_SUPABASE_CONFIG.url, window.ENT_SUPABASE_CONFIG.publishableKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null);
if (publicClient) window.ENT_SUPABASE_CLIENT = publicClient;
let siteSettings = null;
const escapeHtml = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => value == null || value === '' ? 'Por confirmar' : new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(Number(value));
function refreshPublicSettings(){
  for(const field of ['consult_initial_price','consult_followup_price','consult_bimonthly_price','consult_quarterly_price','consult_semester_price','consult_couple_price']){
    document.querySelectorAll('[data-consult-price="'+field+'"]').forEach(el=>{el.textContent=money(siteSettings?.[field]);});
  }
  const validUntil=document.querySelector('[data-consult-valid-until]');
  if(validUntil&&siteSettings?.consult_prices_valid_until){
    const [year,month,day]=String(siteSettings.consult_prices_valid_until).slice(0,10).split('-').map(Number);
    validUntil.textContent=new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',year:'numeric'}).format(new Date(year,month-1,day));
  }
  const host=document.querySelector('#public-announcement');if(!host||!siteSettings)return;
  const now=Date.now(),start=siteSettings.announcement_starts_at?Date.parse(siteSettings.announcement_starts_at):0,end=siteSettings.announcement_ends_at?Date.parse(siteSettings.announcement_ends_at):Infinity;
  if(!siteSettings.announcement_active||!siteSettings.announcement_title||!siteSettings.announcement_body||now<start||now>end)return;
  host.hidden=false;host.innerHTML='<article class="announcement-card"><div class="announcement-mark">ENT <span>·</span> AVISO</div><div><h2>'+escapeHtml(siteSettings.announcement_title)+'</h2><p>'+escapeHtml(siteSettings.announcement_body).replace(/\n/g,'<br>')+'</p></div></article>';
}
async function loadPublicSettings(){
  if(!publicClient)return;
  const {data,error}=await publicClient.from('site_configuration').select('*').eq('id',1).maybeSingle();
  if(error){console.warn('No fue posible cargar la configuración pública de ENT.');return;}
  siteSettings=data;refreshPublicSettings();
  const bankDetails=document.querySelector('#transfer-details');if(bankDetails)bankDetails.textContent=[siteSettings.bank_account_holder,siteSettings.bank_name,siteSettings.bank_clabe?'CLABE '+siteSettings.bank_clabe:null].filter(Boolean).join(' · ')||'Los datos bancarios se confirmarán con ENT.';
  const officeDetails=document.querySelector('#office-details');if(officeDetails&&siteSettings.office_address)officeDetails.textContent='Pago en la primera cita presencial · '+siteSettings.office_address;
}
loadPublicSettings();
const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
};
const openModal = (html) => {
  modalContent.innerHTML = html;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  modal.querySelector('.modal-close').focus();
};
const closeModal = () => {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
};

async function startEnrollment(serviceCode='initial', objective='') {
  if (!siteSettings) await loadPublicSettings();
  const service = consultationServices[serviceCode]; if (!service) return;
  const price = money(siteSettings?.[service.price]);
  const bankRows = [['Titular de la cuenta',siteSettings?.bank_account_holder],['Banco',siteSettings?.bank_name], [siteSettings?.bank_reference_type || 'CLABE interbancaria',siteSettings?.bank_reference_value || siteSettings?.bank_clabe], ...(siteSettings?.bank_secondary_name ? [['Segundo banco',siteSettings.bank_secondary_name],[siteSettings.bank_secondary_reference_type || 'CLABE interbancaria',siteSettings.bank_secondary_reference_value]] : [])];
  const bankHtml = bankRows.map(([label,value]) => value
    ? `<div class="bank-copy-row"><span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span><button class="button button-outline bank-copy-button" type="button" data-copy-text="${escapeHtml(value)}">Copiar</button></div>`
    : `<div class="bank-copy-row"><span><small>${escapeHtml(label)}</small><strong>Dato pendiente de configurar</strong></span></div>`).join('');
  const bankMissing = bankRows.some(([,value]) => !value);
  openModal(`<div class="modal-kicker">SOLICITUD DE CONSULTA ENT</div><h2 id="modal-title">${escapeHtml(service.label)}</h2>
    <p class="modal-lede">${escapeHtml(service.detail)} ENT revisará tus datos y se pondrá en contacto para coordinar la cita.</p>
    <div class="selected-price">Precio vigente: ${escapeHtml(price)} MXN</div>
    <form id="consultation-request-form" data-service="${escapeHtml(serviceCode)}">
      <div class="form-grid">
        <div><label class="form-label" for="request-full-name">Nombre completo</label><input class="input" id="request-full-name" name="full_name" required minlength="2" maxlength="160" autocomplete="name" /></div>
        <div><label class="form-label" for="request-age">Edad</label><input class="input" id="request-age" name="age" type="number" min="1" max="120" step="1" required inputmode="numeric" /></div><div><label class="form-label" for="request-phone">Teléfono / WhatsApp</label><input class="input" id="request-phone" name="phone" type="tel" required minlength="7" maxlength="40" autocomplete="tel" inputmode="tel" /></div>
        <div><label class="form-label" for="request-objective">Objetivo principal</label><select class="select" id="request-objective" name="objective" required><option value="" disabled selected>Selecciona tu objetivo</option><option>Mejorar hábitos y composición corporal</option><option>Rendimiento deportivo</option><option ${objective==='Preparación para competir'?'selected':''}>Preparación para competir</option><option>Otro objetivo</option></select></div>
      </div>
      <label class="form-label">Método de pago</label>
      <div class="payment-row"><label class="payment-choice selected"><input type="radio" name="payment_preference" value="transfer" checked><strong>Transferencia bancaria</strong><span>Usa los botones para copiar cada dato y pegarlo en tu banca móvil.</span></label></div>
      <div class="bank-copy-list">${bankHtml}</div>${siteSettings?.transfer_instructions ? `<p class="field-help bank-instructions">${escapeHtml(siteSettings.transfer_instructions)}</p>` : ''}
      ${bankMissing?'<div class="preview-callout">ENT aún debe configurar los datos bancarios. Confírmalos con el consultorio antes de transferir.</div>':''}
      <div class="proof-upload"><label class="form-label" for="request-payment-proof">Comprobante de transferencia</label><input class="input" id="request-payment-proof" name="payment_proof" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" aria-describedby="request-payment-proof-help" required /><small class="field-help" id="request-payment-proof-help" role="status">Obligatorio · PDF o imagen · máximo 5 MB. Adjunta el comprobante para habilitar el envío.</small></div>
      <div class="preview-callout">Enviar la solicitud no confirma un pago ni una cita. No incluyas información médica sensible aquí.</div>
      <label class="consent-row"><input type="checkbox" name="consent" required><span>Autorizo a ENT a usar mis datos para responder esta solicitud y coordinar mi atención.</span></label><label class="consent-row"><input type="checkbox" name="whatsapp_consent" required><span>Acepto recibir por WhatsApp avisos sobre mi solicitud, cita y acceso al portal ENT.</span></label>
      <button class="button button-dark form-submit" type="submit" disabled>Enviar solicitud <span>↗</span></button><p class="form-note" id="request-feedback" role="status">Al enviar, se registrará en ENT y se abrirá WhatsApp con un aviso listo para confirmar.</p>
    </form>`);

}
function patientDashboard() {
  openModal(`<div class="dashboard">
    <div class="dashboard-header"><div><div class="modal-kicker">PORTAL DE PACIENTE</div><div class="profile-head"><div class="avatar" aria-label="Foto de perfil de demostración"><svg viewBox="0 0 48 48" role="img" aria-label="Silueta de perfil"><circle cx="24" cy="17" r="8" fill="currentColor"/><path d="M8 43c1-9 7-14 16-14s15 5 16 14" fill="currentColor"/></svg></div><div><h2 id="modal-title">Mariana López</h2><p>Paciente de demostración · Consulta de seguimiento</p></div></div></div><span class="demo-label">PERFIL FICTICIO</span></div>
    <nav class="dashboard-tabs" aria-label="Secciones del perfil"><button class="dash-tab active" data-dash="resumen">Resumen</button><button class="dash-tab" data-dash="dieta">Mi dieta</button><button class="dash-tab" data-dash="mediciones">Mediciones</button><button class="dash-tab" data-dash="historial">Historial</button></nav>
    <div id="dash-content">${dashboardContent('resumen')}</div>
  </div>`);
}

function dashboardContent(tab) {
  if (tab === 'dieta') return `<div class="dash-grid"><section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Plan de alimentación</h3><span>ACTUALIZADO · 12 OCT 2026</span></div><div class="preview-callout">Ejemplo de interfaz. Los alimentos y cantidades son ilustrativos y no constituyen una recomendación nutricional.</div><div class="meal"><span class="meal-time">08:00</span><div><b>Desayuno · Ejemplo</b><small>Aquí aparecerían alimentos, porciones e indicaciones del nutriólogo.</small></div></div><div class="meal"><span class="meal-time">13:30</span><div><b>Comida · Ejemplo</b><small>El paciente podría consultar sustituciones y notas de su plan.</small></div></div><div class="meal"><span class="meal-time">19:00</span><div><b>Cena · Ejemplo</b><small>Los cambios quedarían asociados a la fecha de actualización.</small></div></div></section></div>`;
  if (tab === 'mediciones') return `<div class="dash-grid"><section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Mediciones y evolución</h3><span>ÚLTIMAS 4 VALORACIONES</span></div><div class="metric-grid"><div class="metric"><small>PESO</small><strong>64.8 <i>kg</i></strong><div class="metric-trend">Dato ficticio de muestra</div></div><div class="metric"><small>GRASA CORPORAL</small><strong>25.1 <i>%</i></strong><div class="metric-trend">Dato ficticio de muestra</div></div><div class="metric"><small>MASA MUSCULAR</small><strong>27.4 <i>kg</i></strong><div class="metric-trend">Dato ficticio de muestra</div></div></div><div class="preview-callout">En la versión funcional, las mediciones se guardarían por valoración para mostrar tendencias sin reemplazar la interpretación profesional.</div></section></div>`;
  if (tab === 'historial') return `<div class="dash-grid"><section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Historial de seguimiento</h3><span>REGISTRO INDIVIDUAL</span></div><div class="hist-row"><span><b>12 oct 2026</b><br /><small>Actualización de dieta</small></span><small>Plan alimentario · ver detalle</small></div><div class="hist-row"><span><b>28 sep 2026</b><br /><small>Valoración de seguimiento</small></span><small>Mediciones · ver detalle</small></div><div class="hist-row"><span><b>10 sep 2026</b><br /><small>Primera consulta</small></span><small>Valoración inicial · ver detalle</small></div><div class="preview-callout">Cada actualización mostraría fecha, archivos o notas y el profesional que la registró.</div></section></div>`;
  return `<div class="dash-grid"><section class="dash-panel"><div class="dash-panel-head"><h3>Mis mediciones</h3><span>ÚLTIMA VALORACIÓN · 12 OCT</span></div><div class="metric-grid"><div class="metric"><small>PESO</small><strong>64.8 <i>kg</i></strong><div class="metric-trend">Dato de demostración</div></div><div class="metric"><small>GRASA</small><strong>25.1 <i>%</i></strong><div class="metric-trend">Dato de demostración</div></div><div class="metric"><small>MÚSCULO</small><strong>27.4 <i>kg</i></strong><div class="metric-trend">Dato de demostración</div></div></div><svg class="progress-svg" viewBox="0 0 420 120" role="img" aria-label="Gráfica ilustrativa de seguimiento"><path d="M0 30H420M0 70H420M0 110H420" stroke="#e9ede7"/><path d="M0 96 C45 88 70 92 100 73 S155 83 190 63 S250 75 283 48 S345 62 420 23" fill="none" stroke="#6f9475" stroke-width="3"/><circle cx="420" cy="23" r="5" fill="#dba36e"/></svg><div class="panel-note">Gráfica ilustrativa. Los cambios de peso no se interpretan aislados; el equipo revisaría el contexto de cada medición.</div></section><section class="dash-panel"><div class="dash-panel-head"><h3>Seguimiento actual</h3><span>CONSULTA DE SEGUIMIENTO</span></div><div class="meal"><span class="meal-time">HOY</span><div><b>Alimentación</b><small>Consulta tu actualización más reciente</small></div></div><div class="meal"><span class="meal-time">HOY</span><div><b>Entrenamiento</b><small>Rutina asignada · ver detalle</small></div></div><div class="nutrition-summary">Próxima consulta <b>Por confirmar</b></div><div class="panel-note">Este espacio se actualizaría cuando tu nutriólogo publique un nuevo seguimiento.</div></section><section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Actividad reciente</h3><span>HISTORIAL</span></div><div class="hist-row"><span>Actualización de dieta</span><small>12 oct · Disponible</small></div><div class="hist-row"><span>Valoración de seguimiento</span><small>28 sep · Registrada</small></div></section></div>`;
}

function adminDashboard() {
  openModal(`<div class="dashboard"><div class="dashboard-header"><div class="admin-profile profile-head"><img class="avatar avatar-photo" src="assets/esteban-tellez.jpg" alt="Retrato de Esteban Téllez" /><div><div class="modal-kicker">PANEL DEL PROFESIONAL</div><h2 id="modal-title">Esteban Téllez</h2><p>Nutriólogo · Administración ENT</p></div></div><span class="demo-label">DATOS FICTICIOS</span></div>
    <div class="admin-summary-grid"><div><small>SOLICITUDES NUEVAS</small><strong>02</strong><span>Por revisar</span></div><div><small>PACIENTES ACTIVOS</small><strong>03</strong><span>En seguimiento</span></div><div><small>CONSULTAS PRÓXIMAS</small><strong>01</strong><span>Esta semana</span></div></div>
    <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Solicitudes en línea</h3><button class="text-link" data-admin-action="whatsapp">Simular aviso WhatsApp</button></div><div class="table-scroll"><table class="admin-list"><thead><tr><th>NOMBRE</th><th>CONSULTA O PAQUETE</th><th>RECIBIDA</th><th>ESTADO</th><th></th></tr></thead><tbody><tr><td>Nadia Pérez</td><td>Consulta inicial</td><td>14 oct</td><td><span class="status pending">Nueva</span></td><td><button class="text-link" data-admin-action="review">Revisar</button></td></tr><tr><td>Omar Chan</td><td>Paquete semestral · 6 consultas</td><td>13 oct</td><td><span class="status pending">Nueva</span></td><td><button class="text-link" data-admin-action="review">Revisar</button></td></tr></tbody></table></div></section>
    <section class="dash-panel admin-section"><div class="admin-actions"><div><div class="dash-panel-head"><h3>Pacientes activos</h3></div><span class="modal-kicker">03 EXPEDIENTES</span></div><button class="button button-dark" data-admin-action="new">+ Alta manual</button></div><div class="table-scroll"><table class="admin-list"><thead><tr><th>PACIENTE</th><th>CONSULTA O PAQUETE</th><th>ÚLTIMA ACTUALIZACIÓN</th><th>ESTADO</th><th></th></tr></thead><tbody><tr><td>Mariana López</td><td>Consulta de seguimiento</td><td>12 oct 2026</td><td><span class="status">Al día</span></td><td><button class="text-link" data-admin-action="edit">Abrir</button></td></tr><tr><td>Diego Herrera</td><td>Consulta inicial</td><td>05 oct 2026</td><td><span class="status pending">Por revisar</span></td><td><button class="text-link" data-admin-action="edit">Abrir</button></td></tr><tr><td>Lucía Méndez</td><td>Paquete semestral</td><td>28 sep 2026</td><td><span class="status">Al día</span></td><td><button class="text-link" data-admin-action="edit">Abrir</button></td></tr></tbody></table></div></section>
    <div class="preview-callout">Las solicitudes y notificaciones son ejemplos. Esta demostración no guarda datos, agenda citas ni envía mensajes.</div></div>`);
}

function reviewApplication() {
  openModal(`<div class="dashboard"><div class="modal-kicker">SOLICITUD EN LÍNEA · DEMOSTRACIÓN</div><h2 id="modal-title">Nadia Pérez</h2><p class="modal-lede">Servicio Consulta inicial · Prefiere transferencia · Solicitud recibida el 14 de octubre.</p><form id="appointment-form"><div class="form-grid"><div><label class="form-label" for="appointment-date">Fecha de valoración</label><input class="input" id="appointment-date" type="date" required /></div><div><label class="form-label" for="appointment-time">Horario</label><input class="input" id="appointment-time" type="time" required /></div><div><label class="form-label" for="appointment-type">Modalidad</label><select class="select" id="appointment-type"><option>Consulta presencial</option><option>Consulta en línea</option></select></div><div><label class="form-label" for="appointment-place">Lugar o enlace</label><input class="input" id="appointment-place" placeholder="Dirección del consultorio (pendiente)" /></div></div><div class="preview-callout">Al confirmar, la persona recibiría la fecha y el horario acordados. En esta vista previa no se agenda ni se manda el mensaje.</div><button class="button button-dark" type="submit">Simular confirmación de consulta</button></form><button class="button button-outline admin-back" data-admin-action="whatsapp">Simular aviso por WhatsApp al administrador</button></div>`);
}

function adminCreatePatient() {
  openModal(`<div class="dashboard"><div class="modal-kicker">ALTA MANUAL · DEMOSTRACIÓN</div><h2 id="modal-title">Crear expediente de paciente</h2><p class="modal-lede">La cuenta y las credenciales se habilitarían al guardar en el sistema final.</p><form id="new-patient-form"><div class="form-grid"><div><label class="form-label" for="new-name">Nombre completo</label><input class="input" id="new-name" required placeholder="Nombre del paciente" /></div><div><label class="form-label" for="new-username">Usuario</label><input class="input" id="new-username" required placeholder="nombre.apellido" /></div><div><label class="form-label" for="new-phone">WhatsApp</label><input class="input" id="new-phone" type="tel" placeholder="Número con lada" /></div><div><label class="form-label" for="new-plan">Consulta o paquete</label><select class="select" id="new-plan"><option>Consulta inicial</option><option>Consulta de seguimiento</option><option>Paquete bimestral · 2 consultas</option><option>Paquete trimestral · 3 consultas</option><option>Paquete semestral · 6 consultas</option><option>Consulta en pareja · 2 personas</option></select></div></div><div class="preview-callout">Al crear una cuenta real, el administrador genera una clave temporal que el paciente cambia al ingresar.</div><button class="button button-dark" type="submit">Simular alta de paciente</button></form></div>`);
}

function adminEditor() {
  openModal(`<div class="dashboard"><div class="modal-kicker">EXPEDIENTE · DEMOSTRACIÓN</div><h2 id="modal-title">Nueva actualización</h2><p class="modal-lede">Mariana López · Consulta de seguimiento · Los cambios solo se simulan en esta vista previa.</p><div class="admin-update"><div><label class="form-label">Peso (kg)</label><input class="input" placeholder="Ej. 64.8" /></div><div><label class="form-label">Grasa corporal (%)</label><input class="input" placeholder="Ej. 25.1" /></div><div><label class="form-label">Masa muscular (kg)</label><input class="input" placeholder="Ej. 27.4" /></div><div><label class="form-label">Próxima consulta</label><input class="input" type="date" /></div><div><label class="form-label">Dieta / indicaciones</label><textarea placeholder="Resumen de la actualización (contenido de prueba)"></textarea></div></div><div class="preview-callout">Al publicar una actualización en el sistema final, el paciente recibiría un aviso. Aquí no se guarda ni se envía nada.</div><button class="button button-dark" data-admin-action="publish">Simular actualización</button></div>`);
}

document.addEventListener('click',async (event)=>{
  const copyButton=event.target.closest('[data-copy-text]');
  if(copyButton){
    const value=copyButton.dataset.copyText || '';
    try { await navigator.clipboard.writeText(value); showToast('Dato copiado'); }
    catch {
      const field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
      const copied=document.execCommand('copy');field.remove();showToast(copied?'Dato copiado':'No se pudo copiar. Selecciona el dato y cópialo.');
    }
    return;
  }

  const consultation=event.target.closest('[data-consult-package]');
  if(consultation){startEnrollment(consultation.dataset.consultPackage,'');return;}
  const viewButton=event.target.closest('[data-view]');
  if(viewButton){const view=viewButton.dataset.view;document.querySelector('#mobile-panel').classList.remove('open');document.querySelector('.mobile-menu').setAttribute('aria-expanded','false');document.querySelector('.mobile-menu').setAttribute('aria-label','Abrir menú');document.querySelector('.mobile-menu').textContent='☰';if(view==='patient')patientDashboard();else if(view==='admin')adminDashboard();else if(view==='choose')document.querySelector('#consultas')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  const tab=event.target.closest('[data-dash]');if(tab){modal.querySelectorAll('[data-dash]').forEach(b=>b.classList.toggle('active',b===tab));document.querySelector('#dash-content').innerHTML=dashboardContent(tab.dataset.dash);return;}
  const admin=event.target.closest('[data-admin-action]');if(admin){const action=admin.dataset.adminAction;if(action==='edit')adminEditor();if(action==='new')adminCreatePatient();if(action==='review')reviewApplication();if(action==='whatsapp')showToast('Demostración: no se abrió WhatsApp ni se envió un mensaje.');if(action==='publish')showToast('Demostración: no se guardó ni se envió ninguna actualización.');return;}
  if(event.target.closest('.modal-close'))closeModal();
  const mobileLink=event.target.closest('.mobile-panel a');if(mobileLink){document.querySelector('#mobile-panel').classList.remove('open');document.querySelector('.mobile-menu').setAttribute('aria-expanded','false');document.querySelector('.mobile-menu').setAttribute('aria-label','Abrir menú');document.querySelector('.mobile-menu').textContent='☰';}
});
modal.addEventListener('click',(event)=>{if(event.target===modal)closeModal();});
const updateRequestSubmitState=(form)=>{
  if(!form||form.id!=='consultation-request-form')return;
  const input=form.querySelector('#request-payment-proof'),button=form.querySelector('[type="submit"]'),help=form.querySelector('#request-payment-proof-help');
  const file=input?.files?.[0]||null;
  const allowed=['application/pdf','image/jpeg','image/png','image/webp'];
  let issue='';
  if(file&& !allowed.includes(file.type)) issue='Usa un comprobante en PDF, JPG, PNG o WebP.';
  else if(file&&file.size>5*1024*1024) issue='El archivo debe pesar máximo 5 MB.';
  input?.setCustomValidity(issue);
  if(help) help.textContent=issue|| (file ? `Comprobante listo: ${file.name} · puedes continuar.` : 'Obligatorio · PDF o imagen · máximo 5 MB. Adjunta el comprobante para habilitar el envío.');
  if(button)button.disabled=!file||Boolean(issue)||!form.checkValidity();
};
document.addEventListener('input',(event)=>{const form=event.target.closest?.('#consultation-request-form');if(form)updateRequestSubmitState(form);});
document.addEventListener('change',(event)=>{const form=event.target.closest?.('#consultation-request-form');if(form)updateRequestSubmitState(form);});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&modal.classList.contains('open'))closeModal();});
document.addEventListener('submit',async (event)=>{
  const form=event.target;
  if(form.id==='consultation-request-form'){
    event.preventDefault();
    updateRequestSubmitState(form);
    if(!form.checkValidity()){form.reportValidity();return;}
    const proof=form.querySelector('#request-payment-proof')?.files?.[0];
    if(!proof){form.querySelector('#request-payment-proof')?.focus();return;}
    const button=form.querySelector('[type="submit"]'),feedback=form.querySelector('#request-feedback');
    button.disabled=true;button.textContent='Enviando solicitud…';
    const values=Object.fromEntries(new FormData(form).entries()),service=consultationServices[form.dataset.service];
    try{
      let adminPhone=String(siteSettings?.admin_whatsapp||'527711017152').replace(/\D/g,'');if(adminPhone.length===10)adminPhone='52'+adminPhone;
      if(!adminPhone)throw new Error('ENT aún no configuró su WhatsApp.');
      if(!publicClient)throw new Error('No hay conexión con el portal. Recarga la página e inténtalo de nuevo.');
      const payload=new FormData(form);
      payload.set('plan_code',form.dataset.service);
      payload.set('payment_preference','transfer');
      const {data,error}=await publicClient.functions.invoke('submit-consultation-request',{body:payload});
      if(error)throw error;
      if(!data?.success)throw new Error(data?.error||'No se pudo registrar la solicitud.');
      const priceText=data.price==null?'Por confirmar':money(data.price);
      const message=['*SOLICITUD DE CONSULTA ENT*','Folio: '+data.application_id,'Nombre: '+String(values.full_name||'').trim(),'Teléfono: '+String(values.phone||'').trim(),'Servicio: '+service.label,'Precio: '+priceText,'Comprobante de transferencia: cargado en el portal ENT.'].join('\n');
      form.innerHTML='<div class="request-success"><span class="success-check">✓</span><h3>Solicitud registrada</h3><p>Tu solicitud y comprobante quedaron guardados. WhatsApp se abrirá con un aviso preparado; toca Enviar ahí para notificar a ENT.</p></div>';
      window.location.href='https://wa.me/'+adminPhone+'?text='+encodeURIComponent(message);
    }catch(error){
      button.disabled=false;button.innerHTML='Reintentar envío <span>↗</span>';
      if(feedback)feedback.textContent=error?.message||'No se pudo registrar la solicitud. Revisa tus datos e inténtalo de nuevo.';
      console.error('ENT request failed:',error);
    }
    return;
  }
  if(form.id==='appointment-form'){event.preventDefault();showToast('Esta demostración no agenda ni guarda consultas.');closeModal();}
  if(form.id==='new-patient-form'){event.preventDefault();showToast('El alta real se realiza desde el administrador protegido.');closeModal();}
});
document.querySelector('.mobile-menu').addEventListener('click',(event)=>{const button=event.currentTarget;const open=!document.querySelector('#mobile-panel').classList.contains('open');document.querySelector('#mobile-panel').classList.toggle('open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');button.textContent=open?'×':'☰';});
