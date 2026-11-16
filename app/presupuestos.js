'use strict';
/* Presupuestos: una hoja con los datos del local y, por renglón, número de artículo,
   nombre, descripción, cantidad, precio por unidad y total. Se imprime o se guarda en PDF. */

const presuNro = (n) => String(n || 0).padStart(4, '0');
const presuTotal = (p) => (p.items || []).reduce((s, i) => s + (Number(i.cant) || 0) * (Number(i.precio) || 0), 0);
const presuSig = () => state.presupuestos.reduce((m, p) => Math.max(m, Number(p.nro) || 0), 0) + 1;
const ESTADOS_P = { pendiente: ['Esperando respuesta', 'warn'], aceptado: ['Aceptado', 'in'], rechazado: ['No se hizo', ''] };
const itemNom = (i) => i.nombre + (tl(i.talle) ? ' · talle ' + i.talle : '');
const presuVence = (p) => p.validez ? addDays(p.fecha, Number(p.validez) || 0) : '';

VISTAS.presupuestos = () => {
  let ps = state.presupuestos.slice();
  if (ui.presuTab !== 'todos') ps = ps.filter((p) => (p.estado || 'pendiente') === ui.presuTab);
  ps.sort((a, b) => (b.nro || 0) - (a.nro || 0));
  const cuenta = (e) => state.presupuestos.filter((p) => (p.estado || 'pendiente') === e).length;
  return `<div class="spread"><div><h1>Presupuestos</h1><p class="sub">Armá el presupuesto eligiendo los artículos y la app arma la hoja con los datos del local, lista para imprimir o mandar.</p></div>
    <button class="pri" data-act="presuNuevo">+ Nuevo presupuesto</button></div>
  <div class="tabs"><button class="${ui.presuTab === 'todos' ? 'on' : ''}" data-act="presuTab" data-id="todos">Todos (${state.presupuestos.length})</button><button class="${ui.presuTab === 'pendiente' ? 'on' : ''}" data-act="presuTab" data-id="pendiente">Esperando respuesta (${cuenta('pendiente')})</button><button class="${ui.presuTab === 'aceptado' ? 'on' : ''}" data-act="presuTab" data-id="aceptado">Aceptados (${cuenta('aceptado')})</button></div>
  ${ps.length ? `<div class="tablewrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Detalle</th><th>Estado</th><th class="n">Total</th></tr></thead><tbody>
    ${ps.map((p) => { const e = ESTADOS_P[p.estado || 'pendiente']; return `<tr class="click" data-act="presuVer" data-id="${p.id}"><td class="b">${presuNro(p.nro)}</td><td>${fmtDateC(p.fecha)}</td><td>${esc(p.cliente || '—')}</td><td>${esc((p.items || []).slice(0, 2).map((i) => `${i.cant} × ${itemNom(i)}`).join(' · '))}${(p.items || []).length > 2 ? ` y ${p.items.length - 2} más` : ''}</td><td><span class="pill ${e[1]}">${e[0]}</span></td><td class="n b">${fmtMoney(presuTotal(p))}</td></tr>`; }).join('')}
    </tbody></table></div>` : '<div class="empty">Todavía no hay presupuestos. Tocá <b>+ Nuevo presupuesto</b>.</div>'}`;
};

