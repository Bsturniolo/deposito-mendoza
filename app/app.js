'use strict';
/* Depósito Mendoza — gestión de stock por talle, ventas, compras, muestras, plata y calendario.
   Los datos se guardan en el navegador (IndexedDB) y, si hay Firebase configurado,
   se sincronizan entre todos los usuarios del negocio. En la PC (Electron) además
   se guarda un respaldo automático en Documentos. */

// ---------- Utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const numIn = (v) => { // acepta "1500", "1500.5", "1.500,50", "85.000"
  let s = String(v ?? '').trim().replace(/[$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s); return isFinite(n) ? n : 0;
};
const fmtMoney = (n) => { const v = Number(n) || 0; return (v < 0 ? '−' : '') + '$ ' + Math.abs(v).toLocaleString('es-AR', { maximumFractionDigits: 0 }); };
const fmtNum = (n) => (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => ymd(new Date());
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, k) => { const d = parseD(s); d.setDate(d.getDate() + k); return ymd(d); };
const fmtDate = (s) => s ? parseD(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const fmtDateC = (s) => s ? parseD(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '';
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MES_C = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const mesLbl = (m) => MESES[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
const hace = (dias) => dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
const telWa = (t) => { let s = String(t || '').replace(/\D/g, ''); if (!s) return ''; if (s.startsWith('549')) return s; if (s.startsWith('54')) return '549' + s.slice(2); if (s.startsWith('0')) s = s.slice(1); s = s.replace(/^(\d{2,4})15/, '$1'); return '549' + s; };
const waLink = (tel, txt) => `https://wa.me/${telWa(tel)}?text=${encodeURIComponent(txt)}`;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2800);
}

// ---------- Datos ----------
const PAGOS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cuenta corriente'];
const CATS = {
  gasto: ['Alquiler', 'Sueldos', 'Flete y combustible', 'Luz / Gas / Agua', 'Internet / Teléfono', 'Impuestos', 'Publicidad', 'Mantenimiento', 'Otro gasto'],
  inversion: ['Mercadería', 'Equipamiento', 'Vehículo', 'Mejoras del depósito', 'Otra inversión'],
  ingreso: ['Aporte de dinero', 'Otro ingreso'],
};
const TIPOS_MOV = { gasto: { lbl: 'Gasto', cls: 'out' }, inversion: { lbl: 'Inversión', cls: 'pri' }, ingreso: { lbl: 'Ingreso', cls: 'in' } };
const TIPOS_EV = {
  recordatorio: { lbl: 'Recordatorio', ico: '🔔', dot: '' },
  visita: { lbl: 'Visita a cliente', ico: '🚗', dot: 'acc' },
  entrega: { lbl: 'Entrega', ico: '📦', dot: 'acc' },
  pagar: { lbl: 'Pagar', ico: '🔴', dot: 'out' },
  cobrar: { lbl: 'Cobrar', ico: '🟢', dot: 'in' },
  evento: { lbl: 'Evento', ico: '🎉', dot: '' },
  prestamo: { lbl: 'Préstamo (me lo tienen que devolver)', ico: '🤝', dot: 'acc' },
};
const MOTIVOS = {
  entrada: ['Llegó mercadería (sin factura)', 'Devolución de cliente', 'Cambio', 'Otro'],
  salida: ['Envío / entrega sin venta', 'Rotura o falla', 'Cambio', 'Uso propio', 'Otro'],
};

const EMPTY = () => ({
  version: 1,
  config: { negocio: 'Depósito Mendoza S.A.S.', telefono: '261 5734936', talles: '35-45', diasMuestra: 7, avisoDias: 3, ultimoRespaldo: null, cuit: '', direccion: '', email: '', iva: '', presuNota: '' },
  productos: [], stockMovs: [], ventas: [], compras: [], muestras: [], movimientos: [], eventos: [], chat: [], archivos: [], presupuestos: [],
});
const COLS = ['productos', 'stockMovs', 'ventas', 'compras', 'muestras', 'movimientos', 'eventos', 'chat', 'archivos', 'presupuestos'];
let state = EMPTY();

// ---------- Talles: cada artículo tiene los suyos ----------
const TU = 'Único';
const ROPA = 'S,M,L,XL,XXL';
const CATEG = { 'Calzado': '35-45', 'Camisa': ROPA, 'Remera': ROPA, 'Chomba': ROPA, 'Pantalón': '38,40,42,44,46,48,50,52,54', 'Campera': ROPA, 'Buzo': ROPA, 'Gorra': TU, 'Guantes': TU, 'Otro': TU };
function parseTalles(str) {
  const t = String(str || '').trim();
  const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m && +m[2] >= +m[1] && +m[2] - +m[1] < 80) { const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(String(i)); return out; }
  const out = t.split(/[,;\s]+/).filter(Boolean).map((x) => /^(unic[oa]|únic[oa]|u|unico)$/i.test(x) ? TU : /^(x{0,3}[sml]|xxxl)$/i.test(x) ? x.toUpperCase() : x);
  return out.length ? [...new Set(out)] : [TU];
}
const catDe = (p) => (p && p.categoria) || 'Calzado';
function tallesDe(p) {
  if (!p) return [];
  const base = parseTalles(p.tallesDef || (catDe(p) === 'Calzado' ? state.config.talles : CATEG[catDe(p)]) || TU);
  Object.keys(p.talles || {}).forEach((t) => { if (!base.includes(t) && Number(p.talles[t])) base.push(t); });
  return base;
}
const sinTalle = (p) => { const t = tallesDe(p); return t.length === 1 && t[0] === TU; };
const tl = (t) => t && t !== TU ? t : '';
const artLbl = (p) => (p.codigo ? p.codigo + ' · ' : '') + p.nombre + (p.color ? ' · ' + p.color : '');
function talles() { // todos los talles que se usan en algún artículo
  const out = parseTalles(state.config.talles || '35-45');
  state.productos.forEach((p) => { if (!p.archivado) tallesDe(p).forEach((t) => { if (!out.includes(t)) out.push(t); }); });
  return out;
}

