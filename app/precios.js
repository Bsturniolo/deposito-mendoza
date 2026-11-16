'use strict';
/* Listas de precios (público, mayorista, empresa...), subas por porcentaje, historial de precios e IVA */

const IVA = 0.21;
const LISTAS_DEF = [{ id: 'mayorista', nombre: 'Mayorista', desc: 0 }, { id: 'empresa', nombre: 'Empresa', desc: 0 }];
const listas = () => (Array.isArray(state.config.listas) ? state.config.listas : LISTAS_DEF);
const listaNombre = (id) => (!id ? 'Público' : (listas().find((l) => l.id === id) || {}).nombre || 'Público');
// Precio de un artículo en una lista: el precio fijo que se le cargó, o el de público con el descuento de la lista
function precioLista(p, lid) {
  if (!p) return 0;
  const base = Number(p.precio) || 0; if (!lid) return base;
  const fijo = Number((p.precios || {})[lid]) || 0; if (fijo) return fijo;
  const l = listas().find((x) => x.id === lid); if (!l || !Number(l.desc)) return base;
  return Math.round(base * (1 - Number(l.desc) / 100) / 10) * 10;
}
const listaOptions = (sel) => `<option value="">Público</option>${listas().map((l) => `<option value="${esc(l.id)}" ${l.id === sel ? 'selected' : ''}>${esc(l.nombre)}${Number(l.desc) ? ` (−${fmtNum(l.desc)}%)` : ''}</option>`).join('')}`;
// IVA: los precios se cargan con IVA incluido salvo que en Ajustes digan lo contrario
const conIva = () => state.config.preciosSinIva !== true;
const ivaTxt = (n) => { n = Number(n) || 0; if (!n) return ''; return conIva() ? `sin IVA ${fmtMoney(n / (1 + IVA))}` : `con IVA ${fmtMoney(n * (1 + IVA))}`; };

// Historial de precio y costo de cada artículo (queda guardado en el artículo)
function anotarPrecio(p, campo, antes, despues, motivo) {
  antes = Number(antes) || 0; despues = Number(despues) || 0; if (antes === despues) return;
  p.precioHist = (p.precioHist || []).concat({ fecha: todayStr(), campo, antes, despues, motivo: motivo || '', quien: quienSoy() }).slice(-60);
}
function precioHistHTML(p) {
  const h = (p.precioHist || []).slice().reverse().slice(0, 12);
  if (!h.length) return '';
  const lbl = { precio: 'Precio', costo: 'Costo' };
  return `<h2>Historial de precios</h2><div class="list">${h.map((x) => `<div class="li"><div class="m"><b>${lbl[x.campo] || listaNombre(x.campo.replace(/^lista:/, ''))}: ${fmtMoney(x.antes)} → ${fmtMoney(x.despues)}</b><span>${fmtDate(x.fecha)}${x.motivo ? ' · ' + esc(x.motivo) : ''}${x.quien ? ' · ' + esc(nombreDe(x.quien)) : ''}</span></div><div class="s"><span class="pill ${x.despues > x.antes ? 'in' : 'out'}">${x.antes ? (x.despues > x.antes ? '+' : '') + Math.round((x.despues - x.antes) / x.antes * 100) + '%' : 'nuevo'}</span></div></div>`).join('')}</div>`;
}

