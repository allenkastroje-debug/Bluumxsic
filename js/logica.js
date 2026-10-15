/* Lógica del negocio: datos, estados de pago, clientes, planes, movimientos, comprobantes, tasa BCV, avisos y respaldo.
   Los datos usan los mismos nombres de campo que la app de Windows para que el respaldo .json sea intercambiable. */
'use strict';

B.EXT_OK = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'];
B.MAX_PERSONAS = 6;

/* ───────────── Carga y guardado ───────────── */
B.datosBase = () => ({
  Clientes: [], Movimientos: [], Planes: [], Pruebas: [],
  Tasa: 0, TasaActualizada: null, AutoActualizar: true,
  AvisosActivos: true, AvisoHora: 9, DiasCerca: 3, UltimoAviso: null,
});

B.normalizar = (src = {}) => {
  const d = Object.assign(B.datosBase(), src);
  for (const k of ['Clientes', 'Movimientos', 'Planes', 'Pruebas']) if (!Array.isArray(d[k])) d[k] = [];
  d.Tasa = Number(d.Tasa) || 0;
  d.DiasCerca = Number.isInteger(d.DiasCerca) && d.DiasCerca >= 0 ? d.DiasCerca : 3;
  d.AvisoHora = Number.isInteger(d.AvisoHora) && d.AvisoHora >= 0 && d.AvisoHora <= 23 ? d.AvisoHora : 9;
  for (const c of d.Clientes) {
    c.Id ||= B.uuid();
    c.Nombre ||= ''; c.Telefono ||= ''; c.Notas ||= ''; c.Moneda = c.Moneda === 'VES' ? 'VES' : 'USD';
    c.Monto = Number(c.Monto) || 0;
    c.Cuentas = Math.max(1, c.Cuentas | 0);
    if (!Array.isArray(c.Usuarios)) c.Usuarios = [];
    if (!c.Usuarios.length && c.Usuario) c.Usuarios.push(c.Usuario);
    while (c.Usuarios.length < c.Cuentas) c.Usuarios.push('');
    c.Usuario = c.Usuarios[0] || '';
    c.ProximoPago ||= B.aIso(B.hoy());
    c.UltimoPago ||= null; c.Carpeta ||= '';
    // fechas de pago por cuenta (si no, todas las cuentas comparten ProximoPago)
    c.FechasPorCuenta = !!c.FechasPorCuenta && c.Cuentas > 1;
    if (!Array.isArray(c.ProximosPagos)) c.ProximosPagos = [];
    if (!Array.isArray(c.UltimosPagos)) c.UltimosPagos = [];
    while (c.ProximosPagos.length < c.Cuentas) c.ProximosPagos.push(c.ProximoPago);
    while (c.UltimosPagos.length < c.Cuentas) c.UltimosPagos.push(c.UltimoPago);
    c.ProximosPagos.length = c.Cuentas; c.UltimosPagos.length = c.Cuentas;
    B.sincronizar(c);
  }
  for (const p of d.Planes) {
    p.Id ||= B.uuid();
    p.Admin ||= ''; p.Cuenta ||= ''; p.Moneda = p.Moneda === 'VES' ? 'VES' : 'USD';
    p.Monto = Number(p.Monto) || 0;
    p.ProximoPago ||= B.aIso(B.hoy()); p.UltimoPago ||= null; p.Carpeta ||= '';
    if (!Array.isArray(p.Asignaciones)) p.Asignaciones = [];
    if (Array.isArray(p.Miembros) && p.Miembros.length && !p.Asignaciones.length)
      p.Asignaciones = p.Miembros.map(id => ({ ClienteId: id, Indice: 0 }));   // formato antiguo
    p.Miembros = [];
  }
  for (const m of d.Movimientos) {
    m.Id ||= B.uuid(); m.Monto = Number(m.Monto) || 0; m.Tasa = Number(m.Tasa) || 0;
    m.Moneda = m.Moneda === 'VES' ? 'VES' : 'USD'; m.Tipo = m.Tipo === 'Gasto' ? 'Gasto' : 'Ingreso';
    m.Descripcion ||= ''; m.ClienteId ||= null; m.Prueba ||= null;
  }
  return d;
};

B.cargar = async () => {
  let d = null, a = null;
  try { d = await B.db.get('kv', 'datos'); a = await B.db.get('kv', 'ajustes'); }
  catch (e) { B.sinAlmacen = true; }
  B.d = B.normalizar(d || {});
  B.aj = Object.assign({}, B.AJ_DEF, a || {});
};

B.guardar = () => B.db.set('kv', 'datos', B.d).catch(() =>
  B.error('No se pudieron guardar los datos en este teléfono. Revisa el espacio disponible o que el navegador no esté en modo privado.'));
