'use strict';
/* Pedidos de empresas con entregas parciales (pedido → remitos de entrega → factura → cobro)
   y devoluciones / cambios de talle sobre una venta. */

// ---------- Pedidos ----------
const ESTADOS_PED = { abierto: ['Por entregar', 'warn'], parcial: ['Entregado en parte', 'acc'], completo: ['Entregado', 'in'], cancelado: ['Cancelado', 'out'] };
const pedidoSig = () => state.pedidos.reduce((m, p) => Math.max(m, Number(p.nro) || 0), 0) + 1;
const entregasDe = (p) => ventasOk().filter((v) => v.pedidoId === p.id).sort(ordenFH);
function avancePedido(p) { // por renglón: pedido, entregado y lo que falta
  const ent = {}; entregasDe(p).forEach((v) => v.items.forEach((i) => { const k = i.productoId + '|' + i.talle; ent[k] = (ent[k] || 0) + (Number(i.cant) || 0); }));
  const filas = (p.items || []).map((i) => { const k = i.productoId + '|' + i.talle, e = Math.min(ent[k] || 0, Number(i.cant) || 0); ent[k] = (ent[k] || 0) - e; return Object.assign({}, i, { entregado: e, falta: (Number(i.cant) || 0) - e }); });
  const pedido = filas.reduce((s, f) => s + (Number(f.cant) || 0), 0), entregado = filas.reduce((s, f) => s + f.entregado, 0);
  return { filas, pedido, entregado, falta: pedido - entregado, total: filas.reduce((s, f) => s + f.cant * (Number(f.precio) || 0), 0), faltaPlata: filas.reduce((s, f) => s + f.falta * (Number(f.precio) || 0), 0) };
}
function estadoPedido(p) { if (p.cancelado) return 'cancelado'; const a = avancePedido(p); return !a.entregado ? 'abierto' : a.falta > 0 ? 'parcial' : 'completo'; }

