'use strict';
/* Archivos adjuntos (fotos o PDF de facturas). Se guardan junto con los demás datos,
   así no se pierden y se ven desde el celular y la compu. Las fotos se achican solas. */

const MAX_PDF = 700 * 1024; // lo que entra en un registro de la nube
const mb = (n) => (n / 1048576).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' MB';

function leerArchivo(file) { // -> Promise<{ nombre, tipo, data }>
  return new Promise((res, rej) => {
    if (!file) return rej(new Error('No se eligió ningún archivo.'));
    const esImg = /^image\//.test(file.type);
    if (!esImg) {
      if (file.size > MAX_PDF) return rej(new Error(`Ese archivo pesa ${mb(file.size)} y por ahora entran hasta 0,7 MB. Sacale una foto a la factura y cargá la foto.`));
      const fr = new FileReader();
      fr.onload = () => res({ nombre: file.name, tipo: file.type || 'application/octet-stream', data: fr.result });
      fr.onerror = () => rej(new Error('No se pudo leer el archivo.'));
      fr.readAsDataURL(file); return;
    }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      let data = '';
      for (const [lado, q] of [[1600, 0.75], [1280, 0.65], [1000, 0.55]]) {
        const k = Math.min(1, lado / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        data = c.toDataURL('image/jpeg', q);
        if (data.length < 900000) break;
      }
      URL.revokeObjectURL(url);
      res({ nombre: file.name.replace(/\.\w+$/, '') + '.jpg', tipo: 'image/jpeg', data });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo abrir esa foto.')); };
    img.src = url;
  });
}
function archivoGuardar(a, ref) { const id = uid(); state.archivos.push({ id, nombre: a.nombre, tipo: a.tipo, data: a.data, ref: ref || '', fecha: todayStr() }); return id; }
const archivo = (id) => state.archivos.find((x) => x.id === id);
function archivoBorrar(id) { state.archivos = state.archivos.filter((x) => x.id !== id); }
function archivoBlobUrl(a) {
  const [cab, b64] = a.data.split(','); const bin = atob(b64); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([u8], { type: (cab.match(/data:([^;]+)/) || [])[1] || a.tipo }));
}
function archivoHTML(id) {
  const a = archivo(id);
  if (!a) return '<p class="small muted">El archivo todavía se está bajando en este dispositivo. Probá en un ratito.</p>';
  const img = /^image\//.test(a.tipo);
  return `<div class="adj">${img ? `<img src="${a.data}" alt="Factura" data-act="archivoAbrir" data-id="${a.id}">` : `<div class="adj-pdf">📄 ${esc(a.nombre)}</div>`}
    <div class="row mt"><button class="sm" data-act="archivoAbrir" data-id="${a.id}">${img ? '🔍 Ver grande' : '📄 Abrir'}</button><button class="sm" data-act="archivoBajar" data-id="${a.id}">⬇️ Descargar</button></div></div>`;
}
// Campo para elegir archivo dentro de un formulario. dest.archivo queda con lo elegido.
function campoArchivo(box, dest) {
  const inp = $('.adj-in', box), info = $('.adj-info', box); if (!inp) return;
  const pinta = () => { info.innerHTML = dest.archivo ? `📎 ${esc(dest.archivo.nombre)} <button type="button" class="sm adj-x">Quitar</button>` : ''; const x = $('.adj-x', box); if (x) x.onclick = () => { dest.archivo = null; inp.value = ''; pinta(); }; };
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; info.textContent = 'Preparando el archivo…'; leerArchivo(f).then((a) => { dest.archivo = a; pinta(); }).catch((e) => { dest.archivo = null; inp.value = ''; info.innerHTML = `<span class="c-out">${esc(e.message)}</span>`; }); };
  pinta();
}
const campoArchivoHTML = (lbl) => `<div class="f full"><label class="f">${lbl || 'Foto o PDF de la factura'}</label><input type="file" class="adj-in" accept="image/*,application/pdf"><div class="adj-info small"></div></div>`;
function elegirArchivo(onOk) { // abre el selector de archivos directamente
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,application/pdf';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; toast('Preparando el archivo…'); leerArchivo(f).then(onOk).catch((e) => toast('⚠️ ' + e.message)); };
  inp.click();
}
Object.assign(ACTS, {
  archivoAbrir: (id) => {
    const a = archivo(id); if (!a) return;
    if (/^image\//.test(a.tipo)) { const v = document.createElement('div'); v.className = 'visor'; v.innerHTML = `<img src="${a.data}" alt="Factura">`; v.onclick = () => v.remove(); document.body.appendChild(v); return; }
    const url = archivoBlobUrl(a); const w = window.open(url, '_blank'); if (!w) ACTS.archivoBajar(id); setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
  archivoBajar: (id) => { const a = archivo(id); if (!a) return; const url = archivoBlobUrl(a); const l = document.createElement('a'); l.href = url; l.download = a.nombre || 'factura'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); },
});