B.guardarAj = () => B.db.set('kv', 'ajustes', B.aj).catch(() => { });

/* ───────────── Estados de pago ───────────── */
B.estadoDe = dias => dias < 0 ? 'Debe' : dias === 0 ? 'Hoy' : dias <= B.d.DiasCerca ? 'Cerca' : 'Pagado';
B.diasTexto = d => d < 0 ? `${-d} día(s) de retraso` : d === 0 ? 'Hoy' : `En ${d} día(s)`;
B.ESTADO_COLOR = { Debe: 'var(--danger)', Hoy: 'var(--hoy)', Cerca: 'var(--warn)', Pagado: 'var(--ok)' };

B.cDias = c => B.dias(c.ProximoPago);
B.cEstado = c => B.estadoDe(B.cDias(c));
B.cEstadoTexto = c => ({ Debe: '✖ Debe', Hoy: '● Vence hoy', Cerca: '◔ Por vencer' }[B.cEstado(c)] || (c.UltimoPago ? '✔ Pagado' : '✔ Al día'));
/* Con «fechas por cuenta», ProximoPago/UltimoPago guardan la más próxima / la última de todas. */
B.porCuenta = c => !!c.FechasPorCuenta && c.Cuentas > 1;
B.sincronizar = c => {
  if (!B.porCuenta(c)) return;
  const f = c.ProximosPagos.slice(0, c.Cuentas).filter(Boolean).sort();
  if (f.length) c.ProximoPago = f[0];
  const u = c.UltimosPagos.slice(0, c.Cuentas).filter(Boolean).sort();
  c.UltimoPago = u.length ? u[u.length - 1] : null;
};
B.cFecha = (c, i) => (B.porCuenta(c) && c.ProximosPagos[i]) || c.ProximoPago;
B.cDiasC = (c, i) => B.dias(B.cFecha(c, i));
B.cEstadoC = (c, i) => B.estadoDe(B.cDiasC(c, i));
B.estadoTextoDe = (est, pagado) => ({ Debe: '✖ Debe', Hoy: '● Vence hoy', Cerca: '◔ Por vencer' }[est] || (pagado ? '✔ Pagado' : '✔ Al día'));
B.cobraEl = (c, d) => B.porCuenta(c) ? c.ProximosPagos.slice(0, c.Cuentas).some(f => B.mismoDia(B.deIso(f), d)) : B.mismoDia(B.deIso(c.ProximoPago), d);
B.iUrgente = c => { let m = 0; for (let i = 1; i < c.Cuentas; i++) if (B.cFecha(c, i) < B.cFecha(c, m)) m = i; return m; };
/* Pagos que vencen en los próximos N días (una entrada por cuenta cuando tienen fechas distintas). */
B.cobrosProximos = max => {
  const r = [];
  for (const c of B.d.Clientes) {
    if (B.porCuenta(c)) { for (let i = 0; i < c.Cuentas; i++) if (B.cDiasC(c, i) <= max) r.push({ c, i, fecha: B.cFecha(c, i) }); }
    else if (B.cDias(c) <= max) r.push({ c, i: null, fecha: c.ProximoPago });
  }
  return r.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.c.Nombre.localeCompare(b.c.Nombre));
};
B.pEstadoTexto = p => ({ Debe: '✖ Plan vencido', Hoy: '● Se paga hoy', Cerca: '◔ Por pagar' }[B.estadoDe(B.dias(p.ProximoPago))] || '✔ Plan pagado');

B.nombreCuenta = (c, i) => (c.Usuarios[i] && c.Usuarios[i].trim()) ? '@' + c.Usuarios[i].trim().replace(/^@+/, '') : `Cuenta ${i + 1} (sin usuario)`;
B.usuariosTexto = c => c.Usuarios.slice(0, Math.max(1, c.Cuentas)).filter(u => u && u.trim()).map(u => '@' + u.trim().replace(/^@+/, '')).join(', ');
B.cuentasTexto = c => c.Cuentas === 1 ? '1 cuenta' : `${c.Cuentas} cuentas`;
B.cSub = c => [B.usuariosTexto(c), B.cuentasTexto(c), c.Telefono].filter(Boolean).join(' · ');

B.planDeCuenta = (c, i) => B.d.Planes.find(p => p.Asignaciones.some(a => a.ClienteId === c.Id && a.Indice === i));
B.ocupados = p => 1 + p.Asignaciones.length;
B.libres = p => Math.max(0, B.MAX_PERSONAS - B.ocupados(p));
B.cliente = id => B.d.Clientes.find(c => c.Id === id);

