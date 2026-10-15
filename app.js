const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
const toast = document.querySelector('#toast');
let selectedPlan = 'light';
let selectedDuration = '6';
let selectedPayment = 'transfer';
let toastTimer;

const planNames = {light:'Light',weight:'Weight',best:'Best'};
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

function startEnrollment(plan='light', competitionOnly=false) {
  selectedPlan = plan;
  selectedDuration = '6';
  selectedPayment = 'transfer';
  const options=competitionOnly
    ? `<button type="button" class="select-plan selected" data-select-plan="best"><strong>Best</strong><span>Dieta, entrenamiento y preparación enfocada a competir.</span></button>`
    : `<button type="button" class="select-plan ${plan==='light'?'selected':''}" data-select-plan="light"><strong>Light</strong><span>Consultas, valoraciones y dieta en tu perfil.</span></button><button type="button" class="select-plan ${plan==='weight'?'selected':''}" data-select-plan="weight"><strong>Weight</strong><span>Light + entrenamiento y orientación en suplementación.</span></button>`;
  openModal(`<div class="modal-kicker">${competitionOnly?'PREPARACIÓN DE COMPETENCIA':'SOLICITUD DE INGRESO'} · VISTA PREVIA</div>
    <h2 id="modal-title">${competitionOnly?'Un plan para tu meta competitiva.':'Elige tu acompañamiento.'}</h2>
    <p class="modal-lede">${competitionOnly?'El Plan Best es la opción de ENT para preparación enfocada a fisicoculturismo.':'Selecciona entre los planes Light y Weight y deja tus datos para coordinar una valoración.'}</p>
    <div class="plan-select-grid ${competitionOnly?'competition-only':''}">
      ${options}
    </div>
    <label class="form-label">Duración</label>
    <div class="duration-row"><button class="duration-choice selected" type="button" data-duration="6">6 meses</button><button class="duration-choice" type="button" data-duration="12">1 año</button><span class="form-label" style="margin:11px 0 0 7px;color:#88928b">Precio por confirmar</span></div>
    <form id="enrollment-form">
      <div class="form-grid"><div><label class="form-label" for="full-name">Nombre completo</label><input class="input" id="full-name" required placeholder="Tu nombre" autocomplete="name" /></div><div><label class="form-label" for="email">Correo electrónico</label><input class="input" id="email" type="email" required placeholder="tu@correo.com" autocomplete="email" /></div><div><label class="form-label" for="phone">WhatsApp</label><input class="input" id="phone" type="tel" required placeholder="Número con lada" autocomplete="tel" /></div><div><label class="form-label" for="goal">Objetivo principal</label><select class="select" id="goal"><option>Mejorar hábitos y composición corporal</option><option>Rendimiento deportivo</option><option>Preparación para competir</option><option>Otro objetivo</option></select></div></div>
      <label class="form-label">Forma de pago preferida</label>
      <div class="payment-row"><button type="button" class="payment-choice selected" data-payment="transfer"><strong>Transferencia</strong>Se compartirán los datos al confirmar.</button><button type="button" class="payment-choice" data-payment="office"><strong>Efectivo en consultorio</strong>El equipo confirmará dirección y horario.</button></div>
      <div class="preview-callout">La solicitud no confirma una compra ni genera una cuenta. En la versión final, el administrador revisará tus datos, acordará la valoración y dará de alta tus credenciales.</div>
      <button class="button button-dark form-submit" type="submit">Enviar solicitud de demostración <span>↗</span></button><p class="form-note">Demostración local: este botón no envía datos ni abre WhatsApp.</p>
    </form>`);
}