const DB_NAME = 'deposito-mendoza', STORE = 'kv';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function load() {
  try {
    const db = await idb();
    const data = await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get('state'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    if (data) state = Object.assign(EMPTY(), data, { config: Object.assign(EMPTY().config, data.config || {}) });
  } catch (e) { console.error(e); toast('No se pudieron leer los datos guardados: ' + e.message); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
let backupTimer = null;
async function saveLocal() {
  try { const db = await idb(); const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(state, 'state'); } catch (e) { console.error(e); }
}
async function save() {
  try {
    const db = await idb();
    await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(state, 'state'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch (e) { console.error(e); toast('⚠️ Error al guardar: ' + e.message); }
  if (cloud.live) pushDiff();
  if (window.desktop) { clearTimeout(backupTimer); backupTimer = setTimeout(() => window.desktop.saveBackup(JSON.stringify(state)).catch(console.error), 1500); }
}
function commit() { save(); render(); }

const prod = (id) => state.productos.find((p) => p.id === id);
const prodNombre = (id, fallback) => { const p = prod(id); return p ? p.nombre : (fallback || 'Modelo borrado'); };

// ---------- Nube (Firebase) — misma lógica que Gestión del Negocio, con datos compartidos ----------
const cloud = { cfg: null, uid: null, email: '', live: false, synced: {}, buffer: {}, reported: new Set(), unsub: null, pending: false, error: '', deferred: {} };
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function getCloudCfg() {
  if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) return window.FIREBASE_CONFIG;
  try { const c = JSON.parse(localStorage.getItem('firebaseConfig') || 'null'); if (c && c.apiKey) return c; } catch {}
  return null;
}
function parseFirebaseConfig(txt) {
  const out = {}; const re = /(\w+)\s*:\s*["']([^"']+)["']/g; let m;
  while ((m = re.exec(txt))) out[m[1]] = m[2];
  if (!out.apiKey || !out.projectId) throw new Error('No encontré apiKey y projectId en el texto pegado.');
  return out;
}
function pushDiff() {
  const ops = [];
  for (const c of COLS) {
    const prev = cloud.synced[c] || (cloud.synced[c] = {}); const seen = new Set();
    for (const r of state[c]) { seen.add(r.id); const sj = stable(r); if (prev[r.id] !== sj) { prev[r.id] = sj; ops.push({ col: c, id: r.id, data: JSON.parse(JSON.stringify(r)) }); } }
    for (const id of Object.keys(prev)) if (!seen.has(id)) { delete prev[id]; ops.push({ col: c, id, del: true }); }
  }
  const cj = stable(state.config); if (cloud.synced.config !== cj) { cloud.synced.config = cj; ops.push({ col: 'config', data: JSON.parse(JSON.stringify(state.config)) }); }
  if (ops.length) { window.Cloud.write(ops); cloud.pending = true; syncBadge(); }
}
function applyRemote(col, data) {
  if (col === 'config') { if (data) { state.config = Object.assign(EMPTY().config, data); cloud.synced.config = stable(state.config); } return; }
  state[col] = data; cloud.synced[col] = Object.fromEntries(data.map((r) => [r.id, stable(r)]));
}
let remoteRender = null;
function onCloudData(col, data, meta) {
  cloud.pending = meta.pending; syncBadge();
  if (!cloud.live) { cloud.buffer[col] = data; if (!meta.fromCache) cloud.reported.add(col); if (cloud.reported.size === COLS.length + 1) goLive(); return; }
  if (meta.pending) return; // eco de nuestra propia escritura
  if (!$('#modal').classList.contains('hidden')) { cloud.deferred[col] = data; return; } // no pisar un formulario abierto
  applyRemote(col, data);
  clearTimeout(remoteRender); remoteRender = setTimeout(() => { saveLocal(); render(); }, 60);
}
function flushDeferred() {
  const ks = Object.keys(cloud.deferred); if (!ks.length) return;
  ks.forEach((k) => applyRemote(k, cloud.deferred[k])); cloud.deferred = {};
}
function goLive() {
  if (cloud.live) return;
  const local = state;
  const cloudEmpty = COLS.every((c) => !(cloud.buffer[c] || []).length);
  const localHas = COLS.some((c) => local[c].length);
  cloud.live = true;
  if (cloudEmpty && localHas) { cloud.synced = {}; pushDiff(); saveLocal(); render(); toast('Subiendo los datos de este dispositivo a la nube…'); }
  else {
    COLS.forEach((c) => applyRemote(c, cloud.buffer[c] || []));
    applyRemote('config', cloud.buffer.config || null);
    if (!cloud.buffer.config) pushDiff();
    saveLocal(); render();
  }
  cloud.buffer = {};
}
function startCloud() {
  cloud.cfg = getCloudCfg(); if (!cloud.cfg || !window.Cloud) return false;
  try { window.Cloud.init(cloud.cfg); } catch (e) { console.error(e); cloud.error = e.message; return false; }
  const errMsg = (err) => (err && err.code === 'permission-denied' ? 'Este usuario no está habilitado para ver los datos del depósito.' : (err && err.message) || String(err));
  window.addEventListener('cloud-error', (e) => { cloud.error = errMsg(e.detail); syncBadge(); toast('⚠️ ' + cloud.error); });
  window.addEventListener('online', syncBadge); window.addEventListener('offline', syncBadge);
  window.Cloud.onAuth((u) => {
    if (cloud.unsub) { cloud.unsub(); cloud.unsub = null; }
    cloud.live = false; cloud.reported = new Set(); cloud.buffer = {}; cloud.synced = {}; cloud.error = '';
    if (!u) { cloud.uid = null; cloud.email = ''; syncBadge(); render(); return; }
    cloud.uid = u.uid; cloud.email = u.email || '';
    cloud.unsub = window.Cloud.subscribe(onCloudData, (err) => { cloud.error = errMsg(err); syncBadge(); render(); });
    setTimeout(() => { if (cloud.uid === u.uid && !cloud.live && Object.keys(cloud.buffer).length) goLive(); }, 6000);
    syncBadge(); render();
  });
  return true;
}
function syncTxt() {
  if (!cloud.cfg) return '';
  if (!cloud.uid) return '☁️ Sin sesión';
  if (cloud.error) return '⚠️ ' + cloud.error;
  if (!navigator.onLine) return '📴 Sin internet · se guarda y sube después';
  if (!cloud.live) return '⏳ Cargando datos…';
  if (cloud.pending) return '⏳ Subiendo cambios…';
  return '☁️ Sincronizado';
}
function syncBadge() {
  const el = $('#sync'); if (!el) return;
  if (!cloud.cfg) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); el.classList.toggle('warn', !!cloud.error || !navigator.onLine);
  el.textContent = syncTxt(); el.title = cloud.email;
}
const needLogin = () => cloud.cfg && !cloud.uid;

// ---------- Stock ----------
const stockT = (p, t) => Number((p.talles || {})[t]) || 0;
const stockTotal = (p) => Object.values(p.talles || {}).reduce((s, n) => s + (Number(n) || 0), 0);
const minDe = (p) => Number(p.stockMin) || 0;
// items: [{productoId, talle, cant}] — signo +1 entra, -1 sale. Deja registro en stockMovs.
function moverStock(items, signo, motivo, ref, fecha) {
  for (const it of items) {
    const p = prod(it.productoId); if (!p) continue;
    p.talles = p.talles || {};
    p.talles[it.talle] = stockT(p, it.talle) + signo * (Number(it.cant) || 0);
    state.stockMovs.push({ id: uid(), fecha: fecha || todayStr(), productoId: p.id, nombre: p.nombre, talle: it.talle, cant: signo * (Number(it.cant) || 0), motivo, ref: ref || '' });
  }
}
// Mercadería que entra sin factura: cuenta como inversión (unidades × costo del artículo)
function inversionEntrada(items, fecha, ref, concepto) {
  const monto = items.reduce((s, i) => s + (Number(i.cant) || 0) * (Number((prod(i.productoId) || {}).costo) || 0), 0);
  if (!monto) return '';
  const id = uid();
  state.movimientos.push({ id, tipo: 'inversion', categoria: 'Mercadería', concepto: concepto || ('Mercadería: ' + items.map((i) => `${i.cant} ${prodNombre(i.productoId, i.nombre)} ${i.talle}`).join(', ')), monto, fecha: fecha || todayStr(), ref: ref || '' });
  return id;
}
const pares = (items) => (items || []).reduce((s, i) => s + (Number(i.cant) || 0), 0);
function resumenItems(items, max = 3) {
  const g = {}; (items || []).forEach((i) => { const k = i.productoId || i.nombre; (g[k] = g[k] || { n: prodNombre(i.productoId, i.nombre), t: [] }).t.push(tl(i.talle) ? (Number(i.cant) > 1 ? i.cant + '×' : '') + i.talle : String(i.cant)); });
  const arr = Object.values(g).map((x) => `${x.n} (${x.t.join(', ')})`);
  return arr.length > max ? arr.slice(0, max).join(' · ') + ` y ${arr.length - max} más` : arr.join(' · ');
}
const stockBajo = () => state.productos.filter((p) => !p.archivado).flatMap((p) => tallesDe(p).filter((t) => stockT(p, t) <= minDe(p)).map((t) => ({ p, t, n: stockT(p, t) })));

// ---------- Cálculos de plata ----------
const enMes = (f, m) => (f || '').startsWith(m);
function resumenMes(m) {
  const ventas = state.ventas.filter((v) => enMes(v.fecha, m));
  const vendido = ventas.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const cmv = ventas.reduce((s, v) => s + (v.items || []).reduce((a, i) => a + (Number(i.cant) || 0) * (Number(i.costo) || 0), 0), 0);
  const movs = state.movimientos.filter((x) => enMes(x.fecha, m));
  const sumT = (t) => movs.filter((x) => x.tipo === t).reduce((s, x) => s + (Number(x.monto) || 0), 0);
  const pagadas = state.compras.filter((c) => c.pagada && enMes(c.fechaPago || c.fecha, m));
  const facGasto = pagadas.filter((c) => c.clase === 'gasto').reduce((s, c) => s + (Number(c.total) || 0), 0);
  const gastos = sumT('gasto') + facGasto, inversionMovs = sumT('inversion'), otrosIng = sumT('ingreso');
  const comprasPagadas = pagadas.filter((c) => c.clase !== 'gasto').reduce((s, c) => s + (Number(c.total) || 0), 0);
  const cobrado = state.ventas.filter((v) => v.pago !== 'Cuenta corriente' ? enMes(v.fecha, m) : (v.cobrado && enMes(v.fechaCobro, m))).reduce((s, v) => s + (Number(v.total) || 0), 0);
  const bruta = vendido - cmv, neta = bruta - gastos + otrosIng;
  const entro = cobrado + otrosIng, salio = gastos + inversionMovs + comprasPagadas;
  return { ventas, vendido, cmv, bruta, gastos, inversion: inversionMovs + comprasPagadas, comprasPagadas, otrosIng, neta, entro, salio, movs };
}
const meDeben = () => state.ventas.filter((v) => v.pago === 'Cuenta corriente' && !v.cobrado);
const debo = () => state.compras.filter((c) => !c.pagada);
const valorStock = () => state.productos.reduce((s, p) => s + Math.max(0, stockTotal(p)) * (Number(p.costo) || 0), 0);
const muestrasAfuera = () => state.muestras.filter((m) => m.estado === 'afuera');

// ---------- Navegación ----------
let view = 'inicio';
const ui = { stockQ: '', ventasMes: todayStr().slice(0, 7), ventasTab: 'todas', comprasTab: 'todas', muestrasTab: 'afuera', plataMes: todayStr().slice(0, 7), balMes: todayStr().slice(0, 7), calMes: todayStr().slice(0, 7), calSel: todayStr(), msg: '', msgRes: null, stockCat: 'todas', presuTab: 'todos' };
$('#nav').addEventListener('click', (e) => { const a = e.target.closest('a[data-view]'); if (a) go(a.dataset.view); });
const NAV_SEC = ['muestras', 'compras', 'calendario', 'plata', 'balance', 'ajustes', 'mas'];
function go(v) {
  view = v;
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === v || (a.dataset.view === 'mas' && NAV_SEC.includes(v) && window.innerWidth <= 760)));
  render(); window.scrollTo(0, 0);
}
const VISTAS = {};
function render() {
  const ver = $('#ver'); if (ver) ver.textContent = 'versión ' + (window.APP_VERSION || '');
  document.body.classList.toggle('login', !!needLogin());
  syncBadge();
  if (needLogin()) { $('#main').innerHTML = vLogin(); const pw = $('#lgPass'); if (pw) pw.onkeydown = (e) => { if (e.key === 'Enter') ACTS.lgGo(); }; return; }
  const fn = VISTAS[view] || VISTAS.inicio;
  const winY = window.scrollY, misma = render._ultima === view;
  const act = document.activeElement, fid = act && act.id && $('#main').contains(act) ? act.id : null;
  let sel = null; try { if (fid && act.selectionStart != null) sel = [act.selectionStart, act.selectionEnd]; } catch {}
  const KEEP = '#main .tablewrap, #main .chat-ej, #main .tabs, #main #chatLog, #main .curva';
  const scrolls = $$(KEEP).map((el) => [el.scrollLeft, el.scrollTop]);
  $('#main').innerHTML = (cloud.cfg ? `<div class="msync muted">${esc(syncTxt())}</div>` : '') + fn();
  if (misma) { window.scrollTo(0, winY); $$(KEEP).forEach((el, i) => { if (scrolls[i]) { el.scrollLeft = scrolls[i][0]; el.scrollTop = scrolls[i][1]; } }); }
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch {} } }
  render._ultima = view;
  if (typeof afterRender === 'function') afterRender();
}