B.mUsd = m => m.Moneda === 'USD' ? m.Monto : (m.Tasa > 0 ? m.Monto / m.Tasa : 0);
B.mVes = m => m.Moneda === 'VES' ? m.Monto : m.Monto * m.Tasa;
B.aUsd = (v, mon) => mon === 'USD' ? v : (B.d.Tasa > 0 ? v / B.d.Tasa : 0);
B.aVes = (v, mon) => mon === 'VES' ? v : v * B.d.Tasa;

/* ───────────── Carpetas y comprobantes ───────────── */
B.carpetasUsadas = async () => {
  const s = new Set();
  for (const c of B.d.Clientes) if (c.Carpeta) s.add(c.Carpeta.toLowerCase());
  for (const p of B.d.Planes) if (p.Carpeta) s.add(p.Carpeta.toLowerCase());
  for (const k of await B.db.keys('pruebas')) s.add(String(k).split('/').slice(0, -1).join('/').toLowerCase());
  return s;
};

/* Una carpeta por cliente (y "_Planes/" para los administradores), sin repetir nombres. */
B.crearCarpeta = async (nombre, detalle, padre) => {
  const base = B.limpiarNombre(detalle && detalle.trim() ? `${nombre} (${detalle.trim().replace(/^@+/, '')})` : nombre);
  const ruta = n => padre ? `${padre}/${n}` : n, usadas = await B.carpetasUsadas();
  let rel = ruta(base);
  for (let i = 2; usadas.has(rel.toLowerCase()); i++) rel = ruta(`${base} (${i})`);
  return rel;
};

B.extension = f => {
  const m = /\.[a-z0-9]+$/i.exec(f.name || '');
  if (m && B.EXT_OK.includes(m[0].toLowerCase())) return m[0].toLowerCase();
  const t = (f.type || '').toLowerCase();
  return t === 'image/png' ? '.png' : t === 'image/webp' ? '.webp' : t === 'image/gif' ? '.gif' : t === 'image/bmp' ? '.bmp' : t.startsWith('image/') ? '.jpg' : '';
};

B.esImagen = f => !!f && ((f.type || '').startsWith('image/') || B.EXT_OK.includes((/\.[a-z0-9]+$/i.exec(f.name || '') || [''])[0].toLowerCase()));

/* Las fotos del teléfono pesan varios MB: se reducen para que el respaldo no sea enorme. */
B.comprimir = async (file, max = 1800, q = .85) => {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bmp.width * k)); cv.height = Math.max(1, Math.round(bmp.height * k));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    if (bmp.close) bmp.close();
    return await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
  } catch { return null; }
};

B.nombrePrueba = (periodo, ext, usados) => {
  const base = `${periodo.getFullYear()}-${B.pad(periodo.getMonth() + 1)} ${B.MESES[periodo.getMonth()]}`;
  let n = base + ext;
  for (let i = 2; usados.has(n.toLowerCase()); i++) n = `${base} (${i})${ext}`;
  return n;
};

/* Guarda la imagen con el nombre del mes al que pertenece el pago: "2026-10 Octubre.jpg". */
B.guardarPrueba = async (file, carpeta, titular, periodo, clienteId, planId) => {
  if (!B.esImagen(file)) throw new Error('El archivo debe ser una imagen (png, jpg, webp, bmp o gif).');
  let blob = file, ext = B.extension(file) || '.jpg';
  if (file.size > 1.6e6 || !B.extension(file)) {
    const c = await B.comprimir(file);
    if (c && (c.size < file.size || !B.extension(file))) { blob = c; ext = '.jpg'; }
  }
  const claves = await B.db.keys('pruebas');
  const usados = new Set(claves.filter(k => String(k).startsWith(carpeta + '/')).map(k => String(k).slice(carpeta.length + 1).toLowerCase()));
  const nombre = B.nombrePrueba(periodo, ext, usados);
  const clave = `${carpeta}/${nombre}`;
  await B.db.set('pruebas', clave, blob);
  const reg = {
    Id: B.uuid(), Titular: titular, ClienteId: clienteId || null, PlanId: planId || null,
    Archivo: clave, Original: file.name || 'foto', Periodo: `${periodo.getFullYear()}-${B.pad(periodo.getMonth() + 1)}`,
    FechaPago: B.aIso(B.hoy()),
  };
  B.d.Pruebas.push(reg);
  return reg;
};

B.nombreArchivo = ruta => String(ruta || '').split('/').pop();

