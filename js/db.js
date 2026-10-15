/* Base de datos local (IndexedDB): "kv" guarda datos y ajustes, "pruebas" guarda las imágenes de comprobante. */
'use strict';
B.db = (() => {
  let abierta = null;
  const abrir = () => abierta ||= new Promise((ok, mal) => {
    const r = indexedDB.open('bluumxsic', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('pruebas'); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  const tx = async (almacen, modo, fn) => {
    const db = await abrir();
    return new Promise((ok, mal) => {
      const t = db.transaction(almacen, modo);
      const rq = fn(t.objectStore(almacen));
      t.oncomplete = () => ok(rq ? rq.result : undefined);
      t.onerror = t.onabort = () => mal(t.error || new Error('Error de almacenamiento'));
    });
  };
  return {
    get: (a, k) => tx(a, 'readonly', o => o.get(k)),
    set: (a, k, v) => tx(a, 'readwrite', o => o.put(v, k)),
    del: (a, k) => tx(a, 'readwrite', o => o.delete(k)),
    keys: a => tx(a, 'readonly', o => o.getAllKeys()),
    clear: a => tx(a, 'readwrite', o => o.clear()),
  };
})();
