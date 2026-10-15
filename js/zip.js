/* ZIP mínimo, sin librerías: escribe (sin comprimir, las fotos ya vienen comprimidas) y lee (guardado o deflate). */
B.zip = (() => {
  const TABLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = TABLA[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8');

  /* Lee un Blob/File a bytes; si el teléfono se resiste, prueba otras vías. */
  const bytes = async blob => {
    const vias = [() => blob.arrayBuffer(), () => new Response(blob).arrayBuffer(),
      () => new Promise((ok, mal) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => mal(fr.error); fr.readAsArrayBuffer(blob); })];
    let ult;
    for (const v of vias) { try { return new Uint8Array(await v()); } catch (e) { ult = e; } }
    throw new Error('No se pudo leer el archivo desde el teléfono (' + (ult?.name || 'error') + '). Cópialo a la carpeta Descargas y vuelve a elegirlo desde ahí.');
  };

  /** entradas: [{ nombre: 'comprobantes/Ana/2026-10 Octubre.jpg', datos: Blob | Uint8Array | string }] → Blob .zip */
  const crear = async entradas => {
    const partes = [], central = [];
    let pos = 0;
    const ahora = new Date();
    const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
    const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
    for (const e of entradas) {
      const nombre = enc.encode(e.nombre);
      const origen = typeof e.datos === 'string' ? enc.encode(e.datos) : e.datos;
      const u8 = origen instanceof Uint8Array ? origen : await bytes(origen);
      const crc = crc32(u8), tam = u8.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, hora, true); lh.setUint16(12, fecha, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, tam, true); lh.setUint32(22, tam, true); lh.setUint16(26, nombre.length, true); lh.setUint16(28, 0, true);
      partes.push(lh.buffer, nombre, u8);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, hora, true); ch.setUint16(14, fecha, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, tam, true); ch.setUint32(24, tam, true); ch.setUint16(28, nombre.length, true);
      ch.setUint32(42, pos, true);
      central.push(ch.buffer, nombre);
      pos += 30 + nombre.length + tam;
    }
    const tamCentral = central.reduce((s, p) => s + (p.byteLength ?? p.length), 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, entradas.length, true); fin.setUint16(10, entradas.length, true);
    fin.setUint32(12, tamCentral, true); fin.setUint32(16, pos, true);
    return new Blob([...partes, ...central, fin.buffer], { type: 'application/zip' });
  };

  /** Devuelve [{ nombre, leer(): Promise<Blob> }] */
  const leer = async file => {
    const total = file.size;
    if (total < 22) throw new Error('El archivo es demasiado pequeño para ser un .zip.');
    const colaIni = Math.max(0, total - 66000);
    const cola = await bytes(file.slice(colaIni, total));
    const dv = new DataView(cola.buffer, cola.byteOffset, cola.byteLength);
    let e = -1;
    for (let i = cola.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('El .zip está incompleto o dañado (no se encontró su índice). Vuelve a copiarlo.');
    const cuantos = dv.getUint16(e + 10, true), tamC = dv.getUint32(e + 12, true), posC = dv.getUint32(e + 16, true);
    if (posC === 0xFFFFFFFF || cuantos === 0xFFFF) throw new Error('Este .zip es demasiado grande (ZIP64). Divide el respaldo.');
    const c = await bytes(file.slice(posC, posC + tamC));
    const cv = new DataView(c.buffer, c.byteOffset, c.byteLength);
    const lista = [];
    let p = 0;
    for (let i = 0; i < cuantos && p + 46 <= c.length; i++) {
      if (cv.getUint32(p, true) !== 0x02014b50) break;
      const flags = cv.getUint16(p + 8, true), metodo = cv.getUint16(p + 10, true);
      const tamComp = cv.getUint32(p + 20, true), nl = cv.getUint16(p + 28, true), xl = cv.getUint16(p + 30, true), cl = cv.getUint16(p + 32, true);
      const desde = cv.getUint32(p + 42, true);
      const nombre = dec.decode(c.subarray(p + 46, p + 46 + nl)).replace(/\\/g, '/');
      p += 46 + nl + xl + cl;
      if (nombre.endsWith('/')) continue;                       // carpeta
      lista.push({
        nombre, cifrado: !!(flags & 1),
        leer: async () => {
          if (flags & 1) throw new Error('El .zip está protegido con contraseña, y esta versión no lo admite.');
          const lh = await bytes(file.slice(desde, desde + 30));
          const lv = new DataView(lh.buffer, lh.byteOffset, lh.byteLength);
          if (lv.getUint32(0, true) !== 0x04034b50) throw new Error('El .zip está dañado.');
          const ini = desde + 30 + lv.getUint16(26, true) + lv.getUint16(28, true);
          const crudo = file.slice(ini, ini + tamComp);
          if (metodo === 0) return crudo;
          if (metodo === 8) {
            if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador es muy antiguo para abrir el .zip. Actualiza Chrome o Safari.');
            return await new Response(crudo.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
          }
          throw new Error('El .zip usa un método de compresión no admitido (' + metodo + ').');
        },
      });
    }
    return lista;
  };

  return { crear, leer, bytes };
})();