/* ───────────── Clientes ───────────── */
B.validarCliente = (f, usuarios, fechas = []) => {
  if (!f.Nombre.trim()) return 'Escribe el nombre del cliente.';
  const cuentas = parseInt(String(f.Cuentas).trim(), 10);
  if (!(cuentas >= 1 && cuentas <= 20)) return 'Escribe cuántas cuentas alquila (de 1 a 20).';
  const us = usuarios.slice(0, cuentas).map(u => u.trim().replace(/^@+/, '').toLowerCase()).filter(Boolean);
  if (new Set(us).size !== us.length) return 'Dos cuentas tienen el mismo usuario. Cada cuenta debe tener el suyo.';
  const m = B.tryNum(f.Monto);
  if (!(m > 0)) return 'Escribe el monto que paga (mayor que cero).';
  if (!B.deIso(f.ProximoPago)) return 'Elige la próxima fecha de pago.';
  if (f.FechasPorCuenta && cuentas > 1)
    for (let i = 0; i < cuentas; i++) if (!B.deIso(fechas[i])) return `Elige la fecha de pago de la cuenta ${i + 1}.`;
  return null;
};

B.guardarCliente = async (f, usuarios, editId, fechas = []) => {
  const cuentas = parseInt(String(f.Cuentas).trim(), 10);
  const porCuenta = !!f.FechasPorCuenta && cuentas > 1;
  const base = B.aIso(B.deIso(f.ProximoPago));
  const proximos = Array.from({ length: cuentas }, (_, i) => porCuenta ? B.aIso(B.deIso(fechas[i])) : base);
  const datos = {
    FechasPorCuenta: porCuenta, ProximosPagos: proximos,
    Nombre: f.Nombre.trim(), Telefono: f.Telefono.trim(), Notas: f.Notas.trim(),
    Cuentas: cuentas, Usuarios: usuarios.slice(0, cuentas).map(u => u.trim().replace(/^@+/, '')),
    Monto: B.tryNum(f.Monto), Moneda: f.Moneda === 'VES' ? 'VES' : 'USD',
    ProximoPago: [...proximos].sort()[0],
  };
  datos.Usuario = datos.Usuarios[0] || '';
  if (editId) {
    const c = B.cliente(editId);
    const ult = Array.from({ length: cuentas }, (_, i) => (c.UltimosPagos && c.UltimosPagos[i]) || (i >= (c.UltimosPagos || []).length ? c.UltimoPago : null) || null);
    Object.assign(c, datos, { UltimosPagos: ult });
    // si ahora alquila menos cuentas, se sueltan las que sobran en los planes
    for (const p of B.d.Planes) p.Asignaciones = p.Asignaciones.filter(a => a.ClienteId !== c.Id || a.Indice < c.Cuentas);
  } else {
    B.d.Clientes.push(Object.assign({ Id: B.uuid(), UltimoPago: null, Carpeta: '', UltimosPagos: Array(cuentas).fill(null) }, datos));
  }
  B.d.Clientes.forEach(c => { while (c.Usuarios.length < c.Cuentas) c.Usuarios.push(''); B.sincronizar(c); });
  await B.guardar();
};

B.eliminarCliente = async c => {
  B.d.Clientes = B.d.Clientes.filter(x => x.Id !== c.Id);
  for (const p of B.d.Planes) p.Asignaciones = p.Asignaciones.filter(a => a.ClienteId !== c.Id);
  await B.guardar();
};

B.registrarPagoCliente = async (c, file, i = null) => {
  const porCuenta = B.porCuenta(c) && i !== null && i >= 0 && i < c.Cuentas;
  const periodo = B.deIso(porCuenta ? B.cFecha(c, i) : c.ProximoPago), nuevo = B.addMeses(periodo, 1);
  if (!c.Carpeta) c.Carpeta = await B.crearCarpeta(c.Nombre, (c.Usuarios[0] || '').trim());
  const reg = await B.guardarPrueba(file, c.Carpeta, c.Nombre, periodo, c.Id, null);
  const us = B.usuariosTexto(c);
  B.d.Movimientos.push({
    Id: B.uuid(), Fecha: B.aIso(B.hoy()), Tipo: 'Ingreso',
    Descripcion: porCuenta ? `Pago ${c.Nombre} (${B.nombreCuenta(c, i)}) · cuenta ${i + 1} de ${c.Cuentas}`
      : `Pago ${c.Nombre}${us ? ` (${us})` : ''} · ${B.cuentasTexto(c)}`,
    Monto: c.Monto, Moneda: c.Moneda, Tasa: B.d.Tasa, ClienteId: c.Id, CuentaIndice: porCuenta ? i : null, Prueba: reg.Archivo,
  });
  if (porCuenta) {
    c.ProximosPagos[i] = B.aIso(nuevo); c.UltimosPagos[i] = B.aIso(B.hoy());
    B.sincronizar(c);
  } else {
    c.UltimoPago = B.aIso(B.hoy());
    c.ProximoPago = B.aIso(nuevo);
    c.ProximosPagos = Array(c.Cuentas).fill(c.ProximoPago);
  }
  await B.guardar();
  return reg;
};