// ---------- Login ----------
function vLogin() {
  return `<div class="login-box card"><img src="logo-vertical.png" alt="Depósito Mendoza S.A.S.">
  <p class="sub">Entrá con tu email para ver el stock y las ventas en la PC y en el celular.</p>
  <div class="form" style="grid-template-columns:1fr"><label class="f">Email<input id="lgMail" type="email" autocomplete="username" value="${esc(localStorage.getItem('lastEmail') || '')}"></label>
  <label class="f">Contraseña<input id="lgPass" type="password" autocomplete="current-password"></label></div>
  <p class="err" id="lgErr"></p>
  <div class="modal-actions" style="justify-content:space-between"><button class="link" data-act="lgReset">Olvidé mi contraseña</button><button class="pri" data-act="lgGo">Entrar</button></div></div>`;
}
const authMsg = (e) => ({ 'auth/invalid-credential': 'Email o contraseña incorrectos.', 'auth/wrong-password': 'Contraseña incorrecta.', 'auth/user-not-found': 'No existe un usuario con ese email.', 'auth/invalid-email': 'El email no es válido.', 'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.', 'auth/network-request-failed': 'Sin conexión a internet. La primera vez hace falta internet para entrar.' }[e.code] || e.message);

// ---------- Modal ----------
let modalClose = null;
function modal(html, onMount, onClose) {
  const m = $('#modal'); $('.modal-box', m).innerHTML = html; m.classList.remove('hidden');
  modalClose = onClose || null;
  if (onMount) onMount($('.modal-box', m));
  const f = $('.modal-box input:not([type=hidden]):not([readonly]), .modal-box select, .modal-box textarea', m);
  if (f && window.innerWidth > 760) setTimeout(() => f.focus(), 30);
}
function closeModal() {
  $('#modal').classList.add('hidden'); $('#modal .modal-box').innerHTML = '';
  const cb = modalClose; modalClose = null; if (cb) cb();
  flushDeferred(); render();
}
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal(); });
function confirmBox(msg, onYes, yesLbl = 'Sí, seguir') {
  modal(`<h3>¿Seguro?</h3><p>${esc(msg)}</p><div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="cfYes">${esc(yesLbl)}</button></div>`,
    (box) => { $('#cfYes', box).onclick = () => { closeModal(); onYes(); }; });
}