function presuForm(id, pre = {}, onSaved) {
  const orig = id ? state.presupuestos.find((x) => x.id === id) : null;
  const p = orig || Object.assign({ fecha: todayStr(), validez: 15, cliente: '', nota: state.config.presuNota || '' }, pre);
  const lines = (p.items && p.items.length ? p.items : [{}]).map((i) => ({ productoId: i.productoId || '', codigo: i.codigo || '', nombre: i.nombre || '', talle: i.talle || '', descripcion: i.descripcion || '', cant: i.cant || '', precio: i.precio || '' }));
  const arts = state.productos.filter((x) => !x.archivado).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const clientes = [...new Set(state.ventas.map((v) => v.cliente).concat(state.presupuestos.map((x) => x.cliente)).filter(Boolean))];
  const fila = (l, i) => `<div class="linea pline" data-i="${i}">
      <div class="row"><select data-k="productoId" style="flex:1 1 220px"><option value="">— Elegí un artículo o escribilo a mano —</option>${artOptions(l.productoId)}</select>${prod(l.productoId) && !sinTalle(prod(l.productoId)) ? `<select data-k="talle" style="flex:0 1 130px" aria-label="Talle"><option value="">Talle…</option>${tallesDe(prod(l.productoId)).map((t) => `<option ${t === l.talle ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}${lines.length > 1 ? '<button type="button" class="sm danger" data-k="del" title="Quitar">✕</button>' : ''}</div>
      <div class="pgrid"><label class="f">N° art.<input data-k="codigo" value="${esc(l.codigo)}"></label><label class="f">Artículo<input data-k="nombre" value="${esc(l.nombre)}"></label><label class="f pdesc">Descripción<input data-k="descripcion" value="${esc(l.descripcion)}"></label>
      <label class="f">Cantidad<input data-k="cant" inputmode="numeric" value="${esc(l.cant)}"></label><label class="f">Precio por unidad<input data-k="precio" inputmode="decimal" value="${esc(l.precio)}" placeholder="$"></label><div class="f">Total<b class="ptot">${fmtMoney(numIn(l.cant) * numIn(l.precio))}</b></div></div></div>`;
  modal(`<h3>${orig ? 'Editar presupuesto N° ' + presuNro(p.nro) : 'Nuevo presupuesto'}</h3>
    <div class="form"><label class="f">Cliente<input name="cliente" list="pfCli" value="${esc(p.cliente)}" placeholder="Nombre o empresa"><datalist id="pfCli">${clientes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <label class="f">CUIT / DNI (opcional)<input name="cuit" value="${esc(p.cuit)}"></label>
    <label class="f">Dirección (opcional)<input name="direccion" value="${esc(p.direccion)}"></label>
    <label class="f">Teléfono (opcional)<input name="telefono" value="${esc(p.telefono)}"></label>
    <label class="f">Fecha<input type="date" name="fecha" value="${p.fecha}"></label>
    <label class="f">Vale por (días)<input name="validez" inputmode="numeric" value="${esc(p.validez)}"></label></div>
    <div class="lineas mt" id="prL"></div><div class="row mt"><button type="button" class="sm" id="prAdd">+ Otro renglón</button></div>
    <label class="f mt">Aclaraciones (salen al pie de la hoja)<textarea name="nota" rows="2" placeholder="Ej: Precios con IVA incluido. Entrega en 5 días.">${esc(p.nota)}</textarea></label>
    <div class="totbar mt"><span class="small muted" id="prCant"></span><b style="font-size:20px" id="prTot"></b></div>
    <p class="err" id="prErr"></p>
    <div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="prOk">Guardar presupuesto</button></div>`, (box) => {
    const cont = $('#prL', box);
    const tot = () => { const t = lines.reduce((s, l) => s + numIn(l.cant) * numIn(l.precio), 0); $('#prTot', box).textContent = 'Total ' + fmtMoney(t); $('#prCant', box).textContent = lines.filter((l) => l.nombre).length + ' renglones'; };
    const draw = () => { cont.innerHTML = lines.map(fila).join(''); tot(); };
    cont.addEventListener('change', (e) => { const el = e.target; if (el.dataset.k !== 'productoId') return; const l = lines[+el.closest('.pline').dataset.i]; l.productoId = el.value; l.talle = ''; const a = prod(el.value); if (a) { if (sinTalle(a)) l.talle = TU; l.codigo = a.codigo || ''; l.nombre = a.nombre + (a.color ? ' ' + a.color : ''); l.descripcion = a.descripcion || ''; l.precio = a.precio || ''; if (!l.cant) l.cant = 1; } draw(); });
    cont.addEventListener('input', (e) => { const el = e.target, k = el.dataset.k; if (!k || k === 'productoId') return; const li = el.closest('.pline'), l = lines[+li.dataset.i]; l[k] = el.value; $('.ptot', li).textContent = fmtMoney(numIn(l.cant) * numIn(l.precio)); tot(); });
    cont.addEventListener('click', (e) => { const b = e.target.closest('[data-k=del]'); if (!b) return; lines.splice(+b.closest('.pline').dataset.i, 1); draw(); });
    $('#prAdd', box).onclick = () => { lines.push({ productoId: '', codigo: '', nombre: '', talle: '', descripcion: '', cant: '', precio: '' }); draw(); };
    $('#prOk', box).onclick = () => {
      const g = (n) => $(`[name=${n}]`, box).value.trim();
      const items = lines.filter((l) => String(l.nombre).trim()).map((l) => ({ productoId: l.productoId, codigo: String(l.codigo).trim(), nombre: String(l.nombre).trim(), talle: l.productoId ? (l.talle || '') : '', descripcion: String(l.descripcion).trim(), cant: Math.max(1, Math.round(numIn(l.cant)) || 1), precio: numIn(l.precio) }));
      if (!items.length) return ($('#prErr', box).textContent = 'Elegí al menos un artículo.');
      const data = { cliente: g('cliente'), cuit: g('cuit'), direccion: g('direccion'), telefono: g('telefono'), fecha: g('fecha') || todayStr(), validez: Math.round(numIn(g('validez'))) || 0, nota: $('[name=nota]', box).value.trim(), items };
      let rec; if (orig) rec = Object.assign(orig, data); else { rec = Object.assign({ id: uid(), nro: presuSig(), estado: 'pendiente', creado: todayStr(), origen: pre.origen || 'app' }, data); state.presupuestos.push(rec); }
      closeModal(); commit(); toast('Presupuesto N° ' + presuNro(rec.nro) + ' guardado'); if (onSaved) onSaved(rec); else presuVer(rec.id);
    };
    draw();
  });
}

// La hoja tal como se imprime. Sirve para el presupuesto y para el comprobante de una venta.
function hojaDoc(d) {
  const c = state.config;
  const dato = (l, x) => x ? `<div><span>${l}</span> ${esc(x)}</div>` : '';
  return `<div class="hoja">
    <div class="hoja-top"><div class="hoja-neg"><img src="logo-vertical.png" alt=""><div><b>${esc(c.negocio)}</b>${dato('CUIT', c.cuit)}${dato('', c.iva)}${dato('', c.direccion)}${dato('Tel.', c.telefono)}${dato('', c.email)}</div></div>
      <div class="hoja-nro"><div class="hoja-tit">${esc(d.titulo)}</div><div>N° <b>${presuNro(d.nro)}</b></div><div>Fecha: ${fmtDate(d.fecha)}</div>${(d.lineas || []).filter(Boolean).map((x) => `<div>${esc(x)}</div>`).join('')}</div></div>
    <div class="hoja-cli"><b>Cliente:</b> ${esc(d.cliente || '—')}${d.cuit ? ' · CUIT/DNI ' + esc(d.cuit) : ''}${d.direccion ? ' · ' + esc(d.direccion) : ''}${d.telefono ? ' · Tel. ' + esc(d.telefono) : ''}</div>
    <table class="hoja-tabla"><thead><tr><th>N° art.</th><th>Artículo</th><th>Descripción</th><th class="n">Cant.</th>${d.sinPrecios ? '' : '<th class="n">Precio unit.</th><th class="n">Total</th>'}</tr></thead><tbody>
      ${(d.items || []).map((i) => `<tr><td>${esc(i.codigo)}</td><td>${esc(itemNom(i))}</td><td>${esc(i.descripcion)}</td><td class="n">${fmtNum(i.cant)}</td>${d.sinPrecios ? '' : `<td class="n">${fmtMoney(i.precio)}</td><td class="n">${fmtMoney(i.cant * i.precio)}</td>`}</tr>`).join('')}
    </tbody><tfoot>${d.sinPrecios ? `<tr><td colspan="3" class="n">TOTAL DE UNIDADES</td><td class="n">${fmtNum(pares(d.items))}</td></tr>` : `<tr><td colspan="5" class="n">TOTAL</td><td class="n">${fmtMoney(d.total)}</td></tr>`}</tfoot></table>
    ${d.nota ? `<div class="hoja-nota">${esc(d.nota)}</div>` : ''}
    ${d.firma ? '<div class="hoja-firma"><div>Recibí conforme (firma)</div><div>Aclaración</div><div>DNI</div><div>Fecha</div></div>' : ''}
    <div class="hoja-pie">${esc(d.pie || '')}</div></div>`;
}
function presuHoja(p) {
  const v = presuVence(p);
  return hojaDoc({ titulo: 'PRESUPUESTO', nro: p.nro, fecha: p.fecha, lineas: [v ? 'Válido hasta: ' + fmtDate(v) : ''], cliente: p.cliente, cuit: p.cuit, direccion: p.direccion, telefono: p.telefono, items: p.items, total: presuTotal(p), nota: p.nota, pie: 'Documento no válido como factura.' });
}
function imprimirHoja(html, titulo) {
  let d = $('#print'); if (!d) { d = document.createElement('div'); d.id = 'print'; document.body.appendChild(d); }
  d.innerHTML = html;
  const antes = document.title; document.title = titulo;
  document.body.classList.add('imprimiendo');
  const fin = () => { document.body.classList.remove('imprimiendo'); document.title = antes; window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  const img = $('img', d); const ir = () => setTimeout(() => { window.print(); setTimeout(fin, 1500); }, 60);
  if (img && !img.complete) { img.onload = ir; img.onerror = ir; } else ir();
}
// Remito de una venta: mismo formato que el presupuesto, con su propio número y lugar para la firma
function ventaNro(v) { if (!v.nroComp) { v.nroComp = state.ventas.reduce((m, x) => Math.max(m, Number(x.nroComp) || 0), 0) + 1; save(); } return v.nroComp; }
function ventaHoja(v, conPrecios) {
  const items = v.items.map((i) => { const a = prod(i.productoId) || {}; return { codigo: a.codigo || '', nombre: prodNombre(i.productoId, i.nombre), talle: i.talle, descripcion: a.descripcion || '', cant: i.cant, precio: i.precio }; });
  const pres = v.presuId && state.presupuestos.find((x) => x.id === v.presuId);
  return hojaDoc({ titulo: 'REMITO', nro: ventaNro(v), fecha: v.fecha, sinPrecios: !conPrecios, firma: true, lineas: [conPrecios ? 'Forma de pago: ' + v.pago : '', pres ? 'Presupuesto N° ' + presuNro(pres.nro) : ''], cliente: v.cliente, cuit: v.cuit, direccion: v.direccion, telefono: v.telefono, items, total: v.total, nota: '', pie: 'Documento no válido como factura.' });
}
function presuTexto(p) {
  return `*Presupuesto N° ${presuNro(p.nro)}* — ${state.config.negocio}\n${fmtDate(p.fecha)}${p.cliente ? ' · ' + p.cliente : ''}\n\n` + (p.items || []).map((i) => `• ${i.cant} × ${itemNom(i)}${i.codigo ? ' (art. ' + i.codigo + ')' : ''}: ${fmtMoney(i.precio)} c/u = ${fmtMoney(i.cant * i.precio)}`).join('\n') + `\n\n*Total: ${fmtMoney(presuTotal(p))}*` + (presuVence(p) ? `\nVálido hasta el ${fmtDate(presuVence(p))}` : '') + (p.nota ? '\n' + p.nota : '');
}
function presuImprimir(id) {
  const p = state.presupuestos.find((x) => x.id === id); if (!p) return;
  imprimirHoja(presuHoja(p), `Presupuesto ${presuNro(p.nro)}${p.cliente ? ' - ' + p.cliente : ''}`);
}
// El cliente aceptó: del presupuesto sale la venta (descuenta stock) y su remito
function presuAVenta(id) {
  const p = state.presupuestos.find((x) => x.id === id); if (!p) return;
  const items = (p.items || []).filter((i) => prod(i.productoId)).map((i) => ({ productoId: i.productoId, nombre: prod(i.productoId).nombre, talle: sinTalle(prod(i.productoId)) ? TU : (i.talle || ''), cant: i.cant, precio: i.precio }));
  if (!items.length) return toast('Este presupuesto no tiene artículos de la lista para pasar a venta.');
  const aMano = (p.items || []).filter((i) => !prod(i.productoId)).length;
  ventaForm({ cliente: p.cliente, telefono: p.telefono, items, nota: 'Presupuesto N° ' + presuNro(p.nro) + (aMano ? ` (${aMano} renglones escritos a mano no pasaron a la venta)` : '') }, (v) => {
    v.cuit = p.cuit || ''; v.direccion = p.direccion || ''; v.presuId = p.id; p.estado = 'aceptado'; p.ventaId = v.id; commit(); ventaVer(v.id);
  });
}
function presuVer(id) {
  const p = state.presupuestos.find((x) => x.id === id); if (!p) return;
  const e = p.estado || 'pendiente';
  modal(`<div class="spread"><h3>Presupuesto N° ${presuNro(p.nro)}</h3><span class="pill ${ESTADOS_P[e][1]}">${ESTADOS_P[e][0]}</span></div>
    <div class="hoja-vista">${presuHoja(p)}</div>
    <div class="row mt"><button class="pri" id="pvImp">🖨️ Imprimir o guardar PDF</button><a class="btn wa" href="${waLink(p.telefono || '', presuTexto(p))}" target="_blank" rel="noopener">💬 Mandar por WhatsApp</a><button id="pvEd">✏️ Editar</button></div>
    <div class="row mt">${e !== 'aceptado' ? '<button class="acc" id="pvVenta">✅ Lo aceptó: hacer la venta y el remito</button>' : (p.ventaId && state.ventas.some((x) => x.id === p.ventaId) ? '<button id="pvVerV">🧾 Ver la venta y su remito</button>' : '')}${e === 'pendiente' ? '<button id="pvNo">No se hizo</button>' : '<button id="pvPen">Volver a "esperando"</button>'}</div>
    <div class="modal-actions"><button class="danger izq" id="pvDel">Borrar</button><button data-act="close">Cerrar</button></div>`, (box) => {
    const on = (s, fn) => { const b = $(s, box); if (b) b.onclick = fn; };
    on('#pvImp', () => presuImprimir(id));
    on('#pvEd', () => presuForm(id));
    on('#pvVenta', () => presuAVenta(id));
    on('#pvVerV', () => ventaVer(p.ventaId));
    on('#pvNo', () => { p.estado = 'rechazado'; closeModal(); commit(); });
    on('#pvPen', () => { p.estado = 'pendiente'; closeModal(); commit(); });
    on('#pvDel', () => confirmBox('Se borra el presupuesto N° ' + presuNro(p.nro) + '.', () => { state.presupuestos = state.presupuestos.filter((x) => x.id !== id); commit(); toast('Presupuesto borrado'); }, 'Borrar'));
  });
}
Object.assign(ACTS, {
  presuNuevo: () => presuForm(null), presuVer: (id) => presuVer(id),
  presuTab: (id) => { ui.presuTab = id; render(); },
});
