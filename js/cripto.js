/* Respaldo protegido con contraseña.
   Formato .spcontrol (antes .bluumxsic; es el mismo en la app de Windows):
     0-3  "BLXC"   4  versión (1)   5-20  sal (16)   21-24  vueltas PBKDF2 (uint32, big-endian)   25-36  nonce (12)
     37…  datos cifrados + etiqueta (16)  — AES-256-GCM; los primeros 37 bytes van como dato autenticado.
   Clave: PBKDF2-HMAC-SHA256 de la contraseña (UTF-8, normalizada NFC). Dentro va el .zip del respaldo. */
B.cripto = (() => {
  const MAGIA = [0x42, 0x4C, 0x58, 0x43], VER = 1, VUELTAS = 210000, CAB = 37;
  const enc = new TextEncoder();

  const disponible = () => !!(window.crypto && crypto.subtle);
  const esCifrado = u8 => !!u8 && u8.length >= 4 && MAGIA.every((b, i) => u8[i] === b);

  const derivar = async (clave, sal, vueltas) => {
    const base = await crypto.subtle.importKey('raw', enc.encode(String(clave).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: vueltas },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  };

  /** Blob (.zip) + contraseña → Blob cifrado */
  const cifrar = async (blob, clave) => {
    if (!disponible()) throw new Error('Este navegador no permite cifrar aquí (hace falta abrir la app desde una dirección https).');
    const datos = await B.zip.bytes(blob);
    const cab = new Uint8Array(CAB), dv = new DataView(cab.buffer);
    cab.set(MAGIA, 0); cab[4] = VER;
    cab.set(crypto.getRandomValues(new Uint8Array(16)), 5);
    dv.setUint32(21, VUELTAS, false);
    cab.set(crypto.getRandomValues(new Uint8Array(12)), 25);
    const k = await derivar(clave, cab.slice(5, 21), VUELTAS);
    const cif = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: cab.slice(25, 37), additionalData: cab, tagLength: 128 }, k, datos);
    return new Blob([cab, cif], { type: 'application/octet-stream' });
  };

  /** Bytes cifrados + contraseña → Uint8Array del .zip. Lanza Error con .clave = true si la contraseña no sirve. */
  const descifrar = async (u8, clave) => {
    if (!disponible()) throw new Error('Este navegador no permite descifrar aquí (hace falta abrir la app desde una dirección https).');
    if (u8.length < CAB + 16 || u8[4] !== VER) throw new Error('El archivo protegido está incompleto o es de una versión que esta app no conoce.');
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const vueltas = dv.getUint32(21, false);
    if (vueltas < 10000 || vueltas > 5000000) throw new Error('El archivo protegido está dañado.');
    const cab = u8.slice(0, CAB);
    try {
      const k = await derivar(clave, cab.slice(5, 21), vueltas);
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: cab.slice(25, 37), additionalData: cab, tagLength: 128 }, k, u8.subarray(CAB)));
    } catch {
      const e = new Error('Contraseña incorrecta, o el archivo está dañado.'); e.clave = true; throw e;
    }
  };

  return { esCifrado, cifrar, descifrar, disponible };
})();

/* Hoja para escribir la contraseña. nueva = al crear (pide confirmarla y permite "sin contraseña");
   validar(clave) devuelve true o un texto de error (se usa al abrir, para reintentar sin cerrar). Devuelve '' (sin clave), la clave o null (cancelado). */
B.pedirClave = ({ titulo, intro, nueva = false, validar = null }) => new Promise(res => {
  let hecho = false;
  const h = B.sheet(titulo, `
    <form id="f-clave" class="form" novalidate autocomplete="off">
      <p class="nota">${intro}</p>
      <label class="campo"><span>${nueva ? 'Contraseña' : 'Contraseña del respaldo'}</span><input name="c1" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false"></label>
      ${nueva ? '<label class="campo"><span>Repite la contraseña</span><input name="c2" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false"></label>' : ''}
      <label class="interruptor"><input type="checkbox" id="ver-clave"><span>Mostrar la contraseña</span></label>
      <p class="nota err" id="clave-err" hidden></p>
      ${nueva ? '<p class="nota"><b>Guárdala bien:</b> si la olvidas, nadie podrá abrir ese respaldo (ni yo ni la app).</p>' : ''}
      <div class="acciones fin">
        <button type="button" class="btn fantasma" data-cerrar>Cancelar</button>
        <button type="submit" class="btn" id="ok-clave">${nueva ? 'Guardar con contraseña' : 'Abrir'}</button>
      </div>
    </form>`, { alCerrar: () => { if (!hecho) { hecho = true; res(null); } } });
  const f = h.$('#f-clave'), err = h.$('#clave-err');
  const mostrarErr = t => { err.textContent = t; err.hidden = !t; };
  const cerrar = v => { if (hecho) return; hecho = true; res(v); h.cerrar(); };
  h.$('#ver-clave').addEventListener('change', ev => { f.c1.type = ev.target.checked ? 'text' : 'password'; if (f.c2) f.c2.type = f.c1.type; });
  setTimeout(() => f.c1.focus(), 250);
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const c = f.c1.value;
    if (!c) { mostrarErr('Escribe la contraseña.'); return; }
    if (nueva) {
      if (c.length < 6) { mostrarErr('Usa al menos 6 caracteres.'); return; }
      if (c !== f.c2.value) { mostrarErr('Las dos contraseñas no coinciden.'); return; }
    }
    if (validar) {
      const b = h.$('#ok-clave'); b.disabled = true; b.textContent = 'Comprobando…';
      const r = await validar(c);
      b.disabled = false; b.textContent = 'Abrir';
      if (r !== true) { mostrarErr(r); f.c1.select(); return; }
    }
    cerrar(c);
  });
});