function patientDashboard() {
  openModal(`<div class="dashboard">
    <div class="dashboard-header"><div><div class="modal-kicker">PORTAL DE PACIENTE</div><div class="profile-head"><div class="avatar" aria-label="Foto de perfil de demostración"><svg viewBox="0 0 48 48" role="img" aria-label="Silueta de perfil"><circle cx="24" cy="17" r="8" fill="currentColor"/><path d="M8 43c1-9 7-14 16-14s15 5 16 14" fill="currentColor"/></svg></div><div><h2 id="modal-title">Mariana López</h2><p>Paciente de demostración · Plan Weight</p></div></div></div><span class="demo-label">PERFIL FICTICIO</span></div>
    <nav class="dashboard-tabs" aria-label="Secciones del perfil"><button class="dash-tab active" data-dash="resumen">Resumen</button><button class="dash-tab" data-dash="dieta">Mi dieta</button><button class="dash-tab" data-dash="mediciones">Mediciones</button><button class="dash-tab" data-dash="historial">Historial</button></nav>
    <div id="dash-content">${dashboardContent('resumen')}</div>
  </div>`);
}

function dashboardContent(tab) {
  if (tab === 'dieta') return `<div class="dash-grid"><section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Plan de alimentación</h3><span>ACTUALIZADO · 12 OCT 2026</span></div><div class="preview-callout">Ejemplo de interfaz. Los alimentos y cantidades son ilustrativos y no constituyen una recomendación nutricional.</div><div class="meal"><span class="meal-time">08:00</span><div><b>Desayuno · Ejemplo</b><small>Aquí aparecerían alimentos, porciones e indicaciones del nutriólogo.</small></div></div><div class="meal"><span class="meal-time">13:30</span><div><b>Comida · Ejemplo</b><small>El paciente podría consultar sustituciones y notas de su plan.</small></div></div><div class="meal"><span class="meal-time">19:00</span><div><b>Cena · Ejemplo</b><small>Los cambios quedarían asociados a la fecha de actualización.</small></div></div></section></div>`;
  if (tab === 'mediciones') return `<div class="dash-grid"><section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Mediciones y evolución</h3><span>ÚLTIMAS 4 VALORACIONES</span></div><div class="metric-grid"><div class="metric"><small>PESO</small><strong>64.8 <i>kg</i></strong><div class="metric-trend">Dato ficticio de muestra</div></div><div class="metric"><small>GRASA CORPORAL</small><strong>25.1 <i>%</i></strong><div class="metric-trend">Dato ficticio de muestra</div></div><div class="metric"><small>MASA MUSCULAR</small><strong>27.4 <i>kg</i></strong><div class="metric-trend">Dato ficticio de muestra</div></div></div><div class="preview-callout">En la versión funcional, las mediciones se guardarían por valoración para mostrar tendencias sin reemplazar la interpretación profesional.</div></section></div>`;
  if (tab === 'historial') return `<div class="dash-grid"><section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Historial de seguimiento</h3><span>REGISTRO INDIVIDUAL</span></div><div class="hist-row"><span><b>12 oct 2026</b><br /><small>Actualización de dieta</small></span><small>Plan alimentario · ver detalle</small></div><div class="hist-row"><span><b>28 sep 2026</b><br /><small>Valoración de seguimiento</small></span><small>Mediciones · ver detalle</small></div><div class="hist-row"><span><b>10 sep 2026</b><br /><small>Primera consulta</small></span><small>Valoración inicial · ver detalle</small></div><div class="preview-callout">Cada actualización mostraría fecha, archivos o notas y el profesional que la registró.</div></section></div>`;
  return `<div class="dash-grid"><section class="dash-panel"><div class="dash-panel-head"><h3>Mis mediciones</h3><span>ÚLTIMA VALORACIÓN · 12 OCT</span></div><div class="metric-grid"><div class="metric"><small>PESO</small><strong>64.8 <i>kg</i></strong><div class="metric-trend">Dato de demostración</div></div><div class="metric"><small>GRASA</small><strong>25.1 <i>%</i></strong><div class="metric-trend">Dato de demostración</div></div><div class="metric"><small>MÚSCULO</small><strong>27.4 <i>kg</i></strong><div class="metric-trend">Dato de demostración</div></div></div><svg class="progress-svg" viewBox="0 0 420 120" role="img" aria-label="Gráfica ilustrativa de seguimiento"><path d="M0 30H420M0 70H420M0 110H420" stroke="#e9ede7"/><path d="M0 96 C45 88 70 92 100 73 S155 83 190 63 S250 75 283 48 S345 62 420 23" fill="none" stroke="#6f9475" stroke-width="3"/><circle cx="420" cy="23" r="5" fill="#dba36e"/></svg><div class="panel-note">Gráfica ilustrativa. Los cambios de peso no se interpretan aislados; el equipo revisaría el contexto de cada medición.</div></section><section class="dash-panel"><div class="dash-panel-head"><h3>Plan actual</h3><span>WEIGHT</span></div><div class="meal"><span class="meal-time">HOY</span><div><b>Alimentación</b><small>Consulta tu actualización más reciente</small></div></div><div class="meal"><span class="meal-time">HOY</span><div><b>Entrenamiento</b><small>Rutina asignada · ver detalle</small></div></div><div class="nutrition-summary">Próxima consulta <b>Por confirmar</b></div><div class="panel-note">Este espacio se actualizaría cuando tu nutriólogo publique un nuevo seguimiento.</div></section><section class="dash-panel dash-content-wide"><div class="dash-panel-head"><h3>Actividad reciente</h3><span>HISTORIAL</span></div><div class="hist-row"><span>Actualización de dieta</span><small>12 oct · Disponible</small></div><div class="hist-row"><span>Valoración de seguimiento</span><small>28 sep · Registrada</small></div></section></div>`;
}

