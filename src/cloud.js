// Capa de nube (Firebase). Se empaqueta con esbuild en app/cloud.js
// Todos los usuarios del negocio comparten los mismos datos: negocios/{negocio}/{coleccion}/{id}
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, setPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, onSnapshot, writeBatch } from 'firebase/firestore';

let app, auth, db, negocio = 'deposito-mendoza';
const COLS = ['productos', 'stockMovs', 'ventas', 'compras', 'muestras', 'movimientos', 'eventos', 'chat', 'archivos', 'presupuestos'];

window.Cloud = {
  COLS,
  init(config) {
    app = initializeApp(config);
    if (config.negocio) negocio = config.negocio;
    auth = getAuth(app);
    setPersistence(auth, indexedDBLocalPersistence).catch(() => {});
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), ignoreUndefinedProperties: true });
  },
  onAuth(cb) { return onAuthStateChanged(auth, cb); },
  login(email, pass) { return signInWithEmailAndPassword(auth, email, pass); },
  logout() { return signOut(auth); },
  reset(email) { return sendPasswordResetEmail(auth, email); },
  user() { return auth && auth.currentUser; },
  // onData(nombreColeccion, arrayDeDocs, {fromCache, pending})
  subscribe(onData, onError) {
    const unsubs = COLS.map((c) => onSnapshot(collection(db, 'negocios', negocio, c), { includeMetadataChanges: true }, (snap) => {
      onData(c, snap.docs.map((d) => d.data()), { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites });
    }, onError));
    unsubs.push(onSnapshot(doc(db, 'negocios', negocio, 'meta', 'config'), { includeMetadataChanges: true }, (d) => onData('config', d.exists() ? d.data() : null, { fromCache: d.metadata.fromCache, pending: d.metadata.hasPendingWrites }), onError));
    return () => unsubs.forEach((u) => u());
  },
  // ops: [{col, id, data}] o [{col, id, del:true}]; col 'config' => negocios/{negocio}/meta/config
  async write(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(db);
      for (const op of ops.slice(i, i + 400)) {
        const ref = op.col === 'config' ? doc(db, 'negocios', negocio, 'meta', 'config') : doc(db, 'negocios', negocio, op.col, op.id);
        if (op.del) b.delete(ref); else b.set(ref, op.data);
      }
      // sin esperar al servidor: con caché local la escritura queda en cola si no hay internet
      b.commit().catch((e) => window.dispatchEvent(new CustomEvent('cloud-error', { detail: e })));
    }
  },
};