/* ───────────── Planes familiares ───────────── */
B.validarPlan = f => {
  if (!f.Admin.trim()) return 'Escribe el nombre del administrador del plan.';
  if (!(B.tryNum(f.Monto) > 0)) return 'Escribe cuánto cuesta el plan (mayor que cero).';
  if (!B.deIso(f.ProximoPago)) return 'Elige la fecha en que se paga el plan.';
  return null;
};

B.guardarPlan = async (f, editId) => {
  const datos = {
    Admin: f.Admin.trim(), Cuenta: f.Cuenta.trim(), Monto: B.tryNum(f.Monto),
    Moneda: f.Moneda === 'VES' ? 'VES' : 'USD', ProximoPago: B.aIso(B.deIso(f.ProximoPago)),
  };
  if (editId) Object.assign(B.d.Planes.find(p => p.Id === editId), datos);
  else B.d.Planes.push(Object.assign({ Id: B.uuid(), UltimoPago: null, Carpeta: '', Asignaciones: [], Miembros: [] }, datos));
  await B.guardar();
};

B.cuentasLibres = () => {
  const r = [];
  for (const c of B.d.Clientes) for (let i = 0; i < c.Cuentas; i++) if (!B.planDeCuenta(c, i)) r.push({ c, i });
  return r;
};

B.registrarPagoPlan = async (p, file) => {
  const periodo = B.deIso(p.ProximoPago), nuevo = B.addMeses(periodo, 1);
  if (!p.Carpeta) p.Carpeta = await B.crearCarpeta(p.Admin, p.Cuenta, '_Planes');
  const reg = await B.guardarPrueba(file, p.Carpeta, p.Admin, periodo, null, p.Id);
  B.d.Movimientos.push({
    Id: B.uuid(), Fecha: B.aIso(B.hoy()), Tipo: 'Gasto', Descripcion: `Plan familiar · ${p.Admin}`,
    Monto: p.Monto, Moneda: p.Moneda, Tasa: B.d.Tasa, ClienteId: null, Prueba: reg.Archivo,
  });
  p.UltimoPago = B.aIso(B.hoy());
  p.ProximoPago = B.aIso(nuevo);
  await B.guardar();
  return reg;
};

/* ───────────── Movimientos ───────────── */
B.guardarMovimiento = async f => {
  const monto = B.tryNum(f.Monto);
  if (!(monto > 0)) return 'Escribe un monto válido (mayor que cero).';
  if (!(B.d.Tasa > 0)) return 'Primero define o actualiza la tasa BCV (arriba) para poder calcular los equivalentes.';
  const fecha = B.deIso(f.Fecha) || B.hoy();
  B.d.Movimientos.push({
    Id: B.uuid(), Fecha: B.aIso(fecha), Tipo: f.Tipo === 'Gasto' ? 'Gasto' : 'Ingreso',
    Descripcion: f.Descripcion.trim() || (f.Tipo === 'Gasto' ? 'Gasto' : 'Ingreso'),
    Monto: monto, Moneda: f.Moneda === 'VES' ? 'VES' : 'USD', Tasa: B.d.Tasa, ClienteId: null, Prueba: null,
  });
  await B.guardar();
  return null;
};

/* Elimina un movimiento; si era el pago de un cliente ofrece devolver su fecha de pago. */
B.eliminarMovimiento = async m => {
  if (!await B.confirmar('Eliminar movimiento',
    `¿Eliminar este movimiento?\n\n${B.fechaCorta(m.Fecha)} · ${m.Descripcion} · ${B.montoMov(m)}`, { si: 'Eliminar', peligro: true })) return false;
  B.d.Movimientos = B.d.Movimientos.filter(x => x.Id !== m.Id);
  const c = m.ClienteId ? B.cliente(m.ClienteId) : null;
  const ci = Number.isInteger(m.CuentaIndice) ? m.CuentaIndice : null;
  if (c && B.porCuenta(c) && ci !== null && ci < c.Cuentas) {
    const antes = B.aIso(B.addMeses(B.deIso(B.cFecha(c, ci)), -1));
    if (await B.confirmar('Revertir pago',
      `Este movimiento era un pago de ${c.Nombre} (${B.nombreCuenta(c, ci)}).\n¿Devolver la fecha de esa cuenta al ${B.fechaCorta(antes)}?`, { si: 'Sí, devolver', no: 'No' })) {
      c.ProximosPagos[ci] = antes; c.UltimosPagos[ci] = null; B.sincronizar(c);
    }
  } else if (c && await B.confirmar('Revertir pago',
    `Este movimiento era un pago de ${c.Nombre}.\n¿Devolver su próximo pago al ${B.fechaCorta(B.aIso(B.addMeses(B.deIso(c.ProximoPago), -1)))}?`, { si: 'Sí, devolver', no: 'No' })) {
    c.ProximoPago = B.aIso(B.addMeses(B.deIso(c.ProximoPago), -1));
    c.UltimoPago = null;
    c.ProximosPagos = Array(c.Cuentas).fill(c.ProximoPago);
  }
  await B.guardar();
  return true;
};