// ---------- Editor de líneas: artículo + cantidades por talle ----------
// lines: [{productoId, cant:{talle:n}, precio}]  opts: {precio:'Precio por unidad'|'Costo por unidad'|null, verStock:bool, sinStockAviso:bool}
function lineasHTML(lines, opts) {
  const ps = state.productos.filter((p) => !p.archivado).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return lines.map((l, i) => {
    const p = prod(l.productoId);
    return `<div class="linea" data-i="${i}">
      <div class="row"><select data-l="prod" style="flex:1 1 200px"><option value="">— Elegí el artículo —</option>${ps.map((x) => `<option value="${x.id}" ${x.id === l.productoId ? 'selected' : ''}>${esc(artLbl(x))}</option>`).join('')}</select>
      ${opts.precio ? `<label class="f" style="flex:0 1 150px">${opts.precio}<input data-l="precio" inputmode="decimal" value="${l.precio ? esc(l.precio) : ''}" placeholder="$"></label>` : ''}
      ${lines.length > 1 ? `<button type="button" class="sm danger" data-l="del" title="Quitar">✕</button>` : ''}</div>
      ${p ? `<div class="curva">${tallesDe(p).map((t) => { const n = Number((l.cant || {})[t]) || 0, s = stockT(p, t); return `<label>${t === TU ? 'Cantidad' : esc(t)}<input data-l="cant" data-t="${esc(t)}" inputmode="numeric" value="${n || ''}" class="${n ? 'has' : ''}" aria-label="Talle ${t}">${opts.verStock ? `<small class="${s <= 0 ? 'z' : ''}">hay ${s}</small>` : ''}</label>`; }).join('')}</div>` : '<div class="small muted">Elegí el artículo y después poné cuántas unidades de cada talle.</div>'}
    </div>`;
  }).join('');
}
function lineasEditor(cont, lines, opts, onChange) {
  const draw = () => { cont.innerHTML = lineasHTML(lines, opts); onChange && onChange(); };
  cont.addEventListener('change', (e) => {
    const el = e.target, i = +el.closest('.linea').dataset.i, l = lines[i];
    if (el.dataset.l === 'prod') { l.productoId = el.value; const p = prod(el.value); if (p) { const ok = tallesDe(p); Object.keys(l.cant || {}).forEach((k) => { if (!ok.includes(k)) delete l.cant[k]; }); } if (p && opts.precioDe) l.precio = opts.precioDe(p) || ''; draw(); }
  });
  cont.addEventListener('input', (e) => {
    const el = e.target; const li = el.closest('.linea'); if (!li) return; const l = lines[+li.dataset.i];
    if (el.dataset.l === 'cant') { const n = Math.max(0, Math.round(numIn(el.value))); l.cant = l.cant || {}; if (n) l.cant[el.dataset.t] = n; else delete l.cant[el.dataset.t]; el.classList.toggle('has', !!n); onChange && onChange(); }
    if (el.dataset.l === 'precio') { l.precio = el.value; onChange && onChange(); }
  });
  cont.addEventListener('click', (e) => { const b = e.target.closest('[data-l=del]'); if (!b) return; lines.splice(+b.closest('.linea').dataset.i, 1); draw(); });
  draw();
  return { add: () => { lines.push({ productoId: '', cant: {}, precio: '' }); draw(); }, redraw: draw };
}
// lines -> items planos [{productoId, nombre, talle, cant, precio}]
function linesToItems(lines) {
  const out = [];
  for (const l of lines) { const p = prod(l.productoId); if (!p) continue; for (const [t, n] of Object.entries(l.cant || {})) if (Number(n) > 0) out.push({ productoId: p.id, nombre: p.nombre, talle: t, cant: Number(n), precio: numIn(l.precio) }); }
  return out;
}
function itemsToLines(items, precioDe) {
  const by = {}; const lines = [];
  for (const i of items || []) {
    let l = by[i.productoId || '_' + i.nombre];
    if (!l) { l = by[i.productoId || '_' + i.nombre] = { productoId: i.productoId || '', cant: {}, precio: i.precio || (precioDe && prod(i.productoId) ? precioDe(prod(i.productoId)) : '') || '' }; lines.push(l); }
    if (i.talle) l.cant[i.talle] = (l.cant[i.talle] || 0) + (Number(i.cant) || 1);
  }
  return lines.length ? lines : [{ productoId: state.productos.length === 1 ? state.productos[0].id : '', cant: {}, precio: '' }];
}
function faltantes(items, extra) { // pares que no alcanzan en stock
  const need = {}; items.forEach((i) => { const k = i.productoId + '|' + i.talle; need[k] = (need[k] || 0) + i.cant; });
  if (extra) extra.forEach((i) => { const k = i.productoId + '|' + i.talle; need[k] = (need[k] || 0) - i.cant; });
  return Object.entries(need).map(([k, n]) => { const [pid, t] = k.split('|'); const p = prod(pid); return { p, t, n, hay: p ? stockT(p, t) : 0 }; }).filter((x) => x.p && x.n > x.hay);
}