ui.pedTab = 'pendientes';
VISTAS.pedidos = () => {
  let ps = state.pedidos.slice().sort((a, b) => (Number(b.nro) || 0) - (Number(a.nro) || 0));
  const pend = ps.filter((p) => ['abierto', 'parcial'].includes(estadoPedido(p)));
  if (ui.pedTab === 'pendientes') ps = pend;
  return `<div class="spread"><div><h1>Pedidos</h1><p class="sub">Pedidos de empresas que se entregan en partes: cada entrega es una venta con su remito, y se factura y cobra como cualquier venta.</p></div>
    <div class="row"><button class="acc" data-act="pedidoNuevo">+ Pedido</button></div></div>
  <div class="tabs"><button class="${ui.pedTab === 'pendientes' ? 'on' : ''}" data-act="pedTab" data-id="pendientes">Por entregar (${pend.length})</button><button class="${ui.pedTab === 'todos' ? 'on' : ''}" data-act="pedTab" data-id="todos">Todos (${state.pedidos.length})</button></div>
  ${ps.length ? `<div class="tablewrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Entrega para</th><th>Avance</th><th>Estado</th><th class="n">Total</th></tr></thead><tbody>
    ${ps.map((p) => { const a = avancePedido(p), e = ESTADOS_PED[estadoPedido(p)]; return `<tr class="click" data-act="pedidoVer" data-id="${p.id}"><td class="b">${presuNro(p.nro)}</td><td>${fmtDateC(p.fecha)}</td><td>${esc(p.cliente || '—')}${p.oc ? `<div class="small muted">OC ${esc(p.oc)}</div>` : ''}</td><td>${p.entregaPara ? fmtDateC(p.entregaPara) : '—'}</td><td>${a.entregado} de ${a.pedido} unidades<div class="bar"><i style="width:${a.pedido ? (a.entregado / a.pedido * 100).toFixed(0) : 0}%"></i></div></td><td><span class="pill ${e[1]}">${e[0]}</span></td><td class="n b">${fmtMoney(a.total)}</td></tr>`; }).join('')}
    </tbody></table></div>` : `<div class="empty">${ui.pedTab === 'pendientes' ? 'No hay pedidos por entregar.' : 'Todavía no hay pedidos. Tocá <b>+ Pedido</b> o pasá un presupuesto aceptado a pedido.'}</div>`}`;
};
function pedidoForm(id, pre = {}) {
  const orig = id ? state.pedidos.find((x) => x.id === id) : null;
  const p = orig || Object.assign({ fecha: todayStr(), cliente: '', items: [] }, pre);
  let lista = p.lista != null ? p.lista : ((clienteDe(p) || {}).lista || '');
  const precioDe = (a) => precioLista(a, lista) || '';
  const lines = itemsToLines(p.items, precioDe);
  const clientes = [...new Set(state.clientes.map((c) => c.nombre).concat(state.ventas.map((v) => v.cliente)).filter(Boolean))];
  modal(`<h3>${orig ? 'Editar pedido N° ' + presuNro(p.nro) : '+ Pedido'}</h3>
    <div class="form"><label class="f">Cliente<input name="cliente" list="pdCli" value="${esc(p.cliente)}" placeholder="Empresa"><datalist id="pdCli">${clientes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <label class="f">Orden de compra del cliente (opcional)<input name="oc" value="${esc(p.oc)}" placeholder="Ej: OC 4512"></label>
    <label class="f">Fecha del pedido<input type="date" name="fecha" value="${p.fecha}"></label>
    <label class="f">Entregar para (opcional)<input type="date" name="entregaPara" value="${p.entregaPara || ''}"></label>
    <label class="f">Lista de precios<select name="lista">${listaOptions(lista)}</select></label></div>
    <div class="lineas mt" id="pdL"></div><button type="button" class="sm mt" id="pdAdd">+ Otro artículo</button>
    <label class="f mt">Nota<input name="nota" value="${esc(p.nota)}" placeholder="Ej: entregar en obra, pedir por Laura"></label>
    <div class="totbar mt"><span class="small muted" id="pdPares"></span><b id="pdTot" style="font-size:18px"></b></div><p class="err" id="pdErr"></p>
    <div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="pdOk">Guardar pedido</button></div>`, (box) => {
    const calc = () => { const its = linesToItems(lines); $('#pdPares', box).textContent = pares(its) + ' unidades'; $('#pdTot', box).textContent = 'Total ' + fmtMoney(its.reduce((s, i) => s + i.cant * i.precio, 0)); };
    const ed = lineasEditor($('#pdL', box), lines, { precio: 'Precio por unidad', verStock: true, precioDe }, calc);
    $('#pdAdd', box).onclick = ed.add;
    const reprecio = () => { lines.forEach((l) => { const a = prod(l.productoId); if (a) l.precio = precioLista(a, lista) || l.precio; }); ed.redraw(); };
    $('[name=lista]', box).onchange = (e) => { lista = e.target.value; reprecio(); };
    $('[name=cliente]', box).onchange = (e) => { const c = clienteDe({ cliente: e.target.value }); if (c && (c.lista || '') !== lista) { lista = c.lista || ''; $('[name=lista]', box).value = lista; reprecio(); } };
    $('#pdOk', box).onclick = () => {
      const g = (n) => $(`[name=${n}]`, box).value.trim(), err = (m) => ($('#pdErr', box).textContent = m);
      const items = linesToItems(lines); if (!items.length) return err('Elegí los artículos y cuántas unidades de cada talle.');
      if (!g('cliente')) return err('Poné el cliente.');
      const data = { cliente: g('cliente'), oc: g('oc'), fecha: g('fecha') || todayStr(), entregaPara: g('entregaPara'), lista, nota: g('nota'), items };
      const c = clienteDe(data); if (c) { data.clienteId = c.id; data.cliente = c.nombre; }
      let rec; if (orig) { rec = Object.assign(orig, data); registrar('Pedido modificado', `N° ${presuNro(rec.nro)} · ${rec.cliente}`); }
      else { rec = Object.assign({ id: uid(), nro: pedidoSig(), creado: todayStr(), quien: quienSoy(), presuId: pre.presuId || '' }, data); state.pedidos.push(rec); }
      closeModal(); commit(); toast('Pedido N° ' + presuNro(rec.nro) + ' guardado'); pedidoVer(rec.id);
    };
  });
}
function pedidoVer(id) {
  const p = state.pedidos.find((x) => x.id === id); if (!p) return;
  const a = avancePedido(p), est = estadoPedido(p), e = ESTADOS_PED[est], ents = entregasDe(p);
  modal(`<div class="spread"><h3>Pedido N° ${presuNro(p.nro)}</h3><span class="pill ${e[1]}">${e[0]}</span></div>
    <p class="sub">${esc(p.cliente)}${p.oc ? ' · OC ' + esc(p.oc) : ''} · ${fmtDate(p.fecha)}${p.entregaPara ? ' · entregar para el ' + fmtDate(p.entregaPara) : ''}${p.lista ? ' · lista ' + esc(listaNombre(p.lista)) : ''}${p.nota ? '<br>' + esc(p.nota) : ''}</p>
    <div class="tablewrap"><table><thead><tr><th>Artículo</th><th>Talle</th><th class="n">Pedido</th><th class="n">Entregado</th><th class="n">Falta</th><th class="n">Hay en stock</th></tr></thead><tbody>${a.filas.map((f) => { const pr = prod(f.productoId); return `<tr><td>${esc(prodNombre(f.productoId, f.nombre))}</td><td>${esc(tl(f.talle))}</td><td class="n">${f.cant}</td><td class="n">${f.entregado}</td><td class="n b ${f.falta ? 'c-out' : 'c-in'}">${f.falta || '✓'}</td><td class="n">${pr ? stockT(pr, f.talle) : '—'}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="b mt">Entregado ${a.entregado} de ${a.pedido} unidades · total del pedido ${fmtMoney(a.total)}${a.falta ? ' · falta entregar ' + fmtMoney(a.faltaPlata) : ''}</p>
    <h2>Entregas</h2>${ents.length ? `<div class="list">${ents.map((v) => `<div class="li click" data-act="ventaVer" data-id="${v.id}"><div class="m"><b>Remito ${v.nroComp ? presuNro(v.nroComp) : ''} · ${fmtDate(v.fecha)}</b><span>${esc(resumenItems(v.items, 3))}${v.comp ? ' · ' + esc(compLbl(v)) : ''}</span></div><div class="s">${pagoPill(v)}<b>${fmtMoney(v.total)}</b></div></div>`).join('')}</div>` : '<div class="empty">Todavía no se entregó nada.</div>'}
    <div class="row mt">${a.falta && !p.cancelado ? '<button class="acc" id="pdEnt">📦 Hacer una entrega</button>' : ''}${!ents.length ? '<button id="pdEd">✏️ Editar</button>' : ''}${!p.cancelado && a.falta ? '<button id="pdCan">Cancelar lo que falta</button>' : p.cancelado ? '<button id="pdReab">Reabrir</button>' : ''}</div>
    <div class="modal-actions">${!ents.length ? '<button class="danger izq" id="pdDel">Borrar</button>' : ''}<button data-act="close">Cerrar</button></div>`, (box) => {
    const on = (s, fn) => { const b = $(s, box); if (b) b.onclick = fn; };
    on('#pdEnt', () => {
      const items = a.filas.filter((f) => f.falta > 0).map((f) => { const pr = prod(f.productoId); return { productoId: f.productoId, nombre: f.nombre, talle: f.talle, cant: pr ? Math.max(0, Math.min(f.falta, stockT(pr, f.talle))) : f.falta, precio: f.precio }; }).filter((i) => i.cant > 0);
      if (!items.length) return toast('No hay stock de lo que falta entregar. Cargá la mercadería cuando llegue.');
      const c = clienteDe(p);
      ventaForm({ cliente: p.cliente, clienteId: p.clienteId, lista: p.lista, pago: 'Cuenta corriente', items, nota: `Pedido N° ${presuNro(p.nro)}${p.oc ? ' · OC ' + p.oc : ''}`, telefono: c ? c.telefono : '' }, (v) => {
        v.pedidoId = p.id; const n = ventaNro(v); commit(); toast(`Entrega guardada · remito ${presuNro(n)}`); pedidoVer(p.id);
      });
    });
    on('#pdEd', () => pedidoForm(id));
    on('#pdCan', () => confirmBox('Lo que falta entregar queda cancelado. Lo ya entregado sigue igual.', () => { p.cancelado = true; p.fechaCancelado = todayStr(); registrar('Pedido cancelado', `N° ${presuNro(p.nro)} · ${p.cliente} · faltaban ${a.falta} unidades`); commit(); }, 'Cancelar lo que falta'));
    on('#pdReab', () => { p.cancelado = false; commit(); pedidoVer(id); });
    on('#pdDel', () => confirmBox('Se borra el pedido N° ' + presuNro(p.nro) + '.', () => { registrar('Pedido borrado', `N° ${presuNro(p.nro)} · ${p.cliente}`); state.pedidos = state.pedidos.filter((x) => x.id !== id); commit(); }, 'Borrar'));
  });
}
function presuAPedido(id) {
  const pr = state.presupuestos.find((x) => x.id === id); if (!pr) return;
  const items = (pr.items || []).filter((i) => prod(i.productoId)).map((i) => ({ productoId: i.productoId, nombre: prod(i.productoId).nombre, talle: sinTalle(prod(i.productoId)) ? TU : (i.talle || ''), cant: i.cant, precio: i.precio }));
  if (!items.length) return toast('Este presupuesto no tiene artículos de la lista para pasar a pedido.');
  pr.estado = 'aceptado';
  pedidoForm(null, { cliente: pr.cliente, lista: pr.lista, items, nota: 'Presupuesto N° ' + presuNro(pr.nro), presuId: pr.id });
}
Object.assign(ACTS, { pedidoNuevo: () => pedidoForm(null), pedidoVer: (id) => pedidoVer(id), pedTab: (t) => { ui.pedTab = t; render(); } });

// ---------- Devoluciones y cambios de talle ----------
// Una devolución es una venta en negativo: vuelve el stock, baja lo vendido y la ganancia,
// y la plata se devuelve por un medio o queda a favor en la cuenta del cliente.
const esDevolucion = (v) => v.tipo === 'devolucion';
function devueltoDe(v) { const out = {}; ventasOk().filter((d) => d.refVentaId === v.id).forEach((d) => d.items.forEach((i) => { const k = i.productoId + '|' + i.talle; out[k] = (out[k] || 0) - (Number(i.cant) || 0); })); return out; }
function devolucionForm(id) {
  const v = state.ventas.find((x) => x.id === id); if (!v || v.anulada || esDevolucion(v)) return;
  const dev = devueltoDe(v), its = v.items.map((i) => Object.assign({}, i, { max: (Number(i.cant) || 0) - (dev[i.productoId + '|' + i.talle] || 0) })).filter((i) => i.max > 0);
  if (!its.length) return toast('Ya se devolvió todo lo de esta venta.');
  const opts = (v.pago === 'Cuenta corriente' || clienteDe(v) ? ['A favor en su cuenta corriente'] : []).concat(MEDIOS.map((m) => 'Se le devolvió: ' + m));
  modal(`<h3>↩️ Devolución</h3><p class="sub">${esc(v.cliente || 'Sin nombre')} · venta del ${fmtDate(v.fecha)}. Poné cuántas unidades devuelve de cada renglón.</p>
    <div class="tablewrap"><table><thead><tr><th>Artículo</th><th>Talle</th><th class="n">Precio</th><th class="n">Devuelve</th></tr></thead><tbody>${its.map((i, k) => `<tr><td>${esc(prodNombre(i.productoId, i.nombre))}</td><td>${esc(tl(i.talle))}</td><td class="n">${fmtMoney(i.precio)}</td><td class="n"><input data-dv="${k}" inputmode="numeric" placeholder="0 a ${i.max}" style="width:90px"></td></tr>`).join('')}</tbody></table></div>
    <div class="form mt"><label class="f">La plata<select id="dvPlata">${opts.map((o) => `<option>${o}</option>`).join('')}</select></label>
    <label class="f">Motivo<input id="dvMot" placeholder="Ej: falla de fábrica, no le quedó"></label>
    <label class="chk full"><input type="checkbox" id="dvStock" checked> La mercadería vuelve al stock (destildá si vino rota)</label></div>
    <p class="b" id="dvTot"></p><p class="err" id="dvErr"></p>
    <div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="dvOk">Guardar devolución</button></div>`, (box) => {
    const leer = () => its.map((i, k) => Object.assign({}, i, { cant: Math.max(0, Math.min(i.max, Math.round(numIn($(`[data-dv="${k}"]`, box).value)))) })).filter((i) => i.cant > 0);
    const tot = () => { $('#dvTot', box).textContent = leer().length ? 'Total devuelto: ' + fmtMoney(leer().reduce((s, i) => s + i.cant * i.precio, 0)) : ''; };
    $$('[data-dv]', box).forEach((i) => { i.oninput = tot; });
    $('#dvOk', box).onclick = () => {
      const sel = leer(); if (!sel.length) return ($('#dvErr', box).textContent = 'Poné cuántas unidades devuelve.');
      const plata = $('#dvPlata', box).value, mot = $('#dvMot', box).value.trim(), total = sel.reduce((s, i) => s + i.cant * i.precio, 0);
      const d = { id: uid(), tipo: 'devolucion', refVentaId: v.id, fecha: todayStr(), hora: new Date().toTimeString().slice(0, 5), quien: quienSoy(), cliente: v.cliente, clienteId: v.clienteId || '', telefono: v.telefono || '',
        pago: plata.startsWith('A favor') ? 'Cuenta corriente' : plata.replace('Se le devolvió: ', ''), cobrado: !plata.startsWith('A favor'), total: -total, nota: mot, origen: 'app', vuelveStock: $('#dvStock', box).checked,
        items: sel.map((i) => ({ productoId: i.productoId, nombre: i.nombre, talle: i.talle, cant: -i.cant, precio: i.precio, costo: Number(i.costo) || 0 })) };
      if (d.vuelveStock) moverStock(sel, 1, 'Devolución' + (v.cliente ? ' de ' + v.cliente : ''), d.id, d.fecha);
      state.ventas.push(d);
      registrar('Devolución', `${v.cliente || 'Sin nombre'} · ${resumenItems(sel, 3)}${mot ? ' · ' + mot : ''} · ${plata}`, '', fmtMoney(total));
      closeModal(); commit(); toast('Devolución guardada: ' + fmtMoney(total)); ventaVer(v.id);
    };
  });
}
function cambioTalleForm(id) {
  const v = state.ventas.find((x) => x.id === id); if (!v || v.anulada || esDevolucion(v)) return;
  const its = v.items.map((i, k) => Object.assign({ k }, i)).filter((i) => prod(i.productoId) && !sinTalle(prod(i.productoId)));
  if (!its.length) return toast('Esta venta no tiene artículos con talle.');
  modal(`<h3>🔁 Cambio de talle</h3><p class="sub">Mismo artículo y mismo precio, otro talle. El stock se corrige solo.</p>
    <div class="form"><label class="f full">Artículo de la venta<select id="ctIt">${its.map((i) => `<option value="${i.k}">${esc(prodNombre(i.productoId, i.nombre))} · talle ${esc(i.talle)} (${i.cant})</option>`).join('')}</select></label>
    <label class="f">Cuántas<input id="ctN" inputmode="numeric" value="1"></label><label class="f">Talle nuevo<select id="ctT"></select></label></div>
    <p class="err" id="ctErr"></p><div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="ctOk">Hacer el cambio</button></div>`, (box) => {
    const fill = () => { const i = v.items[+$('#ctIt', box).value], p = prod(i.productoId); $('#ctT', box).innerHTML = tallesDe(p).filter((t) => t !== i.talle).map((t) => `<option value="${esc(t)}">${esc(t)} (hay ${stockT(p, t)})</option>`).join(''); };
    $('#ctIt', box).onchange = fill; fill();
    $('#ctOk', box).onclick = () => {
      const k = +$('#ctIt', box).value, i = v.items[k], n = Math.round(numIn($('#ctN', box).value)), t = $('#ctT', box).value;
      if (!(n > 0 && n <= i.cant)) return ($('#ctErr', box).textContent = 'Poné entre 1 y ' + i.cant + '.');
      moverStock([{ productoId: i.productoId, talle: i.talle, cant: n }], 1, 'Cambio de talle' + (v.cliente ? ' de ' + v.cliente : ''), v.id);
      moverStock([{ productoId: i.productoId, talle: t, cant: n }], -1, 'Cambio de talle' + (v.cliente ? ' de ' + v.cliente : ''), v.id);
      const otro = v.items.find((x) => x !== i && x.productoId === i.productoId && x.talle === t && x.precio === i.precio);
      if (otro) otro.cant += n; else v.items.splice(k + 1, 0, Object.assign({}, i, { talle: t, cant: n }));
      i.cant -= n; v.items = v.items.filter((x) => x.cant > 0);
      v.cambios = (v.cambios || []).concat({ fecha: todayStr(), productoId: i.productoId, de: i.talle, a: t, cant: n, quien: quienSoy() });
      registrar('Cambio de talle', `${v.cliente || 'Sin nombre'} · ${prodNombre(i.productoId, i.nombre)} × ${n}`, 'talle ' + i.talle, 'talle ' + t);
      closeModal(); commit(); toast('Cambio hecho'); ventaVer(v.id);
    };
  });
}