function adminDashboard() {
  openModal(`<div class="dashboard"><div class="dashboard-header"><div><div class="modal-kicker">PANEL DEL PROFESIONAL</div><h2 id="modal-title">Administración ENT</h2><p class="modal-lede" style="margin:4px 0 0">Solicitudes, expedientes y consultas</p></div><span class="demo-label">DATOS FICTICIOS</span></div>
    <div class="admin-summary-grid"><div><small>SOLICITUDES NUEVAS</small><strong>02</strong><span>Por revisar</span></div><div><small>PACIENTES ACTIVOS</small><strong>03</strong><span>En seguimiento</span></div><div><small>CONSULTAS PRÓXIMAS</small><strong>01</strong><span>Esta semana</span></div></div>
    <section class="dash-panel admin-section"><div class="dash-panel-head"><h3>Solicitudes en línea</h3><button class="text-link" data-admin-action="whatsapp">Simular aviso WhatsApp</button></div><div class="table-scroll"><table class="admin-list"><thead><tr><th>NOMBRE</th><th>PLAN</th><th>RECIBIDA</th><th>ESTADO</th><th></th></tr></thead><tbody><tr><td>Nadia Pérez</td><td>Light · 6 meses</td><td>14 oct</td><td><span class="status pending">Nueva</span></td><td><button class="text-link" data-admin-action="review">Revisar</button></td></tr><tr><td>Omar Chan</td><td>Best · 1 año</td><td>13 oct</td><td><span class="status pending">Nueva</span></td><td><button class="text-link" data-admin-action="review">Revisar</button></td></tr></tbody></table></div></section>
    <section class="dash-panel admin-section"><div class="admin-actions"><div><div class="dash-panel-head"><h3>Pacientes activos</h3></div><span class="modal-kicker">03 EXPEDIENTES</span></div><button class="button button-dark" data-admin-action="new">+ Alta manual</button></div><div class="table-scroll"><table class="admin-list"><thead><tr><th>PACIENTE</th><th>PLAN</th><th>ÚLTIMA ACTUALIZACIÓN</th><th>ESTADO</th><th></th></tr></thead><tbody><tr><td>Mariana López</td><td>Weight</td><td>12 oct 2026</td><td><span class="status">Al día</span></td><td><button class="text-link" data-admin-action="edit">Abrir</button></td></tr><tr><td>Diego Herrera</td><td>Light</td><td>05 oct 2026</td><td><span class="status pending">Por revisar</span></td><td><button class="text-link" data-admin-action="edit">Abrir</button></td></tr><tr><td>Lucía Méndez</td><td>Best</td><td>28 sep 2026</td><td><span class="status">Al día</span></td><td><button class="text-link" data-admin-action="edit">Abrir</button></td></tr></tbody></table></div></section>
    <div class="preview-callout">Las solicitudes y notificaciones son ejemplos. Esta demostración no guarda datos, agenda citas ni envía mensajes.</div></div>`);
}

