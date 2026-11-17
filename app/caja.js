'use strict';
/* Caja del día: se abre con el efectivo que hay, junta lo que entró y salió por cada medio de pago
   y se cierra contando el efectivo. Como la caja por turno de Milenium, pero de a un día. */

const cajaDe = (fecha) => state.cajas.find((c) => c.fecha === fecha && !c.anulada);
const sinDato = (m) => m || 'Sin dato';
function movsDia(fecha) {
  const ent = [], sal = [];
  ventasOk().filter((v) => v.fecha === fecha && v.pago !== 'Cuenta corriente').forEach((v) => {
    const partes = v.pago === 'Mixto' && Array.isArray(v.pagos) ? v.pagos : [{ medio: v.pago, monto: v.total }];
    partes.forEach((p) => ent.push({ hora: v.hora || '', medio: p.medio, monto: Number(p.monto) || 0, txt: `Venta${v.cliente ? ' · ' + v.cliente : ''}`, act: 'ventaVer', id: v.id }));
  });
  ventasOk().filter((v) => v.pago === 'Cuenta corriente' && v.cobrado && v.fechaCobro === fecha).forEach((v) => ent.push({ hora: '', medio: 'Sin dato', monto: Number(v.total) || 0, txt: `Cobro · ${v.cliente || 'Sin nombre'}`, act: 'ventaVer', id: v.id }));
  cobrosOk().filter((c) => c.fecha === fecha).forEach((c) => ent.push({ hora: c.hora || '', medio: c.medio, monto: (Number(c.monto) || 0) - (Number(c.retencion) || 0), txt: `Pago a cuenta · ${c.cliente || 'Sin nombre'}${c.nota ? ' · ' + c.nota : ''}`, act: 'cobroVer', id: c.id }));
  state.movimientos.filter((x) => x.fecha === fecha).forEach((x) => (x.tipo === 'ingreso' ? ent : sal).push({ hora: '', medio: sinDato(x.medio), monto: Number(x.monto) || 0, txt: `${TIPOS_MOV[x.tipo].lbl} · ${x.concepto || x.categoria}`, act: 'movEditar', id: x.id }));
  state.compras.forEach((c) => pagosDe(c).filter((p) => p.fecha === fecha).forEach((p) => sal.push({ hora: '', medio: sinDato(p.medio), monto: Number(p.monto) || 0, txt: `Pago de factura ${nomFactura(c)}`, act: 'compraVer', id: c.id })));
  return { ent, sal };
}
function resumenCaja(fecha) {
  const c = cajaDe(fecha), { ent, sal } = movsDia(fecha), medios = {};
  ent.forEach((x) => { const o = medios[x.medio] || (medios[x.medio] = { ent: 0, sal: 0 }); o.ent += x.monto; });
  sal.forEach((x) => { const o = medios[x.medio] || (medios[x.medio] = { ent: 0, sal: 0 }); o.sal += x.monto; });
  const extra = (c && c.movs || []).reduce((s, m) => s + (m.tipo === 'retiro' ? -1 : 1) * (Number(m.monto) || 0), 0);
  const ef = medios.Efectivo || { ent: 0, sal: 0 };
  const esperado = (c ? Number(c.inicial) || 0 : 0) + ef.ent - ef.sal + extra;
  return { c, ent, sal, medios, extra, esperado };
}

