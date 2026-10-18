/* Base de datos local (IndexedDB): "kv" guarda datos y ajustes, "pruebas" guarda las imágenes de comprobante. */
'use strict';
B.db = (() => {
  let abierta = null;
  const abrir = () => abierta ||= new Promise((ok, mal) => {
    const r = indexedDB.open('spcontrol', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('pruebas'); };
    r.onsuccess = async () => { try { await migrar(r.result); } catch { } ok(r.result); };
    r.onerror = () => mal(r.error);
  });
  /* Versiones anteriores guardaban todo en una base llamada «bluumxsic»: la primera vez se copia a la nueva (la vieja no se borra). */
  const migrar = async nueva => {
    if (!indexedDB.databases) return;
    if (!(await indexedDB.databases()).some(d => d.name === 'bluumxsic')) return;
    const vacia = await new Promise(ok => { const q = nueva.transaction('kv').objectStore('kv').count(); q.onsuccess = () => ok(q.result === 0); q.onerror = () => ok(false); });
    if (!vacia) return;
    const vieja = await new Promise((ok, mal) => { const r = indexedDB.open('bluumxsic'); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); r.onupgradeneeded = () => r.transaction.abort(); });
    try {
      for (const nombre of ['kv', 'pruebas']) {
        if (!vieja.objectStoreNames.contains(nombre)) continue;
        const { claves, valores } = await new Promise((ok, mal) => {
          const o = vieja.transaction(nombre).objectStore(nombre), k = o.getAllKeys(), v = o.getAll();
          v.onsuccess = () => ok({ claves: k.result, valores: v.result }); v.onerror = () => mal(v.error);
        });
        await new Promise((ok, mal) => {
          const t = nueva.transaction(nombre, 'readwrite'), o = t.objectStore(nombre);
          claves.forEach((c, i) => o.put(valores[i], c));
          t.oncomplete = () => ok(); t.onerror = t.onabort = () => mal(t.error);
        });
      }
    } finally { vieja.close(); }
  };
  const tx = async (almacen, modo, fn) => {
    const db = await abrir();
    return new Promise((ok, mal) => {
      const t = db.transaction(almacen, modo);
      const rq = fn(t.objectStore(almacen));
      t.oncomplete = () => ok(rq ? rq.result : undefined);
      t.onerror = t.onabort = () => mal(t.error || new Error('Error de almacenamiento'));
    });
  };
  /* Gancho para el cifrado en reposo (lo instala js/seguridad.js): env cifra antes de guardar, des descifra al leer. */
  const hook = { env: async (a, k, v) => v, des: async (a, k, r) => r };
  return {
    hook,
    cerrar: async () => { if (abierta) { try { (await abierta).close(); } catch { } abierta = null; } },
    get: async (a, k) => hook.des(a, k, await tx(a, 'readonly', o => o.get(k))),
    set: async (a, k, v) => { const w = await hook.env(a, k, v); return tx(a, 'readwrite', o => o.put(w, k)); },
    del: (a, k) => tx(a, 'readwrite', o => o.delete(k)),
    keys: a => tx(a, 'readonly', o => o.getAllKeys()),
    clear: a => tx(a, 'readwrite', o => o.clear()),
  };
})();
