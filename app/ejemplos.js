'use strict';
/* Datos de ejemplo para probar la app. Se marcan con ejemplo:true y se pueden borrar de una. */
function cargarEjemplos() {
  const hoy = todayStr(), d = (k) => addDays(hoy, k);
  const mk = (nombre, color, alias, costo, precio, curva) => {
    let p = state.productos.find((x) => x.nombre === nombre);
    if (!p) { p = { id: uid(), nombre, marca: 'Ringo Work', color, tipo: 'Calzado de seguridad', alias, costo, precio, stockMin: 2, talles: {}, creado: hoy, ejemplo: true }; state.productos.push(p); }
    else { if (!p.costo) p.costo = costo; if (!p.precio) p.precio = precio; }
    const items = Object.entries(curva).map(([t, n]) => ({ productoId: p.id, talle: t, cant: n }));
    moverStock(items, 1, 'Stock de ejemplo', 'ejemplo', d(-20));
    state.stockMovs.forEach((m) => { if (m.ref === 'ejemplo') m.ejemplo = true; });
    return p;
  };
  const bolt = mk('Bolt 02', 'Marrón', 'bolt', 38000, 62000, { 38: 3, 39: 5, 40: 8, 41: 10, 42: 9, 43: 6, 44: 2, 45: 1 });
  const xr = mk('Air Fly XR 01', 'Negro', 'xr, xr01, xr 01, air fly, airfly', 46000, 75000, { 36: 2, 37: 3, 38: 4, 39: 6, 40: 7, 41: 7, 42: 5, 43: 3, 44: 0, 45: 1 });
  const hb = mk('High Boots 02', 'Marrón', 'high boots, highboots, bota, botas', 52000, 86000, { 39: 2, 40: 4, 41: 5, 42: 6, 43: 3, 44: 1 });
  const venta = (k, cliente, pago, items) => { const its = items.map(([p, t, n]) => ({ productoId: p.id, nombre: p.nombre, talle: String(t), cant: n, precio: p.precio, costo: p.costo })); const v = { id: uid(), fecha: d(k), hora: '11:00', cliente, telefono: '', pago, cobrado: pago !== 'Cuenta corriente', items: its, total: its.reduce((s, i) => s + i.cant * i.precio, 0), nota: '', origen: 'app', ejemplo: true }; moverStock(its, -1, 'Venta a ' + cliente, v.id, v.fecha); state.ventas.push(v); };
  venta(-12, 'Constructora Andes', 'Transferencia', [[bolt, 41, 4], [bolt, 42, 3], [xr, 40, 2]]);
  venta(-8, 'Bodega Los Álamos', 'Cuenta corriente', [[hb, 42, 2], [hb, 43, 1]]);
  venta(-5, 'Juan Pérez', 'Efectivo', [[bolt, 43, 1]]);
  venta(-2, 'Metalúrgica Cuyo', 'Transferencia', [[xr, 41, 3], [xr, 42, 2], [bolt, 40, 2]]);
  venta(0, 'Ferretería San Martín', 'Efectivo', [[bolt, 42, 2]]);
  const mu = (k, cliente, items) => { const its = items.map(([p, t]) => ({ productoId: p.id, nombre: p.nombre, talle: String(t), cant: 1 })); const m = { id: uid(), fecha: d(k), cliente, telefono: '', items: its, nota: '', estado: 'afuera', origen: 'app', ejemplo: true }; moverStock(its, -1, 'Muestra a ' + cliente, m.id, m.fecha); state.muestras.push(m); };
  mu(-15, 'Minera Uspallata', [[hb, 42], [xr, 42]]);
  mu(-3, 'Obra Godoy Cruz', [[bolt, 41]]);
  state.compras.push({ id: uid(), fecha: d(-18), proveedor: 'Ringo Work', nro: 'A-0004-00018233', items: [{ productoId: xr.id, nombre: xr.nombre, talle: '41', cant: 6, costo: xr.costo }], total: 6 * xr.costo, pagada: false, fechaPago: '', vence: d(5), origen: 'app', ejemplo: true });
  state.eventos.push({ id: uid(), fecha: d(5), titulo: 'Pagar factura A-0004-00018233 a Ringo Work', tipo: 'pagar', monto: 6 * xr.costo, hecho: false, ejemplo: true });
  state.eventos.push({ id: uid(), fecha: d(1), hora: '10:00', titulo: 'Visitar obra de Constructora Andes', tipo: 'visita', monto: 0, hecho: false, ejemplo: true });
  [['gasto', 'Alquiler del depósito', 'Alquiler', 350000, -10], ['gasto', 'Nafta camioneta', 'Flete y combustible', 45000, -4], ['inversion', 'Estanterías nuevas', 'Equipamiento', 180000, -9]].forEach(([tipo, concepto, categoria, monto, k]) => state.movimientos.push({ id: uid(), tipo, concepto, categoria, monto, fecha: d(k), ejemplo: true }));
  state.stockMovs.forEach((m) => { if (!m.ejemplo && [...state.ventas, ...state.muestras].some((x) => x.ejemplo && x.id === m.ref)) m.ejemplo = true; });
  commit(); go('inicio'); toast('Listo: cargué datos de ejemplo para que pruebes');
}
function borrarEjemplos() {
  // los modelos de ejemplo se borran; a los modelos propios se les descuenta lo que sumaron los ejemplos
  state.stockMovs.filter((m) => m.ejemplo).forEach((m) => { const p = prod(m.productoId); if (p && !p.ejemplo) p.talles[m.talle] = stockT(p, m.talle) - m.cant; });
  COLS.forEach((c) => { state[c] = state[c].filter((x) => !x.ejemplo); });
  commit(); toast('Datos de ejemplo borrados');
}
Object.assign(ACTS, {
  cargarEjemplos: () => confirmBox('Se cargan ventas, muestras, una factura y gastos de ejemplo para que veas cómo funciona. Después los borrás con un botón.', cargarEjemplos, 'Cargar ejemplos'),
  borrarEjemplos: () => confirmBox('Se borran todos los datos de ejemplo. Lo que cargaste vos queda.', borrarEjemplos, 'Borrar ejemplos'),
});