B.montoMov = m => (m.Tipo === 'Ingreso' ? '+ ' : '− ') + B.dinero(m.Monto, m.Moneda);
B.equivMov = m => m.Moneda === 'USD' ? B.ves(B.mVes(m)) : B.usd(B.mUsd(m));

B.resumenMes = fecha => {
  const a = fecha.getFullYear(), mes = fecha.getMonth();
  const ms = B.d.Movimientos.filter(m => { const d = B.deIso(m.Fecha); return d && d.getFullYear() === a && d.getMonth() === mes; });
  const suma = (t, f) => ms.filter(m => m.Tipo === t).reduce((s, m) => s + f(m), 0);
  const iU = suma('Ingreso', B.mUsd), iV = suma('Ingreso', B.mVes), gU = suma('Gasto', B.mUsd), gV = suma('Gasto', B.mVes);
  const fin = new Date(a, mes + 1, 0), esActual = a === B.hoy().getFullYear() && mes === B.hoy().getMonth();
  const vence = f => { const d = B.deIso(f); return !!d && (esActual ? d <= fin : (d.getFullYear() === a && d.getMonth() === mes)); };
  // (cliente, cuántas cuentas por cobrar): una sola cuenta por cliente, o cada cuenta con su fecha
  const porCobrar = B.d.Clientes.map(c => ({ c, n: B.porCuenta(c) ? c.ProximosPagos.slice(0, c.Cuentas).filter(vence).length : (vence(c.ProximoPago) ? 1 : 0) }))
    .filter(x => x.n > 0);
  return {
    iU, iV, gU, gV, bU: iU - gU, bV: iV - gV, n: ms.length,
    cU: porCobrar.reduce((s, x) => s + B.aUsd(x.c.Monto * x.n, x.c.Moneda), 0),
    cV: porCobrar.reduce((s, x) => s + B.aVes(x.c.Monto * x.n, x.c.Moneda), 0),
  };
};

/* ───────────── Tasa BCV ───────────── */
B.actualizarTasa = async (silencioso = false) => {
  try {
    const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
    const j = await r.json();
    const v = Number(j.promedio);
    if (!(v > 0)) throw new Error('sin tasa');
    B.d.Tasa = v; B.d.TasaActualizada = B.ahoraIso();
    await B.guardar();
    B.render();
    if (!silencioso) B.toast('Tasa actualizada', `Bs ${B.tasaTxt(v)} por US$ · DolarApi (tasa oficial BCV)`);
    return true;
  } catch {
    if (!silencioso) B.aviso('No pude consultar la tasa en internet. Revisa tu conexión o escríbela a mano tocando el recuadro de la tasa.');
    return false;
  }
};

B.mensajeTasa = () => !(B.d.Tasa > 0) ? 'Sin tasa: toca para definirla'
  : B.d.TasaActualizada ? 'Actualizada ' + B.horaTexto(B.d.TasaActualizada) : 'Definida a mano';

/* ───────────── Avisos de pago ───────────── */
B.pendientes = () => {
  const r = { hoy: [], debe: [], cerca: [] };
  const poner = (e, t) => (e === 'Hoy' ? r.hoy : e === 'Debe' ? r.debe : e === 'Cerca' ? r.cerca : null)?.push(t);
  for (const c of B.d.Clientes) {
    if (B.porCuenta(c)) for (let i = 0; i < c.Cuentas; i++) poner(B.cEstadoC(c, i), `${c.Nombre} (${B.nombreCuenta(c, i)})`);
    else poner(B.cEstado(c), c.Nombre);
  }
  for (const p of B.d.Planes) poner(B.estadoDe(B.dias(p.ProximoPago)), 'Plan de ' + p.Admin);
  return r;
};

