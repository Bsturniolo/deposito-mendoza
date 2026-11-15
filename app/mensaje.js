'use strict';
/* Chat "Cargar por mensaje": se escribe (o se dicta) como en WhatsApp y la app lo carga sola.
   Todo se interpreta acá mismo, sin internet y sin costo. */

// ---------- Texto ----------
const ACENTOS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u' };
const norm = (s) => String(s || '').toLowerCase().replace(/[áéíóúüàèìòù]/g, (c) => ACENTOS[c]); // mismo largo que el original
const NUMS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, docena: 12 };
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const titulo = (s) => s.replace(/\S+/g, (w) => w.length > 2 && !/^(del|las|los)$/.test(w) ? w[0].toUpperCase() + w.slice(1) : w);
const blank = (s, a, b) => s.slice(0, a) + ' '.repeat(b - a) + s.slice(b);

function claves(p) { // nombres con los que se puede nombrar un modelo
  const n = norm(p.nombre).trim(), out = new Set([n]);
  out.add(n.replace(/\s+0?\d+$/, '')); // "bolt 02" -> "bolt"
  out.add(n.replace(/\s+/g, ''));
  String(p.alias || '').split(',').map((a) => norm(a).trim()).filter(Boolean).forEach((a) => out.add(a));
  return [...out].filter((k) => k.length >= 2);
}
function buscarModelos(t) { // -> [{p, s, e}] sin superponerse
  const cands = [];
  state.productos.filter((p) => !p.archivado).forEach((p) => claves(p).forEach((k) => {
    const re = new RegExp('(^|[^a-z0-9ñ])(' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*') + ')(?![a-zñ])', 'g'); let m;
    while ((m = re.exec(t))) { const s = m.index + m[1].length; cands.push({ p, s, e: s + m[2].length }); }
  }));
  cands.sort((a, b) => (b.e - b.s) - (a.e - a.s));
  const out = [];
  for (const c of cands) if (!out.some((o) => c.s < o.e && o.s < c.e)) out.push(c);
  out.sort((a, b) => a.s - b.s);
  // si después del modelo viene "01" / "02" (parte del nombre), se lo come
  out.forEach((o) => { const m = t.slice(o.e).match(/^\s*0\d\b/); if (m) o.e += m[0].length; });
  return out;
}

