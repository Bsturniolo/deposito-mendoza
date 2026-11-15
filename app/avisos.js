'use strict';
/* Avisos: la app avisa de lo que está en el calendario.
   - Todos los días mientras falta para la fecha.
   - El mismo día (o si ya se pasó) cada 6 horas.
   Funciona mientras la app está abierta o minimizada. */

const SEIS_HS = 6 * 3600 * 1000;
const avisosOk = () => 'Notification' in window;
const avisosLeer = () => { try { return JSON.parse(localStorage.getItem('avisos') || '{}') || {}; } catch (e) { return {}; } };
const avisosGuardar = (o) => { try { localStorage.setItem('avisos', JSON.stringify(o)); } catch (e) { /* sin lugar */ } };

function avisosBanner() {
  if (!avisosOk() || Notification.permission === 'granted') return '';
  if (Notification.permission === 'denied') return '<div class="card alerta mt small">🔕 Los avisos están bloqueados en este dispositivo. Para que la app te avise, permití las notificaciones de esta página desde el candado de la barra de direcciones.</div>';
  return '<div class="card alerta mt"><div class="spread"><span><b>🔔 Activá los avisos</b><br><span class="small muted">Así la app te recuerda entregas, préstamos y pagos aunque no la estés mirando.</span></span><button class="acc" data-act="avisosActivar">Activar avisos</button></div></div>';
}
function pedirPermisoAvisos() {
  if (!avisosOk() || Notification.permission !== 'default') return;
  try { const p = Notification.requestPermission(() => render()); if (p && p.then) p.then(() => { render(); avisosTick(); }).catch(() => {}); } catch (e) { /* no se puede pedir */ }
}

// Lista de lo que hay que avisar ahora: [{ key, cada: 'dia' | '6h', txt }]
function avisosLista() {
  const hoy = todayStr(), out = [];
  state.eventos.forEach((e) => {
    if (e.hecho || e.aviso === 'no' || !e.fecha) return;
    const faltan = daysBetween(hoy, e.fecha);
    const que = (e.tipo === 'prestamo' ? 'Préstamo' + (e.quien ? ' a ' + e.quien : '') + ': ' : '') + e.titulo;
    if (faltan > 0) { if ((e.aviso || 'diario') === 'diario') out.push({ key: e.id, cada: 'dia', txt: (faltan === 1 ? 'Mañana' : `Faltan ${faltan} días`) + ': ' + que }); }
    else out.push({ key: e.id, cada: '6h', txt: (faltan === 0 ? 'Hoy' + (e.hora ? ' ' + e.hora : '') : `Atrasado (${hace(-faltan)})`) + ': ' + que });
  });
  const dm = state.config.diasMuestra || 7;
  muestrasAfuera().forEach((m) => { const d = daysBetween(m.fecha, hoy); if (d >= dm) out.push({ key: 'mu-' + m.id, cada: 'dia', txt: `Buscar la muestra de ${m.cliente} (${hace(d)})` }); });
  return out;
}
async function mostrarAviso(titulo, cuerpo) {
  if (!avisosOk() || Notification.permission !== 'granted') { toast('🔔 ' + titulo); return; }
  const op = { body: cuerpo, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'deposito-avisos', renotify: true };
  try {
    const reg = navigator.serviceWorker && location.protocol.startsWith('http') ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) { await reg.showNotification(titulo, op); return; }
  } catch (e) { /* sigue con el aviso común */ }
  try { const n = new Notification(titulo, op); n.onclick = () => { window.focus(); go('calendario'); n.close(); }; } catch (e) { toast('🔔 ' + titulo); }
}
function avisosTick() {
  if (typeof state === 'undefined' || !state.eventos) return;
  const h = new Date().getHours(); if (h < 7 || h >= 22) return; // de noche no molesta
  const visto = avisosLeer(), hoy = todayStr(), ahora = Date.now();
  const lista = avisosLista();
  const toca = lista.filter((a) => { const v = visto[a.key] || {}; return a.cada === 'dia' ? v.d !== hoy : !(v.t && ahora - v.t < SEIS_HS); });
  // limpia lo que ya no existe
  const vivos = new Set(lista.map((a) => a.key)); Object.keys(visto).forEach((k) => { if (!vivos.has(k)) delete visto[k]; });
  if (toca.length) {
    toca.forEach((a) => { visto[a.key] = { d: hoy, t: ahora }; });
    mostrarAviso(toca.length === 1 ? toca[0].txt : `Tenés ${toca.length} cosas para acordarte`, toca.length === 1 ? 'Depósito Mendoza' : toca.slice(0, 6).map((a) => '• ' + a.txt).join('\n'));
  }
  avisosGuardar(visto);
}
Object.assign(ACTS, {
  avisosActivar: () => {
    if (!avisosOk()) return toast('Este dispositivo no permite avisos.');
    const fin = () => { render(); if (Notification.permission === 'granted') { localStorage.removeItem('avisos'); mostrarAviso('Avisos activados ✓', 'Te voy a recordar lo que anotes en el calendario.'); setTimeout(avisosTick, 4000); } };
    try { const p = Notification.requestPermission(fin); if (p && p.then) p.then(fin).catch(() => {}); } catch (e) { toast('No se pudieron activar los avisos.'); }
  },
});
setTimeout(avisosTick, 8000);
setInterval(avisosTick, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) avisosTick(); });
