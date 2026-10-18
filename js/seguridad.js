/* Seguridad: PIN para abrir la app y cifrado de los datos guardados en el teléfono.
   - Una clave aleatoria (DEK, AES-256-GCM) cifra tus datos y tus fotos dentro de IndexedDB.
   - La DEK se guarda «envuelta» con una clave sacada de tu PIN (PBKDF2-SHA256, 210 000 vueltas): sin el PIN no se puede abrir.
   - Opcional: huella/rostro del teléfono (WebAuthn) como atajo; el PIN sigue siendo la llave de respaldo.
   No se cifran los nombres de los archivos de las fotos ni los ajustes de apariencia. */
'use strict';

B.seg = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const VUELTAS = 210000;
  const S = { meta: null, dek: null, cifrando: false, bioPosible: false, promesa: null };
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));

  const derivar = async (pin, sal, vueltas = VUELTAS) => {
    const base = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: vueltas, hash: 'SHA-256' }, base,
      { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
  };
  const envolver = async (dek, llave) => {
    const iv = rnd(12);
    return { iv, d: new Uint8Array(await crypto.subtle.wrapKey('raw', dek, llave, { name: 'AES-GCM', iv })) };
  };
  const abrirEnv = (env, llave) => crypto.subtle.unwrapKey('raw', env.d, llave, { name: 'AES-GCM', iv: env.iv },
    { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  const guardarMeta = () => B.db.set('kv', 'seg', S.meta);

  /* ───── Cifrado transparente de datos y fotos ───── */
  B.db.hook.env = async (a, k, v) => {
    if (!S.cifrando) return v;
    const esDatos = a === 'kv' && (k === 'datos' || k === 'datos_antes');
    const esFoto = a === 'pruebas' && v instanceof Blob;
    if (!esDatos && !esFoto) return v;
    if (!S.dek) throw new Error('La app está bloqueada.');
    const iv = rnd(12);
    const claro = esDatos ? enc.encode(JSON.stringify(v)) : await v.arrayBuffer();
    const d = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, S.dek, claro);
    return { __c: 1, iv, d, k: esDatos ? 'j' : 'b', t: esFoto ? (v.type || '') : '' };
  };
  B.db.hook.des = async (a, k, r) => {
    if (!r || r.__c !== 1) return r;
    if (!S.dek) throw new Error('La app está bloqueada.');
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: r.iv }, S.dek, r.d);
    return r.k === 'j' ? JSON.parse(dec.decode(claro)) : new Blob([claro], { type: r.t || '' });
  };

  /* Vuelve a escribir todo (cifrando o descifrando según S.cifrando). */
  const reescribir = async progreso => {
    const claves = await B.db.keys('pruebas');
    const total = claves.length + 2;
    let i = 0;
    for (const k of ['datos', 'datos_antes']) {
      const v = await B.db.get('kv', k);
      if (v !== undefined && v !== null) await B.db.set('kv', k, v);
      if (progreso) progreso(++i, total);
    }
    for (const k of claves) {
      const v = await B.db.get('pruebas', k);
      if (v) await B.db.set('pruebas', k, v);
      if (progreso) progreso(++i, total);
    }
  };

  const borrarBaseVieja = () => new Promise(ok => {   // la base de versiones anteriores guardaba todo sin cifrar
    try { const r = indexedDB.deleteDatabase('bluumxsic'); r.onsuccess = r.onerror = r.onblocked = () => ok(); } catch { ok(); }
  });

  /* ───── API ───── */
  const api = {
    get activo() { return !!(S.meta && S.meta.activo); },
    get meta() { return S.meta; },
    get bioPosible() { return S.bioPosible; },
    get bioActiva() { return !!(S.meta && S.meta.bio); },
    disponible: () => !!(window.crypto && crypto.subtle && indexedDB),

    async preparar() {
      try { S.bioPosible = !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
      catch { S.bioPosible = false; }
    },

    async verificar(pin) {
      const m = S.meta, ahora = Date.now();
      if (m.hasta > ahora) return { ok: false, espera: Math.ceil((m.hasta - ahora) / 1000) };
      try {
        const llave = await derivar(pin, m.sal, m.vueltas);
        S.dek = await abrirEnv(m.env, llave);
        m.fallos = 0; m.hasta = 0; await guardarMeta();
        return { ok: true };
      } catch {
        m.fallos = (m.fallos || 0) + 1;
        const espera = m.fallos >= 10 ? 1800 : m.fallos >= 8 ? 300 : m.fallos >= 5 ? 30 : 0;
        m.hasta = espera ? Date.now() + espera * 1000 : 0;
        await guardarMeta();
        return { ok: false, espera };
      }
    },

    async activar(pin, progreso) {
      const dek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const sal = rnd(16), llave = await derivar(pin, sal);
      S.meta = { v: 1, activo: true, sal, vueltas: VUELTAS, largo: String(pin).length, env: await envolver(dek, llave),
        minutos: 1, fallos: 0, hasta: 0, migrando: true, bio: null };
      await guardarMeta();                 // primero el candado, luego se cifra todo (si se corta, se retoma al desbloquear)
      S.dek = dek; S.cifrando = true;
      await reescribir(progreso);
      S.meta.migrando = false; await guardarMeta();
      await borrarBaseVieja();
      await B.guardar();
    },

    async cambiar(nuevo) {
      const sal = rnd(16), llave = await derivar(nuevo, sal);
      S.meta.sal = sal; S.meta.vueltas = VUELTAS; S.meta.largo = String(nuevo).length;
      S.meta.env = await envolver(S.dek, llave);
      S.meta.fallos = 0; S.meta.hasta = 0;
      await guardarMeta();
    },

    async desactivar(progreso) {
      S.meta.migrando = true; await guardarMeta();
      S.cifrando = false;                  // la DEK sigue en memoria para poder leer lo cifrado
      await reescribir(progreso);
      await B.db.del('kv', 'seg');
      S.meta = null; S.dek = null;
      await B.guardar();
    },

    async setMinutos(n) { S.meta.minutos = n; await guardarMeta(); },

    /* Huella / rostro */
    async bioActivar() {
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: rnd(32), rp: { name: 'SP-Control' }, user: { id: rnd(16), name: 'sp-control', displayName: 'SP-Control' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000, attestation: 'none' } });
      if (!cred) throw new Error('No se pudo registrar la huella.');
      const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
      S.meta.bio = { cred: new Uint8Array(cred.rawId), llave: k, env: await envolver(S.dek, k) };
      await guardarMeta();
    },
    async bioQuitar() { S.meta.bio = null; await guardarMeta(); },
    async bioDesbloquear() {
      const b = S.meta && S.meta.bio;
      if (!b) return false;
      await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: b.cred, transports: ['internal'] }],
        userVerification: 'required', timeout: 60000 } });
      S.dek = await abrirEnv(b.env, b.llave);
      return true;
    },

    /* Arranque: si hay PIN, no se carga nada hasta desbloquear. */
    async iniciar() {
      let m = null;
      try { m = await B.db.get('kv', 'seg'); } catch { }
      if (!m || !m.activo) return;
      S.meta = m; S.cifrando = true;
      const espera = mostrarBloqueo();
      if (B.quitarSplash) B.quitarSplash();
      await espera;
      if (m.migrando) { try { await reescribir(); m.migrando = false; await guardarMeta(); } catch { } }
    },

    bloquear() {
      if (!api.activo || !S.cifrando || document.getElementById('bloqueo')) return S.promesa;
      for (const h of [...B._hojas]) { try { h.cerrar(); } catch { } }
      return mostrarBloqueo();
    },
  };

  /* ───── Pantalla de bloqueo ───── */
  function mostrarBloqueo() {
    if (S.promesa && document.getElementById('bloqueo')) return S.promesa;
    S.promesa = new Promise(listo => {
      const m = S.meta, largo = m.largo || 6;
      const el = document.createElement('div');
      el.id = 'bloqueo'; el.className = 'bloqueo'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'App bloqueada');
      const tecla = n => `<button type="button" class="bl-tecla" data-d="${n}">${n}</button>`;
      el.innerHTML = `<div class="bl-caja">
        <span class="logo bl-logo" aria-hidden="true"></span>
        <b class="bl-tit">SP-Control</b>
        <small id="bl-msg">Escribe tu PIN</small>
        <div class="bl-puntos" id="bl-puntos">${'<i></i>'.repeat(largo)}</div>
        <div class="bl-teclado">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(tecla).join('')}
          ${m.bio ? '<button type="button" class="bl-tecla bl-aux" id="bl-bio" aria-label="Usar huella">☝</button>' : '<span></span>'}
          ${tecla(0)}
          <button type="button" class="bl-tecla bl-aux" id="bl-borrar" aria-label="Borrar">⌫</button>
        </div>
        <button type="button" class="btn fantasma bl-olvide" id="bl-olvide">Olvidé mi PIN</button>
      </div>`;
      document.body.appendChild(el);
      const msg = el.querySelector('#bl-msg'), puntos = [...el.querySelectorAll('#bl-puntos i')];
      let pin = '', ocupado = false, reloj = null;
      const pintar = () => puntos.forEach((p, i) => p.classList.toggle('on', i < pin.length));
      const fin = () => { document.removeEventListener('keydown', teclado); clearInterval(reloj); el.classList.add('sale'); setTimeout(() => el.remove(), 320); listo(); };
      const bloquearTeclas = si => el.querySelectorAll('.bl-tecla').forEach(b => { b.disabled = si; });
      const cuenta = seg => {
        ocupado = true; bloquearTeclas(true); let r = seg;
        const pon = () => { msg.textContent = `Demasiados intentos. Espera ${r >= 60 ? Math.ceil(r / 60) + ' min' : r + ' s'}.`; };
        pon(); clearInterval(reloj);
        reloj = setInterval(() => { r--; if (r <= 0) { clearInterval(reloj); ocupado = false; bloquearTeclas(false); msg.textContent = 'Escribe tu PIN'; } else pon(); }, 1000);
      };
      const intentar = async () => {
        ocupado = true;
        const r = await api.verificar(pin);
        if (r.ok) return fin();
        pin = ''; pintar(); ocupado = false;
        el.querySelector('.bl-caja').classList.remove('tiembla'); void el.offsetWidth; el.querySelector('.bl-caja').classList.add('tiembla');
        if (r.espera) cuenta(r.espera); else msg.textContent = 'PIN incorrecto. Inténtalo de nuevo.';
      };
      const dig = d => { if (ocupado || pin.length >= largo) return; pin += d; pintar(); msg.textContent = 'Escribe tu PIN'; if (pin.length === largo) intentar(); };
      const borrar = () => { if (ocupado) return; pin = pin.slice(0, -1); pintar(); };
      const teclado = ev => { if (/^\d$/.test(ev.key)) dig(ev.key); else if (ev.key === 'Backspace') borrar(); };
      const bio = async () => {
        if (ocupado || !m.bio) return;
        ocupado = true;
        try { if (await api.bioDesbloquear()) { m.fallos = 0; return fin(); } } catch { msg.textContent = 'No se pudo usar la huella. Usa tu PIN.'; }
        ocupado = false;
      };
      el.addEventListener('click', async ev => {
        const t = ev.target.closest('button'); if (!t) return;
        if (t.dataset.d !== undefined) dig(t.dataset.d);
        else if (t.id === 'bl-borrar') borrar();
        else if (t.id === 'bl-bio') bio();
        else if (t.id === 'bl-olvide') olvide();
      });
      document.addEventListener('keydown', teclado);
      if (m.hasta > Date.now()) cuenta(Math.ceil((m.hasta - Date.now()) / 1000));
      else if (m.bio && S.dek === null) setTimeout(bio, 450);
    });
    return S.promesa;
  }

  /* Olvidé mi PIN: la única salida es borrar lo guardado en este teléfono y restaurar el respaldo. */
  async function olvide() {
    if (!await B.confirmar('Olvidé mi PIN',
      'Tus datos están cifrados con el PIN: sin él no se pueden abrir, ni siquiera yo.\n\nLa única salida es borrar lo guardado en este teléfono y luego importar tu respaldo (.spcontrol) con su contraseña.\n\n¿Borrar todo lo de este teléfono?', { si: 'Sí, borrar todo', peligro: true })) return;
    if (!await B.confirmar('Última confirmación', 'Se borrarán clientes, planes, pagos y fotos de este teléfono. Si no tienes un respaldo, no hay forma de recuperarlos.', { si: 'Borrar definitivamente', peligro: true })) return;
    try { await B.db.cerrar(); } catch { }
    await new Promise(ok => { try { const r = indexedDB.deleteDatabase('spcontrol'); r.onsuccess = r.onerror = r.onblocked = () => ok(); } catch { ok(); } });
    await borrarBaseVieja();
    try { localStorage.clear(); } catch { }
    location.reload();
  }

  /* Bloqueo automático al volver a la app */
  let oculto = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { oculto = Date.now(); return; }
    if (api.activo && S.cifrando && oculto && !document.getElementById('bloqueo') && Date.now() - oculto >= (S.meta.minutos || 0) * 60000) api.bloquear();
  });

  return api;
})();

