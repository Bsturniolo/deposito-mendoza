'use strict';
/* Pantallas y formularios de Depósito Mendoza */

// ---------- Inicio ----------
// Nombre para el saludo: cada usuario puede poner el suyo en Ajustes; si no, Federico.
const claveNombre = () => cloud.email || 'este-dispositivo';
const miNombre = () => (state.config.nombres || {})[claveNombre()] || 'Federico';
VISTAS.inicio = () => {
  const hoy = todayStr(), mes = hoy.slice(0, 7), r = resumenMes(mes);
  const vh = state.ventas.filter((v) => v.fecha === hoy);
  const h = new Date().getHours(), saludo = (h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches') + ', ' + miNombre();
  const dm = state.config.diasMuestra || 7;
  const mAf = muestrasAfuera().map((m) => ({ m, d: daysBetween(m.fecha, hoy) })).sort((a, b) => b.d - a.d);
  const mBuscar = mAf.filter((x) => x.d >= dm);
  const evs = state.eventos.filter((e) => !e.hecho && e.fecha <= addDays(hoy, state.config.avisoDias || 3)).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
  const sinStock = stockBajo().filter((x) => x.n <= 0);
  const totPares = state.productos.reduce((s, p) => s + stockTotal(p), 0);
  const vacio = !state.productos.length;
  return `<h1>${saludo} 👋</h1><p class="sub">${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
  ${vacio ? `<div class="card wa-box"><h3>Bienvenido a la app de Depósito Mendoza</h3><p>Para empezar, cargá los artículos que vendés. Podés arrancar con los tres artículos de Ringo Work y después sumar los que quieras.</p>
    <div class="row"><button class="pri" data-act="iniModelos">Empezar con Bolt 02, Air Fly XR 01 y High Boots 02</button><button data-act="cargarEjemplos">Probar con datos de ejemplo</button></div></div>` : ''}
  <div class="hero">
    <button class="big" data-act="goto" data-id="mensaje"><span class="e">💬</span><span><b>Cargar por mensaje</b><br><span class="small">Escribí o dictá lo que hiciste</span></span></button>
    <button data-act="ventaNueva"><span class="e">🛒</span><b>Nueva venta</b></button>
    <button data-act="entradaNueva"><span class="e">📥</span><b>Entró mercadería</b></button>
    <button data-act="muestraNueva"><span class="e">📦</span><b>Dejé una muestra</b></button>
  </div>
  ${avisosBanner()}
  <div class="grid kpis">
    <div class="card kpi"><div class="lbl">Vendido hoy</div><div class="val">${fmtMoney(vh.reduce((s, v) => s + (+v.total || 0), 0))}</div><div class="hint">${pares(vh.flatMap((v) => v.items))} unidades</div></div>
    <div class="card kpi"><div class="lbl">Vendido en ${MESES[+mes.slice(5) - 1].toLowerCase()}</div><div class="val">${fmtMoney(r.vendido)}</div><div class="hint">${r.ventas.length} ventas · ${pares(r.ventas.flatMap((v) => v.items))} unidades</div></div>
    <div class="card kpi"><div class="lbl">Invertido en ${MESES[+mes.slice(5) - 1].toLowerCase()}</div><div class="val c-inv">${fmtMoney(r.inversion)}</div><div class="hint">mercadería que entró y otras compras</div></div>
    <div class="card kpi"><div class="lbl">Ganancia del mes</div><div class="val ${r.neta < 0 ? 'c-out' : 'c-in'}">${fmtMoney(r.neta)}</div><div class="hint">ya descontados los gastos</div></div>
    <div class="card kpi"><div class="lbl">Unidades en el depósito</div><div class="val">${fmtNum(totPares)}</div><div class="hint">${sinStock.length ? `<span class="c-out">${sinStock.length} talles sin stock</span>` : 'todos los talles con stock'}</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card ${mBuscar.length ? 'alerta' : ''}"><div class="spread"><h3>📦 Muestras para buscar</h3><button class="sm" data-act="goto" data-id="muestras">Ver todas</button></div>
      ${mAf.length ? `<div class="list">${mAf.slice(0, 5).map(({ m, d }) => `<div class="li"><div class="m"><b>${esc(m.cliente || 'Sin nombre')}</b><span>${esc(resumenItems(m.items, 2))}</span></div><div class="s"><span class="pill ${d >= dm * 2 ? 'out' : d >= dm ? 'warn' : ''}">${hace(d)}</span><button class="sm" data-act="muestraVolvio" data-id="${m.id}">La busqué</button></div></div>`).join('')}</div>` : '<div class="empty">No hay muestras afuera.</div>'}
    </div>
    <div class="card ${evs.some((e) => e.fecha < hoy) ? 'alerta roja' : ''}"><div class="spread"><h3>📅 Próximos días y préstamos</h3><button class="sm" data-act="eventoNuevo">+ Anotar</button></div>
      ${evs.length ? `<div class="list">${evs.slice(0, 6).map((e) => evLi(e)).join('')}</div>` : '<div class="empty">Nada anotado para estos días.</div>'}
    </div>
    <div class="card"><div class="spread"><h3>💰 Me deben</h3><span class="b">${fmtMoney(meDeben().reduce((s, v) => s + (+v.total || 0), 0))}</span></div>
      ${meDeben().length ? `<div class="list">${meDeben().slice(0, 5).map((v) => `<div class="li"><div class="m"><b>${esc(v.cliente || 'Sin nombre')}</b><span>${fmtDateC(v.fecha)} · ${esc(resumenItems(v.items, 1))}</span></div><div class="s"><b>${fmtMoney(v.total)}</b><button class="sm" data-act="cobrar" data-id="${v.id}">Cobré</button></div></div>`).join('')}</div>` : '<div class="empty">Nadie te debe plata.</div>'}
    </div>
    <div class="card"><div class="spread"><h3>👢 Para reponer</h3><button class="sm" data-act="goto" data-id="stock">Ver stock</button></div>
      ${stockBajo().length ? `<div class="list">${stockBajo().slice(0, 8).map((x) => `<div class="li"><div class="m"><b>${esc(x.p.nombre)} · talle ${x.t}</b></div><div class="s"><span class="pill ${x.n <= 0 ? 'out' : 'warn'}">${x.n <= 0 ? 'sin stock' : 'quedan ' + x.n}</span></div></div>`).join('')}</div>` : '<div class="empty">Todos los talles tienen stock suficiente.</div>'}
    </div>
  </div>
  ${ejemploBanner()}`;
};
function evLi(e) {
  const hoy = todayStr(), t = TIPOS_EV[e.tipo] || TIPOS_EV.recordatorio, venc = e.fecha < hoy;
  return `<div class="li"><div class="m"><b>${t.ico} ${esc(e.titulo)}</b><span class="${venc ? 'c-out' : ''}">${e.fecha === hoy ? 'Hoy' : e.fecha === addDays(hoy, 1) ? 'Mañana' : fmtDateC(e.fecha)}${e.hora ? ' ' + esc(e.hora) : ''}${venc ? ' · atrasado' : ''}${e.monto ? ' · ' + fmtMoney(e.monto) : ''}</span></div><div class="s"><button class="sm" data-act="eventoHecho" data-id="${e.id}">✓ Listo</button></div></div>`;
}
function ejemploBanner() {
  const hay = COLS.some((c) => state[c].some((x) => x.ejemplo));
  return hay ? `<div class="card mt" style="background:var(--pri2)"><div class="spread"><span><b>Estás viendo datos de ejemplo.</b> Cuando quieras empezar en serio, borralos.</span><button data-act="borrarEjemplos">Borrar datos de ejemplo</button></div></div>` : '';
}

// ---------- Artículos y stock ----------
const curvaLbl = (t) => t === TU ? 'Cantidad' : t;
const artSub = (p) => [p.codigo ? 'N° ' + p.codigo : '', p.marca, p.color].filter(Boolean).join(' · ');
VISTAS.stock = () => {
  const q = ui.stockQ.trim().toLowerCase();
  const todos = state.productos.filter((p) => !p.archivado);
  const cats = [...new Set(todos.map(catDe))].sort((a, b) => a.localeCompare(b, 'es'));
  if (ui.stockCat !== 'todas' && !cats.includes(ui.stockCat)) ui.stockCat = 'todas';
  const ps = todos.filter((p) => (ui.stockCat === 'todas' || catDe(p) === ui.stockCat) && (!q || [p.codigo, p.nombre, p.descripcion, p.marca, p.color, catDe(p), p.alias].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => catDe(a).localeCompare(catDe(b), 'es') || a.nombre.localeCompare(b.nombre, 'es'));
  const tot = ps.reduce((s, p) => s + stockTotal(p), 0);
  const potencial = todos.reduce((s, p) => s + Math.max(0, stockTotal(p)) * ((Number(p.precio) || 0) - (Number(p.costo) || 0)), 0);
  const sinPrecio = todos.filter((p) => !p.precio || !p.costo);
  const bajo = stockBajo();
  // se agrupan los artículos que usan los mismos talles, así cada tabla tiene sus columnas
  const grupos = []; ps.forEach((p) => { const ts = tallesDe(p), k = ts.join(','); let g = grupos.find((x) => x.k === k); if (!g) grupos.push(g = { k, ts, ps: [] }); g.ps.push(p); });
  const fila = (p, ts) => `<tr class="click" data-act="prodVer" data-id="${p.id}"><td class="mod"><b>${esc(p.nombre)}</b><div class="small muted">${esc(artSub(p))}${artSub(p) ? ' · ' : ''}${p.precio ? fmtMoney(p.precio) : '<span class="c-warn">sin precio</span>'}</div></td>${ts.map((t) => { const n = stockT(p, t); return `<td class="t ${n <= 0 ? 't0' : n <= minDe(p) ? 'tb' : ''}">${n}</td>`; }).join('')}${ts.length > 1 ? `<td class="tot">${stockTotal(p)}</td>` : ''}</tr>`;
  const tabla = (g) => { const un = g.ts.length === 1; const titulo = [...new Set(g.ps.map(catDe))].join(' · ');
    return `<h3 class="mt">${esc(titulo)} <span class="small muted">(${g.ps.length})</span></h3><div class="tablewrap"><table class="sg"><thead><tr><th class="mod">Artículo</th>${g.ts.map((t) => `<th>${un ? 'Stock' : esc(t)}</th>`).join('')}${un ? '' : '<th>Total</th>'}</tr></thead><tbody>${g.ps.map((p) => fila(p, g.ts)).join('')}</tbody>
    ${g.ps.length > 1 ? `<tfoot><tr><td class="mod b">Total</td>${g.ts.map((t) => `<td class="b">${g.ps.reduce((s, p) => s + stockT(p, t), 0)}</td>`).join('')}${un ? '' : `<td class="tot">${g.ps.reduce((s, p) => s + stockTotal(p), 0)}</td>`}</tr></tfoot>` : ''}</table></div>`; };
  return `<div class="spread"><div><h1>Artículos</h1><p class="sub">Todo lo que vendés: calzado, ropa, gorras y lo que sea, con su número, precio y stock. Tocá un artículo para ver el detalle.</p></div>
    <div class="row"><button class="pri" data-act="entradaNueva">📥 Entró</button><button data-act="salidaNueva">📤 Salió</button><button data-act="prodNuevo">+ Artículo</button></div></div>
  <div class="grid kpis"><div class="card kpi"><div class="lbl">Artículos</div><div class="val">${todos.length}</div><div class="hint">${fmtNum(todos.reduce((s, p) => s + stockTotal(p), 0))} unidades en stock</div></div>
    <div class="card kpi"><div class="lbl">Mercadería a costo</div><div class="val">${fmtMoney(valorStock())}</div><div class="hint">lo que pagaste</div></div>
    <div class="card kpi"><div class="lbl">Ganancia si vendés todo</div><div class="val c-in">${fmtMoney(potencial)}</div><div class="hint">precio − costo de cada unidad</div></div>
    <div class="card kpi"><div class="lbl">Talles sin stock</div><div class="val ${bajo.some((x) => x.n <= 0) ? 'c-out' : ''}">${bajo.filter((x) => x.n <= 0).length}</div><div class="hint">${bajo.filter((x) => x.n > 0).length} con poco stock</div></div></div>
  ${sinPrecio.length ? `<div class="card alerta mt"><b>Faltan precios:</b> ${sinPrecio.slice(0, 12).map((p) => `<button class="sm" data-act="prodEditar" data-id="${p.id}">${esc(p.nombre)}</button>`).join(' ')}${sinPrecio.length > 12 ? ` y ${sinPrecio.length - 12} más` : ''} <span class="small muted">Poné el costo y el precio de venta de cada artículo para que la app saque la inversión y la ganancia.</span></div>` : ''}
  ${cats.length > 1 ? `<div class="tabs mt"><button class="${ui.stockCat === 'todas' ? 'on' : ''}" data-act="stockCat" data-id="todas">Todo</button>${cats.map((c) => `<button class="${ui.stockCat === c ? 'on' : ''}" data-act="stockCat" data-id="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
  <div class="row mt" style="margin-bottom:10px"><input id="stockQ" class="search" type="search" placeholder="Buscar por nombre o número de artículo…" value="${esc(ui.stockQ)}"><a class="btn wa" href="${waLink('', textoStock())}" target="_blank" rel="noopener">💬 Pasar stock por WhatsApp</a></div>
  ${ps.length ? grupos.map(tabla).join('') + `<p class="small muted mt">Mostrando ${ps.length} artículos · ${fmtNum(tot)} unidades. <span class="pill out">rojo</span> sin stock · <span class="pill warn">naranja</span> quedan pocos (menos del mínimo que pusiste en el artículo)</p>`
    : `<div class="empty">${todos.length ? 'Ningún artículo coincide con la búsqueda.' : 'Todavía no cargaste artículos. Tocá <b>+ Artículo</b>.'}</div>`}`;
};
function numerosModelo(p) {
  const its = state.ventas.flatMap((v) => v.items).filter((i) => i.productoId === p.id);
  const vendidos = its.reduce((s, i) => s + i.cant, 0), vendido = its.reduce((s, i) => s + i.cant * i.precio, 0);
  const ganancia = its.reduce((s, i) => s + i.cant * (i.precio - (i.costo || 0)), 0);
  const comp = state.compras.flatMap((c) => c.items).filter((i) => i.productoId === p.id);
  const ent = state.stockMovs.filter((m) => m.productoId === p.id && m.cant > 0 && /^(Llegó mercadería|Entrada por mensaje|Stock inicial)/.test(m.motivo));
  const entraron = comp.reduce((s, i) => s + i.cant, 0) + ent.reduce((s, m) => s + m.cant, 0);
  const invertido = comp.reduce((s, i) => s + i.cant * (i.costo || 0), 0) + ent.reduce((s, m) => s + m.cant, 0) * (Number(p.costo) || 0);
  const potencial = Math.max(0, stockTotal(p)) * ((Number(p.precio) || 0) - (Number(p.costo) || 0));
  return { vendidos, vendido, ganancia, entraron, invertido, potencial };
}
function textoStock() {
  const lines = state.productos.filter((p) => !p.archivado && stockTotal(p) > 0).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((p) => `*${p.nombre}*: ` + (sinTalle(p) ? stockTotal(p) + ' unidades' : tallesDe(p).filter((t) => stockT(p, t) > 0).map((t) => `${t}(${stockT(p, t)})`).join(' ')));
  return `Stock Depósito Mendoza al ${fmtDate(todayStr())}\n` + (lines.join('\n') || 'Sin stock cargado');
}
function prodVer(id) {
  const p = prod(id); if (!p) return;
  const movs = state.stockMovs.filter((m) => m.productoId === id).slice(-15).reverse();
  const n = numerosModelo(p);
  modal(`<h3>${esc(p.nombre)}</h3><p class="sub">${esc([p.codigo ? 'Artículo N° ' + p.codigo : '', catDe(p), p.marca, p.color].filter(Boolean).join(' · '))}${p.descripcion ? '<br>' + esc(p.descripcion) : ''}</p>
    <div class="grid kpis" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:12px">
      <div class="card kpi"><div class="lbl">Costo por unidad</div><div class="val" style="font-size:19px">${p.costo ? fmtMoney(p.costo) : '<span class="c-warn">Falta</span>'}</div></div>
      <div class="card kpi"><div class="lbl">Precio de venta</div><div class="val" style="font-size:19px">${p.precio ? fmtMoney(p.precio) : '<span class="c-warn">Falta</span>'}</div><div class="hint">${p.precio && p.costo ? `ganás ${fmtMoney(p.precio - p.costo)} por unidad (${Math.round((p.precio - p.costo) / p.precio * 100)}%)` : ''}</div></div>
      <div class="card kpi"><div class="lbl">Invertido</div><div class="val c-inv" style="font-size:19px">${fmtMoney(n.invertido)}</div><div class="hint">${n.entraron} unidades que entraron</div></div>
      <div class="card kpi"><div class="lbl">Ganancia de ventas</div><div class="val c-in" style="font-size:19px">${fmtMoney(n.ganancia)}</div><div class="hint">${n.vendidos} unidades vendidas · ${fmtMoney(n.vendido)}</div></div>
      <div class="card kpi"><div class="lbl">Si vendés lo que hay</div><div class="val" style="font-size:19px">${fmtMoney(n.potencial)}</div><div class="hint">de ganancia (${stockTotal(p)} unidades)</div></div>
    </div>
    <div class="curva">${tallesDe(p).map((t) => { const n = stockT(p, t); return `<label>${esc(curvaLbl(t))}<input readonly value="${n}" class="${n > 0 ? 'has' : ''}" style="${n <= 0 ? 'color:var(--out)' : ''}"></label>`; }).join('')}</div>
    <p class="b mt">Total: ${stockTotal(p)} unidades</p>
    <div class="row"><button class="pri" id="pvIn">📥 Entró</button><button id="pvOut">📤 Salió</button><button id="pvCont">🔢 Contar stock</button><button id="pvEd">✏️ Editar artículo</button></div>
    <h2>Últimos movimientos</h2>${movs.length ? `<div class="list">${movs.map((m) => `<div class="li"><div class="m"><b>${esc(m.motivo)}</b><span>${fmtDate(m.fecha)}${tl(m.talle) ? ' · talle ' + esc(m.talle) : ''}</span></div><div class="s"><span class="pill ${m.cant > 0 ? 'in' : 'out'}">${m.cant > 0 ? '+' : ''}${m.cant}</span></div></div>`).join('')}</div>` : '<div class="empty">Sin movimientos todavía.</div>'}
    <div class="modal-actions"><button data-act="close">Cerrar</button></div>`, (box) => {
    $('#pvIn', box).onclick = () => movStockForm('entrada', { items: [{ productoId: id }] });
    $('#pvOut', box).onclick = () => movStockForm('salida', { items: [{ productoId: id }] });
    $('#pvCont', box).onclick = () => contarForm(id);
    $('#pvEd', box).onclick = () => prodForm(id);
  });
}
function prodForm(id, pre, onSaved) {
  const p = id ? prod(id) : Object.assign({ categoria: 'Calzado', stockMin: 2 }, pre || {});
  const isNew = !id;
  const cats = [...new Set(Object.keys(CATEG).concat(state.productos.map(catDe)))];
  const defDe = (c) => c === 'Calzado' ? (state.config.talles || '35-45') : (CATEG[c] || TU);
  modal(`<h3>${isNew ? 'Nuevo artículo' : 'Editar artículo'}</h3><div class="form">
    <label class="f">N° de artículo<input name="codigo" value="${esc(p.codigo)}" placeholder="Ej: 1024"></label>
    <label class="f">Nombre<input name="nombre" value="${esc(p.nombre)}" placeholder="Ej: Bolt 02, Camisa de trabajo"></label>
    <label class="f">Qué es<select name="categoria">${cats.map((c) => `<option ${c === catDe(p) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <label class="f">Talles<input name="tallesDef" value="${esc(p.tallesDef || defDe(catDe(p)))}" placeholder="35-45 · S,M,L,XL · Único"><span class="small muted">Separados por coma. Poné "Único" si no lleva talle.</span></label>
    <label class="f full">Descripción (sale en los presupuestos)<input name="descripcion" value="${esc(p.descripcion)}" placeholder="Ej: Botín de seguridad con puntera de acero"></label>
    <label class="f">Marca<input name="marca" value="${esc(p.marca)}"></label>
    <label class="f">Color<input name="color" value="${esc(p.color)}" placeholder="Ej: Marrón"></label>
    <label class="f">Costo por unidad (lo que pagás)<input name="costo" inputmode="decimal" value="${p.costo || ''}" placeholder="$"></label>
    <label class="f">Precio de venta por unidad<input name="precio" inputmode="decimal" value="${p.precio || ''}" placeholder="$"></label>
    <label class="f">Avisarme cuando queden (por talle)<input name="stockMin" inputmode="numeric" value="${p.stockMin ?? ''}"></label>
    <label class="f">Otros nombres para el chat<input name="alias" value="${esc(p.alias)}" placeholder="Ej: bolt, botin marron"></label>
    ${isNew ? `<div class="full"><label class="f">Stock que hay hoy (opcional)</label><div class="curva" id="pfCur"></div><label class="chk mt"><input type="checkbox" id="pfInv"> Contar este stock como inversión de hoy</label></div>` : ''}
    <p class="err full" id="pfErr"></p></div>
    <div class="modal-actions">${isNew ? '' : '<button class="danger izq" id="pfDel">Borrar artículo</button>'}<button data-act="close">Cancelar</button><button class="pri" id="pfOk">Guardar</button></div>`, (box) => {
    const cat = $('[name=categoria]', box), tdef = $('[name=tallesDef]', box); let catAnt = cat.value;
    const curva = () => { const c = $('#pfCur', box); if (!c) return; const val = {}; $$('input', c).forEach((i) => { val[i.dataset.t] = i.value; }); c.innerHTML = parseTalles(tdef.value).map((t) => `<label>${esc(curvaLbl(t))}<input data-t="${esc(t)}" inputmode="numeric" value="${esc(val[t] || '')}"></label>`).join(''); };
    cat.onchange = () => { if (!tdef.value.trim() || tdef.value.trim() === defDe(catAnt)) tdef.value = defDe(cat.value); catAnt = cat.value; curva(); };
    tdef.onchange = curva; curva();
    $('#pfOk', box).onclick = () => {
      const g = (n) => $(`[name=${n}]`, box).value.trim(); const err = (m) => ($('#pfErr', box).textContent = m);
      if (!g('nombre')) return err('Poné el nombre del artículo.');
      if (g('codigo') && state.productos.some((x) => x.id !== id && !x.archivado && String(x.codigo || '').toLowerCase() === g('codigo').toLowerCase())) return err('Ya hay otro artículo con ese número.');
      const data = { codigo: g('codigo'), nombre: g('nombre'), categoria: g('categoria'), tallesDef: g('tallesDef') || defDe(g('categoria')), descripcion: g('descripcion'), marca: g('marca'), color: g('color'), costo: numIn(g('costo')), precio: numIn(g('precio')), stockMin: Math.round(numIn(g('stockMin'))), alias: g('alias') };
      let rec;
      if (isNew) {
        rec = Object.assign({ id: uid(), talles: {}, creado: todayStr() }, data); state.productos.push(rec);
        const items = $$('#pfCur input', box).map((i) => ({ productoId: rec.id, talle: i.dataset.t, cant: Math.round(numIn(i.value)) })).filter((i) => i.cant > 0);
        if (items.length) { moverStock(items, 1, 'Stock inicial'); if ($('#pfInv', box) && $('#pfInv', box).checked) inversionEntrada(items, todayStr(), rec.id, 'Stock inicial de ' + rec.nombre); }
      } else { rec = Object.assign(p, data); }
      closeModal(); commit(); toast(isNew ? 'Artículo guardado' : 'Cambios guardados'); if (onSaved) onSaved(rec);
    };
    const d = $('#pfDel', box); if (d) d.onclick = () => confirmBox(`Se borra el artículo ${p.nombre}. Las ventas viejas quedan registradas.`, () => { state.productos = state.productos.filter((x) => x.id !== id); commit(); toast('Artículo borrado'); }, 'Borrar');
  });
}
function contarForm(id) {
  const p = prod(id);
  modal(`<h3>Contar stock · ${esc(p.nombre)}</h3><p class="sub">Poné cuántas unidades hay de verdad en el depósito. La app corrige la diferencia y la deja anotada.</p>
    <div class="curva">${tallesDe(p).map((t) => `<label>${esc(curvaLbl(t))}<input data-t="${esc(t)}" inputmode="numeric" value="${stockT(p, t)}"></label>`).join('')}</div>
    <div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="ctOk">Guardar conteo</button></div>`, (box) => {
    $('#ctOk', box).onclick = () => {
      let cambios = 0;
      $$('.curva input', box).forEach((i) => { const t = i.dataset.t, real = Math.round(numIn(i.value)), dif = real - stockT(p, t); if (dif) { moverStock([{ productoId: id, talle: t, cant: Math.abs(dif) }], Math.sign(dif), 'Conteo (ajuste)'); cambios++; } });
      closeModal(); commit(); toast(cambios ? 'Stock corregido' : 'El stock ya estaba bien');
    };
  });
}
// Entrada o salida de mercadería sin venta ni factura
function movStockForm(tipo, pre = {}, onSaved) {
  const ent = tipo === 'entrada';
  const lines = itemsToLines(pre.items);
  const rec = { foto: pre.foto || '' };
  modal(`<h3>${ent ? '📥 Entró mercadería' : '📤 Salió mercadería'}</h3>
    <p class="sub">${ent ? '¿Viene con factura? Mejor cargala en <b>Compras</b> así queda el costo y si la pagaste.' : 'Para ventas usá <b>Nueva venta</b>; esto es para lo que sale sin venderse.'}</p>
    <div class="form"><label class="f">Fecha<input type="date" name="fecha" value="${pre.fecha || todayStr()}"></label>
    <label class="f">Motivo<select name="motivo">${MOTIVOS[tipo].map((m) => `<option ${m === pre.motivo ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
    <div class="lineas mt" id="msL"></div><button type="button" class="sm mt" id="msAdd">+ Otro artículo</button>
    <label class="f mt">Nota<input name="nota" value="${esc(pre.nota)}"></label>
    ${ent ? '<label class="chk mt"><input type="checkbox" name="inv" checked> Contarlo como inversión (unidades × costo del artículo)</label>' : ''}
    <p class="err" id="msErr"></p>
    <div class="modal-actions">${ent ? '<button class="izq" id="msFac">🧾 Es con factura</button>' : ''}<button data-act="close">Cancelar</button><button class="pri" id="msOk">Guardar</button></div>`, (box) => {
    const ed = lineasEditor($('#msL', box), lines, { verStock: !ent });
    $('#msAdd', box).onclick = ed.add;
    const fac = $('#msFac', box); if (fac) fac.onclick = () => compraForm(null, { items: linesToItems(lines), fecha: $('[name=fecha]', box).value, foto: rec.foto });
    $('#msOk', box).onclick = () => {
      const items = linesToItems(lines); if (!items.length) return ($('#msErr', box).textContent = 'Elegí el artículo y poné cuántas unidades de cada talle.');
      const motivo = $('[name=motivo]', box).value, nota = $('[name=nota]', box).value.trim(), fecha = $('[name=fecha]', box).value || todayStr();
      moverStock(items, ent ? 1 : -1, motivo + (nota ? ' — ' + nota : ''), '', fecha);
      if (ent && $('[name=inv]', box).checked) inversionEntrada(items, fecha);
      closeModal(); commit(); toast(`${ent ? 'Entraron' : 'Salieron'} ${pares(items)} unidades`); if (onSaved) onSaved({ items });
    };
  });
}

// ---------- Ventas ----------
VISTAS.ventas = () => {
  const m = ui.ventasMes;
  let vs = state.ventas.filter((v) => enMes(v.fecha, m));
  if (ui.ventasTab === 'deben') vs = meDeben();
  vs = vs.slice().sort((a, b) => (b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || '')));
  const r = resumenMes(m);
  return `<div class="spread"><div><h1>Ventas</h1><p class="sub">${ui.ventasTab === 'deben' ? 'Ventas a cuenta que todavía no te pagaron' : mesLbl(m)}</p></div>
    <div class="row"><input type="month" id="ventasMes" value="${m}" style="width:auto"><button class="acc" data-act="ventaNueva">🛒 Nueva venta</button></div></div>
  <div class="tabs"><button class="${ui.ventasTab === 'todas' ? 'on' : ''}" data-act="ventasTab" data-id="todas">Del mes</button><button class="${ui.ventasTab === 'deben' ? 'on' : ''}" data-act="ventasTab" data-id="deben">Me deben (${meDeben().length})</button></div>
  ${ui.ventasTab === 'todas' ? `<div class="grid kpis" style="margin-bottom:14px"><div class="card kpi"><div class="lbl">Vendido</div><div class="val">${fmtMoney(r.vendido)}</div><div class="hint">${r.ventas.length} ventas</div></div><div class="card kpi"><div class="lbl">Unidades vendidas</div><div class="val">${pares(r.ventas.flatMap((v) => v.items))}</div></div><div class="card kpi"><div class="lbl">Ganancia sobre la mercadería</div><div class="val c-in">${fmtMoney(r.bruta)}</div><div class="hint">${r.vendido ? Math.round(r.bruta / r.vendido * 100) : 0}% de lo vendido</div></div></div>` : ''}
  ${vs.length ? `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Qué se llevó</th><th>Pago</th><th class="n">Total</th></tr></thead><tbody>
    ${vs.map((v) => `<tr class="click" data-act="ventaVer" data-id="${v.id}"><td>${fmtDateC(v.fecha)}</td><td>${esc(v.cliente || '—')}</td><td>${esc(resumenItems(v.items, 2))}</td><td><span class="pill ${v.pago === 'Cuenta corriente' ? (v.cobrado ? 'in' : 'warn') : ''}">${v.pago === 'Cuenta corriente' ? (v.cobrado ? 'Cobrada' : 'Me debe') : esc(v.pago)}</span></td><td class="n b">${fmtMoney(v.total)}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty">${ui.ventasTab === 'deben' ? 'Nadie te debe plata.' : 'No hay ventas en este mes.'}</div>`}`;
};
function ventaForm(pre = {}, onSaved) {
  const precioDe = (p) => p.precio || '';
  const lines = itemsToLines(pre.items, precioDe);
  const rec = { foto: pre.foto || '' };
  let totalManual = pre.total ? Number(pre.total) : null, forzar = false;
  const clientes = [...new Set(state.ventas.concat(state.muestras).map((v) => v.cliente).filter(Boolean))];
  modal(`<h3>🛒 Nueva venta</h3>${pre.desdeMuestra ? '<p class="pill acc">Viene de una muestra: el stock ya se descontó cuando la dejaste.</p>' : ''}
    <div class="form"><label class="f">Cliente<input name="cliente" list="vfCli" value="${esc(pre.cliente)}" placeholder="Nombre o empresa"><datalist id="vfCli">${clientes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <label class="f">Teléfono (opcional)<input name="tel" inputmode="tel" value="${esc(pre.telefono)}"></label>
    <label class="f">Fecha<input type="date" name="fecha" value="${pre.fecha || todayStr()}"></label>
    <label class="f">Forma de pago<select name="pago">${PAGOS.map((p) => `<option ${p === (pre.pago || 'Efectivo') ? 'selected' : ''}>${p === 'Cuenta corriente' ? 'Cuenta corriente (me debe)' : p}</option>`).join('')}</select></label></div>
    <div class="lineas mt" id="vfL"></div><button type="button" class="sm mt" id="vfAdd">+ Otro artículo</button>
    <label class="f mt">Nota<input name="nota" value="${esc(pre.nota)}"></label>
    <div class="totbar mt"><span class="small muted" id="vfPares"></span><label class="f" style="flex-direction:row;align-items:center;gap:8px">Total<input name="total" inputmode="decimal" style="width:150px;font-weight:800;font-size:18px"></label></div>
    <p class="err" id="vfErr"></p>
    <div class="modal-actions"><button data-act="close">Cancelar</button><button class="acc" id="vfOk">Guardar venta</button></div>`, (box) => {
    const tot = $('[name=total]', box);
    const calc = () => { const items = linesToItems(lines); const auto = items.reduce((s, i) => s + i.cant * i.precio, 0); $('#vfPares', box).textContent = `${pares(items)} unidades`; if (totalManual == null) tot.value = auto ? fmtNum(auto) : ''; forzar = false; $('#vfOk', box).textContent = 'Guardar venta'; $('#vfErr', box).textContent = ''; };
    tot.oninput = () => { totalManual = tot.value.trim() ? numIn(tot.value) : null; };
    if (totalManual != null) tot.value = fmtNum(totalManual);
    const ed = lineasEditor($('#vfL', box), lines, { precio: 'Precio por unidad', verStock: !pre.desdeMuestra, precioDe }, calc);
    $('#vfAdd', box).onclick = ed.add;
    $('#vfOk', box).onclick = () => {
      const items = linesToItems(lines); if (!items.length) return ($('#vfErr', box).textContent = 'Elegí el artículo y poné cuántas unidades de cada talle.');
      if (!pre.desdeMuestra && !forzar) { const f = faltantes(items); if (f.length) { forzar = true; $('#vfErr', box).textContent = 'No alcanza el stock: ' + f.map((x) => `${x.p.nombre} talle ${x.t} (hay ${x.hay})`).join(', ') + '. Si igual lo vendiste, tocá de nuevo y el stock queda en negativo hasta que lo corrijas.'; $('#vfOk', box).textContent = 'Guardar igual'; return; } }
      const g = (n) => $(`[name=${n}]`, box).value.trim();
      const pago = g('pago').startsWith('Cuenta') ? 'Cuenta corriente' : g('pago');
      const v = { id: uid(), fecha: g('fecha') || todayStr(), hora: new Date().toTimeString().slice(0, 5), cliente: g('cliente'), telefono: g('tel'), pago, cobrado: pago !== 'Cuenta corriente', items: items.map((i) => Object.assign(i, { costo: Number(prod(i.productoId).costo) || 0 })), total: numIn(tot.value) || items.reduce((s, i) => s + i.cant * i.precio, 0), nota: g('nota'), foto: rec.foto, origen: pre.origen || 'app' };
      if (pre.desdeMuestra) v.muestraId = pre.desdeMuestra; else moverStock(v.items, -1, 'Venta' + (v.cliente ? ' a ' + v.cliente : ''), v.id, v.fecha);
      state.ventas.push(v);
      if (pre.desdeMuestra) { const m = state.muestras.find((x) => x.id === pre.desdeMuestra); if (m) { m.estado = 'vendida'; m.fechaCierre = todayStr(); m.ventaId = v.id; } }
      closeModal(); commit(); toast(`Venta guardada: ${fmtMoney(v.total)}`); if (onSaved) onSaved(v);
    };
    calc();
  });
}
function ventaVer(id) {
  const v = state.ventas.find((x) => x.id === id); if (!v) return;
  const txt = `Hola${v.cliente ? ' ' + v.cliente : ''}! Te paso el detalle de tu compra en Depósito Mendoza (${fmtDate(v.fecha)}):\n` + v.items.map((i) => `• ${i.cant} × ${prodNombre(i.productoId, i.nombre)}${tl(i.talle) ? ' talle ' + i.talle : ''}${i.precio ? ' — ' + fmtMoney(i.precio) + ' c/u' : ''}`).join('\n') + `\nTotal: ${fmtMoney(v.total)}\n¡Gracias!`;
  modal(`<h3>Venta · ${fmtDate(v.fecha)}</h3><p class="sub">${esc(v.cliente || 'Sin nombre')}${v.telefono ? ' · ' + esc(v.telefono) : ''} · ${esc(v.pago)}${v.pago === 'Cuenta corriente' ? (v.cobrado ? ' (cobrada el ' + fmtDate(v.fechaCobro) + ')' : ' (me debe)') : ''}${v.origen === 'chat' ? ' · cargada por mensaje' : ''}</p>
    <div class="tablewrap"><table><thead><tr><th>Artículo</th><th>Talle</th><th class="n">Cant.</th><th class="n">Precio</th></tr></thead><tbody>${v.items.map((i) => `<tr><td>${esc(prodNombre(i.productoId, i.nombre))}</td><td>${esc(tl(i.talle))}</td><td class="n">${i.cant}</td><td class="n">${fmtMoney(i.precio)}</td></tr>`).join('')}</tbody></table></div>
    <p class="b mt" style="font-size:20px">Total ${fmtMoney(v.total)}</p>${v.nota ? `<p>${esc(v.nota)}</p>` : ''}
    <div class="row"><button class="pri" id="vvImp">🖨️ Imprimir comprobante</button></div>
    <div class="modal-actions"><button class="danger izq" id="vvAn">Anular venta</button>${!v.cobrado ? `<button class="pri" data-act="cobrar" data-id="${v.id}">💰 Me pagó</button>` : ''}<a class="btn wa" href="${waLink(v.telefono, txt)}" target="_blank" rel="noopener">💬 Mandar detalle</a><button data-act="close">Cerrar</button></div>`, (box) => {
    $('#vvImp', box).onclick = () => imprimirHoja(ventaHoja(v), `Comprobante ${presuNro(ventaNro(v))}${v.cliente ? ' - ' + v.cliente : ''}`);
    $('#vvAn', box).onclick = () => confirmBox('Se borra la venta y las unidades vuelven al stock.', () => anularVenta(id), 'Anular venta');
  });
}
function anularVenta(id) {
  const v = state.ventas.find((x) => x.id === id); if (!v) return;
  if (v.muestraId) { const m = state.muestras.find((x) => x.id === v.muestraId); if (m) { m.estado = 'afuera'; delete m.ventaId; delete m.fechaCierre; } }
  else moverStock(v.items, 1, 'Venta anulada', v.id);
  state.ventas = state.ventas.filter((x) => x.id !== id); commit(); toast('Venta anulada');
}

// ---------- Compras y facturas ----------
VISTAS.compras = () => {
  let cs = state.compras.slice();
  if (ui.comprasTab === 'debo') cs = debo();
  if (ui.comprasTab === 'pagadas') cs = cs.filter((c) => c.pagada);
  cs.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const tot = debo().reduce((s, c) => s + (+c.total || 0), 0);
  const deQue = (c) => pares(c.items) ? pares(c.items) + ' unidades' : (c.detalle || (c.clase === 'gasto' ? 'Gasto' : 'Compra'));
  return `<div class="spread"><div><h1>Compras y facturas</h1><p class="sub">Guardá acá cada factura con su foto o PDF: queda anotado si la pagaste y no se pierde. Si es de mercadería, además suma las unidades al stock.</p></div>
    <div class="row"><button data-act="facturaArchivo">📎 Guardar foto o PDF de una factura</button><button class="pri" data-act="compraNueva">🧾 Cargar factura</button></div></div>
  <div class="tabs"><button class="${ui.comprasTab === 'todas' ? 'on' : ''}" data-act="comprasTab" data-id="todas">Todas (${state.compras.length})</button><button class="${ui.comprasTab === 'debo' ? 'on' : ''}" data-act="comprasTab" data-id="debo">A pagar (${debo().length} · ${fmtMoney(tot)})</button><button class="${ui.comprasTab === 'pagadas' ? 'on' : ''}" data-act="comprasTab" data-id="pagadas">Pagadas</button></div>
  ${cs.length ? `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Factura</th><th>De qué</th><th>Estado</th><th class="n">Total</th><th>Archivo</th></tr></thead><tbody>
    ${cs.map((c) => `<tr class="click" data-act="compraVer" data-id="${c.id}"><td>${fmtDateC(c.fecha)}</td><td>${esc(c.proveedor || '—')}</td><td>${esc(c.nro || '')}</td><td>${esc(deQue(c))}</td><td><span class="pill ${c.pagada ? 'in' : c.vence && c.vence < todayStr() ? 'out' : 'warn'}">${c.pagada ? '✓ Pagada' : c.vence ? (c.vence < todayStr() ? 'Vencida ' : 'A pagar · vence ') + fmtDateC(c.vence) : 'A pagar'}</span></td><td class="n b">${fmtMoney(c.total)}</td><td>${c.archivoId ? '📎' : '<span class="small muted">sin archivo</span>'}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty">${ui.comprasTab === 'debo' ? 'No debés ninguna factura 👌' : 'Todavía no hay facturas guardadas.'}</div>`}`;
};
function pagarCompra(c, fecha) { c.pagada = true; c.fechaPago = fecha || todayStr(); state.eventos.filter((e) => e.ref === c.id).forEach((e) => { e.hecho = true; }); }
function compraForm(id, pre = {}, onSaved) {
  const precioDe = (p) => p.costo || '';
  const lines = itemsToLines(pre.items, precioDe);
  const rec = { archivo: pre.archivo || null };
  let totalManual = pre.total ? Number(pre.total) : null;
  const clase0 = pre.clase || 'mercaderia';
  const provs = [...new Set(state.compras.map((c) => c.proveedor).filter(Boolean))];
  if (!provs.includes('Ringo Work')) provs.push('Ringo Work');
  modal(`<h3>🧾 Guardar factura</h3>
    <div class="form"><label class="f full">¿De qué es la factura?<select name="clase"><option value="mercaderia" ${clase0 === 'mercaderia' ? 'selected' : ''}>Botines / mercadería (suma al stock)</option><option value="gasto" ${clase0 === 'gasto' ? 'selected' : ''}>Un gasto (luz, alquiler, flete, impuestos…)</option><option value="otra" ${clase0 === 'otra' ? 'selected' : ''}>Otra compra (no suma al stock)</option></select></label>
    <label class="f">Proveedor<input name="prov" list="cfProv" value="${esc(pre.proveedor || (state.compras.length || clase0 !== 'mercaderia' ? '' : 'Ringo Work'))}"><datalist id="cfProv">${provs.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <label class="f">N° de factura<input name="nro" value="${esc(pre.nro)}" placeholder="Ej: A-0003-00012345"></label>
    <label class="f full nomerc">Detalle<input name="detalle" value="${esc(pre.detalle)}" placeholder="Ej: Luz de noviembre"></label>
    <label class="f">Fecha<input type="date" name="fecha" value="${pre.fecha || todayStr()}"></label>
    <label class="f">¿La pagaste?<select name="pagada"><option value="1" ${pre.pagada !== false ? 'selected' : ''}>Sí, ya está pagada</option><option value="0" ${pre.pagada === false ? 'selected' : ''}>No, la pago más adelante</option></select></label>
    <label class="f vence">Vence el<input type="date" name="vence" value="${pre.vence || addDays(todayStr(), 30)}"></label>
    ${campoArchivoHTML('Foto o PDF de la factura (para que no se pierda)')}
    <label class="chk full merc"><input type="checkbox" name="actCosto" checked> Actualizar el costo de los artículos con el de esta factura</label></div>
    <div class="merc"><div class="lineas mt" id="cfL"></div><div class="row mt"><button type="button" class="sm" id="cfAdd">+ Otro artículo</button><button type="button" class="sm" id="cfNuevo">+ Artículo nuevo que no está en la lista</button></div></div>
    <div class="totbar mt"><span class="small muted" id="cfPares"></span><label class="f" style="flex-direction:row;align-items:center;gap:8px">Total factura<input name="total" inputmode="decimal" style="width:160px;font-weight:800;font-size:18px"></label></div>
    <p class="err" id="cfErr"></p>
    <div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="cfOk">Guardar factura</button></div>`, (box) => {
    const tot = $('[name=total]', box), claseSel = $('[name=clase]', box);
    const esMerc = () => claseSel.value === 'mercaderia';
    const calc = () => { const items = esMerc() ? linesToItems(lines) : []; const auto = items.reduce((s, i) => s + i.cant * i.precio, 0); $('#cfPares', box).textContent = esMerc() ? `${pares(items)} unidades` : ''; if (totalManual == null) tot.value = auto ? fmtNum(auto) : ''; };
    tot.oninput = () => { totalManual = tot.value.trim() ? numIn(tot.value) : null; };
    if (totalManual != null) tot.value = fmtNum(totalManual);
    const ed = lineasEditor($('#cfL', box), lines, { precio: 'Costo por unidad', precioDe }, calc);
    const pag = $('[name=pagada]', box), ven = $('.vence', box);
    const upd = () => { ven.classList.toggle('hidden', pag.value === '1'); $$('.merc', box).forEach((el) => el.classList.toggle('hidden', !esMerc())); $$('.nomerc', box).forEach((el) => el.classList.toggle('hidden', esMerc())); calc(); };
    pag.onchange = upd; claseSel.onchange = upd;
    campoArchivo(box, rec);
    $('#cfAdd', box).onclick = ed.add;
    $('#cfNuevo', box).onclick = () => { const snap = { proveedor: $('[name=prov]', box).value, nro: $('[name=nro]', box).value, fecha: $('[name=fecha]', box).value, items: linesToItems(lines), archivo: rec.archivo, total: totalManual, pagada: pag.value === '1', vence: $('[name=vence]', box).value, origen: pre.origen }; prodForm(null, null, (p) => { snap.items.push({ productoId: p.id, talle: '', cant: 0 }); compraForm(null, snap, onSaved); }); };
    $('#cfOk', box).onclick = () => {
      const err = (m) => ($('#cfErr', box).textContent = m);
      const merc = esMerc(), items = merc ? linesToItems(lines) : [];
      if (merc && !items.length) return err('Elegí el artículo y poné cuántas unidades de cada talle. Si la factura no es de botines, cambiá arriba de qué es.');
      const g = (n) => $(`[name=${n}]`, box).value.trim(); const pagada = g('pagada') === '1';
      const total = numIn(tot.value) || items.reduce((s, i) => s + i.cant * i.precio, 0);
      if (!merc && !total && !rec.archivo) return err('Poné el total de la factura o adjuntá la foto.');
      const cid = uid();
      const c = { id: cid, fecha: g('fecha') || todayStr(), proveedor: g('prov'), nro: g('nro'), clase: g('clase'), detalle: merc ? '' : g('detalle'), items: items.map((i) => ({ productoId: i.productoId, nombre: i.nombre, talle: i.talle, cant: i.cant, costo: i.precio })), total, pagada, fechaPago: pagada ? (g('fecha') || todayStr()) : '', vence: pagada ? '' : g('vence'), archivoId: rec.archivo ? archivoGuardar(rec.archivo, cid) : '', origen: pre.origen || 'app' };
      if (merc && $('[name=actCosto]', box).checked) items.forEach((i) => { if (i.precio) prod(i.productoId).costo = i.precio; });
      if (merc) moverStock(c.items, 1, 'Compra' + (c.proveedor ? ' a ' + c.proveedor : '') + (c.nro ? ' (fact. ' + c.nro + ')' : ''), c.id, c.fecha);
      state.compras.push(c);
      if (!pagada && c.vence) state.eventos.push({ id: uid(), fecha: c.vence, titulo: tituloFactura(c), tipo: 'pagar', monto: c.total, hecho: false, aviso: 'diario', creado: todayStr(), ref: c.id });
      closeModal(); commit(); toast(merc ? `Factura guardada: entraron ${pares(c.items)} unidades` : 'Factura guardada ✓'); if (onSaved) onSaved(c);
      if (!pagada) pedirPermisoAvisos();
    };
    upd();
  });
}
const tituloFactura = (c) => `Pagar factura ${c.nro || ''} ${c.proveedor ? 'de ' + c.proveedor : c.detalle || ''}`.replace(/\s+/g, ' ').trim();
function compraVer(id) {
  const c = state.compras.find((x) => x.id === id); if (!c) return;
  const venc = !c.pagada && c.vence && c.vence < todayStr();
  modal(`<h3>Factura ${esc(c.nro || '')}</h3><p class="sub">${esc(c.proveedor || 'Sin proveedor')}${c.detalle ? ' · ' + esc(c.detalle) : ''} · ${fmtDate(c.fecha)}</p>
    <p><span class="pill ${c.pagada ? 'in' : venc ? 'out' : 'warn'}" style="font-size:14px;padding:5px 12px">${c.pagada ? '✓ Pagada el ' + fmtDate(c.fechaPago) : (venc ? 'Sin pagar · venció el ' : 'Sin pagar' + (c.vence ? ' · vence el ' : '')) + (c.vence ? fmtDate(c.vence) : '')}</span></p>
    ${c.items && c.items.length ? `<div class="tablewrap mt"><table><thead><tr><th>Artículo</th><th>Talle</th><th class="n">Cant.</th><th class="n">Costo</th></tr></thead><tbody>${c.items.map((i) => `<tr><td>${esc(prodNombre(i.productoId, i.nombre))}</td><td>${esc(i.talle)}</td><td class="n">${i.cant}</td><td class="n">${fmtMoney(i.costo)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <p class="b mt" style="font-size:20px">Total ${fmtMoney(c.total)}</p>
    ${c.archivoId ? archivoHTML(c.archivoId) : '<div class="row"><button id="cvAdj">📎 Adjuntar foto o PDF</button><span class="small muted">Todavía no tiene archivo guardado.</span></div>'}
    <div class="modal-actions"><button class="danger izq" id="cvAn">Borrar factura</button>${c.archivoId ? '<button id="cvQuitar">Quitar archivo</button>' : ''}${!c.pagada ? '<button class="pri" id="cvPag">💸 La pagué</button>' : '<button id="cvNoPag">No estaba pagada</button>'}<button data-act="close">Cerrar</button></div>`, (box) => {
    const on = (sel, fn) => { const b = $(sel, box); if (b) b.onclick = fn; };
    on('#cvPag', () => { pagarCompra(c); closeModal(); commit(); toast('Factura marcada como pagada ✓'); });
    on('#cvNoPag', () => { c.pagada = false; c.fechaPago = ''; state.eventos.filter((e) => e.ref === c.id).forEach((e) => { e.hecho = false; }); closeModal(); commit(); toast('Quedó como sin pagar'); });
    on('#cvAdj', () => elegirArchivo((a) => { c.archivoId = archivoGuardar(a, c.id); commit(); toast('Archivo guardado 📎'); compraVer(id); }));
    on('#cvQuitar', () => confirmBox('Se borra el archivo guardado de esta factura.', () => { archivoBorrar(c.archivoId); c.archivoId = ''; commit(); compraVer(id); }, 'Quitar'));
    on('#cvAn', () => confirmBox(c.items && c.items.length ? 'Se borra la factura y esas unidades se descuentan del stock.' : 'Se borra la factura y su archivo.', () => { if (c.items && c.items.length) moverStock(c.items, -1, 'Factura anulada', c.id); if (c.archivoId) archivoBorrar(c.archivoId); state.compras = state.compras.filter((x) => x.id !== id); state.eventos = state.eventos.filter((e) => e.ref !== id); commit(); toast('Factura borrada'); }, 'Borrar'));
  });
}

// ---------- Muestras ----------
VISTAS.muestras = () => {
  const hoy = todayStr(), dm = state.config.diasMuestra || 7;
  const af = ui.muestrasTab === 'afuera';
  const ms = state.muestras.filter((m) => af ? m.estado === 'afuera' : m.estado !== 'afuera').sort((a, b) => af ? a.fecha.localeCompare(b.fecha) : (b.fechaCierre || '').localeCompare(a.fechaCierre || ''));
  return `<div class="spread"><div><h1>Muestras</h1><p class="sub">Lo que dejaste a clientes para que prueben. Te avisa a los ${dm} días para que no te olvides de buscarla.</p></div>
    <button class="acc" data-act="muestraNueva">📦 Dejé una muestra</button></div>
  <div class="tabs"><button class="${af ? 'on' : ''}" data-act="muestrasTab" data-id="afuera">Afuera (${muestrasAfuera().length})</button><button class="${af ? '' : 'on'}" data-act="muestrasTab" data-id="hist">Ya resueltas</button></div>
  ${ms.length ? `<div class="grid g2">${ms.map((m) => { const d = daysBetween(m.fecha, hoy);
    const txt = `Hola${m.cliente ? ' ' + m.cliente : ''}! Te escribo de Depósito Mendoza por la muestra que te dejé el ${fmtDate(m.fecha)} (${resumenItems(m.items)}). ¿Qué te pareció? ¿Paso a buscarla o te la dejo?`;
    return `<div class="card ${af && d >= dm * 2 ? 'alerta roja' : af && d >= dm ? 'alerta' : ''}"><div class="spread"><h3 style="margin:0">${esc(m.cliente || 'Sin nombre')}</h3>${af ? `<span class="pill ${d >= dm * 2 ? 'out' : d >= dm ? 'warn' : ''}">${hace(d)}</span>` : `<span class="pill ${m.estado === 'vendida' ? 'in' : ''}">${m.estado === 'vendida' ? 'Se la quedó (venta)' : 'La busqué'} · ${fmtDateC(m.fechaCierre)}</span>`}</div>
      <p class="small" style="margin:6px 0">${esc(resumenItems(m.items))}</p><p class="small muted" style="margin:0 0 8px">Dejada el ${fmtDate(m.fecha)}${m.telefono ? ' · ' + esc(m.telefono) : ''}${m.nota ? ' · ' + esc(m.nota) : ''}</p>
      ${af ? `<div class="row mt"><button class="sm pri" data-act="muestraVolvio" data-id="${m.id}">✅ La busqué</button><button class="sm" data-act="muestraVendida" data-id="${m.id}">💰 Se la quedó</button><a class="btn sm wa" href="${waLink(m.telefono, txt)}" target="_blank" rel="noopener">💬 Escribirle</a><button class="sm link danger" data-act="muestraBorrar" data-id="${m.id}">Borrar</button></div>` : ''}</div>`; }).join('')}</div>`
    : `<div class="empty">${af ? 'No hay muestras afuera.' : 'Todavía no hay muestras resueltas.'}</div>`}`;
};
function muestraForm(pre = {}, onSaved) {
  const lines = itemsToLines(pre.items);
  const rec = { foto: pre.foto || '' };
  const clientes = [...new Set(state.ventas.concat(state.muestras).map((v) => v.cliente).filter(Boolean))];
  modal(`<h3>📦 Dejé una muestra</h3><p class="sub">Las unidades salen del stock mientras están afuera. Cuando la busques, vuelven solos.</p>
    <div class="form"><label class="f">¿A quién se la dejaste?<input name="cliente" list="mfCli" value="${esc(pre.cliente)}"><datalist id="mfCli">${clientes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <label class="f">Teléfono (opcional)<input name="tel" inputmode="tel" value="${esc(pre.telefono)}"></label>
    <label class="f">¿Cuándo?<input type="date" name="fecha" value="${pre.fecha || todayStr()}"></label></div>
    <div class="lineas mt" id="mfL"></div><button type="button" class="sm mt" id="mfAdd">+ Otro artículo</button>
    <label class="f mt">Nota<input name="nota" value="${esc(pre.nota)}" placeholder="Ej: la prueba el capataz de la obra"></label>
    <p class="err" id="mfErr"></p>
    <div class="modal-actions"><button data-act="close">Cancelar</button><button class="acc" id="mfOk">Guardar muestra</button></div>`, (box) => {
    const ed = lineasEditor($('#mfL', box), lines, { verStock: true }); $('#mfAdd', box).onclick = ed.add;
    $('#mfOk', box).onclick = () => {
      const items = linesToItems(lines).map((i) => ({ productoId: i.productoId, nombre: i.nombre, talle: i.talle, cant: i.cant }));
      if (!items.length) return ($('#mfErr', box).textContent = 'Elegí el artículo y el talle que dejaste.');
      const g = (n) => $(`[name=${n}]`, box).value.trim();
      if (!g('cliente')) return ($('#mfErr', box).textContent = 'Poné a quién se la dejaste, así sabés a quién ir a buscarla.');
      const m = { id: uid(), fecha: g('fecha') || todayStr(), cliente: g('cliente'), telefono: g('tel'), items, nota: g('nota'), foto: rec.foto, estado: 'afuera', origen: pre.origen || 'app' };
      moverStock(items, -1, 'Muestra a ' + m.cliente, m.id, m.fecha); state.muestras.push(m);
      closeModal(); commit(); toast('Muestra anotada. Te aviso si pasa mucho tiempo.'); if (onSaved) onSaved(m);
    };
  });
}
function muestraVolvio(id) {
  const m = state.muestras.find((x) => x.id === id); if (!m || m.estado !== 'afuera') return;
  moverStock(m.items, 1, 'Volvió muestra de ' + m.cliente, m.id); m.estado = 'devuelta'; m.fechaCierre = todayStr(); commit(); toast('Muestra devuelta: las unidades volvieron al stock');
}

// ---------- Calendario ----------
const COLORES = [['#164e68', 'Azul'], ['#f67a0c', 'Naranja'], ['#1a7f4b', 'Verde'], ['#c0392b', 'Rojo'], ['#7b3fa0', 'Violeta'], ['#c99a06', 'Amarillo'], ['#5a6b76', 'Gris']];
const colorEv = (e) => e.color || { pagar: '#c0392b', cobrar: '#1a7f4b', visita: '#f67a0c', entrega: '#f67a0c', prestamo: '#7b3fa0', evento: '#164e68' }[e.tipo] || '#164e68';
const AVISOS = { diario: 'Todos los días hasta ese día, y el día cada 6 horas', dia: 'Solo el mismo día, cada 6 horas', no: 'No avisarme' };
function itemsDelDia(d) {
  const out = state.eventos.filter((e) => e.fecha === d).sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99')).map((e) => ({ k: 'ev', e, color: colorEv(e) }));
  const dm = state.config.diasMuestra || 7;
  muestrasAfuera().forEach((m) => { if (addDays(m.fecha, dm) === d) out.push({ k: 'mu', m, color: '#f67a0c' }); });
  state.ventas.filter((v) => v.fecha === d).forEach((v) => out.push({ k: 've', v, color: '#9fb3bd' }));
  return out;
}
const chipTxt = (x) => x.k === 'ev' ? x.e.titulo : x.k === 'mu' ? 'Buscar muestra ' + x.m.cliente : 'Venta ' + (x.v.cliente || '');
function evDetalle(e) {
  const t = TIPOS_EV[e.tipo] || TIPOS_EV.recordatorio, hoy = todayStr();
  const venc = !e.hecho && e.fecha < hoy;
  return `<div class="li ev-li" style="border-left:5px solid ${colorEv(e)};padding-left:10px"><div class="m"><b style="${e.hecho ? 'text-decoration:line-through;opacity:.6' : ''}">${t.ico} ${esc(e.titulo)}</b>
    <span>${esc(t.lbl)}${e.quien ? ' · ' + esc(e.quien) : ''}${e.hora ? ' · ' + esc(e.hora) : ''}${e.monto ? ' · ' + fmtMoney(e.monto) : ''}${venc ? ' · <b class="c-out">atrasado</b>' : ''}${e.aviso !== 'no' && !e.hecho ? ' · 🔔' : ''}</span>${e.nota ? `<div class="small" style="white-space:pre-wrap;margin-top:2px">${esc(e.nota)}</div>` : ''}</div>
    <div class="s">${e.hecho ? `<span class="pill in">${e.tipo === 'prestamo' ? 'Devuelto' : 'Hecho'}</span>` : `<button class="sm" data-act="eventoHecho" data-id="${e.id}">${e.tipo === 'prestamo' ? '✓ Lo devolvió' : '✓ Listo'}</button>`}<button class="sm" data-act="eventoEditar" data-id="${e.id}">Editar</button></div></div>`;
}
VISTAS.calendario = () => {
  const [y, mo] = ui.calMes.split('-').map(Number), first = new Date(y, mo - 1, 1), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const hoy = todayStr(), days = [];
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(ymd(d)); }
  const its = itemsDelDia(ui.calSel);
  const prest = state.eventos.filter((e) => e.tipo === 'prestamo' && !e.hecho).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const prox = state.eventos.filter((e) => !e.hecho && e.tipo !== 'prestamo' && e.fecha >= hoy && e.fecha <= addDays(hoy, 14)).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
  const atras = state.eventos.filter((e) => !e.hecho && e.tipo !== 'prestamo' && e.fecha < hoy);
  return `<div class="spread"><div><h1>Calendario</h1><p class="sub">Anotá lo que quieras con el color que quieras: eventos, entregas, préstamos, pagos. La app te avisa todos los días hasta que llegue, y ese día cada 6 horas.</p></div>
    <div class="row"><button data-act="prestamoNuevo">🤝 Presté algo</button><button class="pri" data-act="eventoNuevo">+ Anotar</button></div></div>
  ${avisosBanner()}
  <div class="card"><div class="spread" style="margin-bottom:10px"><button class="sm" data-act="calMov" data-id="-1">◀</button><b>${mesLbl(ui.calMes)}</b><button class="sm" data-act="calMov" data-id="1">▶</button></div>
  <div class="cal">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => `<div class="dn">${d}</div>`).join('')}
  ${days.map((d) => { const it = itemsDelDia(d); return `<button class="${d.slice(0, 7) !== ui.calMes ? 'otro' : ''} ${d === hoy ? 'hoy' : ''} ${d === ui.calSel ? 'sel' : ''}" data-act="calSel" data-id="${d}"><span>${+d.slice(8)}</span><span class="chips">${it.slice(0, 3).map((x) => `<i class="chip" style="background:${x.color}">${esc(chipTxt(x))}</i>`).join('')}${it.length > 3 ? `<i class="mas">+${it.length - 3}</i>` : ''}</span></button>`; }).join('')}</div></div>
  <div class="spread"><h2>${ui.calSel === hoy ? 'Hoy' : parseD(ui.calSel).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2><button class="sm" data-act="eventoNuevo">+ Anotar este día</button></div>
  ${its.length ? `<div class="card"><div class="list">${its.map((x) => x.k === 'ev' ? evDetalle(x.e)
    : x.k === 'mu' ? `<div class="li" style="border-left:5px solid ${x.color};padding-left:10px"><div class="m"><b>📦 Buscar muestra de ${esc(x.m.cliente)}</b><span>${esc(resumenItems(x.m.items))} · dejada el ${fmtDate(x.m.fecha)}</span></div><div class="s"><button class="sm" data-act="muestraVolvio" data-id="${x.m.id}">La busqué</button></div></div>`
    : `<div class="li" style="border-left:5px solid ${x.color};padding-left:10px"><div class="m"><b>🛒 Venta${x.v.cliente ? ' a ' + esc(x.v.cliente) : ''}</b><span>${esc(resumenItems(x.v.items, 2))}</span></div><div class="s"><b>${fmtMoney(x.v.total)}</b></div></div>`).join('')}</div></div>` : '<div class="empty">Nada para este día.</div>'}
  <div class="grid g2 mt">
    <div class="card"><h3>🤝 Prestado (${prest.length})</h3>${prest.length ? `<div class="list">${prest.map((e) => evDetalle(e)).join('')}</div>` : '<div class="empty">No hay nada prestado.</div>'}</div>
    <div class="card"><h3>📅 Próximas 2 semanas</h3>${atras.length || prox.length ? `<div class="list">${atras.concat(prox).map((e) => evDetalle(e).replace('<span>', `<span>${fmtDateC(e.fecha)} · `)).join('')}</div>` : '<div class="empty">Nada anotado.</div>'}</div>
  </div>`;
};
function eventoForm(id, pre = {}, onSaved) {
  const e = id ? state.eventos.find((x) => x.id === id) : Object.assign({ fecha: ui.calSel >= todayStr() ? ui.calSel : todayStr(), tipo: 'recordatorio', aviso: 'diario' }, pre);
  let color = e.color || '';
  modal(`<h3>${id ? 'Editar' : e.tipo === 'prestamo' ? '🤝 Presté algo' : 'Anotar en el calendario'}</h3><div class="form">
    <label class="f full"><span id="efTitL">${e.tipo === 'prestamo' ? '¿Qué prestaste?' : '¿Qué es?'}</span><input name="titulo" value="${esc(e.titulo)}" placeholder="${e.tipo === 'prestamo' ? 'Ej: 2 pares Bolt 42 y una campera' : 'Ej: Entrega a Constructora Andes'}"></label>
    <label class="f">Tipo<select name="tipo">${Object.entries(TIPOS_EV).map(([k, t]) => `<option value="${k}" ${k === e.tipo ? 'selected' : ''}>${t.ico} ${t.lbl}</option>`).join('')}</select></label>
    <label class="f quien">¿A quién?<input name="quien" value="${esc(e.quien)}" placeholder="Nombre"></label>
    <label class="f"><span id="efFecL">${e.tipo === 'prestamo' ? '¿Cuándo lo tiene que devolver?' : 'Fecha'}</span><input type="date" name="fecha" value="${e.fecha}"></label>
    <label class="f">Hora (opcional)<input type="time" name="hora" value="${esc(e.hora)}"></label>
    <div class="f full"><label class="f">Color</label><div class="colores">${COLORES.map(([c, n]) => `<button type="button" class="col" data-c="${c}" title="${n}" aria-label="${n}" style="background:${c}"></button>`).join('')}</div></div>
    <label class="f full">Texto / detalles<textarea name="nota" rows="3" placeholder="Lo que quieras anotar">${esc(e.nota)}</textarea></label>
    <label class="f">Avisarme<select name="aviso">${Object.entries(AVISOS).map(([k, l]) => `<option value="${k}" ${k === (e.aviso || 'diario') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f">Monto (opcional)<input name="monto" inputmode="decimal" value="${e.monto || ''}" placeholder="$"></label>
    <p class="err full" id="efErr"></p></div>
    <div class="modal-actions">${id ? '<button class="danger izq" id="efDel">Borrar</button>' : ''}<button data-act="close">Cancelar</button><button class="pri" id="efOk">Guardar</button></div>`, (box) => {
    const tipoSel = $('[name=tipo]', box);
    const upd = () => { const pr = tipoSel.value === 'prestamo'; $('.quien', box).classList.toggle('hidden', !pr); $('#efTitL', box).textContent = pr ? '¿Qué prestaste?' : '¿Qué es?'; $('#efFecL', box).textContent = pr ? '¿Cuándo lo tiene que devolver?' : 'Fecha'; $$('.col', box).forEach((b) => b.classList.toggle('on', b.dataset.c === (color || colorEv({ tipo: tipoSel.value })))); };
    tipoSel.onchange = upd; $$('.col', box).forEach((b) => { b.onclick = () => { color = b.dataset.c; upd(); }; }); upd();
    $('#efOk', box).onclick = () => {
      const g = (n) => $(`[name=${n}]`, box).value.trim(); if (!g('titulo')) return ($('#efErr', box).textContent = tipoSel.value === 'prestamo' ? 'Escribí qué prestaste.' : 'Escribí qué es.');
      const data = { titulo: g('titulo'), tipo: g('tipo'), quien: g('tipo') === 'prestamo' ? g('quien') : '', fecha: g('fecha') || todayStr(), hora: g('hora'), monto: numIn(g('monto')), nota: $('[name=nota]', box).value.trim(), color, aviso: g('aviso') };
      let rec; if (id) rec = Object.assign(e, data); else { rec = Object.assign({ id: uid(), hecho: false, creado: todayStr(), origen: pre.origen || 'app' }, data); state.eventos.push(rec); }
      ui.calSel = rec.fecha; ui.calMes = rec.fecha.slice(0, 7);
      closeModal(); commit(); toast(rec.aviso === 'no' ? 'Anotado en el calendario' : 'Anotado. Te voy a ir avisando 🔔'); if (onSaved) onSaved(rec);
      pedirPermisoAvisos();
    };
    const d = $('#efDel', box); if (d) d.onclick = () => { state.eventos = state.eventos.filter((x) => x.id !== id); closeModal(); commit(); };
  });
}

// ---------- Gastos e inversión ----------
VISTAS.plata = () => {
  const m = ui.plataMes, r = resumenMes(m);
  const ms = r.movs.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const cp = state.compras.filter((c) => c.pagada && enMes(c.fechaPago || c.fecha, m));
  return `<div class="spread"><div><h1>Gastos e inversión</h1><p class="sub">${mesLbl(m)}</p></div>
    <div class="row"><input type="month" id="plataMes" value="${m}" style="width:auto"><button class="pri" data-act="movNuevo" data-id="gasto">− Gasto</button><button data-act="movNuevo" data-id="inversion">📈 Inversión</button><button data-act="movNuevo" data-id="ingreso">+ Ingreso</button></div></div>
  <div class="grid kpis"><div class="card kpi"><div class="lbl">Gastos</div><div class="val c-out">${fmtMoney(r.gastos)}</div><div class="hint">alquiler, sueldos, flete…</div></div>
    <div class="card kpi"><div class="lbl">Inversión</div><div class="val c-inv">${fmtMoney(r.inversion)}</div><div class="hint">incluye ${fmtMoney(r.comprasPagadas)} de facturas de mercadería</div></div>
    <div class="card kpi"><div class="lbl">Entró a la caja</div><div class="val c-in">${fmtMoney(r.entro)}</div><div class="hint">ventas cobradas y otros ingresos</div></div>
    <div class="card kpi"><div class="lbl">Diferencia de caja</div><div class="val ${r.entro - r.salio < 0 ? 'c-out' : ''}">${fmtMoney(r.entro - r.salio)}</div><div class="hint">entró menos salió</div></div></div>
  <h2>Movimientos del mes</h2>
  ${ms.length || cp.length ? `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th class="n">Monto</th></tr></thead><tbody>
    ${ms.map((x) => `<tr class="click" data-act="movEditar" data-id="${x.id}"><td>${fmtDateC(x.fecha)}</td><td><span class="pill ${TIPOS_MOV[x.tipo].cls}">${TIPOS_MOV[x.tipo].lbl}</span></td><td>${esc(x.concepto || x.categoria)}<div class="small muted">${esc(x.categoria)}</div></td><td class="n b ${x.tipo === 'ingreso' ? 'c-in' : 'c-out'}">${x.tipo === 'ingreso' ? '+' : '−'}${fmtMoney(x.monto)}</td></tr>`).join('')}
    ${cp.map((c) => `<tr class="click" data-act="compraVer" data-id="${c.id}"><td>${fmtDateC(c.fechaPago || c.fecha)}</td><td><span class="pill pri">Mercadería</span></td><td>Factura ${esc(c.nro || '')} ${esc(c.proveedor || '')}<div class="small muted">${pares(c.items)} unidades</div></td><td class="n b c-out">−${fmtMoney(c.total)}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">No hay movimientos este mes.</div>'}`;
};
function movForm(tipo, id, pre = {}, onSaved) {
  const x = id ? state.movimientos.find((m) => m.id === id) : Object.assign({ tipo, fecha: todayStr(), categoria: CATS[tipo][0] }, pre);
  const t = x.tipo;
  modal(`<h3>${id ? 'Editar' : 'Anotar'} ${TIPOS_MOV[t].lbl.toLowerCase()}</h3><div class="form">
    <label class="f full">¿Qué fue?<input name="concepto" value="${esc(x.concepto)}" placeholder="${t === 'gasto' ? 'Ej: Nafta de la camioneta' : t === 'inversion' ? 'Ej: Estanterías nuevas' : 'Ej: Aporte de socio'}"></label>
    <label class="f">Rubro<select name="categoria">${CATS[t].map((c) => `<option ${c === x.categoria ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label class="f">Monto<input name="monto" inputmode="decimal" value="${x.monto || ''}" placeholder="$"></label>
    <label class="f">Fecha<input type="date" name="fecha" value="${x.fecha}"></label><p class="err full" id="mvErr"></p></div>
    <div class="modal-actions">${id ? '<button class="danger izq" id="mvDel">Borrar</button>' : ''}<button data-act="close">Cancelar</button><button class="pri" id="mvOk">Guardar</button></div>`, (box) => {
    const rec = { foto: x.foto || '' };
    $('#mvOk', box).onclick = () => {
      const g = (n) => $(`[name=${n}]`, box).value.trim(); const monto = numIn(g('monto')); if (monto <= 0) return ($('#mvErr', box).textContent = 'Poné el monto.');
      const data = { tipo: t, concepto: g('concepto') || g('categoria'), categoria: g('categoria'), monto, fecha: g('fecha') || todayStr(), foto: rec.foto };
      let r; if (id) r = Object.assign(x, data); else { r = Object.assign({ id: uid(), origen: pre.origen || 'app' }, data); state.movimientos.push(r); }
      closeModal(); commit(); toast('Anotado'); if (onSaved) onSaved(r);
    };
    const d = $('#mvDel', box); if (d) d.onclick = () => { state.movimientos = state.movimientos.filter((m) => m.id !== id); closeModal(); commit(); };
  });
}

// ---------- Balance ----------
VISTAS.balance = () => {
  const m = ui.balMes, r = resumenMes(m), y = m.slice(0, 4);
  const top = {}; r.ventas.forEach((v) => v.items.forEach((i) => { const k = prodNombre(i.productoId, i.nombre); const o = top[k] || (top[k] = { n: k, pares: 0, total: 0, t: {} }); o.pares += i.cant; o.total += i.cant * i.precio; o.t[i.talle] = (o.t[i.talle] || 0) + i.cant; }));
  const tops = Object.values(top).sort((a, b) => b.total - a.total), tmax = tops.length ? tops[0].total : 1;
  const tallesV = {}; r.ventas.forEach((v) => v.items.forEach((i) => { tallesV[i.talle] = (tallesV[i.talle] || 0) + i.cant; })); const tvmax = Math.max(1, ...Object.values(tallesV));
  const anio = Array.from({ length: 12 }, (_, i) => { const mm = `${y}-${String(i + 1).padStart(2, '0')}`; return { mm, r: resumenMes(mm) }; });
  const gastosCat = {}; r.movs.filter((x) => x.tipo === 'gasto').forEach((x) => { gastosCat[x.categoria] = (gastosCat[x.categoria] || 0) + x.monto; });
  return `<div class="spread"><div><h1>Balance</h1><p class="sub">${mesLbl(m)}: cuánto se vendió, cuánto costó y cuánto quedó.</p></div><input type="month" id="balMes" value="${m}" style="width:auto"></div>
  <div class="grid kpis"><div class="card kpi"><div class="lbl">Ventas</div><div class="val">${fmtMoney(r.vendido)}</div><div class="hint">${pares(r.ventas.flatMap((v) => v.items))} unidades</div></div>
    <div class="card kpi"><div class="lbl">Ganancia neta</div><div class="val ${r.neta < 0 ? 'c-out' : 'c-in'}">${fmtMoney(r.neta)}</div><div class="hint">lo que quedó después de todo</div></div>
    <div class="card kpi"><div class="lbl">Inversión</div><div class="val c-inv">${fmtMoney(r.inversion)}</div><div class="hint">mercadería y otras compras</div></div>
    <div class="card kpi"><div class="lbl">Me deben / Debo</div><div class="val" style="font-size:18px"><span class="c-in">${fmtMoney(meDeben().reduce((s, v) => s + (+v.total || 0), 0))}</span> / <span class="c-out">${fmtMoney(debo().reduce((s, c) => s + (+c.total || 0), 0))}</span></div><div class="hint">a hoy</div></div></div>
  <div class="grid g2 mt">
    <div class="card"><h3>Estado de resultados</h3><table class="er"><tbody>
      <tr><td>Ventas</td><td class="n">${fmtMoney(r.vendido)}</td></tr>
      <tr><td>− Lo que costó esa mercadería</td><td class="n">${fmtMoney(r.cmv)}</td></tr>
      <tr class="tot"><td>Ganancia bruta</td><td class="n">${fmtMoney(r.bruta)}</td></tr>
      ${Object.entries(gastosCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<tr class="sub"><td>− ${esc(c)}</td><td class="n">${fmtMoney(v)}</td></tr>`).join('')}
      <tr><td>− Gastos</td><td class="n">${fmtMoney(r.gastos)}</td></tr>
      ${r.otrosIng ? `<tr><td>+ Otros ingresos</td><td class="n">${fmtMoney(r.otrosIng)}</td></tr>` : ''}
      <tr class="tot"><td>Ganancia neta</td><td class="n ${r.neta < 0 ? 'c-out' : 'c-in'}" style="font-size:20px">${fmtMoney(r.neta)}</td></tr></tbody></table>
      <p class="small muted">Las facturas de mercadería no son gasto: cuentan como inversión y se descuentan recién cuando vendés esas unidades.</p></div>
    <div class="card"><h3>Artículos más vendidos</h3>${tops.length ? tops.map((t) => `<div style="margin-bottom:10px"><div class="spread"><b>${esc(t.n)}</b><span>${fmtMoney(t.total)}</span></div><div class="bar"><i style="width:${(t.total / tmax * 100).toFixed(1)}%"></i></div><span class="small muted">${t.pares} unidades · talles ${Object.entries(t.t).sort().map(([k, v]) => `${k}(${v})`).join(' ')}</span></div>`).join('') : '<div class="empty">Sin ventas este mes.</div>'}
      ${Object.keys(tallesV).length ? `<h3 class="mt">Talles más vendidos</h3><div class="curva">${talles().map((t) => `<label>${t}<div class="bar" style="width:100%;height:46px;display:flex;align-items:flex-end;background:#eef1f3"><i style="width:100%;height:${((tallesV[t] || 0) / tvmax * 100).toFixed(0)}%;background:var(--acc)"></i></div><small>${tallesV[t] || 0}</small></label>`).join('')}</div>` : ''}</div>
  </div>
  <h2>Año ${y}</h2><div class="tablewrap"><table><thead><tr><th>Mes</th><th class="n">Ventas</th><th class="n">Ganancia bruta</th><th class="n">Gastos</th><th class="n">Ganancia neta</th><th class="n">Inversión</th></tr></thead><tbody>
  ${anio.map(({ mm, r: a }) => `<tr class="click" data-act="balIr" data-id="${mm}" style="${mm === m ? 'background:var(--pri2)' : ''}"><td>${MESES[+mm.slice(5) - 1]}</td><td class="n">${fmtMoney(a.vendido)}</td><td class="n">${fmtMoney(a.bruta)}</td><td class="n">${fmtMoney(a.gastos)}</td><td class="n b ${a.neta < 0 ? 'c-out' : ''}">${fmtMoney(a.neta)}</td><td class="n">${fmtMoney(a.inversion)}</td></tr>`).join('')}
  <tr class="b"><td>Total</td>${['vendido', 'bruta', 'gastos', 'neta', 'inversion'].map((k) => `<td class="n b">${fmtMoney(anio.reduce((s, x) => s + x.r[k], 0))}</td>`).join('')}</tr></tbody></table></div>`;
};

// ---------- Ajustes ----------
VISTAS.ajustes = () => {
  const c = state.config;
  return `<h1>Ajustes</h1><p class="sub">Datos del negocio (salen en los presupuestos) y opciones de la app.</p>
  <div class="card"><div class="form">
    <label class="f">Tu nombre (para el saludo)<input id="cfNom" value="${esc(miNombre())}"></label>
    <label class="f">Nombre del negocio<input id="cfNeg" value="${esc(c.negocio)}"></label>
    <label class="f">Teléfono del negocio<input id="cfTel" value="${esc(c.telefono)}"></label>
    <label class="f">Talles de calzado<input id="cfTal" value="${esc(c.talles)}" placeholder="35-45"></label>
    <label class="f">CUIT<input id="cfCuit" value="${esc(c.cuit)}" placeholder="30-12345678-9"></label>
    <label class="f">Condición frente al IVA<input id="cfIva" value="${esc(c.iva)}" placeholder="Ej: Responsable Inscripto"></label>
    <label class="f">Dirección del local<input id="cfDir" value="${esc(c.direccion)}"></label>
    <label class="f">Email del negocio<input id="cfMail" value="${esc(c.email)}"></label>
    <label class="f full">Aclaración fija al pie de los presupuestos<input id="cfPn" value="${esc(c.presuNota)}" placeholder="Ej: Precios con IVA incluido."></label>
    <label class="f">Avisarme de una muestra a los (días)<input id="cfDm" inputmode="numeric" value="${c.diasMuestra}"></label>
  </div><div class="modal-actions"><button class="pri" data-act="cfgGuardar">Guardar</button></div></div>
  <h2>☁️ Sincronización</h2>
  <div class="card">${cloud.cfg ? `<p>${esc(syncTxt())}${cloud.email ? ' · ' + esc(cloud.email) : ''}</p><div class="row">${cloud.uid ? '<button data-act="lgOut">Cerrar sesión</button>' : ''}${localStorage.getItem('firebaseConfig') ? '<button data-act="cfgCloudDel">Desconectar este dispositivo</button>' : ''}</div>`
    : `<p>Ahora los datos quedan solo en este dispositivo. Para que tu viejo, tu vieja y vos vean lo mismo en el celu y en la PC, hay que conectar Firebase (está explicado en el README del proyecto). Si ya tenés la configuración, pegala acá:</p><textarea id="cfFb" placeholder="const firebaseConfig = { apiKey: ..., projectId: ... }"></textarea><div class="modal-actions"><button class="pri" data-act="cfgCloud">Conectar</button></div>`}</div>
  <h2>💾 Respaldo</h2>
  <div class="card"><p class="small muted">${window.desktop ? 'En la PC se guarda solo una copia todos los días en Documentos / Deposito Mendoza - Respaldos.' : 'Bajá una copia de todos los datos de vez en cuando.'}</p><div class="row"><button data-act="backupBajar">⬇️ Descargar copia</button><label class="btn">⬆️ Recuperar copia<input type="file" id="cfRest" accept="application/json" class="hidden"></label>${window.desktop ? '<button data-act="backupAbrir">📂 Abrir carpeta de respaldos</button>' : ''}</div></div>
  <h2>Datos de ejemplo</h2><div class="card"><div class="row"><button data-act="cargarEjemplos">Cargar datos de ejemplo</button>${COLS.some((k) => state[k].some((x) => x.ejemplo)) ? '<button data-act="borrarEjemplos">Borrar datos de ejemplo</button>' : ''}</div></div>`;
};
VISTAS.mas = () => {
  const items = [['inicio', '🏠', 'Inicio'], ['mensaje', '💬', 'Cargar por mensaje'], ['ventas', '🛒', 'Ventas'], ['stock', '👢', 'Artículos'], ['presupuestos', '📝', 'Presupuestos'], ['muestras', '📦', 'Muestras'], ['compras', '🧾', 'Compras y facturas'], ['calendario', '📅', 'Calendario'], ['plata', '💵', 'Gastos e inversión'], ['balance', '📊', 'Balance'], ['ajustes', '⚙️', 'Ajustes']];
  return `<h1>Menú</h1><div class="mas-grid">${items.map(([v, i, l]) => `<button class="mas-it" data-act="goto" data-id="${v}"><span>${i}</span>${l}</button>`).join('')}</div><p class="small muted mt">versión ${esc(window.APP_VERSION || '')}</p>`;
};

// ---------- Acciones de pantallas ----------
Object.assign(ACTS, {
  ventaNueva: () => ventaForm(), ventaVer: (id) => ventaVer(id),
  entradaNueva: () => movStockForm('entrada'), salidaNueva: () => movStockForm('salida'),
  prodNuevo: () => prodForm(null), stockCat: (id) => { ui.stockCat = id; render(); }, prodVer: (id) => prodVer(id), prodEditar: (id) => prodForm(id),
  compraNueva: () => compraForm(null), facturaArchivo: () => elegirArchivo((a) => compraForm(null, { archivo: a, clase: 'otra' })), compraVer: (id) => compraVer(id),
  muestraNueva: () => muestraForm(), muestraVolvio: (id) => muestraVolvio(id),
  muestraVendida: (id) => { const m = state.muestras.find((x) => x.id === id); if (m) ventaForm({ cliente: m.cliente, telefono: m.telefono, items: m.items.map((i) => Object.assign({}, i, { precio: (prod(i.productoId) || {}).precio || '' })), desdeMuestra: m.id }); },
  muestraBorrar: (id) => confirmBox('Se borra la muestra y las unidades vuelven al stock.', () => { const m = state.muestras.find((x) => x.id === id); if (m && m.estado === 'afuera') moverStock(m.items, 1, 'Muestra borrada', m.id); state.muestras = state.muestras.filter((x) => x.id !== id); commit(); }, 'Borrar'),
  muestrasTab: (id) => { ui.muestrasTab = id; render(); }, ventasTab: (id) => { ui.ventasTab = id; render(); }, comprasTab: (id) => { ui.comprasTab = id; render(); },
  cobrar: (id) => { const v = state.ventas.find((x) => x.id === id); if (!v) return; v.cobrado = true; v.fechaCobro = todayStr(); if (!$('#modal').classList.contains('hidden')) closeModal(); commit(); toast(`Cobrado: ${fmtMoney(v.total)}`); },
  eventoNuevo: () => eventoForm(null), eventoEditar: (id) => eventoForm(id), prestamoNuevo: () => eventoForm(null, { tipo: 'prestamo', fecha: addDays(todayStr(), 7) }),
  eventoHecho: (id) => { const e = state.eventos.find((x) => x.id === id); if (e) { e.hecho = true; commit(); toast('Listo ✓'); } },
  calSel: (d) => { ui.calSel = d; if (d.slice(0, 7) !== ui.calMes) ui.calMes = d.slice(0, 7); render(); },
  calMov: (k) => { const d = parseD(ui.calMes + '-01'); d.setMonth(d.getMonth() + Number(k)); ui.calMes = ymd(d).slice(0, 7); render(); },
  movNuevo: (t) => movForm(t), movEditar: (id) => movForm(null, id),
  balIr: (m) => { ui.balMes = m; render(); },
  iniModelos: () => {
    [['Bolt 02', 'Marrón', 'bolt'], ['Air Fly XR 01', 'Negro', 'xr, xr01, xr 01, air fly, airfly'], ['High Boots 02', 'Marrón', 'high boots, highboots, bota, botas']].forEach(([n, c, a]) => state.productos.push({ id: uid(), nombre: n, marca: 'Ringo Work', color: c, categoria: 'Calzado', descripcion: 'Calzado de seguridad', alias: a, costo: 0, precio: 0, stockMin: 2, talles: {}, creado: todayStr() }));
    commit(); go('stock'); toast('Listo. Ahora poné los precios y el stock de cada artículo.');
  },
  cfgGuardar: () => { const c = state.config; const nom = $('#cfNom').value.trim(); c.nombres = Object.assign({}, c.nombres); if (nom) c.nombres[claveNombre()] = nom; else delete c.nombres[claveNombre()]; c.negocio = $('#cfNeg').value.trim(); c.telefono = $('#cfTel').value.trim(); c.cuit = $('#cfCuit').value.trim(); c.iva = $('#cfIva').value.trim(); c.direccion = $('#cfDir').value.trim(); c.email = $('#cfMail').value.trim(); c.presuNota = $('#cfPn').value.trim(); c.talles = $('#cfTal').value.trim() || '35-45'; c.diasMuestra = Math.max(1, Math.round(numIn($('#cfDm').value)) || 7); commit(); toast('Ajustes guardados'); },
  cfgCloud: () => { try { const c = parseFirebaseConfig($('#cfFb').value); localStorage.setItem('firebaseConfig', JSON.stringify(c)); location.reload(); } catch (e) { toast(e.message); } },
  cfgCloudDel: () => confirmBox('Este dispositivo deja de sincronizar. Los datos de la nube no se borran.', async () => { try { await window.Cloud.logout(); } catch {} localStorage.removeItem('firebaseConfig'); location.reload(); }, 'Desconectar'),
  backupBajar: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state)], { type: 'application/json' })); a.download = `deposito-mendoza-${todayStr()}.json`; a.click(); state.config.ultimoRespaldo = todayStr(); save(); },
  backupAbrir: () => window.desktop && window.desktop.openBackups(),
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'stockQ') { ui.stockQ = t.value; render(); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'ventasMes' && t.value) { ui.ventasMes = t.value; ui.ventasTab = 'todas'; render(); }
  else if (t.id === 'plataMes' && t.value) { ui.plataMes = t.value; render(); }
  else if (t.id === 'balMes' && t.value) { ui.balMes = t.value; render(); }
  else if (t.id === 'cfRest' && t.files[0]) {
    const fr = new FileReader(); fr.onload = () => { try { const d = JSON.parse(fr.result); if (!d.productos) throw new Error('El archivo no es una copia de la app.'); confirmBox('Se reemplazan todos los datos actuales por los de la copia.', () => { state = Object.assign(EMPTY(), d, { config: Object.assign(EMPTY().config, d.config || {}) }); commit(); toast('Copia recuperada'); }, 'Recuperar'); } catch (er) { toast(er.message); } }; fr.readAsText(t.files[0]);
  }
});