// ---------- Acciones (botones con data-act) ----------
const ACTS = {
  close: () => closeModal(),
  goto: (id) => go(id),
  lgGo: async () => {
    const mail = $('#lgMail').value.trim(), pass = $('#lgPass').value; if (!mail || !pass) return ($('#lgErr').textContent = 'Completá email y contraseña.');
    localStorage.setItem('lastEmail', mail); $('#lgErr').textContent = 'Entrando…';
    try { await window.Cloud.login(mail, pass); } catch (e) { $('#lgErr').textContent = authMsg(e); }
  },
  lgReset: async () => { const mail = $('#lgMail').value.trim(); if (!mail) return ($('#lgErr').textContent = 'Escribí tu email arriba y tocá de nuevo.'); try { await window.Cloud.reset(mail); $('#lgErr').textContent = 'Te mandamos un mail para cambiar la contraseña.'; } catch (e) { $('#lgErr').textContent = authMsg(e); } },
  lgOut: () => confirmBox('Vas a cerrar sesión en este dispositivo. Los datos siguen guardados en la nube.', async () => { await window.Cloud.logout(); state = EMPTY(); saveLocal(); render(); }, 'Cerrar sesión'),
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const fn = ACTS[b.dataset.act]; if (fn) { e.preventDefault(); fn(b.dataset.id, b); }
});