// Suba (o baja) de precios por porcentaje, para todos o una categoría
function subirPreciosForm() {
  const cats = [...new Set(state.productos.filter((p) => !p.archivado).map(catDe))].sort((a, b) => a.localeCompare(b, 'es'));
  modal(`<h3>📈 Subir precios</h3><p class="sub">Sube el precio de venta de un grupo de artículos por un porcentaje. Para bajar, poné el número en negativo.</p>
    <div class="form"><label class="f">Porcentaje<input id="spPct" inputmode="decimal" placeholder="Ej: 10"></label>
    <label class="f">Qué artículos<select id="spCat"><option value="">Todos</option>${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
    <label class="chk full"><input type="checkbox" id="spCosto"> Subir también el costo (si te aumentó el proveedor)</label>
    <label class="chk full"><input type="checkbox" id="spRed" checked> Redondear a los $100</label></div>
    <p class="small muted" id="spPrev"></p><p class="err" id="spErr"></p>
    <div class="modal-actions"><button data-act="close">Cancelar</button><button class="pri" id="spOk">Aplicar</button></div>`, (box) => {
    const leer = () => { const pct = numIn($('#spPct', box).value), cat = $('#spCat', box).value; const ps = state.productos.filter((p) => !p.archivado && (!cat || catDe(p) === cat) && Number(p.precio)); return { pct, cat, ps, costo: $('#spCosto', box).checked, red: $('#spRed', box).checked }; };
    const nuevo = (n, o) => { const x = n * (1 + o.pct / 100); return o.red ? Math.round(x / 100) * 100 : Math.round(x); };
    const prev = () => { const o = leer(); const p = o.ps[0]; $('#spPrev', box).textContent = o.pct && p ? `${o.ps.length} artículos. Ej: ${p.nombre} pasa de ${fmtMoney(p.precio)} a ${fmtMoney(nuevo(p.precio, o))}.` : ''; };
    ['#spPct', '#spCat', '#spCosto', '#spRed'].forEach((s) => { $(s, box).oninput = prev; $(s, box).onchange = prev; }); // en los campos: la caja del modal se reusa
    $('#spOk', box).onclick = () => {
      const o = leer(); if (!o.pct) return ($('#spErr', box).textContent = 'Poné el porcentaje.'); if (!o.ps.length) return ($('#spErr', box).textContent = 'No hay artículos con precio en ese grupo.');
      const mot = `Suba ${o.pct > 0 ? '+' : ''}${fmtNum(o.pct)}%`;
      o.ps.forEach((p) => {
        const n = nuevo(p.precio, o); anotarPrecio(p, 'precio', p.precio, n, mot); p.precio = n;
        Object.keys(p.precios || {}).forEach((lid) => { if (Number(p.precios[lid])) { const m = nuevo(p.precios[lid], o); anotarPrecio(p, 'lista:' + lid, p.precios[lid], m, mot); p.precios[lid] = m; } });
        if (o.costo && Number(p.costo)) { const c = nuevo(p.costo, Object.assign({}, o, { red: false })); anotarPrecio(p, 'costo', p.costo, c, mot); p.costo = c; }
      });
      registrar('Suba de precios', `${o.cat || 'Todos los artículos'} · ${o.ps.length} artículos${o.costo ? ' · también el costo' : ''}`, '', mot);
      closeModal(); commit(); toast(`Precios actualizados: ${o.ps.length} artículos`);
    };
  });
}

// Ajustes: listas de precios
function listasHTML() {
  const ls = listas();
  return `<p class="small muted">El precio que cargás en cada artículo es el de <b>público</b>. Cada lista puede tener un descuento sobre ese precio, y en cada artículo podés fijarle un precio distinto por lista. A cada cliente le asignás su lista en la ficha.</p>
    <div class="form" id="lsF">${ls.map((l, i) => `<label class="f">Lista ${i + 1}<input data-ls="nombre" data-i="${i}" value="${esc(l.nombre)}"></label><label class="f">Descuento sobre público (%)<input data-ls="desc" data-i="${i}" inputmode="decimal" value="${Number(l.desc) ? fmtNum(l.desc) : ''}" placeholder="0"></label>`).join('')}
    <label class="f">Lista nueva (opcional)<input data-ls="nombre" data-i="${ls.length}" placeholder="Ej: Ferreterías"></label><label class="f">Descuento (%)<input data-ls="desc" data-i="${ls.length}" inputmode="decimal" placeholder="0"></label>
    <label class="chk full"><input type="checkbox" id="lsSinIva" ${conIva() ? '' : 'checked'}> Los precios que cargo son <b>sin IVA</b> (si no lo tildás, se toman con IVA incluido)</label></div>
    <div class="modal-actions"><button class="pri" data-act="listasGuardar">Guardar listas</button></div>`;
}
ACTS.listasGuardar = () => {
  const ls = listas(), out = [];
  const val = (k, i) => { const el = $(`#lsF [data-ls=${k}][data-i="${i}"]`); return el ? el.value.trim() : ''; };
  for (let i = 0; i <= ls.length; i++) {
    const nombre = val('nombre', i); if (!nombre) continue;
    const desc = Math.max(0, Math.min(90, numIn(val('desc', i))));
    const id = ls[i] ? ls[i].id : normCli(nombre).replace(/[^a-z0-9]+/g, '-') + '-' + uid().slice(-4);
    if (ls[i] && (Number(ls[i].desc) || 0) !== desc) registrar('Cambio de lista de precios', nombre, (Number(ls[i].desc) || 0) + '%', desc + '%');
    out.push({ id, nombre, desc });
  }
  state.config.listas = out;
  const sinIva = $('#lsSinIva').checked; if (sinIva !== !conIva()) registrar('Cambio de IVA en precios', '', conIva() ? 'con IVA' : 'sin IVA', sinIva ? 'sin IVA' : 'con IVA');
  state.config.preciosSinIva = sinIva;
  commit(); toast('Listas guardadas');
};
ACTS.subirPrecios = () => subirPreciosForm();