/* ───── Cuadro para pedir/crear un PIN numérico de 6 a 8 dígitos ───── */
B.pedirPin = ({ titulo, intro, nueva = false, validar = null }) => new Promise(res => {
  let hecho = false;
  const campo = (n, t) => `<label class="campo"><span>${t}</span><input name="${n}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" autocapitalize="none" spellcheck="false"></label>`;
  const h = B.sheet(titulo, `
    <form id="f-pin" class="form" novalidate autocomplete="off">
      <p class="nota">${intro}</p>
      ${campo('p1', nueva ? 'PIN nuevo (6 a 8 dígitos)' : 'PIN')}
      ${nueva ? campo('p2', 'Repite el PIN') : ''}
      <p class="nota err" id="pin-err" hidden></p>
      <div class="acciones fin">
        <button type="button" class="btn fantasma" data-cerrar>Cancelar</button>
        <button type="submit" class="btn" id="ok-pin">Continuar</button>
      </div>
    </form>`, { alCerrar: () => { if (!hecho) { hecho = true; res(null); } } });
  const f = h.$('#f-pin'), err = h.$('#pin-err');
  const mostrar = t => { err.textContent = t; err.hidden = !t; };
  const cerrar = v => { if (hecho) return; hecho = true; res(v); h.cerrar(); };
  for (const i of f.querySelectorAll('input')) i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 8); });
  setTimeout(() => f.p1.focus(), 250);
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const p = f.p1.value;
    if (nueva) {
      if (!/^\d{6,8}$/.test(p)) { mostrar('El PIN debe tener de 6 a 8 números.'); return; }
      if (/^(\d)\1+$/.test(p) || '01234567890123456789'.includes(p) || '98765432109876543210'.includes(p)) { mostrar('Ese PIN es muy fácil de adivinar (123456, 000000…). Elige otro.'); return; }
      if (p !== f.p2.value) { mostrar('Los dos PIN no coinciden.'); return; }
    } else if (!p) { mostrar('Escribe el PIN.'); return; }
    if (validar) {
      const b = h.$('#ok-pin'); b.disabled = true; b.textContent = 'Comprobando…';
      const r = await validar(p);
      b.disabled = false; b.textContent = 'Continuar';
      if (r !== true) { mostrar(r); f.p1.select(); return; }
    }
    cerrar(p);
  });
});