ui.cajaFecha = todayStr();
VISTAS.caja = () => {
  const f = ui.cajaFecha, r = resumenCaja(f), c = r.c, hoy = f === todayStr();
  const estado = !c ? (hoy ? 'Sin abrir' : 'No se abrió') : c.cerrada ? 'Cerrada' : 'Abierta';
  const filas = r.ent.map((x) => Object.assign({ s: 1 }, x)).concat(r.sal.map((x) => Object.assign({ s: -1 }, x))).concat((c && c.movs || []).map((m) => ({ s: m.tipo === 'retiro' ? -1 : 1, hora: m.hora, medio: 'Efectivo', monto: m.monto, txt: (m.tipo === 'retiro' ? 'Retiro de caja' : 'Ingreso a caja') + (m.concepto ? ' · ' + m.concepto : '') })))
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  const hist = state.cajas.filter((x) => !x.anulada).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 15);
  return `<div class="spread"><div><h1>Caja del día</h1><p class="sub">${parseD(f).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · <b>${estado}</b>${c && c.cerrada ? ' por ' + esc(nombreDe(c.cerradaPor)) + ' a las ' + esc(c.horaCierre) : c ? ' por ' + esc(nombreDe(c.abiertaPor)) + ' a las ' + esc(c.horaApertura) : ''}</p></div>
    <div class="row"><input type="date" id="cajaFecha" value="${f}" style="width:auto">${!c && hoy ? '<button class="pri" data-act="cajaAbrir">Abrir caja</button>' : ''}${c && !c.cerrada ? '<button data-act="cajaMov" data-id="retiro">− Retiro</button><button data-act="cajaMov" data-id="ingreso">+ Ingreso</button><button class="pri" data-act="cajaCerrar">Cerrar caja</button>' : ''}${c && c.cerrada ? '<button data-act="cajaReabrir">Reabrir</button>' : ''}</div></div>
  <div class="grid kpis"><div class="card kpi"><div class="lbl">Efectivo al abrir</div><div class="val">${c ? fmtMoney(c.inicial) : '—'}</div></div>
    <div class="card kpi"><div class="lbl">Efectivo que tendría que haber</div><div class="val">${fmtMoney(r.esperado)}</div><div class="hint">apertura + entradas − salidas en efectivo</div></div>
    ${c && c.cerrada ? `<div class="card kpi"><div class="lbl">Efectivo contado</div><div class="val">${fmtMoney(c.contado)}</div><div class="hint ${c.contado - c.esperado ? 'c-out' : 'c-in'}">${c.contado - c.esperado ? (c.contado > c.esperado ? 'sobran ' : 'faltan ') + fmtMoney(Math.abs(c.contado - c.esperado)) : 'cerró justo'}</div></div>` : ''}
    <div class="card kpi"><div class="lbl">Entró en total</div><div class="val c-in">${fmtMoney(r.ent.reduce((s, x) => s + x.monto, 0))}</div><div class="hint">todos los medios</div></div></div>
  <h2>Por medio de pago</h2>${Object.keys(r.medios).length ? `<div class="tablewrap"><table><thead><tr><th>Medio</th><th class="n">Entró</th><th class="n">Salió</th><th class="n">Neto</th></tr></thead><tbody>${Object.entries(r.medios).sort((a, b) => (b[1].ent - b[1].sal) - (a[1].ent - a[1].sal)).map(([m, o]) => `<tr><td>${esc(m)}</td><td class="n c-in">${fmtMoney(o.ent)}</td><td class="n c-out">${o.sal ? fmtMoney(o.sal) : ''}</td><td class="n b">${fmtMoney(o.ent - o.sal)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No hubo movimientos de plata este día.</div>'}
  ${filas.length ? `<h2>Movimientos</h2><div class="tablewrap"><table><thead><tr><th>Hora</th><th>Qué</th><th>Medio</th><th class="n">Monto</th></tr></thead><tbody>${filas.map((x) => `<tr${x.act ? ` class="click" data-act="${x.act}" data-id="${x.id}"` : ''}><td>${esc(x.hora || '')}</td><td>${esc(x.txt)}</td><td>${esc(x.medio)}</td><td class="n b ${x.s > 0 ? 'c-in' : 'c-out'}">${x.s > 0 ? '+' : '−'}${fmtMoney(x.monto)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  ${c && c.nota ? `<p class="small muted">Nota del cierre: ${esc(c.nota)}</p>` : ''}
  <h2>Cajas anteriores</h2>${hist.length ? `<div class="tablewrap"><table><thead><tr><th>Día</th><th class="n">Apertura</th><th class="n">Tendría que haber</th><th class="n">Contado</th><th class="n">Diferencia</th><th>Quién cerró</th></tr></thead><tbody>${hist.map((x) => `<tr class="click" data-act="cajaIr" data-id="${x.fecha}"><td>${fmtDateC(x.fecha)}</td><td class="n">${fmtMoney(x.inicial)}</td><td class="n">${x.cerrada ? fmtMoney(x.esperado) : '—'}</td><td class="n">${x.cerrada ? fmtMoney(x.contado) : '<span class="pill warn">abierta</span>'}</td><td class="n b ${x.cerrada && x.contado - x.esperado ? 'c-out' : ''}">${x.cerrada ? fmtMoney(x.contado - x.esperado) : ''}</td><td>${x.cerrada ? esc(nombreDe(x.cerradaPor)) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Todavía no se cerró ninguna caja.</div>'}
  <p class="small muted mt">Para que la caja cierre bien, anotá los gastos con "cómo se pagó" y los pagos de clientes y proveedores con su medio. Lo que figura como "Sin dato" son movimientos viejos que no tenían el medio cargado.</p>`;
};
Object.assign(ACTS, {
  cajaIr: (f) => { ui.cajaFecha = f; render(); },
  cajaAbrir: () => {
    const ult = state.cajas.filter((x) => x.cerrada && !x.anulada).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    modal(`<h3>Abrir caja</h3><p class="sub">¿Cuánto efectivo hay en la caja al empezar el día?</p><div class="form"><label class="f">Efectivo inicial<input id="caIni" inputmode="decimal" value="${ult ? fmtNum(ult.contado) : ''}" placeholder="$"></label></div>
      ${ult ? `<p class="small muted">Propuesto: lo que se contó al cerrar el ${fmtDate(ult.fecha)}.</p>` : ''}<div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="caOk">Abrir caja</button></div>`, (box) => {
      $('#caOk', box).onclick = () => {
        if (cajaDe(todayStr())) { closeModal(); return; }
        state.cajas.push({ id: uid(), fecha: todayStr(), inicial: numIn($('#caIni', box).value), horaApertura: new Date().toTimeString().slice(0, 5), abiertaPor: quienSoy(), movs: [], cerrada: false });
        ui.cajaFecha = todayStr(); closeModal(); commit(); toast('Caja abierta');
      };
    });
  },
  cajaMov: (tipo) => {
    const c = cajaDe(ui.cajaFecha); if (!c || c.cerrada) return;
    modal(`<h3>${tipo === 'retiro' ? '− Retiro de efectivo' : '+ Ingreso de efectivo'}</h3><p class="sub">${tipo === 'retiro' ? 'Plata que se saca de la caja y no es un gasto (ej: la lleva el dueño, se deposita en el banco).' : 'Plata que se pone en la caja (ej: cambio).'}</p>
      <div class="form"><label class="f">Monto<input id="cmM" inputmode="decimal" placeholder="$"></label><label class="f">Motivo<input id="cmC" placeholder="${tipo === 'retiro' ? 'Ej: depósito en el banco' : 'Ej: cambio'}"></label></div><p class="err" id="cmErr"></p>
      <div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="cmOk">Guardar</button></div>`, (box) => {
      $('#cmOk', box).onclick = () => { const m = numIn($('#cmM', box).value); if (m <= 0) return ($('#cmErr', box).textContent = 'Poné el monto.'); c.movs = (c.movs || []).concat({ id: uid(), hora: new Date().toTimeString().slice(0, 5), tipo, monto: m, concepto: $('#cmC', box).value.trim(), quien: quienSoy() }); registrar(tipo === 'retiro' ? 'Retiro de caja' : 'Ingreso a caja', $('#cmC', box).value.trim(), '', fmtMoney(m)); closeModal(); commit(); };
    });
  },
  cajaCerrar: () => {
    const r = resumenCaja(ui.cajaFecha), c = r.c; if (!c || c.cerrada) return;
    modal(`<h3>Cerrar caja</h3><p class="sub">Contá el efectivo y anotalo. Según lo cargado tendría que haber <b>${fmtMoney(r.esperado)}</b>.</p>
      <div class="form"><label class="f">Efectivo contado<input id="ccC" inputmode="decimal" placeholder="$" style="font-weight:800;font-size:18px"></label><label class="f full">Nota (opcional)<input id="ccN" placeholder="Ej: faltan $500 de un vuelto"></label></div>
      <p class="b" id="ccDif"></p><p class="err" id="ccErr"></p><div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="ccOk">Cerrar caja</button></div>`, (box) => {
      const dif = () => { const v = $('#ccC', box).value.trim(); if (!v) { $('#ccDif', box).textContent = ''; return; } const d = numIn(v) - r.esperado; $('#ccDif', box).textContent = d ? (d > 0 ? 'Sobran ' : 'Faltan ') + fmtMoney(Math.abs(d)) : 'Cierra justo ✓'; };
      $('#ccC', box).oninput = dif;
      $('#ccOk', box).onclick = () => {
        if (!$('#ccC', box).value.trim()) return ($('#ccErr', box).textContent = 'Poné cuánto efectivo contaste.');
        Object.assign(c, { cerrada: true, contado: numIn($('#ccC', box).value), esperado: r.esperado, horaCierre: new Date().toTimeString().slice(0, 5), cerradaPor: quienSoy(), nota: $('#ccN', box).value.trim() });
        registrar('Cierre de caja', fmtDate(c.fecha) + (c.nota ? ' · ' + c.nota : ''), 'tendría que haber ' + fmtMoney(c.esperado), 'contado ' + fmtMoney(c.contado));
        closeModal(); commit(); toast(c.contado === c.esperado ? 'Caja cerrada justa ✓' : 'Caja cerrada · diferencia ' + fmtMoney(c.contado - c.esperado));
      };
    });
  },
  cajaReabrir: () => { const c = cajaDe(ui.cajaFecha); if (!c) return; confirmBox('La caja vuelve a quedar abierta para corregir algo y cerrarla de nuevo.', () => { registrar('Caja reabierta', fmtDate(c.fecha), 'contado ' + fmtMoney(c.contado), ''); c.cerrada = false; commit(); }, 'Reabrir'); },
});
document.addEventListener('change', (e) => { if (e.target.id === 'cajaFecha' && e.target.value) { ui.cajaFecha = e.target.value; render(); } });