B.textoPendientes = r => {
  const t = [];
  if (r.debe.length) t.push(`${r.debe.length} atrasado(s): ${r.debe.slice(0, 3).join(', ')}${r.debe.length > 3 ? '…' : ''}`);
  if (r.hoy.length) t.push(`Vencen hoy: ${r.hoy.slice(0, 3).join(', ')}${r.hoy.length > 3 ? '…' : ''}`);
  if (r.cerca.length) t.push(`${r.cerca.length} por vencer`);
  return t.join(' · ');
};

B.notificar = async (titulo, cuerpo) => {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker?.getRegistration();
    const op = { body: cuerpo, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'pagos' };
    if (reg) await reg.showNotification(titulo, op); else new Notification(titulo, op);
    return true;
  } catch { return false; }
};

/* manual = botón "Revisar ahora". Automático: una vez al día pasada la hora elegida. */
B.revisarPagos = async (manual = false) => {
  const r = B.pendientes(), texto = B.textoPendientes(r), hay = r.debe.length + r.hoy.length + r.cerca.length > 0;
  if (manual) {
    if (!hay) { B.toast('Todo al día', 'No hay pagos vencidos, para hoy ni por vencer.', 'Exito'); return; }
    B.toast('Pagos pendientes', texto, 'Aviso');
    await B.notificar('Bluumxsic · pagos', texto);
    return;
  }
  if (!B.d.AvisosActivos || !hay) return;
  const ahora = new Date(), hoyIso = B.aIso(B.hoy());
  if (ahora.getHours() < B.d.AvisoHora || B.d.UltimoAviso === hoyIso) return;
  B.d.UltimoAviso = hoyIso;
  await B.guardar();
  B.toast('Pagos pendientes', texto, 'Aviso');
  await B.notificar('Bluumxsic · pagos', texto);
};

/* ───────────── Respaldo (.zip) ───────────── */
const aBase64 = blob => new Promise((ok, mal) => {
  const fr = new FileReader();
  fr.onload = () => ok(String(fr.result).split(',')[1] || '');
  fr.onerror = () => mal(fr.error);
  fr.readAsDataURL(blob);
});
const deBase64 = (b64, tipo) => {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: tipo });
};
B.mimeDe = ruta => ({ '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' }[(/\.[a-z0-9]+$/i.exec(ruta) || [''])[0].toLowerCase()] || 'image/jpeg');

/* Mismo formato que el respaldo de la app de Windows (v2.2): se pueden pasar datos y comprobantes en ambos sentidos. */
B.crearRespaldo = async () => {
  const claves = await B.db.keys('pruebas'), entradas = [];
  for (const k of claves) {
    const blob = await B.db.get('pruebas', k);
    if (blob) entradas.push({ nombre: 'comprobantes/' + String(k), datos: blob });
  }
  const d = B.d;
  const datos = {
    Clientes: d.Clientes, Movimientos: d.Movimientos, Planes: d.Planes, Pruebas: d.Pruebas,
    Tasa: d.Tasa, TasaActualizada: d.TasaActualizada, AutoActualizar: d.AutoActualizar,
    AvisosActivos: d.AvisosActivos, AvisoHora: d.AvisoHora, DiasCerca: d.DiasCerca, UltimoAviso: d.UltimoAviso,
  };
  const json = JSON.stringify({ Version: 2, App: 'Bluumxsic SP-Control', Fecha: B.ahoraIso(), Datos: datos, Archivos: [] }, null, 1);
  entradas.push({ nombre: 'datos.json', datos: json });
  const n = new Date();
  const nombre = `Bluumxsic-respaldo-${n.getFullYear()}${B.pad(n.getMonth() + 1)}${B.pad(n.getDate())}-${B.pad(n.getHours())}${B.pad(n.getMinutes())}.zip`;
  return { blob: await B.zip.crear(entradas), nombre, n: claves.length };
};

B.descargar = (blob, nombre) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

B.leerArchivoTexto = async file => {
  const intentos = [() => file.text(), () => new Response(file).text(),
    () => new Promise((ok, mal) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => mal(fr.error); fr.readAsText(file); })];
  let ult;
  for (const f of intentos) { try { return await f(); } catch (e) { ult = e; } }
  throw new Error('No se pudo leer el archivo desde el teléfono (' + (ult?.name || 'error') + '). Cópialo a la carpeta Descargas y vuelve a elegirlo desde ahí.');
};

const validarRespaldo = r => {
  if (!r || typeof r !== 'object' || !r.Datos || !(r.Version >= 1)) throw new Error('Este archivo no es un respaldo de Bluumxsic.');
};

/* Acepta el .zip nuevo (datos.json + comprobantes/) y el .json antiguo (fotos en Base64).
   Devuelve { Version, Fecha, Datos, Archivos: [{ Ruta, obtener(): Promise<Blob> }] } */