// ---------- Interpretar ----------
function interpretar(original) {
  let t = norm(original).replace(/[¿¡]/g, ' ');
  // números escritos con letras
  t = t.replace(/\b(media docena)\b/g, (m) => '6'.padEnd(m.length));
  t = t.replace(/\b(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|docena)\b/g, (w) => String(NUMS[w]).padEnd(w.length));
  const r = { texto: original, items: [], fecha: '', hora: '', monto: 0, montoUnit: false, cliente: '', pago: '', falta: [] };
  const TS = talles();
  const esTalle = (n) => TS.includes(String(n));

  // ----- tipo -----
  const has = (re) => re.test(t);
  const pregunta = /\?/.test(original) || /^\s*(cuant[oa]s?|quien(es)?|a quien(es)?|que (hay|tengo|me|facturas?|debo|le debo|preste)|hay\b|tengo\b|mostrame|decime|stock\b|como (vengo|vamos|va))/.test(t);
  const hayMod = () => buscarModelos(t).length > 0;
  const prestados = () => state.eventos.filter((e) => e.tipo === 'prestamo' && !e.hecho);
  if (/^\s*(ayuda|que (podes|puedo|sabes) (hacer|pedir(te)?|escribir)|como (se usa|funciona|te uso))/.test(t)) r.tipo = 'ayuda';
  else if (!pregunta && has(/\b(preste|prestamos|deje prestad)/)) { r.tipo = 'evento'; r.prestamo = true; }
  else if (has(/muestra/) && has(/\b(busque|buscamos|retire|retiramos|devolv|volvio|volvieron|trajeron|trajo|recupere|me la dieron|levante)/)) r.tipo = 'muestraVuelta';
  else if (/^\s*(cuant[oa]s?|quien(es)?|a quien(es)?|que (hay|tengo|me|facturas?|debo|le debo|preste))\b/.test(t) || pregunta && !has(/\b(vendi|vendimos|entraron|llegaron|deje|gaste|pague)\b/)) r.tipo = 'consulta';
  else if (has(/\b(nuevo modelo|modelo nuevo|(agrega|agregame|agregar|crea|creame|crear|carga|cargame|cargar|suma|sumar) (el |un )?modelo)\b/)) r.tipo = 'modelo';
  else if (hayMod() && has(/\b(precio|costo|cuesta|cuestan|me sale|me salen|lo vendo a|los vendo a|se vende a|se venden a|vale|valen)\b/) && !has(/\b(vendi|vendimos|entraron|llegaron|deje|compre)\b/)) r.tipo = 'precio';
  else if (hayMod() && has(/\b(conte|contamos|corregi|corregir|ajusta|ajustar|ajuste|en realidad (hay|quedan|tengo))\b/)) r.tipo = 'ajuste';
  else if (!has(/muestra/) && has(/\b(me devolvio|me devolvieron|devolvio|devolvieron|me trajo|me trajeron|ya me (lo|los|la|las) (dio|dieron|trajo))\b/) && prestados().length) r.tipo = 'prestamoVuelta';
  else if (has(/muestra/) || has(/\bdeje\b/) && !has(/\bvend/)) r.tipo = 'muestra';
  else if (has(/\b(me pago|me pagaron|me pago todo|cobre|cobramos|me transfirio|me deposito|me cancelo)\b/)) r.tipo = 'cobro';
  else if (has(/\bvend|\bventa\b|se llev(o|aron)|\bfacture\b/)) r.tipo = 'venta';
  else if (has(/\b(pague|pagamos|cancele|pagada|ya esta paga)\b/) && has(/\bfacturas?\b|\bboleta\b/) && debo().length) r.tipo = 'pagoFactura';
  else if (has(/\b(pague|pagamos|le pague)\b/) && debo().some((c) => norm(c.proveedor).split(/\s+/).some((w) => w.length >= 3 && new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t)))) r.tipo = 'pagoFactura';
  else if (has(/\bfactura\b|\bcompre\b|\bcompramos\b|\bcompra de\b/) && hayMod()) r.tipo = 'compra';
  else if (has(/\bfacturas?\b|\bboleta\b/)) r.tipo = 'factura';
  else if (has(/\bentr(o|aron|ada)\b|\blleg(o|aron)\b|\bingres|\brecib|\brepus|\bsume\b|\bagregue\b/)) r.tipo = 'entrada';
  else if (has(/\bsali(o|eron|da)\b|\bsaque\b|\bsacamos\b|\bretire\b|\brot[oa]s?\b|\bfalla\b|\bdevolvi al proveedor\b|\bmande\b|\benvie\b/) && buscarModelos(t).length) r.tipo = 'salida';
  else if (has(/\binvert|\binversion\b/)) r.tipo = 'inversion';
  else if (has(/\bgast|\bpague\b|\bpagamos\b|\bpago de\b|\bnafta\b|\bcombustible\b|\bgasoil\b|\bflete\b|\balquiler\b|\bsueldo|\bimpuesto|\bafip\b|\barca\b|\bmonotributo\b|\bluz\b|\binternet\b/)) r.tipo = 'gasto';
  else if (has(/\baporte\b|\bpuse plata\b|\bingreso de plata\b/)) r.tipo = 'ingreso';
  else if (has(/^\s*(listo|hecho|ya esta|ya (hice|fui|entregue|llame|visite|pase|lleve|busque|retire)|termine|cumplido)\b/) && state.eventos.some((e) => !e.hecho && e.tipo !== 'prestamo')) r.tipo = 'eventoHecho';
  else if (has(/\b(recorda|acordate|anota|agenda|tengo que|hay que|turno|reunion|visit|llamar|entregar|ir a|pasar por|cobrar|cobrarle|pagar|pagarle|vence)/)) r.tipo = 'evento';
  else if (has(/\b(ma[nñ]ana|pasado ma[nñ]ana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b|\b\d{1,2}\/\d{1,2}\b/)) r.tipo = 'evento';

  // ----- fecha y hora (se sacan del texto para que no confundan talles) -----
  const hoy = todayStr(), futuro = r.tipo === 'evento' || r.tipo === 'factura';
  let m;
  if ((m = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/))) { const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : hoy.slice(0, 4); r.fecha = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; t = blank(t, m.index, m.index + m[0].length); }
  if ((m = t.match(/\bpasado ma[nñ]ana\b/))) { r.fecha = addDays(hoy, 2); t = blank(t, m.index, m.index + m[0].length); }
  else if ((m = t.match(/\bma[nñ]ana\b/))) { r.fecha = addDays(hoy, 1); t = blank(t, m.index, m.index + m[0].length); }
  else if ((m = t.match(/\banteayer\b/))) { r.fecha = addDays(hoy, -2); t = blank(t, m.index, m.index + m[0].length); }
  else if ((m = t.match(/\bayer\b/))) { r.fecha = addDays(hoy, -1); t = blank(t, m.index, m.index + m[0].length); }
  else if ((m = t.match(/\bhoy\b/))) { r.fecha = hoy; t = blank(t, m.index, m.index + m[0].length); }
  if (!r.fecha && (m = t.match(/\b(el |este |el proximo |el otro )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/))) {
    const want = DIAS.indexOf(m[2]), d = parseD(hoy), cur = d.getDay();
    let k = futuro ? (want - cur + 7) % 7 || 7 : -((cur - want + 7) % 7);
    r.fecha = addDays(hoy, k); t = blank(t, m.index, m.index + m[0].length);
  }
  if (!r.fecha && futuro && (m = t.match(/\bel (\d{1,2})\b(?!\s*(pares|par|x))/))) { const d = +m[1]; if (d >= 1 && d <= 31) { let f = hoy.slice(0, 8) + String(d).padStart(2, '0'); if (f < hoy) { const x = parseD(hoy.slice(0, 8) + '01'); x.setMonth(x.getMonth() + 1); f = ymd(x).slice(0, 8) + String(d).padStart(2, '0'); } r.fecha = f; t = blank(t, m.index, m.index + m[0].length); } }
  if ((m = t.match(/\b(?:a las|alas|tipo|a eso de las)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:hs|horas|h)?\b/)) || (m = t.match(/\b(\d{1,2})[:.](\d{2})\s*(?:hs|h)?\b/)) || (m = t.match(/\b(\d{1,2})\s*(?:hs|horas)\b/))) {
    const h = +m[1]; if (h <= 23) { r.hora = `${String(h).padStart(2, '0')}:${m[2] || '00'}`; t = blank(t, m.index, m.index + m[0].length); }
  }

  // ----- plata -----
  const leerMonto = (num, suf) => { let v = numIn(num); if (/mil|k|luca/.test(suf || '')) v *= 1000; return v; };
  const reMonto = [/\$\s*(\d[\d.,]*)\s*(mil|k|lucas?)?/, /\b(\d[\d.,]*)\s*(mil|k|lucas?|pesos)\b/, /\b(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d{4,})\b/];
  for (const re of reMonto) { if ((m = t.match(re))) { r.monto = leerMonto(m[1], m[2]); const after = t.slice(m.index + m[0].length, m.index + m[0].length + 14); if (/^\s*(c\/u|cada uno|cada par|el par|por par|x par)/.test(after) || /(c\/u|cada uno|el par|por par)\s*$/.test(t.slice(Math.max(0, m.index - 14), m.index))) r.montoUnit = true; t = blank(t, m.index, m.index + m[0].length); break; } }

  // ----- forma de pago -----
  if (has(/a cuenta|fiado|cuenta corriente|me debe|queda debiendo|despues (me )?paga|lo paga despues|sin pagar/)) r.pago = 'Cuenta corriente';
  else if (has(/transf|mercado ?pago|\bmp\b|deposito/)) r.pago = 'Transferencia';
  else if (has(/tarjeta|debito|credito/)) r.pago = 'Tarjeta';
  else if (has(/efectivo|contado|cash/)) r.pago = 'Efectivo';

  // ----- modelos, talles y cantidades -----
  const ms = buscarModelos(t);
  ms.forEach((mo, i) => {
    const antes = t.slice(i ? ms[i - 1].e : 0, mo.s), despues = t.slice(mo.e, i < ms.length - 1 ? ms[i + 1].s : t.length);
    const pares = []; let mm;
    const reP = /(\d+)\s*(?:pares?\s*)?(?:del|de|en|talle|t\.?|nro|n°|numero|#)\s*(\d{2})\b/g;
    while ((mm = reP.exec(despues))) if (esTalle(mm[2])) pares.push({ talle: mm[2], cant: +mm[1] });
    const reX = /\b(\d{2})\s*x\s*(\d+)\b/g;
    while ((mm = reX.exec(despues))) if (esTalle(mm[1])) pares.push({ talle: mm[1], cant: +mm[2] });
    if (!pares.length) {
      const ts = (despues.match(/\b\d{2}\b/g) || []).filter(esTalle);
      let cant = 0;
      if ((mm = despues.match(/\bx\s*(\d+)\b/))) cant = +mm[1];
      if (!cant && (mm = (antes + ' ' + despues).match(/\b(\d+)\s*pares?\b/))) cant = +mm[1];
      if (!cant) { const ns = (antes.match(/\b\d+\b/g) || []).map(Number).filter((n) => n > 0 && n < 1000 && !esTalle(n)); if (ns.length) cant = ns[ns.length - 1]; }
      cant = cant || 1;
      if (ts.length) ts.forEach((tl) => pares.push({ talle: tl, cant })); else pares.push({ talle: '', cant });
    }
    pares.forEach((x) => r.items.push({ productoId: mo.p.id, nombre: mo.p.nombre, talle: x.talle, cant: x.cant }));
    t = blank(t, mo.s, mo.e);
  });
  r.modelosMencionados = ms.length;

  // ----- cliente -----
  const intro = r.tipo === 'muestra' ? '(?:a|al|en|para|en lo de|a la|al de)' : r.tipo === 'cobro' ? '(?:a|de|al)' : r.tipo === 'factura' ? '(?:de|del|a|al)' : '(?:a|al|para|cliente|a la|en)';
  const STOP = /^(talle|t|con|en|por|pago|paga|pagan|efectivo|transferencia|transf|tarjeta|debito|credito|cuenta|contado|fiado|que|y|e|el|los|las|x|pares?|cada|c\/u|a|la|lo|le|una?|muestra|mi|me|se|sin|pagar|cobrar|buscar|todo|total|precio|hasta|vence|vencimiento|pagada|paga)$/;
  const reC = new RegExp('\\b' + intro + '\\s+([a-zñ][a-zñ.&\'-]*(?:\\s+[a-zñ][a-zñ.&\'-]*){0,5})', 'g');
  while (!r.cliente && (m = reC.exec(t))) {
    const words = m[1].split(/\s{2,}/)[0].split(/\s+/); const keep = [];
    while (words.length > 1 && /^(la|el|los|las|lo)$/.test(words[0])) words.shift();
    for (const w of words) { if (STOP.test(w) || /^(vend|deje|cobr|entr|lleg|sali|gast|pagu)/.test(w)) break; keep.push(w); }
    while (keep.length && /^(la|el|los|las|lo|de|del)$/.test(keep[0])) keep.shift();
    while (keep.length && /^(de|del)$/.test(keep[keep.length - 1])) keep.pop();
    if (keep.length && keep.join(' ').length >= 2 && !/^(cuenta|credito|plazo|domicilio)$/.test(keep[0])) {
      const s = m.index + m[0].indexOf(m[1]) + m[1].indexOf(keep[0]); const e = s + keep.join(' ').length;
      let nom = original.slice(s, e).trim(); if (nom === nom.toLowerCase()) nom = titulo(nom);
      r.cliente = nom;
    }
  }
  r.fechaDada = !!r.fecha;
  if (!r.fecha) r.fecha = r.prestamo ? addDays(hoy, 7) : hoy;
  return r;
}

