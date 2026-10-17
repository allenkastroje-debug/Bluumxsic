/* Service worker: deja la app disponible sin internet y revisa los pagos cuando el sistema lo permite. */
const VERSION = 'spcontrol-v2.2';
const ARCHIVOS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/util.js', 'js/db.js', 'js/zip.js', 'js/cripto.js', 'js/tema.js', 'js/ui.js', 'js/logica.js', 'js/vistas.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/logo-mask.png', 'icons/apple-touch-icon.png',
  'icons/logo-x-tl.png', 'icons/logo-x-tr.png', 'icons/logo-x-bl.png', 'icons/logo-x-br.png', 'icons/logo-espada.png', 'icons/logo-ala-i.png', 'icons/logo-ala-d.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Primero lo guardado (rápido y sin internet); en segundo plano se actualiza para la próxima vez.
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // la tasa BCV siempre va directo a internet
  ev.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const guardado = await cache.match(req, { ignoreSearch: true });
    const red = fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (guardado) { ev.waitUntil(red); return guardado; }
    const r = await red;
    if (r) return r;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  })());
});

/* ───── Revisión de pagos en segundo plano (solo Android con la app instalada; el sistema decide cuándo) ───── */
function leerDatos() {
  return leerDatosDe('spcontrol').then(d => d || leerDatosDe('bluumxsic'));   // la segunda es la base de versiones anteriores
}
function leerDatosDe(nombre) {
  return new Promise(ok => {
    const r = indexedDB.open(nombre, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('pruebas'); };
    r.onerror = () => ok(null);
    r.onsuccess = () => {
      try {
        const q = r.result.transaction('kv').objectStore('kv').get('datos');
        q.onsuccess = () => ok(q.result || null);
        q.onerror = () => ok(null);
      } catch { ok(null); }
    };
  });
}

self.addEventListener('periodicsync', ev => {
  if (ev.tag !== 'revisar-pagos') return;
  ev.waitUntil((async () => {
    const d = await leerDatos();
    if (!d || d.AvisosActivos === false) return;
    const ahora = new Date(), hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}T00:00:00`;
    if (ahora.getHours() < (d.AvisoHora ?? 9) || d.UltimoAviso === hoyIso) return;
    const dias = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - hoy) / 864e5) : 99; };
    const cerca = d.DiasCerca ?? 3;
    let debe = 0, hoyN = 0, prox = 0;
    for (const x of [...(d.Clientes || []), ...(d.Planes || [])]) {
      const n = dias(x.ProximoPago);
      if (n < 0) debe++; else if (n === 0) hoyN++; else if (n <= cerca) prox++;
    }
    if (!debe && !hoyN && !prox) return;
    const partes = [];
    if (debe) partes.push(`${debe} atrasado(s)`);
    if (hoyN) partes.push(`${hoyN} vencen hoy`);
    if (prox) partes.push(`${prox} por vencer`);
    await self.registration.showNotification('SP-Control · pagos', { body: partes.join(' · '), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'pagos' });
  })());
});

self.addEventListener('notificationclick', ev => {
  ev.notification.close();
  ev.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (lista.length) return lista[0].focus();
    return self.clients.openWindow('./');
  })());
});
