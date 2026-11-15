'use strict';
/* Arranque de la app */
(async function () {
  await load();
  // Mensaje compartido desde otra app (ej. "Compartir" en WhatsApp) → va al chat
  const q = new URLSearchParams(location.search);
  const compartido = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n').trim();
  if (compartido) { history.replaceState(null, '', location.pathname); view = 'mensaje'; ui.msg = compartido; }
  startCloud();
  go(view);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