// ---------- Qué falta y cómo se describe ----------
function revisar(r) {
  const f = [];
  const conItems = ['venta', 'compra', 'entrada', 'salida', 'muestra', 'ajuste'].includes(r.tipo);
  if (r.tipo === 'precio') { const pr = leerPrecios(r.texto); if (!pr.costo && !pr.precio) f.push('el costo o el precio'); }
  if (r.tipo === 'modelo' && !nombreModelo(r.texto)) f.push('el nombre del modelo');
  if (r.tipo === 'factura' && !r.monto) f.push('el total');
  if (conItems) {
    if (!r.items.length) f.push('el modelo');
    if (r.items.some((i) => !i.talle)) f.push('el talle');
  }
  if (r.tipo === 'venta' && r.items.length && !r.monto && r.items.some((i) => !(prod(i.productoId) || {}).precio)) f.push('el precio');
  if (r.tipo === 'muestra' && !r.cliente) f.push('a quién se la dejaste');
  if (r.tipo === 'compra') f.push('revisar la factura');
  if (['gasto', 'inversion', 'ingreso'].includes(r.tipo) && !r.monto) f.push('el monto');
  r.falta = f; return r;
}
const detalle = (items) => items.map((i) => `${i.cant} × ${prodNombre(i.productoId, i.nombre)}${i.talle ? ' talle ' + i.talle : ''}`).join(', ');
function precioItems(r) { // reparte el monto entre los pares, o usa el precio del modelo
  const tot = pares(r.items);
  return r.items.map((i) => { const p = prod(i.productoId) || {}; let precio = Number(p.precio) || 0; if (r.monto) precio = r.montoUnit ? r.monto : Math.round(r.monto / tot); return Object.assign({}, i, { precio }); });
}
function categoriaGasto(t) {
  t = norm(t);
  const k = [[/nafta|combustible|gasoil|flete|envio|correo|peaje|camioneta/, 'Flete y combustible'], [/alquiler/, 'Alquiler'], [/sueldo|empleado|aguinaldo|jornal/, 'Sueldos'], [/luz|gas\b|agua|edemsa|ecogas/, 'Luz / Gas / Agua'], [/internet|telefono|celular|claro|personal|movistar/, 'Internet / Teléfono'], [/impuesto|afip|arca|monotributo|ingresos brutos|iibb|atm|rentas/, 'Impuestos'], [/publicidad|facebook|instagram|folleto|cartel/, 'Publicidad'], [/arreglo|mantenimiento|reparacion|service/, 'Mantenimiento']];
  for (const [re, c] of k) if (re.test(t)) return c;
  return 'Otro gasto';
}
const conceptoDe = (txt) => { let s = txt.replace(/\$?\s*\d[\d.,]*\s*(mil|k|lucas?|pesos)?/gi, '').replace(/\b(gaste|gastamos|pague|pagamos|en|de|hoy|ayer)\b/gi, ' ').replace(/\s+/g, ' ').trim(); return s ? s[0].toUpperCase() + s.slice(1) : ''; };

function leerPrecios(texto) { // "costo 30000 y lo vendo a 55 mil" -> { costo, precio }
  let t = norm(texto); buscarModelos(t).forEach((m) => { t = blank(t, m.s, m.e); });
  const num = '[^\\d$]{0,25}\\$?\\s*(\\d[\\d.,]*)\\s*(mil|k|lucas?)?';
  const val = (m) => { let v = numIn(m[2]); if (/mil|k|luca/.test(m[3] || '')) v *= 1000; return v; };
  const out = { costo: 0, precio: 0 }; let m;
  if ((m = t.match(new RegExp('\\b(costo|me cuesta|me cuestan|me sale|me salen|lo pago|los pago|lo compro|los compro|me lo dejan|me los dejan)\\b' + num)))) { out.costo = val(m); t = blank(t, m.index, m.index + m[0].length); }
  if ((m = t.match(new RegExp('\\b(precio|lo vendo|los vendo|se vende|se venden|vendo|venta|vale|valen|cuesta|cuestan|sale|salen)\\b' + num)))) out.precio = val(m);
  return out;
}
function nombreModelo(texto) {
  const t = norm(texto); const m = t.match(/\b(nuevo modelo|modelo nuevo|modelo)\b\s*:?\s*/); if (!m) return '';
  let rest = texto.slice(m.index + m[0].length); const nr = norm(rest);
  const ll = nr.match(/^(que se llama|llamado|se llama|nuevo|de nombre)\s+/); if (ll) rest = rest.slice(ll[0].length);
  const c = norm(rest).search(/\s*(,|;|\bcosto\b|\bprecio\b|\bcuesta\b|\bme (sale|cuesta)\b|\blo vendo\b|\bvale\b|\bsale\b|\by\b|\$|\b\d{3,}\b)/);
  let n = (c >= 0 ? rest.slice(0, c) : rest).trim().replace(/[.:]+$/, '');
  if (n && n === n.toLowerCase()) n = n.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1));
  return n;
}
const COL_PAL = { azul: '#164e68', naranja: '#f67a0c', verde: '#1a7f4b', rojo: '#c0392b', violeta: '#7b3fa0', morado: '#7b3fa0', amarillo: '#c99a06', gris: '#5a6b76' };
const RE_COLOR = /\b(?:en color|de color|color|en)\s+(azul|naranja|verde|rojo|violeta|morado|amarillo|gris)\b/i;
const nomFactura = (c) => `${c.nro ? c.nro + ' ' : ''}${c.proveedor ? 'de ' + c.proveedor : c.detalle || ''}`.trim();

