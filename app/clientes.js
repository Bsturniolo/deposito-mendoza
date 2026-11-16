'use strict';
/* Clientes y cuenta corriente: ficha de cada cliente, lo que debe, pagos parciales y estado de cuenta */

ui.cliQ = '';
const cuentaDe = (key) => cuentas().porCliente[key] || null;
const ultimaCompra = (key) => ventasOk().filter((v) => cliKey(v) === key).sort(ordenFH).pop();

VISTAS.clientes = () => {
  const cs = cuentas().porCliente, anio = todayStr().slice(0, 4);
  const filas = state.clientes.map((c) => ({ key: c.id, c, nombre: c.nombre }));
  Object.values(cs).forEach((a) => { if (!a.cli && (a.debe > 0 || a.aFavor > 0)) filas.push({ key: a.key, c: null, nombre: a.nombre }); });
  const q = normCli(ui.cliQ);
  const fs = filas.filter((f) => !q || normCli([f.nombre, f.c && f.c.cuit, f.c && f.c.contacto].join(' ')).includes(q))
    .map((f) => { const a = cs[f.key] || { debe: 0, aFavor: 0 }; const u = ultimaCompra(f.key); return Object.assign(f, { debe: a.debe, aFavor: a.aFavor, ultima: u ? u.fecha : '', anio: ventasOk().filter((v) => cliKey(v) === f.key && v.fecha.startsWith(anio)).reduce((s, v) => s + (+v.total || 0), 0) }); })
    .sort((a, b) => b.debe - a.debe || a.nombre.localeCompare(b.nombre, 'es'));
  return `<div class="spread"><div><h1>Clientes</h1><p class="sub">Ficha de cada cliente y su cuenta corriente: lo que te deben y los pagos a cuenta.</p></div>
    <div class="row"><button class="acc" data-act="clienteNuevo">+ Cliente</button></div></div>
  <div class="grid kpis" style="margin-bottom:14px"><div class="card kpi"><div class="lbl">Me deben en total</div><div class="val c-in">${fmtMoney(debeTotal())}</div><div class="hint">${deudores().length} clientes con saldo</div></div>
    <div class="card kpi"><div class="lbl">Cobrado este mes</div><div class="val">${fmtMoney(cobrosOk().filter((c) => enMes(c.fecha, todayStr().slice(0, 7))).reduce((s, c) => s + (+c.monto || 0), 0))}</div><div class="hint">pagos a cuenta</div></div></div>
  <div class="row" style="margin-bottom:10px"><input id="cliQ" class="search" type="search" placeholder="Buscar por nombre, CUIT o contacto…" value="${esc(ui.cliQ)}"></div>
  ${fs.length ? `<div class="tablewrap"><table><thead><tr><th>Cliente</th><th class="opt">CUIT</th><th class="opt">Teléfono</th><th>Última compra</th><th class="n opt">Compró en ${anio}</th><th class="n">Saldo</th></tr></thead><tbody>
    ${fs.map((f) => `<tr class="click" data-act="clienteVer" data-id="${esc(f.key)}"><td><b>${esc(f.nombre)}</b>${f.c ? '' : ' <span class="pill">sin ficha</span>'}</td><td class="opt">${esc(f.c ? f.c.cuit : '')}</td><td class="opt">${esc(f.c ? f.c.telefono : '')}</td><td>${f.ultima ? fmtDateC(f.ultima) : '—'}</td><td class="n opt">${fmtMoney(f.anio)}</td><td class="n b">${f.debe > 0 ? `<span class="c-out">debe ${fmtMoney(f.debe)}</span>` : f.aFavor > 0 ? `<span class="c-in">a favor ${fmtMoney(f.aFavor)}</span>` : '<span class="muted">al día</span>'}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty">${filas.length ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes. Tocá <b>+ Cliente</b>, o se crean solos cuando vendés a cuenta.'}</div>`}`;
};
document.addEventListener('input', (e) => { if (e.target.id === 'cliQ') { ui.cliQ = e.target.value; render(); const i = $('#cliQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } });

// Movimientos de la cuenta corriente con el saldo después de cada uno (como la ficha de Milenium)
function movsCuenta(key) {
  const a = cuentaDe(key); if (!a) return [];
  const rows = [];
  a.ventas.forEach((v) => { rows.push({ fecha: v.fecha, hora: v.hora || '', txt: `Venta${v.comp ? ' · ' + compLbl(v) : ''} · ${resumenItems(v.items, 2)}`, debe: Number(v.total) || 0, haber: 0, act: 'ventaVer', id: v.id });
    if (v.cobrado) rows.push({ fecha: v.fechaCobro || v.fecha, hora: '99', txt: 'Pago (venta marcada como cobrada)', debe: 0, haber: Number(v.total) || 0, act: 'ventaVer', id: v.id }); });
  a.cobros.forEach((c) => rows.push({ fecha: c.fecha, hora: c.hora || '', txt: `Pago · ${c.medio}${c.nota ? ' · ' + c.nota : ''}`, debe: 0, haber: Number(c.monto) || 0, act: 'cobroVer', id: c.id }));
  rows.sort(ordenFH); let s = 0; rows.forEach((r) => { s += r.debe - r.haber; r.saldo = s; });
  return rows;
}
function textoCuenta(key) {
  const a = cuentaDe(key), c = cli(key), nom = c ? c.nombre : a ? a.nombre : '';
  const pend = cuentas().pend, vs = a ? a.ventas.filter((v) => pend.get(v.id) > 0) : [];
  return `Hola${nom ? ' ' + nom : ''}! Te paso el estado de tu cuenta en ${state.config.negocio} al ${fmtDate(todayStr())}:\n` +
    (vs.length ? vs.map((v) => `• ${fmtDate(v.fecha)}${v.comp ? ' · ' + compLbl(v) : ''}: ${fmtMoney(pend.get(v.id))}${pend.get(v.id) < v.total ? ' (de ' + fmtMoney(v.total) + ')' : ''}`).join('\n') + `\nSaldo: ${fmtMoney(a.debe)}` : 'No tenés saldo pendiente. ¡Gracias!');
}
function clienteVer(key) {
  const c = cli(key), a = cuentaDe(key), nombre = c ? c.nombre : a ? a.nombre : '';
  if (!c && !a) return;
  const rows = movsCuenta(key).reverse(), ult = ultimaCompra(key);
  const compras = ventasOk().filter((v) => cliKey(v) === key);
  const tel = (c && c.telefono) || (ult && ult.telefono) || '';
  modal(`<h3>👤 ${esc(nombre)}</h3><p class="sub">${c ? esc([c.cuit ? 'CUIT ' + c.cuit : '', c.condIva, c.lista ? 'Lista ' + listaNombre(c.lista) : '', c.contacto ? 'Contacto: ' + c.contacto : '', c.telefono, c.email, c.direccion].filter(Boolean).join(' · ')) || 'Ficha sin datos todavía' : 'Todavía no tiene ficha: tocá <b>Crear ficha</b> para guardar CUIT, dirección y contacto.'}${c && c.nota ? '<br>' + esc(c.nota) : ''}</p>
    <div class="grid kpis" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:12px">
      <div class="card kpi"><div class="lbl">Saldo</div><div class="val ${a && a.debe > 0 ? 'c-out' : 'c-in'}" style="font-size:22px">${a && a.debe > 0 ? fmtMoney(a.debe) : a && a.aFavor > 0 ? 'A favor ' + fmtMoney(a.aFavor) : 'Al día'}</div><div class="hint">${a && a.debe > 0 ? 'te debe' : ''}</div></div>
      <div class="card kpi"><div class="lbl">Compras</div><div class="val" style="font-size:22px">${fmtMoney(compras.reduce((s, v) => s + (+v.total || 0), 0))}</div><div class="hint">${compras.length} ventas${ult ? ' · última el ' + fmtDateC(ult.fecha) : ''}</div></div>
    </div>
    <div class="row"><button class="pri" id="clPago">💰 Registrar pago</button><button id="clVenta">🛒 Nueva venta</button>${c ? '<button id="clEd">✏️ Editar ficha</button>' : '<button id="clCrear">➕ Crear ficha</button>'}${tel || (a && a.debe) ? `<a class="btn wa" href="${waLink(tel, textoCuenta(key))}" target="_blank" rel="noopener">💬 Mandar estado de cuenta</a>` : ''}</div>
    <h2>Cuenta corriente</h2>${rows.length ? `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th class="n">Debe</th><th class="n">Pagó</th><th class="n">Saldo</th></tr></thead><tbody>${rows.map((r) => `<tr class="click" data-act="${r.act}" data-id="${r.id}"><td>${fmtDateC(r.fecha)}</td><td>${esc(r.txt)}</td><td class="n">${r.debe ? fmtMoney(r.debe) : ''}</td><td class="n c-in">${r.haber ? fmtMoney(r.haber) : ''}</td><td class="n b">${fmtMoney(r.saldo)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">Acá entran las ventas a cuenta y los pagos. Las ventas al contado no mueven la cuenta.</p>` : '<div class="empty">No tiene ventas a cuenta ni pagos.</div>'}
    <div class="modal-actions"><button data-act="close">Cerrar</button></div>`, (box) => {
    $('#clPago', box).onclick = () => cobroForm(key);
    $('#clVenta', box).onclick = () => { closeModal(); ventaForm({ cliente: nombre, clienteId: c ? c.id : '', telefono: tel, pago: 'Cuenta corriente' }); };
    const ed = $('#clEd', box); if (ed) ed.onclick = () => clienteForm(c.id);
    const cr = $('#clCrear', box); if (cr) cr.onclick = () => clienteForm(null, { nombre, telefono: tel });
  });
}
function clienteForm(id, pre = {}, onSaved) {
  const c = id ? cli(id) : Object.assign({ nombre: '', cuit: '', condIva: '', telefono: '', email: '', direccion: '', contacto: '', nota: '' }, pre);
  if (!c) return;
  const inp = (n, l, ph = '', cls = 'f') => `<label class="${cls}">${l}<input name="${n}" value="${esc(c[n])}" placeholder="${ph}"></label>`;
  modal(`<h3>${id ? 'Editar cliente' : '+ Cliente'}</h3><div class="form">
    ${inp('nombre', 'Nombre o razón social', 'Ej: Constructora Andes S.A.')}${inp('cuit', 'CUIT', '30-12345678-9')}
    <label class="f">Lista de precios<select name="lista">${listaOptions(c.lista)}</select></label>
    <label class="f">Condición frente al IVA<select name="condIva"><option value="">—</option>${COND_IVA.map((x) => `<option ${x === c.condIva ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    ${inp('contacto', 'Persona de contacto', 'Ej: Laura, compras')}${inp('telefono', 'Teléfono')}${inp('email', 'Email')}${inp('direccion', 'Dirección de entrega', '', 'f full')}${inp('nota', 'Nota', 'Ej: paga a 30 días, pide remito con orden de compra', 'f full')}</div>
    <p class="err" id="clErr"></p>
    <div class="modal-actions">${id ? '<button class="danger izq" id="clDel">Borrar ficha</button>' : ''}<button data-act="close">Cancelar</button><button class="pri" id="clOk">Guardar</button></div>`, (box) => {
    $('#clOk', box).onclick = () => {
      const g = (n) => $(`[name=${n}]`, box).value.trim(); const err = (m) => ($('#clErr', box).textContent = m);
      const data = { nombre: g('nombre'), cuit: g('cuit'), condIva: g('condIva'), contacto: g('contacto'), telefono: g('telefono'), email: g('email'), direccion: g('direccion'), nota: g('nota'), lista: g('lista') };
      if (!data.nombre) return err('Poné el nombre del cliente.');
      if (state.clientes.some((x) => x.id !== id && normCli(x.nombre) === normCli(data.nombre))) return err('Ya hay un cliente con ese nombre.');
      const cuitN = data.cuit.replace(/\D/g, ''); if (cuitN && state.clientes.some((x) => x.id !== id && String(x.cuit || '').replace(/\D/g, '') === cuitN)) return err('Ya hay un cliente con ese CUIT.');
      let rec;
      if (id) {
        if (c.nombre !== data.nombre) { registrar('Cambio de nombre', 'Cliente', c.nombre, data.nombre); const viejo = normCli(c.nombre); state.ventas.concat(state.cobros).forEach((x) => { if (!x.clienteId && normCli(x.cliente) === viejo) x.clienteId = id; if (x.clienteId === id) x.cliente = data.nombre; }); }
        rec = Object.assign(c, data);
      } else {
        rec = Object.assign({ id: uid(), creado: todayStr() }, data); state.clientes.push(rec);
        const n = normCli(rec.nombre); state.ventas.concat(state.cobros).forEach((x) => { if (!x.clienteId && normCli(x.cliente) === n) x.clienteId = rec.id; });
      }
      closeModal(); commit(); toast('Cliente guardado'); if (onSaved) onSaved(rec); else clienteVer(rec.id);
    };
    const d = $('#clDel', box); if (d) d.onclick = () => confirmBox(`Se borra la ficha de ${c.nombre}. Sus ventas y pagos quedan guardados con el nombre.`, () => { registrar('Cliente borrado', c.nombre); state.ventas.concat(state.cobros).forEach((x) => { if (x.clienteId === id) x.clienteId = ''; }); state.clientes = state.clientes.filter((x) => x.id !== id); commit(); toast('Ficha borrada'); }, 'Borrar');
  });
}
// Pago a cuenta: cualquier monto; si viene de una venta, se aplica primero a esa venta
function cobroForm(key, pre = {}) {
  const a = cuentaDe(key), c = cli(key), nombre = c ? c.nombre : a ? a.nombre : '';
  const debe = a ? a.debe : 0;
  modal(`<h3>💰 Pago de ${esc(nombre)}</h3><p class="sub">${debe > 0 ? 'Debe ' + fmtMoney(debe) + '. Puede pagar todo o una parte.' : 'No tiene saldo pendiente; el pago queda a favor.'}</p>
    <div class="form"><label class="f">Monto<input name="monto" inputmode="decimal" value="${pre.monto || debe ? fmtNum(pre.monto || debe) : ''}" style="font-weight:800;font-size:18px"></label>
    <label class="f">Fecha<input type="date" name="fecha" value="${pre.fecha || todayStr()}"></label>
    <label class="f">Cómo pagó<select name="medio">${MEDIOS_COBRO.map((m) => `<option ${m === (pre.medio || 'Transferencia') ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    <label class="f">Nota<input name="nota" value="${esc(pre.nota)}" placeholder="Ej: cheque Banco Nación N° 1234, vence 30/12"></label></div>
    <p class="err" id="cbErr"></p>
    <div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="cbOk">Guardar pago</button></div>`, (box) => {
    $('#cbOk', box).onclick = () => {
      const g = (n) => $(`[name=${n}]`, box).value.trim(); const monto = numIn(g('monto'));
      if (monto <= 0) return ($('#cbErr', box).textContent = 'Poné cuánto pagó.');
      const r = cobroNuevo({ clienteId: c ? c.id : '', cliente: nombre, monto, medio: g('medio'), fecha: g('fecha'), nota: g('nota'), ventaId: pre.ventaId });
      const queda = (cuentaDe(cliKey(r)) || {}).debe || 0;
      closeModal(); commit(); toast(`Pago guardado: ${fmtMoney(monto)}${queda > 0 ? ' · todavía debe ' + fmtMoney(queda) : ' · quedó al día'}`);
    };
  });
}
function cobroVer(id) {
  const c = state.cobros.find((x) => x.id === id); if (!c) return;
  modal(`<h3>Pago de ${esc(c.cliente || 'Sin nombre')}</h3><p class="sub">${fmtDate(c.fecha)}${c.hora ? ' ' + esc(c.hora) : ''} · ${esc(c.medio)}${c.quien ? ' · cargó ' + esc(nombreDe(c.quien)) : ''}</p>
    <p class="b" style="font-size:20px">${fmtMoney(c.monto)}</p>${c.nota ? `<p>${esc(c.nota)}</p>` : ''}
    ${c.anulado ? `<p class="anulada-box">❌ Pago anulado el ${fmtDate(c.fechaAnulado)}${c.motivoAnulado ? ': ' + esc(c.motivoAnulado) : ''}.</p>` : ''}
    <div class="modal-actions">${c.anulado ? '' : '<button class="danger izq" id="cbAn">Anular pago</button>'}<button data-act="close">Cerrar</button></div>`, (box) => {
    const an = $('#cbAn', box); if (an) an.onclick = () => modal(`<h3>Anular pago</h3><p>El pago no se borra: queda anulado y lo que pagó vuelve a la deuda.</p><div class="form"><label class="f full">Motivo<input id="cbMot" placeholder="Ej: el cheque vino rechazado"></label></div>
      <div class="modal-actions"><button data-act="close">Cancelar</button><button class="danger" id="cbAnOk">Anular pago</button></div>`, (b2) => {
      $('#cbAnOk', b2).onclick = () => { anularCobro(id, $('#cbMot', b2).value.trim()); closeModal(); commit(); toast('Pago anulado'); };
    });
  });
}
function anularCobro(id, motivo) {
  const c = state.cobros.find((x) => x.id === id); if (!c || c.anulado) return;
  Object.assign(c, { anulado: true, fechaAnulado: todayStr(), motivoAnulado: motivo || '' });
  registrar('Pago anulado', `${c.cliente || 'Sin nombre'} · ${c.medio} · ${fmtDate(c.fecha)}${motivo ? ' · ' + motivo : ''}`, fmtMoney(c.monto), '');
}