function reviewApplication() {
  openModal(`<div class="dashboard"><div class="modal-kicker">SOLICITUD EN LÍNEA · DEMOSTRACIÓN</div><h2 id="modal-title">Nadia Pérez</h2><p class="modal-lede">Plan Light · 6 meses · Prefiere transferencia · Solicitud recibida el 14 de octubre.</p><form id="appointment-form"><div class="form-grid"><div><label class="form-label" for="appointment-date">Fecha de valoración</label><input class="input" id="appointment-date" type="date" required /></div><div><label class="form-label" for="appointment-time">Horario</label><input class="input" id="appointment-time" type="time" required /></div><div><label class="form-label" for="appointment-type">Modalidad</label><select class="select" id="appointment-type"><option>Consulta presencial</option><option>Consulta en línea</option></select></div><div><label class="form-label" for="appointment-place">Lugar o enlace</label><input class="input" id="appointment-place" placeholder="Dirección del consultorio (pendiente)" /></div></div><div class="preview-callout">Al confirmar, la persona recibiría la fecha y el horario acordados. En esta vista previa no se agenda ni se manda el mensaje.</div><button class="button button-dark" type="submit">Simular confirmación de consulta</button></form><button class="button button-outline admin-back" data-admin-action="whatsapp">Simular aviso por WhatsApp al administrador</button></div>`);
}

function adminCreatePatient() {
  openModal(`<div class="dashboard"><div class="modal-kicker">ALTA MANUAL · DEMOSTRACIÓN</div><h2 id="modal-title">Crear expediente de paciente</h2><p class="modal-lede">La cuenta y las credenciales se habilitarían al guardar en el sistema final.</p><form id="new-patient-form"><div class="form-grid"><div><label class="form-label" for="new-name">Nombre completo</label><input class="input" id="new-name" required placeholder="Nombre del paciente" /></div><div><label class="form-label" for="new-email">Correo electrónico</label><input class="input" id="new-email" required type="email" placeholder="correo@ejemplo.com" /></div><div><label class="form-label" for="new-phone">WhatsApp</label><input class="input" id="new-phone" type="tel" placeholder="Número con lada" /></div><div><label class="form-label" for="new-plan">Plan</label><select class="select" id="new-plan"><option>Light</option><option>Weight</option><option>Best</option></select></div></div><div class="preview-callout">Por seguridad, el sistema final debería enviar una invitación para que cada paciente cree su contraseña; el administrador no necesita asignar ni conocerla.</div><button class="button button-dark" type="submit">Simular alta de paciente</button></form></div>`);
}

function adminEditor() {
  openModal(`<div class="dashboard"><div class="modal-kicker">EXPEDIENTE · DEMOSTRACIÓN</div><h2 id="modal-title">Nueva actualización</h2><p class="modal-lede">Mariana López · Plan Weight · Los cambios solo se simulan en esta vista previa.</p><div class="admin-update"><div><label class="form-label">Peso (kg)</label><input class="input" placeholder="Ej. 64.8" /></div><div><label class="form-label">Grasa corporal (%)</label><input class="input" placeholder="Ej. 25.1" /></div><div><label class="form-label">Masa muscular (kg)</label><input class="input" placeholder="Ej. 27.4" /></div><div><label class="form-label">Próxima consulta</label><input class="input" type="date" /></div><div><label class="form-label">Dieta / indicaciones</label><textarea placeholder="Resumen de la actualización (contenido de prueba)"></textarea></div></div><div class="preview-callout">Al publicar una actualización en el sistema final, el paciente recibiría un aviso. Aquí no se guarda ni se envía nada.</div><button class="button button-dark" data-admin-action="publish">Simular actualización</button></div>`);
}