// ---------- Ejecutar sin formulario ----------
function ejecutar(r) { // devuelve {txt, deshacer}
  const id = uid();
  if (r.tipo === 'precio') {
    const pr = leerPrecios(r.texto), ids = [...new Set(r.items.map((i) => i.productoId))], prev = [];
    ids.forEach((pid) => { const p = prod(pid); prev.push({ id: pid, costo: p.costo || 0, precio: p.precio || 0 }); if (pr.costo) p.costo = pr.costo; if (pr.precio) p.precio = pr.precio; });
    return { txt: '✅ Precios guardados.\n' + ids.map((pid) => { const p = prod(pid); return `${p.nombre}: costo ${p.costo ? fmtMoney(p.costo) : 'sin cargar'} · precio de venta ${p.precio ? fmtMoney(p.precio) : 'sin cargar'}${p.costo && p.precio ? ` · ganás ${fmtMoney(p.precio - p.costo)} por par` : ''}`; }).join('\n'), deshacer: { k: 'precio', prev } };
  }
  if (r.tipo === 'modelo') {
    const nombre = nombreModelo(r.texto), pr = leerPrecios(r.texto);
    const ya = state.productos.find((p) => !p.archivado && norm(p.nombre).trim() === norm(nombre).trim());
    if (ya) return { txt: `El modelo ${ya.nombre} ya está cargado. Si querés cambiarle el precio escribí: "precio del ${ya.nombre} 50000".` };
    state.productos.push({ id, nombre, marca: 'Ringo Work', color: '', tipo: 'Calzado de seguridad', costo: pr.costo, precio: pr.precio, stockMin: 2, alias: '', talles: {}, creado: todayStr() });
    return { txt: `✅ Modelo nuevo: ${nombre}${pr.costo ? ' · costo ' + fmtMoney(pr.costo) : ''}${pr.precio ? ' · precio ' + fmtMoney(pr.precio) : ''}.\n${pr.costo && pr.precio ? '' : 'Cuando sepas el costo y el precio escribime: "' + nombre + ' costo 30000 precio 50000".\n'}Para cargarle stock: "entraron 10 ${nombre} 42".`, deshacer: { k: 'modelo', id } };
  }
  if (r.tipo === 'ajuste') {
    const cero = /\b(cero|ninguno|no hay|no quedan?|no queda nada)\b/.test(norm(r.texto));
    const movs = [];
    r.items.forEach((i) => { if (cero) i.cant = 0; const dif = i.cant - stockT(prod(i.productoId), i.talle); if (dif) movs.push({ productoId: i.productoId, nombre: i.nombre, talle: i.talle, cant: dif }); });
    if (movs.length) moverStock(movs, 1, 'Conteo por mensaje', id, todayStr());
    return { txt: `✅ Stock corregido: ${r.items.map((i) => `${prodNombre(i.productoId, i.nombre)} talle ${i.talle} → ${i.cant} pares`).join(', ')}.`, deshacer: { k: 'stock', items: movs, signo: 1 } };
  }
  if (r.tipo === 'prestamoVuelta' || r.tipo === 'eventoHecho') {
    const e = state.eventos.find((x) => x.id === r.eventoId); e.hecho = true;
    return { txt: r.tipo === 'prestamoVuelta' ? `✅ Listo, ${e.quien ? e.quien + ' devolvió' : 'te devolvieron'}: ${e.titulo}. Ya no te aviso más.` : `✅ Hecho: ${e.titulo}.`, deshacer: { k: 'eventoHecho', id: e.id } };
  }
  if (r.tipo === 'pagoFactura') {
    const c = state.compras.find((x) => x.id === r.compraId); pagarCompra(c, r.fecha > todayStr() ? todayStr() : r.fecha);
    const quedan = debo().length;
    return { txt: `✅ Factura ${nomFactura(c)} pagada: ${fmtMoney(c.total)}.${quedan ? ` Te queda${quedan > 1 ? 'n' : ''} ${quedan} por pagar.` : ' No debés ninguna otra 👌'}`, deshacer: { k: 'pagoFactura', id: c.id } };
  }
  if (r.tipo === 'factura') {
    const hoy = todayStr(), tn = norm(r.texto), cat = categoriaGasto(r.texto), gasto = cat !== 'Otro gasto';
    const pagada = /\b(pague|pagamos|pagada|paga)\b/.test(tn) && !/\b(sin pagar|a pagar|no la pague|falta pagar|vence)\b/.test(tn);
    const c = { id, fecha: r.fechaDada && r.fecha <= hoy ? r.fecha : hoy, proveedor: gasto ? '' : r.cliente, nro: '', clase: gasto ? 'gasto' : 'otra', detalle: gasto ? cat : '', items: [], total: r.monto, pagada, fechaPago: '', vence: pagada ? '' : (r.fechaDada && r.fecha > hoy ? r.fecha : addDays(hoy, 30)), archivoId: '', origen: 'chat' };
    if (pagada) c.fechaPago = c.fecha;
    state.compras.push(c);
    if (!pagada) state.eventos.push({ id: uid(), fecha: c.vence, titulo: tituloFactura(c), tipo: 'pagar', monto: c.total, hecho: false, aviso: 'diario', creado: hoy, ref: c.id });
    return { txt: `🧾 Factura guardada ${nomFactura(c)}: ${fmtMoney(c.total)} · ${pagada ? 'pagada' : 'sin pagar, vence el ' + fmtDate(c.vence) + ' (te voy avisando)'}.\nPara guardarle la foto o el PDF tocá el 📎 de abajo.`, deshacer: { k: 'factura', id } };
  }
  if (r.tipo === 'venta') {
    const items = precioItems(r).map((i) => Object.assign(i, { costo: Number((prod(i.productoId) || {}).costo) || 0 }));
    const pago = r.pago || 'Efectivo';
    const v = { id, fecha: r.fecha, hora: new Date().toTimeString().slice(0, 5), cliente: r.cliente, telefono: '', pago, cobrado: pago !== 'Cuenta corriente', items, total: r.monto && !r.montoUnit ? r.monto : items.reduce((s, i) => s + i.cant * i.precio, 0), nota: r.texto, origen: 'chat' };
    moverStock(items, -1, 'Venta' + (v.cliente ? ' a ' + v.cliente : ''), id, v.fecha); state.ventas.push(v);
    const neg = items.filter((i) => stockT(prod(i.productoId), i.talle) < 0);
    return { txt: `✅ Venta cargada: ${detalle(items)}${v.cliente ? ' a ' + v.cliente : ''} · ${fmtMoney(v.total)} · ${pago === 'Cuenta corriente' ? 'te queda debiendo' : pago.toLowerCase()}${neg.length ? `\n⚠️ Ojo: según la app no había stock de ${detalle(neg)}. Revisá el stock.` : ''}`, deshacer: { k: 'venta', id } };
  }
  if (r.tipo === 'entrada' || r.tipo === 'salida') {
    const s = r.tipo === 'entrada' ? 1 : -1;
    moverStock(r.items, s, (s > 0 ? 'Entrada' : 'Salida') + ' por mensaje: ' + r.texto.slice(0, 60), id, r.fecha);
    const inv = s > 0 ? inversionEntrada(r.items, r.fecha, id) : '';
    const invTxt = inv ? ` Lo anoté como inversión: ${fmtMoney(state.movimientos.find((x) => x.id === inv).monto)}.` : (s > 0 ? ' (Si le cargás el costo al modelo, también lo cuento como inversión.)' : '');
    return { txt: `✅ ${s > 0 ? 'Entraron' : 'Salieron'} ${detalle(r.items)}. ${r.items.map((i) => `Ahora hay ${stockT(prod(i.productoId), i.talle)} del ${i.talle}`).filter((x, k, a) => a.indexOf(x) === k).join(', ')}.${invTxt}`, deshacer: { k: 'stock', items: r.items, signo: s, inv } };
  }
  if (r.tipo === 'muestra') {
    const mu = { id, fecha: r.fecha, cliente: r.cliente, telefono: '', items: r.items.map((i) => ({ productoId: i.productoId, nombre: i.nombre, talle: i.talle, cant: i.cant })), nota: '', estado: 'afuera', origen: 'chat' };
    moverStock(mu.items, -1, 'Muestra a ' + mu.cliente, id, mu.fecha); state.muestras.push(mu);
    return { txt: `✅ Muestra anotada: ${detalle(mu.items)} a ${mu.cliente}. Si en ${state.config.diasMuestra || 7} días no la buscaste, te aviso.`, deshacer: { k: 'muestra', id } };
  }
  if (r.tipo === 'muestraVuelta') {
    const mu = state.muestras.find((x) => x.id === r.muestraId); muestraVolvio(mu.id);
    return { txt: `✅ Listo, la muestra de ${mu.cliente} volvió. ${detalle(mu.items)} de nuevo en el stock.`, deshacer: { k: 'muestraVuelta', id: mu.id } };
  }
  if (r.tipo === 'cobro') {
    const v = state.ventas.find((x) => x.id === r.ventaId); v.cobrado = true; v.fechaCobro = r.fecha;
    return { txt: `✅ Cobrado: ${v.cliente} te pagó ${fmtMoney(v.total)} de la venta del ${fmtDate(v.fecha)}.`, deshacer: { k: 'cobro', id: v.id } };
  }
  if (['gasto', 'inversion', 'ingreso'].includes(r.tipo)) {
    const cat = r.tipo === 'gasto' ? categoriaGasto(r.texto) : CATS[r.tipo][r.tipo === 'inversion' ? 4 : 0];
    state.movimientos.push({ id, tipo: r.tipo, concepto: conceptoDe(r.texto) || cat, categoria: cat, monto: r.monto, fecha: r.fecha, origen: 'chat' });
    return { txt: `✅ ${TIPOS_MOV[r.tipo].lbl} anotado: ${fmtMoney(r.monto)} en ${cat.toLowerCase()}.`, deshacer: { k: 'mov', id } };
  }
  if (r.tipo === 'evento') {
    const tipo = r.prestamo ? 'prestamo' : /cobr/.test(norm(r.texto)) ? 'cobrar' : /pagar|pagarle/.test(norm(r.texto)) ? 'pagar' : /visit|ir a|pasar por/.test(norm(r.texto)) ? 'visita' : /entreg/.test(norm(r.texto)) ? 'entrega' : 'recordatorio';
    let tit = r.texto.replace(/^\s*(recordame|recorda(r|me)?|acordate( de)?|anota(me)?( que)?|agenda(me)?|tengo que|hay que)\s*/i, '').trim(); tit = tit.replace(/\b(el |este |el pr[oó]ximo )?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b|\b(pasado )?ma[nñ]ana\b|\bhoy\b|\b(a las|alas)\s*\d{1,2}([:.]\d{2})?\s*(hs|horas)?\b|\b\d{1,2}[:.]\d{2}\s*(hs)?\b|\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/gi, ' ').replace(/\s+/g, ' ').trim(); if (r.prestamo) { tit = tit.replace(/^\s*(ya )?(le |les )?(prest[eé]|prestamos|dej[eé] prestad[oa]s?)\s*/i, ''); if (r.cliente) tit = tit.replace(new RegExp('\\s*\\b(a|al|a la|para)\\s+' + r.cliente.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' '); tit = tit.replace(/\s*\bhasta( el)?\s*$/i, '').replace(/\s+/g, ' ').trim(); }
    const cm = r.texto.match(RE_COLOR), color = cm ? COL_PAL[cm[1].toLowerCase()] : ''; if (cm) tit = tit.replace(RE_COLOR, ' ').replace(/\s+/g, ' ').trim();
    tit = tit[0] ? tit[0].toUpperCase() + tit.slice(1) : r.texto;
    state.eventos.push({ id, fecha: r.fecha, hora: r.hora, titulo: tit, tipo, color, quien: r.prestamo ? r.cliente : '', monto: r.monto || 0, hecho: false, aviso: 'diario', creado: todayStr(), origen: 'chat' });
    if (r.prestamo) return { txt: `🤝 Anotado el préstamo${r.cliente ? ' a ' + r.cliente : ''}: ${tit}. Te aviso todos los días hasta el ${fmtDate(r.fecha)}${r.fechaDada ? '' : ' (le puse una semana; cambialo en el calendario si querés)'}.`, deshacer: { k: 'evento', id } };
    return { txt: `✅ Anotado en el calendario para el ${parseD(r.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}${r.hora ? ' a las ' + r.hora : ''}: ${tit}`, deshacer: { k: 'evento', id } };
  }
  return null;
}
function deshacer(d) {
  if (!d) return;
  if (d.k === 'venta') anularVenta(d.id);
  else if (d.k === 'stock') { moverStock(d.items, -d.signo, 'Corrección (se deshizo un mensaje)'); if (d.inv) state.movimientos = state.movimientos.filter((x) => x.id !== d.inv); }
  else if (d.k === 'muestra') { const mu = state.muestras.find((x) => x.id === d.id); if (mu && mu.estado === 'afuera') moverStock(mu.items, 1, 'Corrección (se deshizo un mensaje)', mu.id); state.muestras = state.muestras.filter((x) => x.id !== d.id); }
  else if (d.k === 'muestraVuelta') { const mu = state.muestras.find((x) => x.id === d.id); if (mu) { moverStock(mu.items, -1, 'Corrección (se deshizo un mensaje)', mu.id); mu.estado = 'afuera'; delete mu.fechaCierre; } }
  else if (d.k === 'cobro') { const v = state.ventas.find((x) => x.id === d.id); if (v) { v.cobrado = false; delete v.fechaCobro; } }
  else if (d.k === 'mov') state.movimientos = state.movimientos.filter((x) => x.id !== d.id);
  else if (d.k === 'evento') state.eventos = state.eventos.filter((x) => x.id !== d.id);
  else if (d.k === 'precio') d.prev.forEach((x) => { const p = prod(x.id); if (p) { p.costo = x.costo; p.precio = x.precio; } });
  else if (d.k === 'modelo') state.productos = state.productos.filter((x) => x.id !== d.id);
  else if (d.k === 'eventoHecho') { const e = state.eventos.find((x) => x.id === d.id); if (e) e.hecho = false; }
  else if (d.k === 'pagoFactura') { const c = state.compras.find((x) => x.id === d.id); if (c) { c.pagada = false; c.fechaPago = ''; state.eventos.filter((e) => e.ref === c.id).forEach((e) => { e.hecho = false; }); } }
  else if (d.k === 'factura') { const c = state.compras.find((x) => x.id === d.id); if (c && c.archivoId) archivoBorrar(c.archivoId); state.compras = state.compras.filter((x) => x.id !== d.id); state.eventos = state.eventos.filter((e) => e.ref !== d.id); }
}

// ---------- Consultas ----------
function responderConsulta(r) {
  const t = norm(r.texto), hoy = todayStr();
  if (r.items.length && /precio|costo|cuesta|sale|vale|gano/.test(t)) return [...new Set(r.items.map((i) => i.productoId))].map(prod).map((p) => `${p.nombre}: costo ${p.costo ? fmtMoney(p.costo) : 'sin cargar'} · precio de venta ${p.precio ? fmtMoney(p.precio) : 'sin cargar'}${p.costo && p.precio ? ` · ganás ${fmtMoney(p.precio - p.costo)} por par` : ''}`).join('\n');
  if (/invert|inversion/.test(t)) { const rm = resumenMes(hoy.slice(0, 7)); return `En ${MESES[+hoy.slice(5, 7) - 1].toLowerCase()} llevás invertido ${fmtMoney(rm.inversion)}.\nMercadería que hay en el depósito, a costo: ${fmtMoney(valorStock())}.`; }
  if (/prest/.test(t)) { const p = state.eventos.filter((e) => e.tipo === 'prestamo' && !e.hecho); return p.length ? 'Tenés prestado:\n' + p.map((e) => `• ${e.quien || 'Sin nombre'}: ${e.titulo} (lo devuelve el ${fmtDate(e.fecha)})`).join('\n') : 'No tenés nada prestado.'; }
  if (/\b(debo|facturas?|a pagar|tengo que pagar)\b/.test(t) && !/me deben?/.test(t)) { const d = debo(); return d.length ? 'Facturas sin pagar:\n' + d.map((c) => `• ${c.proveedor || c.detalle || 'Factura'}${c.nro ? ' ' + c.nro : ''}: ${fmtMoney(c.total)}${c.vence ? ' (vence el ' + fmtDate(c.vence) + ')' : ''}`).join('\n') + `\nTotal: ${fmtMoney(d.reduce((s, c) => s + (+c.total || 0), 0))}` : 'No debés ninguna factura 👌'; }
  if (r.items.length || /stock|hay|tengo|quedan?/.test(t) && !/vend|deb|muestra|gan/.test(t)) {
    const ids = [...new Set(r.items.map((i) => i.productoId))];
    const ps = ids.length ? ids.map(prod) : state.productos.filter((p) => !p.archivado);
    const ts = r.items.map((i) => i.talle).filter(Boolean);
    if (!ps.length) return 'Todavía no hay modelos cargados.';
    return ps.map((p) => ts.length ? `${p.nombre}: ` + ts.map((tl) => `talle ${tl} → ${stockT(p, tl)} pares`).join(', ') : `${p.nombre} (${stockTotal(p)} pares): ` + (talles().filter((tl) => stockT(p, tl)).map((tl) => `${tl}(${stockT(p, tl)})`).join(' ') || 'sin stock')).join('\n');
  }
  if (/deb|deuda/.test(t)) { const d = meDeben(); return d.length ? 'Te deben:\n' + d.map((v) => `• ${v.cliente || 'Sin nombre'}: ${fmtMoney(v.total)} (desde el ${fmtDate(v.fecha)})`).join('\n') + `\nTotal: ${fmtMoney(d.reduce((s, v) => s + (+v.total || 0), 0))}` : 'Nadie te debe plata 👌'; }
  if (/muestra/.test(t)) { const a = muestrasAfuera(); return a.length ? 'Muestras afuera:\n' + a.map((m) => `• ${m.cliente}: ${resumenItems(m.items)} (${hace(daysBetween(m.fecha, hoy))})`).join('\n') : 'No hay muestras afuera.'; }
  if (/vend|venta|facture|gan/.test(t)) {
    const semana = /semana/.test(t), mesQ = /mes/.test(t) || /gan/.test(t);
    const desde = semana ? addDays(hoy, -6) : mesQ ? hoy.slice(0, 8) + '01' : r.fecha;
    const vs = state.ventas.filter((v) => v.fecha >= desde && v.fecha <= hoy);
    const tot = vs.reduce((s, v) => s + (+v.total || 0), 0);
    const per = semana ? 'en los últimos 7 días' : mesQ ? 'en ' + MESES[+hoy.slice(5, 7) - 1].toLowerCase() : r.fecha === hoy ? 'hoy' : 'el ' + fmtDate(r.fecha);
    let s = `Vendiste ${fmtMoney(tot)} ${per} (${vs.length} ventas, ${pares(vs.flatMap((v) => v.items))} pares).`;
    if (mesQ) { const rm = resumenMes(hoy.slice(0, 7)); s += `\nGanancia del mes, ya descontados los gastos: ${fmtMoney(rm.neta)}.`; }
    return s;
  }
  if (/agenda|calendario|tengo que|hacer|pendiente/.test(t)) { const e = state.eventos.filter((x) => !x.hecho && x.fecha <= addDays(hoy, 7)).sort((a, b) => a.fecha.localeCompare(b.fecha)); return e.length ? 'Próximos 7 días:\n' + e.map((x) => `• ${fmtDateC(x.fecha)}${x.hora ? ' ' + x.hora : ''}: ${x.titulo}`).join('\n') : 'No tenés nada anotado para los próximos 7 días.'; }
  return null;
}

// ---------- Chat ----------
const EJEMPLOS = '🛒 Ventas: "vendí 2 bolt 42 a Juan 85000" · "Juan me pagó"\n📥 Stock: "entraron 10 xr 40 y 5 xr 41" · "salieron 2 bolt 41 rotos" · "conté 6 bolt 42"\n🏷️ Modelos y precios: "bolt costo 30000 precio 55000" · "nuevo modelo Titan 03"\n📦 Muestras: "dejé muestra high boots 43 a Constructora Andes" · "busqué la muestra de Andes"\n🤝 Préstamos: "le presté una campera a Pedro hasta el viernes" · "Pedro me devolvió la campera"\n🧾 Facturas: "factura de Ringo 500000 vence el 30" · "pagué la factura de Ringo" · el 📎 guarda la foto\n💸 Plata: "gasté 20000 de nafta" · "invertí 100000 en estanterías"\n📅 Calendario: "el lunes a las 10 entregar a obra Pérez en rojo" · "listo la entrega de Pérez"\n❓ Preguntas: "¿cuánto hay de bolt?" · "¿cuánto vendí este mes?" · "¿qué debo?" · "¿quién me debe?" · "¿qué presté?"';
const AYUDA = 'No entendí bien 🤔. Podés escribirme cosas así:\n' + EJEMPLOS + '\nO elegí qué querés cargar:';
const ELEGIR = { // cuando hay que elegir sobre cuál registro actuar
  cobro: { key: 'ventaId', lista: () => meDeben(), get: (id) => state.ventas.find((x) => x.id === id), nom: (x) => x.cliente, lbl: (x) => `${x.cliente || 'Sin nombre'} · ${fmtMoney(x.total)}`, q: '¿Cuál te pagaron?', nada: 'No hay ventas a cuenta pendientes de cobro.' },
  muestraVuelta: { key: 'muestraId', lista: () => muestrasAfuera(), get: (id) => state.muestras.find((x) => x.id === id), nom: (x) => x.cliente, lbl: (x) => `${x.cliente || 'Sin nombre'} · ${resumenItems(x.items, 1)}`, q: '¿Cuál muestra volvió?', nada: 'No hay muestras afuera.' },
  prestamoVuelta: { key: 'eventoId', lista: () => state.eventos.filter((e) => e.tipo === 'prestamo' && !e.hecho), get: (id) => state.eventos.find((x) => x.id === id), nom: (x) => (x.quien || '') + ' ' + x.titulo, lbl: (x) => `${x.quien || 'Sin nombre'} · ${x.titulo}`, q: '¿Qué te devolvieron?', nada: 'No tenés nada prestado.' },
  eventoHecho: { key: 'eventoId', lista: () => state.eventos.filter((e) => e.tipo !== 'prestamo' && !e.hecho).sort((a, b) => a.fecha.localeCompare(b.fecha)), get: (id) => state.eventos.find((x) => x.id === id), nom: (x) => x.titulo, lbl: (x) => `${fmtDateC(x.fecha)} · ${x.titulo}`, q: '¿Qué es lo que ya hiciste?', nada: 'No hay nada pendiente en el calendario.' },
  pagoFactura: { key: 'compraId', lista: () => debo(), get: (id) => state.compras.find((x) => x.id === id), nom: (x) => [x.proveedor, x.detalle, x.nro].join(' '), lbl: (x) => `${x.proveedor || x.detalle || 'Factura'}${x.nro ? ' ' + x.nro : ''} · ${fmtMoney(x.total)}`, q: '¿Cuál factura pagaste?', nada: 'No hay facturas sin pagar.' },
};
const SIN_PESO = /^(para|con|los|las|del|que|una|uno|por|the|sus|mis|este|esta|factura|pagar|entrega|entregar|listo|hecho)$/;
const chatOrden = () => state.chat.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
function chatPush(m) { const r = Object.assign({ id: uid(), ts: Date.now(), fecha: todayStr(), hora: new Date().toTimeString().slice(0, 5) }, m); state.chat.push(r); if (state.chat.length > 300) { const ord = chatOrden(); const fuera = new Set(ord.slice(0, state.chat.length - 300).map((x) => x.id)); state.chat = state.chat.filter((x) => !fuera.has(x.id)); } return r; }
function procesarMensaje(txt) {
  txt = String(txt || '').trim(); if (!txt) return;
  chatPush({ de: 'yo', texto: txt, usuario: cloud.email || '' });
  // varios renglones con acciones distintas = varios mensajes
  const lineas = txt.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const partes = lineas.length > 1 && lineas.every((l) => interpretar(l).tipo) ? lineas : [txt];
  partes.forEach(procesarUno);
  commit();
}
function procesarUno(txt) {
  const r = revisar(interpretar(txt));
  if (!r.tipo) { chatPush({ de: 'app', texto: AYUDA, botones: 'menu', original: txt }); return; }
  if (r.tipo === 'ayuda') { chatPush({ de: 'app', texto: 'Podés pedirme todo lo que hace la app, escribiendo o dictando:\n' + EJEMPLOS + '\nSi me equivoco, tocá ↩️ Deshacer.', original: txt }); return; }
  if (r.tipo === 'consulta') { chatPush({ de: 'app', texto: responderConsulta(r) || AYUDA, botones: responderConsulta(r) ? '' : 'menu', original: txt }); return; }
  if (ELEGIR[r.tipo]) {
    const E = ELEGIR[r.tipo], t = norm(txt), lista = E.lista();
    let cand = lista.filter((x) => norm(E.nom(x)).split(/[^a-z0-9ñ]+/).some((w) => w.length >= 3 && !SIN_PESO.test(w) && new RegExp('(^|[^a-z0-9ñ])' + w + '([^a-z0-9ñ]|$)').test(t)));
    if (r.tipo === 'muestraVuelta' && r.items.length) cand = (cand.length ? cand : lista).filter((x) => x.items.some((i) => r.items.some((j) => j.productoId === i.productoId)));
    if (r.tipo === 'pagoFactura' && cand.length > 1 && r.monto) { const ex = cand.filter((x) => Number(x.total) === r.monto); if (ex.length) cand = ex; }
    if (cand.length === 1) { r[E.key] = cand[0].id; const res = ejecutar(r); chatPush({ de: 'app', texto: res.txt, deshacer: res.deshacer, original: txt }); return; }
    if (!lista.length) { chatPush({ de: 'app', texto: E.nada, original: txt }); return; }
    chatPush({ de: 'app', texto: E.q, elegir: { tipo: r.tipo, ids: (cand.length ? cand : lista).slice(0, 8).map((x) => x.id) }, original: txt });
    return;
  }
  if (!r.falta.length) { const res = ejecutar(r); chatPush({ de: 'app', texto: res.txt, deshacer: res.deshacer, original: txt }); return; }
  // falta algo: se pregunta con un formulario ya completado
  const que = { venta: 'una venta', compra: 'una factura de compra', entrada: 'mercadería que entró', salida: 'mercadería que salió', muestra: 'una muestra', gasto: 'un gasto', inversion: 'una inversión', ingreso: 'un ingreso', evento: r.prestamo ? 'un préstamo' : 'algo para el calendario', precio: 'el precio de un modelo', modelo: 'un modelo nuevo', ajuste: 'un conteo de stock', factura: 'una factura' }[r.tipo];
  chatPush({ de: 'app', texto: `Entendí que es ${que}${r.items.length ? ': ' + detalle(r.items) : ''}${r.cliente ? ' · ' + r.cliente : ''}${r.monto ? ' · ' + fmtMoney(r.monto) : ''}.\n${r.tipo === 'compra' ? 'Revisá los costos y si la pagaste, y guardala.' : 'Me falta ' + r.falta.join(' y ') + '. Tocá Completar.'}`, pendiente: r, estado: 'pendiente', original: txt });
}
function abrirPendiente(msg) {
  const r = msg.pendiente; const done = (rec) => { msg.estado = 'cargado'; msg.texto += '\n✅ Cargado.'; commit(); void rec; };
  const items = r.tipo === 'venta' ? precioItems(r) : r.items;
  const base = { fecha: r.fecha, cliente: r.cliente, items, origen: 'chat', nota: r.texto };
  if (r.tipo === 'venta') ventaForm(Object.assign(base, { pago: r.pago, total: r.monto && !r.montoUnit ? r.monto : null }), done);
  else if (r.tipo === 'compra') compraForm(null, Object.assign(base, { items: r.items.map((i) => Object.assign({}, i, { precio: r.montoUnit ? r.monto : '' })), total: r.monto && !r.montoUnit ? r.monto : null }), done);
  else if (r.tipo === 'entrada' || r.tipo === 'salida') movStockForm(r.tipo, base, done);
  else if (r.tipo === 'muestra') muestraForm(base, done);
  else if (['gasto', 'inversion', 'ingreso'].includes(r.tipo)) movForm(r.tipo, null, { concepto: conceptoDe(r.texto), categoria: r.tipo === 'gasto' ? categoriaGasto(r.texto) : undefined, monto: r.monto, fecha: r.fecha, origen: 'chat' }, done);
  else if (r.tipo === 'evento') eventoForm(null, Object.assign({ titulo: r.prestamo ? '' : r.texto, fecha: r.fecha, hora: r.hora, origen: 'chat' }, r.prestamo ? { tipo: 'prestamo', quien: r.cliente } : {}), done);
  else if (r.tipo === 'factura') compraForm(null, { clase: categoriaGasto(r.texto) !== 'Otro gasto' ? 'gasto' : 'otra', proveedor: r.cliente, total: r.monto || null, pagada: false, origen: 'chat' }, done);
  else if (r.tipo === 'precio' && r.items[0]) prodForm(r.items[0].productoId, null, done);
  else if (r.tipo === 'modelo') { const pr = leerPrecios(r.texto); prodForm(null, { nombre: nombreModelo(r.texto), costo: pr.costo, precio: pr.precio }, done); }
  else if (r.tipo === 'ajuste' && r.items[0]) { contarForm(r.items[0].productoId); msg.estado = 'cargado'; save(); }
}

VISTAS.mensaje = () => {
  const msgs = chatOrden().slice(-80);
  let dia = '';
  return `<div class="spread"><div><h1>💬 Cargar por mensaje</h1><p class="sub">Escribile a la app como le escribirías a alguien por WhatsApp. Podés tocar el 🎤 del teclado y dictar.</p></div></div>
  <div class="chat" id="chatLog">${msgs.length ? msgs.map((m) => { const sep = m.fecha !== dia ? `<div class="chat-dia">${m.fecha === todayStr() ? 'Hoy' : fmtDate(m.fecha)}</div>` : ''; dia = m.fecha; return sep + burbuja(m); }).join('') : `<div class="burbuja app"><div class="txt">Hola 👋 Contame qué hiciste y lo cargo. Desde acá podés manejar toda la app:\n${esc(EJEMPLOS)}</div></div>`}</div>
  <div class="chat-ej">${['vendí 1 bolt 42 a ', 'entraron ', 'dejé muestra ', 'busqué la muestra de ', 'gasté ', 'le presté ', 'me devolvió ', 'factura de ', 'pagué la factura de ', 'precio del ', '¿cuánto hay de ', '¿qué debo?', 'ayuda'].map((e) => `<button class="sm" data-act="chatEj" data-id="${esc(e)}">${esc(e.replace(/\s$/, '…'))}</button>`).join('')}</div>
  <div class="chat-bar"><button data-act="chatAdjuntar" aria-label="Guardar foto o PDF de una factura" title="Guardar foto o PDF de una factura">📎</button><textarea id="chatTxt" rows="1" placeholder="Escribí un mensaje…" enterkeyhint="send">${esc(ui.msg)}</textarea><button class="acc" data-act="chatEnviar" aria-label="Enviar">➤</button></div>`;
};
function burbuja(m) {
  if (m.de === 'yo') return `<div class="burbuja yo"><div class="txt">${esc(m.texto)}</div><div class="hora">${esc(m.hora)}${m.usuario && cloud.email && m.usuario !== cloud.email ? ' · ' + esc(m.usuario.split('@')[0]) : ''}</div></div>`;
  let extra = '';
  if (m.deshacer && !m.deshecho) extra = `<div class="row"><button class="sm" data-act="chatDeshacer" data-id="${m.id}">↩️ Deshacer</button></div>`;
  if (m.deshecho) extra = '<div class="small muted">↩️ Deshecho</div>';
  if (m.estado === 'pendiente') extra = `<div class="row"><button class="sm pri" data-act="chatCompletar" data-id="${m.id}">✏️ Completar</button><button class="sm" data-act="chatDescartar" data-id="${m.id}">Descartar</button></div>`;
  if (m.estado === 'descartado') extra = '<div class="small muted">Descartado</div>';
  if (m.botones === 'menu' && !m.usado) extra = `<div class="row">${[['venta', '🛒 Venta'], ['entrada', '📥 Entró'], ['salida', '📤 Salió'], ['muestra', '📦 Muestra'], ['gasto', '💸 Gasto'], ['factura', '🧾 Factura'], ['prestamo', '🤝 Presté'], ['evento', '📅 Recordatorio']].map(([k, l]) => `<button class="sm" data-act="chatMenu" data-id="${m.id}|${k}">${l}</button>`).join('')}</div>`;
  if (m.elegir && !m.usado) {
    const E = ELEGIR[m.elegir.tipo]; const lst = m.elegir.ids.map((id) => E.get(id)).filter(Boolean);
    extra = `<div class="list">${lst.map((x) => `<button class="sm" style="justify-content:flex-start;margin-top:4px" data-act="chatElegir" data-id="${m.id}|${x.id}">${esc(E.lbl(x))}</button>`).join('')}</div>`;
  }
  return `<div class="burbuja app"><div class="txt">${esc(m.texto)}</div>${extra}<div class="hora">${esc(m.hora)}</div></div>`;
}
let chatScroll = true;
function afterRender() {
  if (view !== 'mensaje') return;
  const ta = $('#chatTxt'); if (!ta) return;
  const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight + 2) + 'px'; }; fit();
  ta.oninput = () => { ui.msg = ta.value; fit(); };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 760) { e.preventDefault(); ACTS.chatEnviar(); } };
  if (chatScroll) { chatScroll = false; const l = $('#chatLog'); if (l) l.scrollTop = l.scrollHeight; window.scrollTo(0, document.body.scrollHeight); }
}
const chatMsg = (id) => state.chat.find((x) => x.id === id);
Object.assign(ACTS, {
  chatEnviar: () => { const ta = $('#chatTxt'); const v = ta ? ta.value : ui.msg; if (!v.trim()) return; ui.msg = ''; chatScroll = true; procesarMensaje(v); const t2 = $('#chatTxt'); if (t2 && window.innerWidth > 760) t2.focus(); },
  chatEj: (txt) => { ui.msg = txt; const ta = $('#chatTxt'); if (ta) { ta.value = txt; ta.dispatchEvent(new Event('input')); } if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } },
  chatDeshacer: (id) => { const m = chatMsg(id); if (!m || m.deshecho) return; deshacer(m.deshacer); m.deshecho = true; commit(); toast('Deshecho'); },
  chatCompletar: (id) => { const m = chatMsg(id); if (m) abrirPendiente(m); },
  chatAdjuntar: () => elegirArchivo((a) => {
    const ult = chatOrden().slice().reverse().find((m) => m.de === 'app' && m.deshacer && m.deshacer.k === 'factura' && !m.deshecho);
    const c = ult && state.compras.find((x) => x.id === ult.deshacer.id);
    chatScroll = true;
    if (c && !c.archivoId && Date.now() - (ult.ts || 0) < 15 * 60000) { c.archivoId = archivoGuardar(a, c.id); chatPush({ de: 'app', texto: `📎 Listo, guardé el archivo en la factura ${nomFactura(c)}.` }); commit(); return; }
    compraForm(null, { archivo: a, clase: 'otra', origen: 'chat' }, (f) => { chatPush({ de: 'app', texto: `🧾 Factura guardada con su archivo${nomFactura(f) ? ' (' + nomFactura(f) + ')' : ''}: ${fmtMoney(f.total)} · ${f.pagada ? 'pagada' : 'sin pagar' + (f.vence ? ', vence el ' + fmtDate(f.vence) : '')}.` }); commit(); });
  }),
  chatDescartar: (id) => { const m = chatMsg(id); if (m) { m.estado = 'descartado'; commit(); } },
  chatMenu: (v) => { const [id, k] = v.split('|'); const m = chatMsg(id); if (!m) return; const r = revisar(interpretar(m.original || '')); r.tipo = k; if (k === 'prestamo') { r.tipo = 'evento'; r.prestamo = true; } const msg = { pendiente: r }; m.usado = true; save(); abrirPendiente(Object.assign(msg, { texto: '' })); },
  chatElegir: (v) => { const [id, x] = v.split('|'); const m = chatMsg(id); if (!m) return; const r = { tipo: m.elegir.tipo, fecha: todayStr(), texto: m.original, items: [] }; r[ELEGIR[m.elegir.tipo].key] = x; const res = ejecutar(r); m.usado = true; chatPush({ de: 'app', texto: res.txt, deshacer: res.deshacer }); chatScroll = true; commit(); },
});