/* ───── Acciones de «Más → Seguridad» ───── */
B.segAcc = {
  'seg-activar': async () => {
    if (!B.seg.disponible()) { B.aviso('Este navegador no permite cifrar. Abre la app desde https (por ejemplo, tu página de GitHub) en Chrome o Safari.'); return; }
    const pin = await B.pedirPin({ titulo: 'Crea tu PIN', nueva: true,
      intro: 'Elige un PIN de 6 a 8 números. Se pedirá al abrir la app y tus datos y fotos quedarán cifrados con él.' });
    if (!pin) return;
    if (!await B.confirmar('Antes de continuar', 'Si olvidas el PIN, tus datos no se pueden abrir: solo se recuperan importando tu respaldo.\n\n¿Ya hiciste un respaldo reciente?', { si: 'Sí, activar', no: 'Cancelar' })) return;
    const c = B.cargando('Cifrando tus datos…', 'No cierres la app.');
    try { await B.seg.activar(pin, (i, t) => c.texto('Cifrando tus datos…', `${i} de ${t}`)); }
    catch (err) { c.cerrar(); B.error('No se pudo activar el bloqueo: ' + (err.message || err)); B.render(); return; }
    c.cerrar(); B.render(); B.toast('Bloqueo activado', 'Tus datos y fotos están cifrados.', 'Exito');
  },
  'seg-cambiar': async () => {
    const ok = await B.pedirPin({ titulo: 'PIN actual', intro: 'Escribe tu PIN actual para poder cambiarlo.',
      validar: async p => { const r = await B.seg.verificar(p); return r.ok ? true : (r.espera ? `Demasiados intentos. Espera ${r.espera} s.` : 'PIN incorrecto.'); } });
    if (!ok) return;
    const nuevo = await B.pedirPin({ titulo: 'PIN nuevo', nueva: true, intro: 'Elige tu nuevo PIN de 6 a 8 números.' });
    if (!nuevo) return;
    await B.seg.cambiar(nuevo); B.render(); B.toast('PIN cambiado', 'Se usará la próxima vez que abras la app.', 'Exito');
  },
  'seg-desactivar': async () => {
    const ok = await B.pedirPin({ titulo: 'Quitar el bloqueo', intro: 'Escribe tu PIN para quitar el bloqueo. Tus datos volverán a guardarse sin cifrar en este teléfono.',
      validar: async p => { const r = await B.seg.verificar(p); return r.ok ? true : (r.espera ? `Demasiados intentos. Espera ${r.espera} s.` : 'PIN incorrecto.'); } });
    if (!ok) return;
    const c = B.cargando('Descifrando tus datos…', 'No cierres la app.');
    try { await B.seg.desactivar((i, t) => c.texto('Descifrando tus datos…', `${i} de ${t}`)); }
    catch (err) { c.cerrar(); B.error('No se pudo quitar el bloqueo: ' + (err.message || err)); B.render(); return; }
    c.cerrar(); B.render(); B.toast('Bloqueo desactivado', 'Los datos ya no están cifrados.', 'Info');
  },
  'seg-min': async el => { await B.seg.setMinutos(+el.dataset.v); B.render(); },
  'seg-bloquear': () => { B.seg.bloquear(); },
  'seg-bio': async () => {
    try {
      if (B.seg.bioActiva) { await B.seg.bioQuitar(); B.toast('Huella desactivada', 'Se usará solo el PIN.', 'Info'); }
      else { await B.seg.bioActivar(); B.toast('Huella activada', 'Podrás abrir la app con la huella o el rostro del teléfono. El PIN sigue siendo el respaldo.', 'Exito'); }
    } catch (err) { if (!err || err.name !== 'NotAllowedError') B.error('No se pudo activar la huella en este teléfono: ' + ((err && err.message) || err)); }
    B.render();
  },
};