document.addEventListener('click',(event)=>{
  const viewButton=event.target.closest('[data-view]');
  if(viewButton){const view=viewButton.dataset.view;document.querySelector('#mobile-panel').classList.remove('open');document.querySelector('.mobile-menu').setAttribute('aria-expanded','false');document.querySelector('.mobile-menu').setAttribute('aria-label','Abrir menú');document.querySelector('.mobile-menu').textContent='☰';if(view==='patient')patientDashboard();else if(view==='admin')adminDashboard();else if(view==='competition')startEnrollment('best',true);else startEnrollment('light');return;}
  const planButton=event.target.closest('[data-plan]');if(planButton){startEnrollment(planButton.dataset.plan,planButton.dataset.plan==='best');return;}
  const selectPlan=event.target.closest('[data-select-plan]');if(selectPlan){selectedPlan=selectPlan.dataset.selectPlan;modal.querySelectorAll('[data-select-plan]').forEach(b=>b.classList.toggle('selected',b.dataset.selectPlan===selectedPlan));return;}
  const duration=event.target.closest('[data-duration]');if(duration){selectedDuration=duration.dataset.duration;modal.querySelectorAll('[data-duration]').forEach(b=>b.classList.toggle('selected',b.dataset.duration===selectedDuration));return;}
  const payment=event.target.closest('[data-payment]');if(payment){selectedPayment=payment.dataset.payment;modal.querySelectorAll('[data-payment]').forEach(b=>b.classList.toggle('selected',b.dataset.payment===selectedPayment));return;}
  const tab=event.target.closest('[data-dash]');if(tab){modal.querySelectorAll('[data-dash]').forEach(b=>b.classList.toggle('active',b===tab));document.querySelector('#dash-content').innerHTML=dashboardContent(tab.dataset.dash);return;}
  const admin=event.target.closest('[data-admin-action]');if(admin){const action=admin.dataset.adminAction;if(action==='edit')adminEditor();if(action==='new')adminCreatePatient();if(action==='review')reviewApplication();if(action==='whatsapp')showToast('Demostración: no se abrió WhatsApp ni se envió un mensaje.');if(action==='publish')showToast('Demostración: no se guardó ni se envió ninguna actualización.');return;}
  if(event.target.closest('.modal-close'))closeModal();
  const mobileLink=event.target.closest('.mobile-panel a');if(mobileLink){document.querySelector('#mobile-panel').classList.remove('open');document.querySelector('.mobile-menu').setAttribute('aria-expanded','false');document.querySelector('.mobile-menu').setAttribute('aria-label','Abrir menú');document.querySelector('.mobile-menu').textContent='☰';}
});
modal.addEventListener('click',(event)=>{if(event.target===modal)closeModal();});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&modal.classList.contains('open'))closeModal();});
document.addEventListener('submit',(event)=>{if(event.target.id==='enrollment-form'){event.preventDefault();showToast(`Vista previa: solicitud ${planNames[selectedPlan]} · ${selectedDuration} meses · ${selectedPayment==='transfer'?'transferencia':'consultorio'}. No se envió.`);closeModal();}if(event.target.id==='appointment-form'){event.preventDefault();showToast('Demostración: cita no guardada ni enviada.');closeModal();}if(event.target.id==='new-patient-form'){event.preventDefault();showToast('Demostración: expediente no creado.');closeModal();}});
document.querySelector('.mobile-menu').addEventListener('click',(event)=>{const button=event.currentTarget;const open=!document.querySelector('#mobile-panel').classList.contains('open');document.querySelector('#mobile-panel').classList.toggle('open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');button.textContent=open?'×':'☰';});
