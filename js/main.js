/* Formularios, acciones de los botones y arranque de la app. */
'use strict';

/* ───────────── Formularios ───────────── */
const seg = (name, ops, val) => `<div class="seg" role="radiogroup">${ops.map(([v, t]) =>
  `<label><input type="radio" name="${name}" value="${v}" ${v === val ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>`;
const campo = (t, inner, extra = '') => `<label class="campo ${extra}"><span>${t}</span>${inner}</label>`;

B.hojaTasa = () => {
  const h = B.sheet('Tasa BCV', `
    <p class="nota">Bolívares por cada dólar. Se usa para calcular los equivalentes de cada movimiento.</p>
    ${campo('Tasa (Bs por US$)', `<input id="t-valor" inputmode="decimal" value="${B.d.Tasa > 0 ? B.tasaTxt(B.d.Tasa) : ''}" placeholder="Ej. 36,50">`)}
    <p class="nota" id="t-msg">${e(B.mensajeTasa())}</p>
    <button class="tog ${B.d.AutoActualizar ? 'on' : ''}" role="switch" aria-checked="${B.d.AutoActualizar}" id="t-auto"><span>Actualizar sola al abrir la app y cada hora</span><i></i></button>
    <div class="acciones fin">
      <button class="btn fantasma" id="t-web">⟳ Consultar en internet</button>
      <button class="btn" id="t-ok">Guardar</button>
    </div>`);
  h.$('#t-auto').onclick = async ev => {
    B.d.AutoActualizar = !B.d.AutoActualizar;
    ev.currentTarget.classList.toggle('on', B.d.AutoActualizar);
    ev.currentTarget.setAttribute('aria-checked', B.d.AutoActualizar);
    await B.guardar();
  };
  h.$('#t-web').onclick = async ev => {
    ev.currentTarget.disabled = true;
    if (await B.actualizarTasa(false)) h.cerrar();
    else ev.currentTarget.disabled = false;
  };
  h.$('#t-ok').onclick = async () => {
    const v = B.tryNum(h.$('#t-valor').value, false);
    if (!(v > 0)) { B.aviso('Escribe una tasa válida (mayor que cero).'); return; }
    B.d.Tasa = v; B.d.TasaActualizada = null;
    await B.guardar(); h.cerrar(); B.render();
    B.toast('Tasa guardada', `Bs ${B.tasaTxt(v)} por US$`, 'Exito');
  };
};

B.hojaCliente = (c = null) => {
  const edit = !!c, hoyIso = B.aInput(B.hoy());
  const h = B.sheet(edit ? 'Editar cliente' : 'Nuevo cliente', `
    <form id="f-cli" class="form" novalidate autocomplete="off">
      ${campo('Nombre del cliente', `<input name="Nombre" value="${e(c?.Nombre || '')}" autocapitalize="words">`)}
      ${campo('Teléfono (opcional)', `<input name="Telefono" type="tel" inputmode="tel" value="${e(c?.Telefono || '')}" placeholder="0412 1234567">`)}
      ${campo('¿Cuántas cuentas alquila?', `<input name="Cuentas" type="number" inputmode="numeric" min="1" max="20" value="${c?.Cuentas || 1}">`)}
      <label class="interruptor" id="fpc-caja" hidden><input type="checkbox" name="FechasPorCuenta" ${c && B.porCuenta(c) ? 'checked' : ''}><span>Cada cuenta con su propia fecha de pago <small>(el monto es por cuenta)</small></span></label>
      <div id="usuarios"></div>
      <div class="dos">
        ${campo('<em id="monto-et" style="font-style:normal">Monto que paga</em>', `<input name="Monto" inputmode="decimal" value="${c ? B.num(c.Monto).replace(/^(.*),00$/, '$1') : ''}" placeholder="5,00">`)}
        <div class="campo"><span>Moneda</span>${seg('Moneda', [['USD', 'US$'], ['VES', 'Bs']], c?.Moneda || 'USD')}</div>
      </div>
      ${campo('Próxima fecha de pago', `<input name="ProximoPago" type="date" value="${c ? B.aInput(B.deIso(c.ProximoPago)) : hoyIso}">`)}
      ${campo('Notas (opcional)', `<textarea name="Notas" rows="2">${e(c?.Notas || '')}</textarea>`)}
      <div class="acciones fin"><button type="button" class="btn fantasma" data-cerrar>Cancelar</button><button type="submit" class="btn">${edit ? 'Guardar cambios' : 'Agregar cliente'}</button></div>
    </form>`, { alta: true });
  const form = h.$('#f-cli'), cont = h.$('#usuarios');
  const usuarios = (c ? [...c.Usuarios] : ['']);
  const fechas = c ? Array.from({ length: c.Cuentas }, (_, i) => B.aInput(B.deIso(B.cFecha(c, i)))) : [];
  const caja = h.$('#fpc-caja');
  const leerFilas = () => {
    cont.querySelectorAll('input[data-u]').forEach(i => { usuarios[+i.dataset.u] = i.value; });
    cont.querySelectorAll('input[data-f]').forEach(i => { fechas[+i.dataset.f] = i.value; });
  };
  const pintarUsuarios = () => {
    leerFilas();
    const n = Math.min(20, Math.max(1, parseInt(form.Cuentas.value, 10) || 1));
    while (usuarios.length < n) usuarios.push('');
    const base = form.ProximoPago.value || hoyIso;
    for (let i = 0; i < n; i++) if (!fechas[i]) fechas[i] = base;
    caja.hidden = n < 2;
    const por = n > 1 && form.FechasPorCuenta.checked;
    h.$('#monto-et').textContent = por ? 'Monto por cada cuenta' : 'Monto que paga';
    cont.innerHTML = Array.from({ length: n }, (_, i) =>
      campo(n === 1 ? 'Usuario de la cuenta' : `Usuario de la cuenta ${i + 1}`,
        `<input data-u="${i}" value="${e(usuarios[i] || '')}" placeholder="usuario_spotify" autocapitalize="none" spellcheck="false">`) +
      (por ? campo(`Fecha de pago de la cuenta ${i + 1}`, `<input data-f="${i}" type="date" value="${e(fechas[i])}">`) : '')).join('');
  };
  form.Cuentas.addEventListener('input', pintarUsuarios);
  form.FechasPorCuenta.addEventListener('change', pintarUsuarios);
  pintarUsuarios();
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    leerFilas();
    const f = B.leer(form);
    const err = B.validarCliente(f, usuarios, fechas);
    if (err) { B.aviso(err); return; }
    await B.guardarCliente(f, usuarios, c?.Id, fechas);
    h.cerrar(); B.render();
    B.toast(edit ? 'Cliente actualizado' : 'Cliente agregado', f.Nombre.trim(), 'Exito');
  });
};

B.hojaPlan = (p = null) => {
  const edit = !!p;
  const h = B.sheet(edit ? 'Editar plan familiar' : 'Nuevo plan familiar', `
    <form id="f-plan" class="form" novalidate autocomplete="off">
      ${campo('Administrador del plan', `<input name="Admin" value="${e(p?.Admin || '')}" autocapitalize="words">`)}
      ${campo('Cuenta (correo o usuario)', `<input name="Cuenta" value="${e(p?.Cuenta || '')}" autocapitalize="none" spellcheck="false">`)}
      <div class="dos">
        ${campo('Cuánto cuesta', `<input name="Monto" inputmode="decimal" value="${p ? B.num(p.Monto).replace(/^(.*),00$/, '$1') : ''}" placeholder="16,99">`)}
        <div class="campo"><span>Moneda</span>${seg('Moneda', [['USD', 'US$'], ['VES', 'Bs']], p?.Moneda || 'USD')}</div>
      </div>
      ${campo('Fecha en que se paga', `<input name="ProximoPago" type="date" value="${B.aInput(p ? B.deIso(p.ProximoPago) : B.hoy())}">`)}
      <div class="acciones fin"><button type="button" class="btn fantasma" data-cerrar>Cancelar</button><button type="submit" class="btn">${edit ? 'Guardar cambios' : 'Agregar plan'}</button></div>
    </form>`);
  const form = h.$('#f-plan');
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = B.leer(form), err = B.validarPlan(f);
    if (err) { B.aviso(err); return; }
    await B.guardarPlan(f, p?.Id);
    h.cerrar(); B.render();
    B.toast(edit ? 'Plan actualizado' : 'Plan agregado', f.Admin.trim(), 'Exito');
  });
};

B.hojaMovimiento = () => {
  const h = B.sheet('Nuevo movimiento', `
    <form id="f-mov" class="form" novalidate autocomplete="off">
      ${seg('Tipo', [['Ingreso', '↑ Ingreso'], ['Gasto', '↓ Gasto / pérdida']], 'Ingreso')}
      ${campo('Descripción', `<input name="Descripcion" placeholder="Ej. Pago de Juan, Plan familiar…">`)}
      <div class="dos">
        ${campo('Monto', `<input name="Monto" inputmode="decimal" placeholder="0,00">`)}
        <div class="campo"><span>Moneda</span>${seg('Moneda', [['USD', 'US$'], ['VES', 'Bs']], 'USD')}</div>
      </div>
      ${campo('Fecha', `<input name="Fecha" type="date" value="${B.aInput(B.ui.movDia)}">`)}
      <div class="acciones fin"><button type="button" class="btn fantasma" data-cerrar>Cancelar</button><button type="submit" class="btn">Agregar</button></div>
    </form>`);
  const form = h.$('#f-mov');
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = B.leer(form), err = await B.guardarMovimiento(f);
    if (err) { B.aviso(err); return; }
    const d = B.deIso(f.Fecha); if (d) { B.ui.movDia = d; B.ui.calMes = new Date(d.getFullYear(), d.getMonth(), 1); }
    h.cerrar(); B.render();
    B.toast(f.Tipo === 'Gasto' ? 'Gasto registrado' : 'Ingreso registrado', `${f.Descripcion.trim() || f.Tipo} · ${B.dinero(B.tryNum(f.Monto), f.Moneda)}`, 'Exito');
  });
};

/* Registrar un pago: la foto del comprobante es obligatoria. */
B.hojaPago = ({ titulo, intro, periodo, ejecutar, exito }) => {
  if (!(B.d.Tasa > 0)) { B.aviso('Primero define o actualiza la tasa BCV (arriba).'); return; }
  let archivo = null, url = null;
  const h = B.sheet(titulo, `
    <p class="nota">${intro}</p>
    <div class="prueba" id="pr-caja"><div class="prueba-vacia"><span>🧾</span><b>Comprobante de pago obligatorio</b><small>Toma una foto o elige la captura del pago.</small></div></div>
    <p class="nota" id="pr-nombre"></p>
    <div class="acciones">
      <label class="btn fantasma">📷 Tomar foto<input type="file" accept="image/*" capture="environment" hidden id="pr-cam"></label>
      <label class="btn fantasma">🖼 Elegir imagen<input type="file" accept="image/*" hidden id="pr-gal"></label>
    </div>
    <div class="acciones fin"><button class="btn fantasma" data-cerrar>Cancelar</button><button class="btn" id="pr-ok" disabled>✔ Registrar pago</button></div>`,
    { alCerrar: () => { if (url) URL.revokeObjectURL(url); } });
  const poner = f => {
    if (!f) return;
    if (!B.esImagen(f)) { B.aviso('El archivo debe ser una imagen (png, jpg, webp, bmp o gif).'); return; }
    archivo = f;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(f);
    h.$('#pr-caja').innerHTML = `<img src="${url}" alt="Vista previa del comprobante">`;
    const ext = (f.size > 1.6e6 || !B.extension(f)) ? '.jpg' : B.extension(f);
    h.$('#pr-nombre').innerHTML = `Se guardará como «<b>${e(B.nombrePrueba(periodo, ext, new Set()))}</b>» en la carpeta del titular.`;
    h.$('#pr-ok').disabled = false;
  };
  h.$('#pr-cam').onchange = ev => poner(ev.target.files[0]);
  h.$('#pr-gal').onchange = ev => poner(ev.target.files[0]);
  h.$('#pr-ok').onclick = async ev => {
    if (!archivo) { B.aviso('No se registró el pago: la imagen de la prueba es obligatoria.'); return; }
    const b = ev.currentTarget; b.disabled = true; b.textContent = 'Guardando…';
    try {
      const reg = await ejecutar(archivo);
      h.cerrar(); B.render();
      B.toast(exito.titulo, `${exito.texto} · comprobante guardado como «${B.nombreArchivo(reg.Archivo)}»`, 'Exito');
    } catch (err) {
      b.disabled = false; b.textContent = '✔ Registrar pago';
      B.error('No se pudo guardar la imagen: ' + (err && err.message ? err.message : err));
    }
  };
};

/* i = cuenta concreta (cuando el cliente tiene fechas distintas por cuenta); sin i se paga la que vence primero. */
B.pagarCliente = (c, i = null) => {
  const porCuenta = B.porCuenta(c);
  if (porCuenta && (i === null || isNaN(i))) i = B.iUrgente(c);
  const periodo = B.deIso(porCuenta ? B.cFecha(c, i) : c.ProximoPago), nuevo = B.addMeses(periodo, 1);
  B.hojaPago({
    titulo: 'Registrar pago',
    intro: porCuenta
      ? `¿Registrar el pago de <b>${e(c.Nombre)}</b> · ${e(B.nombreCuenta(c, i))} por <b>${e(B.dinero(c.Monto, c.Moneda))}</b>?<br>La fecha de esa cuenta pasará del ${e(B.fechaCorta(B.aIso(periodo)))} al ${e(B.fechaCorta(B.aIso(nuevo)))}.`
      : `¿Registrar el pago de <b>${e(c.Nombre)}</b> por <b>${e(B.dinero(c.Monto, c.Moneda))}</b>?<br>Su próximo pago pasará al ${e(B.fechaCorta(B.aIso(nuevo)))}.`,
    periodo, ejecutar: f => B.registrarPagoCliente(c, f, porCuenta ? i : null),
    exito: { titulo: 'Pago registrado', texto: porCuenta ? `${c.Nombre} · ${B.nombreCuenta(c, i)}` : c.Nombre },
  });
};

B.pagarPlan = p => {
  const periodo = B.deIso(p.ProximoPago), nuevo = B.addMeses(periodo, 1);
  B.hojaPago({
    titulo: 'Pagar plan familiar',
    intro: `¿Registrar el pago del plan de <b>${e(p.Admin)}</b> por <b>${e(B.dinero(p.Monto, p.Moneda))}</b>?<br>El próximo pago pasará al ${e(B.fechaCorta(B.aIso(nuevo)))}.`,
    periodo, ejecutar: f => B.registrarPagoPlan(p, f), exito: { titulo: 'Pago del plan registrado', texto: p.Admin },
  });
};

B.hojaAgregarCuenta = p => {
  if (B.libres(p) === 0) { B.aviso('Este plan está lleno (administrador + 5 cuentas).'); return; }
  const libres = B.cuentasLibres();
  if (!libres.length) { B.aviso('No hay cuentas pendientes por asignar.\nSi un cliente alquila más cuentas, súbele el número en Clientes (✎).'); return; }
  const h = B.sheet(`Agregar al plan de ${p.Admin}`, `
    <p class="nota">Elige la cuenta del cliente que va en este plan. Quedan ${B.libres(p)} cupo(s).</p>
    <div class="lista">${libres.map(({ c, i }) => `
      <button class="card fila elegir st-${B.cEstado(c)}" data-c="${c.Id}" data-i="${i}">
        <div class="fila-info"><b>${e(c.Nombre)}</b><small>${e(B.nombreCuenta(c, i))}</small></div>${chipEstado(B.cEstado(c), B.cEstadoTexto(c))}
      </button>`).join('')}</div>`);
  h.el.addEventListener('click', async ev => {
    const b = ev.target.closest('.elegir'); if (!b) return;
    if (B.libres(p) === 0) return;
    p.Asignaciones.push({ ClienteId: b.dataset.c, Indice: +b.dataset.i });
    await B.guardar(); h.cerrar(); B.render();
    const c = B.cliente(b.dataset.c);
    B.toast('Cuenta agregada al plan', `${c.Nombre} · ${B.nombreCuenta(c, +b.dataset.i)} → ${p.Admin}`, 'Exito');
  });
};

/* Galería de comprobantes guardados (todos o los de un cliente / plan). */
B.hojaComprobantes = async (carpeta, nombre) => {
  let lista = B.d.Pruebas.filter(r => !carpeta || String(r.Archivo).startsWith(carpeta + '/'));
  if (carpeta === '' && nombre) lista = [];
  const grupos = new Map();
  [...lista].sort((a, b) => String(b.FechaPago).localeCompare(String(a.FechaPago)) || b.Archivo.localeCompare(a.Archivo))
    .forEach(r => { const k = r.Titular || 'Sin titular'; (grupos.get(k) || grupos.set(k, []).get(k)).push(r); });
  const html = grupos.size ? [...grupos].map(([t, rs]) => `
      <h3>${e(t)}</h3>
      <div class="galeria">${rs.map(r => `<button class="miniatura" data-r="${e(r.Archivo)}" aria-label="${e(B.nombreArchivo(r.Archivo))}">
        <img alt="" data-src="${e(r.Archivo)}"><small>${e(B.nombreArchivo(r.Archivo))}</small></button>`).join('')}</div>`).join('')
    : vacio('🧾', 'Sin comprobantes', 'Cada pago que registres guarda aquí su foto, ordenada por titular y mes.');
  const h = B.sheet(nombre ? `Comprobantes · ${nombre}` : 'Comprobantes', html, { alta: true });
  h.el.addEventListener('click', ev => { const b = ev.target.closest('.miniatura'); if (b) B.verImagen(b.dataset.r); });
  for (const img of h.$$('img[data-src]')) {
    B.urlPrueba(img.dataset.src).then(u => { if (u) img.src = u; else img.closest('.miniatura').classList.add('perdida'); });
  }
};

B.verImagen = async ruta => {
  const blob = await B.db.get('pruebas', ruta);
  if (!blob) { B.aviso('No encuentro esa imagen en este teléfono. Si importaste un respaldo antiguo, es posible que no la incluyera.'); return; }
  const url = await B.urlPrueba(ruta), nombre = B.nombreArchivo(ruta);
  const h = B.sheet(nombre, `<img class="visor-img" src="${url}" alt="${e(nombre)}">
    <div class="acciones fin">
      ${navigator.canShare ? '<button class="btn fantasma" id="v-share">📤 Compartir</button>' : ''}
      <button class="btn fantasma" id="v-down">⬇ Descargar</button>
      <button class="btn" data-cerrar>Cerrar</button></div>`, { alta: true });
  h.$('#v-down').onclick = () => B.descargar(blob, nombre);
  const s = h.$('#v-share');
  if (s) s.onclick = async () => {
    try { await navigator.share({ files: [new File([blob], nombre, { type: blob.type || B.mimeDe(nombre) })], title: nombre }); }
    catch (err) { if (err.name !== 'AbortError') B.descargar(blob, nombre); }
  };
};

/* ───────────── Acciones de los botones ───────────── */
const AJ = {
  modo(v) { const p = B.PRESETS.find(x => x.n === B.aj.preset) || B.PRESETS[0]; if (p.o !== (v === 'o')) { B.aj.preset = v === 'o' ? 'Spotify Oscuro' : 'Spotify Claro'; B.aj.acento = '#1DB954'; } },
  preset(v) { B.aj.preset = v; B.aj.acento = (B.PRESETS.find(x => x.n === v) || B.PRESETS[0]).ac; },
  acento(v) { B.aj.acento = v; },
  nivel(v) { B.aj.nivel = +v; },
  logocolor(v) { B.aj.logoColor = v; },
  fuente(v) { B.aj.fuente = v; },
  escala(v) { B.aj.escala = +v; },
  margen(v) { B.aj.margen = +v; },
  toast(v) { B.aj.toast = +v; B.toast('Así se verán los mensajes', `Duran ${v} segundos en pantalla.`, 'Info'); },
};
const aplicarAj = () => { B.guardarAj(); B.aplicarTema(); B.render(); };

const ACC = {
  ir: el => B.irA(el.dataset.p),
  tasa: () => B.hojaTasa(),
  'mes-ant': () => { B.ui.mes = new Date(B.ui.mes.getFullYear(), B.ui.mes.getMonth() - 1, 1); B.render(); },
  'mes-sig': () => { B.ui.mes = new Date(B.ui.mes.getFullYear(), B.ui.mes.getMonth() + 1, 1); B.render(); },

  filtro: el => { B.ui.filtro = el.dataset.f; B.render(); },
  'abrir-cli': el => {
    const card = el.closest('.cli'), id = el.dataset.id, ab = !B.ui.abiertos.has(id);
    ab ? B.ui.abiertos.add(id) : B.ui.abiertos.delete(id);
    card.classList.toggle('abierto', ab); el.setAttribute('aria-expanded', ab);
  },
  'nuevo-cli': () => B.hojaCliente(),
  'edit-cli': el => B.hojaCliente(B.cliente(el.dataset.id)),
  'del-cli': async el => {
    const c = B.cliente(el.dataset.id);
    if (!await B.confirmar('Eliminar cliente', `¿Eliminar a ${c.Nombre}?\nSus pagos ya registrados se conservan en Movimientos.`, { si: 'Eliminar', peligro: true })) return;
    await B.eliminarCliente(c); B.render(); B.toast('Cliente eliminado', c.Nombre, 'Info');
  },
  'pagar-cli': el => B.pagarCliente(B.cliente(el.dataset.id), el.dataset.i === undefined ? null : +el.dataset.i),

  'nuevo-plan': () => B.hojaPlan(),
  'edit-plan': el => B.hojaPlan(B.d.Planes.find(p => p.Id === el.dataset.id)),
  'del-plan': async el => {
    const p = B.d.Planes.find(x => x.Id === el.dataset.id);
    let msg = `¿Eliminar el plan de ${p.Admin}?`;
    if (p.Asignaciones.length) msg += `\n\nTiene ${p.Asignaciones.length} cuenta(s) asignada(s); quedarán sin plan.`;
    msg += '\nLas pruebas de pago guardadas no se borran.';
    if (!await B.confirmar('Eliminar plan', msg, { si: 'Eliminar', peligro: true })) return;
    B.d.Planes = B.d.Planes.filter(x => x.Id !== p.Id);
    await B.guardar(); B.render(); B.toast('Plan eliminado', p.Admin, 'Info');
  },
  'pagar-plan': el => B.pagarPlan(B.d.Planes.find(p => p.Id === el.dataset.id)),
  'add-miembro': el => B.hojaAgregarCuenta(B.d.Planes.find(p => p.Id === el.dataset.id)),
  retirar: async el => {
    const p = B.d.Planes.find(x => x.Id === el.dataset.p), c = B.cliente(el.dataset.c), i = +el.dataset.i;
    if (!await B.confirmar('Retirar del plan', `¿Retirar a ${c.Nombre} (${B.nombreCuenta(c, i)}) del plan de ${p.Admin}?\nQuedará un cupo libre.`, { si: 'Retirar', peligro: true })) return;
    p.Asignaciones = p.Asignaciones.filter(a => !(a.ClienteId === c.Id && a.Indice === i));
    await B.guardar(); B.render(); B.toast('Cuenta retirada', `${c.Nombre} salió del plan de ${p.Admin}`, 'Info');
  },
  comprobantes: el => B.hojaComprobantes(el.dataset.t, el.dataset.n),
  'ver-img': el => B.verImagen(el.dataset.r),

  'mov-modo': el => { B.ui.movModo = el.dataset.m; B.render(); },
  'cal-toggle': () => { B.ui.calAbierto = !B.ui.calAbierto; B.render(); },
  'cal-ant': () => { B.ui.calMes = new Date(B.ui.calMes.getFullYear(), B.ui.calMes.getMonth() - 1, 1); B.render(); },
  'cal-sig': () => { B.ui.calMes = new Date(B.ui.calMes.getFullYear(), B.ui.calMes.getMonth() + 1, 1); B.render(); },
  'cal-dia': el => { const d = B.deIso(el.dataset.f + 'T00:00:00'); B.ui.movDia = d; B.ui.calMes = new Date(d.getFullYear(), d.getMonth(), 1); B.ui.movModo = 'dia'; B.render(); },
  'nuevo-mov': () => B.hojaMovimiento(),
  'del-mov': async el => {
    const m = B.d.Movimientos.find(x => x.Id === el.dataset.id);
    if (await B.eliminarMovimiento(m)) { B.render(); B.toast('Movimiento eliminado', '', 'Info'); }
  },

  sec: el => {
    const card = el.closest('.sec'), k = el.dataset.k, ab = !B.ui.secs.has(k);
    ab ? B.ui.secs.add(k) : B.ui.secs.delete(k);
    card.classList.toggle('abierto', ab); el.setAttribute('aria-expanded', ab);
    if (ab && k === 'resp') B.pintarMas();
  },
  aj: el => { const f = AJ[el.dataset.g]; if (f) { f(el.dataset.v); aplicarAj(); } },
  tog: el => {
    const k = el.dataset.k;
    if (k === 'cristal') B.aj.cristal = !B.aj.cristal;
    else if (k === 'animado') B.aj.animado = !B.aj.animado;
    else if (k === 'logo') B.aj.logo = !B.aj.logo;
    else if (k === 'mostrarTasa') B.aj.mostrarTasa = !B.aj.mostrarTasa;
    else if (k === 'avisos') { B.d.AvisosActivos = !B.d.AvisosActivos; B.guardar(); }
    aplicarAj();
  },

  permiso: async () => {
    try { const r = await Notification.requestPermission(); B.render(); B.toast(r === 'granted' ? 'Avisos permitidos' : 'Avisos no permitidos', r === 'granted' ? 'Ahora recibirás notificaciones del teléfono.' : 'Puedes cambiarlo en los permisos del navegador.', r === 'granted' ? 'Exito' : 'Aviso'); }
    catch { B.aviso('Este navegador no permite avisos del sistema.'); }
  },
  'probar-aviso': async () => {
    const ok = await B.notificar('Bluumxsic · aviso de prueba', 'Así te llegarán los avisos de pago.');
    B.toast('Aviso de prueba', ok ? 'Revisa tus notificaciones.' : 'Permite los avisos del teléfono para verlo también como notificación.', ok ? 'Exito' : 'Info');
  },
  revisar: () => B.revisarPagos(true),
  'actualizar': async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) { B.toast('Sin actualización automática', `Esta copia (versión ${B.VERSION}) no usa archivos guardados. Vuelve a abrir la página para ver lo último.`, 'Info'); return; }
      B.toast('Buscando…', `Versión instalada: ${B.VERSION}`, 'Info');
      await reg.update();
      const w = reg.waiting || reg.installing;
      if (w) { await B.esperar(1500); location.reload(); }
      else { await B.esperar(600); B.toast('Todo al día', `Tienes la versión ${B.VERSION}.`, 'Exito'); B.estadoVersion(); }
    } catch { B.toast('No se pudo buscar', 'Revisa tu conexión a internet e inténtalo de nuevo.', 'Error'); }
  },
  'probar-toast': () => B.toast('Comprobante de pago subido', `Se guardó como «${B.hoy().getFullYear()}-${B.pad(B.hoy().getMonth() + 1)} ${B.MESES[B.hoy().getMonth()]}.jpg»`, 'Exito'),
  'probar-dlg': async () => {
    const si = await B.confirmar('¿Así se ven las confirmaciones?', 'Este mensaje es de la propia app: usa tus colores, tu fuente y el estilo cristal si lo tienes activado.', { si: 'Me gusta' });
    B.toast(si ? 'Perfecto' : 'Cancelado', si ? 'Los mensajes no usan cuadros del navegador.' : 'No se cambió nada.', si ? 'Exito' : 'Aviso');
  },

  'exp-compartir': () => exportar(true),
  'exp-descargar': () => exportar(false),
  importar: () => $('#archivo-respaldo').click(),
  'reset-aj': async () => {
    if (!await B.confirmar('Restablecer ajustes', 'Vuelven el tema, el nombre, el logo, la letra, el tamaño y la distribución a como venían de fábrica.\nTus clientes, pagos y comprobantes no cambian.', { si: 'Restablecer', peligro: true })) return;
    B.aj = Object.assign({}, B.AJ_DEF); aplicarAj(); B.toast('Ajustes restablecidos', '', 'Info');
  },
  instalar: async () => {
    const ev = B.ui.instalar; if (!ev) return;
    ev.prompt(); try { await ev.userChoice; } catch { }
    B.ui.instalar = null; B.render();
  },
};

async function exportar(compartir) {
  // contraseña opcional: '' = sin contraseña, null = canceló
  const clave = await B.pedirClave({
    titulo: 'Proteger el respaldo', nueva: true,
    intro: 'Si lo envías por WhatsApp o correo, ponle una contraseña para que solo tú puedas abrirlo. También puedes guardarlo sin contraseña.',
  });
  if (clave === null) return;
  const quitar = B.toast('Preparando respaldo…', clave ? 'Incluye tus datos y las fotos, cifrados con tu contraseña.' : 'Incluye tus datos y las fotos de comprobantes.', 'Info');
  try {
    let { blob, nombre, n } = await B.crearRespaldo();
    if (clave) { blob = await B.cripto.cifrar(blob, clave); nombre = nombre.replace(/\.zip$/, '.bluumxsic'); }
    quitar();
    const tipo = clave ? 'application/octet-stream' : 'application/zip';
    const file = new File([blob], nombre, { type: tipo });
    if (compartir && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Respaldo Bluumxsic' }); B.toast('Respaldo listo', `${n} imagen(es) de prueba incluidas${clave ? ' · con contraseña' : ''}.`, 'Exito'); return; }
      catch (err) { if (err.name === 'AbortError') return; }
    }
    B.descargar(blob, nombre);
    B.info(`Se guardaron tus datos y ${n} imagen(es) de prueba${clave ? ', protegidos con contraseña' : ''}.\n\n${nombre}\n\nGuárdalo en un lugar seguro (nube o USB).${clave ? '\nNo olvides la contraseña: sin ella no se puede abrir.' : ''}`, 'Respaldo guardado', 'Exito');
  } catch (err) { quitar(); B.error('No se pudo crear el respaldo: ' + (err.message || err)); }
}

async function importar(file) {
  try {
    const r = await B.leerRespaldo(file), d = r.Datos;
    const fecha = r.Fecha ? B.horaTexto(r.Fecha) : '';
    if (!await B.confirmar('Importar respaldo',
      `Este respaldo${fecha ? ' es del ' + fecha : ''} y trae:\n\n• ${(d.Clientes || []).length} cliente(s)\n• ${(d.Planes || []).length} plan(es)\n• ${(d.Movimientos || []).length} movimiento(s)\n• ${r.Archivos.length} imagen(es) de prueba\n\nSe reemplazarán los datos actuales (antes se guarda una copia de seguridad automática). ¿Continuar?`,
      { si: 'Importar', peligro: true })) return;
    const n = await B.restaurar(r);
    B.render();
    B.info(`Se restauraron los datos y ${n} imagen(es).`, 'Respaldo importado', 'Exito');
  } catch (err) { if (err && err.cancelado) return; B.error('No se pudo importar el respaldo: ' + (err.message || err)); }
}

/* ───────────── Eventos globales ───────────── */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const f = ACC[el.dataset.act];
  if (f) f(el);
});

document.addEventListener('input', ev => {
  if (ev.target.id === 'buscar') {
    B.ui.busca = ev.target.value;
    const tmp = document.createElement('div'); tmp.innerHTML = vClientes();
    $('#vista .lista').replaceWith(tmp.querySelector('.lista'));
  }
});

document.addEventListener('change', async ev => {
  const t = ev.target;
  if (t.id === 'archivo-respaldo' && t.files[0]) { const f = t.files[0]; importar(f).finally(() => { try { t.value = ''; } catch { } }); return; }
  if (t.id === 'hex-acento' || t.id === 'hex-logo') {
    const v = t.value.trim();
    if (t.id === 'hex-logo' && !v) { B.aj.logoColor = ''; aplicarAj(); return; }
    if (!B.color.esValido(v)) { B.aviso('Escribe un color en formato #RRGGBB, por ejemplo #FF5733.'); t.value = t.id === 'hex-acento' ? B.aj.acento : B.aj.logoColor; return; }
    const hex = '#' + v.replace('#', '').toUpperCase();
    if (t.id === 'hex-acento') B.aj.acento = hex; else B.aj.logoColor = hex;
    aplicarAj(); return;
  }
  if (t.id === 'aj-nombre') { B.aj.nombre = t.value.trim() || B.AJ_DEF.nombre; aplicarAj(); return; }
  if (t.id === 'aj-sub') { B.aj.sub = t.value.trim(); aplicarAj(); return; }
  if (t.id === 'aj-hora') { const n = parseInt(t.value, 10); B.d.AvisoHora = n >= 0 && n <= 23 ? n : B.d.AvisoHora; t.value = B.d.AvisoHora; await B.guardar(); return; }
  if (t.id === 'aj-dias') { const n = parseInt(t.value, 10); B.d.DiasCerca = n >= 0 && n <= 30 ? n : B.d.DiasCerca; t.value = B.d.DiasCerca; await B.guardar(); B.renderTabs(); return; }
});

/* ───────────── Arranque ───────────── */
(async function iniciar() {
  await B.cargar();
  B.aplicarTema();
  B.render();
  if (B.sinAlmacen) B.aviso('Este navegador no deja guardar datos (¿modo privado?). Lo que hagas no se conservará al cerrar.');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(async reg => {
      try {   // en Android con la app instalada, el sistema puede revisar los pagos de vez en cuando
        if ('periodicSync' in reg) await reg.periodicSync.register('revisar-pagos', { minInterval: 12 * 3600 * 1000 });
      } catch { }
    }).catch(() => { });
  }
  try {   // avisa una sola vez cuando la app pasa a una versión nueva
    const antes = localStorage.getItem('bluumxsic-ver');
    if (antes && antes !== B.VERSION) setTimeout(() => B.toast('App actualizada', `Ahora usas la versión ${B.VERSION} (antes ${antes}).`, 'Exito'), 1500);
    localStorage.setItem('bluumxsic-ver', B.VERSION);
  } catch { }
  window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); B.ui.instalar = ev; if (B.ui.pag === 'mas') B.render(); });
  window.addEventListener('appinstalled', () => { B.ui.instalar = null; B.toast('App instalada', 'Ya puedes abrirla desde tu pantalla de inicio.', 'Exito'); });
  try { navigator.storage?.persist?.(); } catch { }

  // tasa BCV: al abrir (si tiene más de una hora) y cada hora
  const vieja = !B.d.TasaActualizada || (Date.now() - new Date(B.d.TasaActualizada).getTime()) > 3600e3;
  if (B.d.AutoActualizar && (vieja || !(B.d.Tasa > 0))) B.actualizarTasa(true);
  setInterval(() => { if (B.d.AutoActualizar && !document.hidden) B.actualizarTasa(true); }, 3600e3);

  // avisos de pago y cambio de día
  setTimeout(() => B.revisarPagos(false), 1200);
  setInterval(() => B.revisarPagos(false), 10 * 60e3);
  let dia = B.aIso(B.hoy());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (B.aIso(B.hoy()) !== dia) { dia = B.aIso(B.hoy()); B.ui.movDia = B.hoy(); }
    if (!B._hojas.length) B.render();
    B.revisarPagos(false);
  });
})();