B.leerRespaldo = async file => {
  if (!file.size) throw new Error('El archivo está vacío (0 KB). Vuelve a copiarlo; puede que la extracción quedara incompleta.');
  const cab = await B.zip.bytes(file.slice(0, 4));
  if (cab[0] === 0x50 && cab[1] === 0x4B) {
    const lista = await B.zip.leer(file);
    const ed = lista.find(x => x.nombre.toLowerCase() === 'datos.json');
    if (!ed) throw new Error('El .zip no trae «datos.json»: no es un respaldo de Bluumxsic.');
    let r;
    try { r = JSON.parse((await (await ed.leer()).text()).replace(/^\uFEFF/, '')); } catch (e) { if (e.message && /contraseña|zip|navegador|compresión/.test(e.message)) throw e; throw new Error('«datos.json» está dañado o incompleto.'); }
    validarRespaldo(r);
    r.Archivos = lista.filter(x => /^comprobantes\//i.test(x.nombre))
      .map(x => ({ Ruta: x.nombre.replace(/^comprobantes\//i, ''), obtener: x.leer }));
    return r;
  }
  let txt = await B.leerArchivoTexto(file);
  txt = txt.replace(/^\uFEFF/, '').trim();
  let r;
  try { r = JSON.parse(txt); } catch (e) {
    throw new Error('El archivo no es un respaldo completo (' + Math.round(file.size / 1024) + ' KB leídos). Puede estar cortado o dañado: ' + (e.message || e));
  }
  validarRespaldo(r);
  r.Archivos = (Array.isArray(r.Archivos) ? r.Archivos : []).map(a => ({ Ruta: a.Ruta, obtener: async () => deBase64(a.Base64 || '', B.mimeDe(String(a.Ruta || ''))) }));
  return r;
};

B.restaurar = async r => {
  await B.db.set('kv', 'datos_antes', B.d);                // copia de seguridad previa
  await B.db.clear('pruebas');
  let n = 0;
  for (const a of r.Archivos) {
    const ruta = String(a.Ruta || '').replace(/\\/g, '/');
    const ext = (/\.[a-z0-9]+$/i.exec(ruta) || [''])[0].toLowerCase();
    if (!ruta || ruta.startsWith('/') || ruta.split('/').some(s => s === '..' || s === '') || !B.EXT_OK.includes(ext)) continue;
    try {
      const blob = await a.obtener();
      if (!blob || !blob.size) continue;
      await B.db.set('pruebas', ruta, blob.type ? blob : new Blob([blob], { type: B.mimeDe(ruta) })); n++;
    } catch { /* imagen dañada: se omite */ }
  }
  const nuevo = B.normalizar(r.Datos);
  // se conservan los ajustes propios de este teléfono (avisos, días de anticipación)
  nuevo.AvisosActivos = B.d.AvisosActivos; nuevo.AvisoHora = B.d.AvisoHora; nuevo.DiasCerca = B.d.DiasCerca;
  nuevo.AutoActualizar = B.d.AutoActualizar; nuevo.UltimoAviso = B.d.UltimoAviso;
  if (!(nuevo.Tasa > 0)) nuevo.Tasa = B.d.Tasa;
  B.d = nuevo;
  await B.guardar();
  return n;
};

/* Imagen guardada → URL para mostrarla (se cachean mientras la app está abierta). */
B._urls = new Map();
B.urlPrueba = async ruta => {
  if (B._urls.has(ruta)) return B._urls.get(ruta);
  const blob = await B.db.get('pruebas', ruta);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  B._urls.set(ruta, u);
  return u;
};

B.whatsapp = c => {
  let t = (c.Telefono || '').replace(/[^\d+]/g, '');
  if (!t) return null;
  t = t.replace(/^\+/, '');
  if (t.startsWith('00')) t = t.slice(2);
  else if (t.startsWith('0')) t = '58' + t.slice(1);
  const iu = B.porCuenta(c) ? B.iUrgente(c) : null;
  const dias = iu === null ? B.cDias(c) : B.cDiasC(c, iu);
  const cuando = dias < 0 ? `venció hace ${-dias} día(s)` : dias === 0 ? 'vence hoy' : `vence el ${B.fechaCorta(iu === null ? c.ProximoPago : B.cFecha(c, iu))}`;
  const de = iu === null ? 'tu pago de Spotify' : `el pago de tu cuenta ${B.nombreCuenta(c, iu)} de Spotify`;
  const msg = `Hola ${c.Nombre}, te escribo para recordarte que ${de} (${B.dinero(c.Monto, c.Moneda)}) ${cuando}. ¡Gracias!`;
  return `https://wa.me/${t}?text=${encodeURIComponent(msg)}`;
};
