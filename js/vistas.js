/* Pantallas de la app: cabecera, pestañas, Resumen, Clientes, Planes, Movimientos y Más (ajustes). */
'use strict';

const hoy0 = B.hoy();
B.ui = {
  pag: 'resumen',
  mes: new Date(hoy0.getFullYear(), hoy0.getMonth(), 1),
  filtro: 'todos', busca: '',
  abiertos: new Set(), planesAb: new Set(), secs: new Set(['apariencia']),
  movModo: 'dia', movDia: hoy0, calMes: new Date(hoy0.getFullYear(), hoy0.getMonth(), 1), calAbierto: true,
  instalar: null,
};

const e = B.esc;
const chipEstado = (est, txt) => `<span class="chip" style="--st:${B.ESTADO_COLOR[est]}">${e(txt)}</span>`;

/* ───────────── Cabecera y pestañas ───────────── */
B.renderCabecera = () => {
  const a = B.aj;
  $('#cabecera').innerHTML = `
    <div class="marca">
      ${a.logo ? '<span class="logo" aria-hidden="true"></span>' : ''}
      <div class="marca-txt"><b>${e(a.nombre)}</b>${a.sub ? `<small>${e(a.sub)}</small>` : ''}</div>
    </div>
    ${a.mostrarTasa ? `<button class="tasa ${B.d.Tasa > 0 ? '' : 'falta'}" data-act="tasa" aria-label="Tasa BCV">
      <small>Tasa BCV</small><b>${B.d.Tasa > 0 ? 'Bs ' + B.tasaTxt(B.d.Tasa) : 'Definir'}</b></button>` : ''}`;
  document.title = a.sub ? `${a.nombre} · ${a.sub}` : a.nombre;
};

const TABS = [['resumen', '📊', 'Resumen'], ['clientes', '👥', 'Clientes'], ['planes', '🏠', 'Planes'], ['movs', '💸', 'Movimientos'], ['mas', '⚙', 'Más']];
B.renderTabs = () => {
  const r = B.pendientes(), n = r.debe.length + r.hoy.length;
  $('#tabs').innerHTML = TABS.map(([k, ic, tx]) => `
    <button class="tab ${B.ui.pag === k ? 'act' : ''}" data-act="ir" data-p="${k}" ${B.ui.pag === k ? 'aria-current="page"' : ''}>
      <span class="tab-ic">${ic}${k === 'clientes' && n ? `<i class="punto-n">${n}</i>` : ''}</span><span>${tx}</span>
    </button>`).join('');
};

function $(s, r = document) { return r.querySelector(s); }

B.render = () => {
  const y = window.scrollY;
  B.renderCabecera();
  B.renderTabs();
  const v = $('#vista');
  const vistas = { resumen: vResumen, clientes: vClientes, planes: vPlanes, movs: vMovs, mas: vMas };
  v.innerHTML = (vistas[B.ui.pag] || vResumen)() + fab();
  window.scrollTo(0, y);
  if (B.ui.pag === 'mas') B.pintarMas();
};

B.irA = p => {
  B.ui.pag = p;
  const v = $('#vista');
  B.render();
  v.classList.remove('entra'); void v.offsetWidth; v.classList.add('entra');
  window.scrollTo(0, 0);
};

function fab() {
  const a = { clientes: ['nuevo-cli', 'Nuevo cliente'], planes: ['nuevo-plan', 'Nuevo plan'], movs: ['nuevo-mov', 'Nuevo movimiento'] }[B.ui.pag];
  return a ? `<button class="fab" data-act="${a[0]}" aria-label="${a[1]}"><span>＋</span></button>` : '';
}

const vacio = (ic, t, s) => `<div class="vacio"><span>${ic}</span><b>${e(t)}</b><small>${e(s)}</small></div>`;

/* ───────────── Resumen ───────────── */
function vResumen() {
  const r = B.resumenMes(B.ui.mes), p = B.pendientes();
  const hay = p.debe.length + p.hoy.length + p.cerca.length > 0;
  const prox = B.d.Clientes.filter(c => B.cDias(c) <= 7).sort((a, b) => a.ProximoPago.localeCompare(b.ProximoPago)).slice(0, 8);
  const planes = B.d.Planes.filter(x => B.dias(x.ProximoPago) <= 7).sort((a, b) => a.ProximoPago.localeCompare(b.ProximoPago));
  const porCobrar = B.d.Clientes.filter(c => B.cDias(c) <= 0).length;
  return `<section class="pagina">
    <div class="mes-nav">
      <button class="icono" data-act="mes-ant" aria-label="Mes anterior">‹</button>
      <h1>${e(B.mesAnio(B.ui.mes))}</h1>
      <button class="icono" data-act="mes-sig" aria-label="Mes siguiente">›</button>
    </div>
    ${hay ? `<div class="card alerta" style="--st:${p.debe.length ? 'var(--danger)' : p.hoy.length ? 'var(--hoy)' : 'var(--warn)'}">
      <b>${p.debe.length ? '✖ Hay pagos atrasados' : p.hoy.length ? '● Hoy vencen pagos' : '◔ Pagos por vencer'}</b>
      <small>${e(B.textoPendientes(p))}</small></div>` : ''}
    <div class="stats">
      ${stat('Ganado', r.iU, r.iV, 'ing')}
      ${stat('Gastos', r.gU, r.gV, 'gas')}
      ${stat('Balance', r.bU, r.bV, r.bU >= 0 ? 'ing' : 'gas')}
      ${stat('Por cobrar', r.cU, r.cV, 'cob')}
    </div>
    <div class="fila-chips">
      <span class="chip" style="--st:var(--danger)">${porCobrar} por cobrar</span>
      <span class="chip" style="--st:var(--ok)">${B.d.Clientes.length - porCobrar} al día</span>
      <span class="chip" style="--st:var(--accent)">${r.n} movimiento(s)</span>
    </div>
    <h2 class="sec-t">Próximos cobros</h2>
    ${prox.length ? prox.map(c => `
      <div class="card fila st-${B.cEstado(c)}">
        <div class="fila-info"><b>${e(c.Nombre)}</b><small>${e(B.dinero(c.Monto, c.Moneda))} · ${e(B.diasTexto(B.cDias(c)))}</small></div>
        ${chipEstado(B.cEstado(c), B.cEstadoTexto(c))}
        <button class="btn mini" data-act="pagar-cli" data-id="${c.Id}">✔ Pagó</button>
      </div>`).join('') : vacio('🎉', 'Nada por cobrar esta semana', 'Cuando alguien venza en los próximos 7 días aparecerá aquí.')}
    ${planes.length ? `<h2 class="sec-t">Planes por pagar</h2>` + planes.map(x => `
      <div class="card fila st-${B.estadoDe(B.dias(x.ProximoPago))}">
        <div class="fila-info"><b>${e(x.Admin)}</b><small>${e(B.dinero(x.Monto, x.Moneda))} · ${e(B.diasTexto(B.dias(x.ProximoPago)))}</small></div>
        ${chipEstado(B.estadoDe(B.dias(x.ProximoPago)), B.pEstadoTexto(x))}
        <button class="btn mini" data-act="pagar-plan" data-id="${x.Id}">✔ Pagar</button>
      </div>`).join('') : ''}
  </section>`;
}
function stat(t, usd, ves, k) {
  return `<div class="card stat ${k}"><small>${t}</small><b>${B.usd(usd)}</b><span>${B.ves(ves)}</span></div>`;
}

/* ───────────── Clientes ───────────── */
function vClientes() {
  const q = B.ui.busca.trim().toLowerCase();
  const todos = B.d.Clientes, deben = todos.filter(c => B.cDias(c) <= 0);
  let lista = B.ui.filtro === 'cobrar' ? deben : B.ui.filtro === 'dia' ? todos.filter(c => B.cDias(c) > 0) : todos;
  if (q) lista = lista.filter(c => (c.Nombre + ' ' + B.usuariosTexto(c) + ' ' + c.Telefono).toLowerCase().includes(q));
  lista = [...lista].sort((a, b) => a.ProximoPago.localeCompare(b.ProximoPago) || a.Nombre.localeCompare(b.Nombre));
  const f = (k, t, n) => `<button class="chipbtn ${B.ui.filtro === k ? 'act' : ''}" data-act="filtro" data-f="${k}">${t} <i>${n}</i></button>`;
  return `<section class="pagina">
    <h1 class="tit">Clientes</h1>
    <div class="buscar"><span>🔍</span><input type="search" id="buscar" placeholder="Buscar cliente…" value="${e(B.ui.busca)}" autocomplete="off"></div>
    <div class="fila-chips">${f('todos', 'Todos', todos.length)}${f('cobrar', 'Por cobrar', deben.length)}${f('dia', 'Al día', todos.length - deben.length)}</div>
    <div class="lista">${lista.length ? lista.map(tarjetaCliente).join('') : vacio('👥', todos.length ? 'Sin resultados' : 'Aún no hay clientes', todos.length ? 'Prueba con otra búsqueda o filtro.' : 'Toca ＋ para registrar al primero.')}</div>
  </section>`;
}

function tarjetaCliente(c) {
  const est = B.cEstado(c), ab = B.ui.abiertos.has(c.Id), dias = B.cDias(c);
  const cuentas = Array.from({ length: c.Cuentas }, (_, i) => {
    const p = B.planDeCuenta(c, i);
    return `<li><span>${e(B.nombreCuenta(c, i))}</span><small>${p ? '🏠 ' + e(p.Admin) : 'Sin plan'}</small></li>`;
  }).join('');
  const wa = B.whatsapp(c);
  return `<article class="card cli st-${est} ${ab ? 'abierto' : ''}" data-id="${c.Id}">
    <button class="cli-cab" data-act="abrir-cli" data-id="${c.Id}" aria-expanded="${ab}">
      <div class="cli-info"><b>${e(c.Nombre)}</b><small>${e(B.cSub(c)) || '—'}</small></div>
      <div class="cli-der"><b>${e(B.dinero(c.Monto, c.Moneda))}</b>${chipEstado(est, B.cEstadoTexto(c))}</div>
    </button>
    <div class="cli-pie"><span>Próximo pago: ${e(B.fechaCorta(c.ProximoPago))}</span><span>${e(B.diasTexto(dias))}</span></div>
    <div class="detalle"><div class="det-in">
      <dl class="datos">
        <div><dt>Último pago</dt><dd>${e(B.fechaCorta(c.UltimoPago))}</dd></div>
        <div><dt>Teléfono</dt><dd>${e(c.Telefono || '—')}</dd></div>
        ${c.Notas ? `<div class="ancho"><dt>Notas</dt><dd>${e(c.Notas)}</dd></div>` : ''}
      </dl>
      <h3>Cuentas que alquila</h3>
      <ul class="cuentas">${cuentas}</ul>
      <div class="acciones">
        <button class="btn" data-act="pagar-cli" data-id="${c.Id}">✔ Pagó</button>
        ${wa ? `<a class="btn fantasma" href="${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
        ${c.Telefono ? `<a class="btn fantasma" href="tel:${e(c.Telefono.replace(/[^\d+]/g, ''))}">📞 Llamar</a>` : ''}
        <button class="btn fantasma" data-act="comprobantes" data-t="${e(c.Carpeta || '')}" data-n="${e(c.Nombre)}">🧾 Comprobantes</button>
        <button class="btn fantasma" data-act="edit-cli" data-id="${c.Id}">✎ Editar</button>
        <button class="btn fantasma peligro-t" data-act="del-cli" data-id="${c.Id}">Eliminar</button>
      </div>
    </div></div>
  </article>`;
}

/* ───────────── Planes familiares ───────────── */
function vPlanes() {
  return `<section class="pagina">
    <h1 class="tit">Planes familiares</h1>
    <p class="sub">Administrador + 5 cuentas = 6 lugares por plan.</p>
    <div class="lista">${B.d.Planes.length ? B.d.Planes.map(tarjetaPlan).join('') : vacio('🏠', 'Aún no hay planes', 'Toca ＋ para registrar el primer plan familiar.')}</div>
  </section>`;
}

function tarjetaPlan(p) {
  const est = B.estadoDe(B.dias(p.ProximoPago)), oc = B.ocupados(p), lib = B.libres(p);
  const puntos = Array.from({ length: B.MAX_PERSONAS }, (_, i) => `<i class="pt ${i === 0 ? 'admin' : i < oc ? 'ocu' : ''}"></i>`).join('');
  const miembros = p.Asignaciones.map(a => ({ a, c: B.cliente(a.ClienteId) })).filter(x => x.c).map(({ a, c }) => `
    <li class="st-${B.cEstado(c)}">
      <div><b>${e(c.Nombre)}</b><small>${e(B.nombreCuenta(c, a.Indice))}</small></div>
      ${chipEstado(B.cEstado(c), B.cEstadoTexto(c))}
      <button class="icono chico" data-act="retirar" data-p="${p.Id}" data-c="${c.Id}" data-i="${a.Indice}" aria-label="Retirar del plan">✕</button>
    </li>`).join('');
  return `<article class="card plan st-${est}">
    <div class="plan-cab">
      <div><b>${e(p.Admin)}</b><small>${e(p.Cuenta || 'Sin cuenta indicada')}</small></div>
      ${chipEstado(est, B.pEstadoTexto(p))}
    </div>
    <div class="cupos"><span class="puntos">${puntos}</span>
      <small>${oc} de ${B.MAX_PERSONAS} ocupados · ${lib === 0 ? 'Plan lleno' : lib === 1 ? '1 cupo libre' : lib + ' cupos libres'}</small></div>
    <p class="pago">Se paga <b>${e(B.dinero(p.Monto, p.Moneda))}</b> · ${e(B.fechaCorta(p.ProximoPago))} · ${e(B.diasTexto(B.dias(p.ProximoPago)))}</p>
    <ul class="miembros">${miembros || '<li class="vacia"><small>Sin cuentas de clientes asignadas todavía.</small></li>'}</ul>
    <div class="acciones">
      <button class="btn" data-act="add-miembro" data-id="${p.Id}" ${lib === 0 ? 'disabled' : ''}>＋ Agregar cuenta</button>
      <button class="btn fantasma" data-act="pagar-plan" data-id="${p.Id}">✔ Pagar plan</button>
      <button class="btn fantasma" data-act="comprobantes" data-t="${e(p.Carpeta || '')}" data-n="${e(p.Admin)}">🧾 Comprobantes</button>
      <button class="btn fantasma" data-act="edit-plan" data-id="${p.Id}">✎ Editar</button>
      <button class="btn fantasma peligro-t" data-act="del-plan" data-id="${p.Id}">Eliminar</button>
    </div>
  </article>`;
}

/* ───────────── Movimientos + calendario ───────────── */
B.calendario = () => {
  const m = B.ui.calMes, y = m.getFullYear(), mes = m.getMonth(), sel = B.ui.movDia;
  const marcas = {};
  const marca = (iso, k) => { const d = B.deIso(iso); if (d && d.getFullYear() === y && Math.abs(d.getMonth() - mes) <= 1) (marcas[B.aInput(d)] ||= {})[k] = 1; };
  B.d.Movimientos.forEach(x => marca(x.Fecha, x.Tipo === 'Ingreso' ? 'i' : 'g'));
  B.d.Clientes.forEach(c => marca(c.ProximoPago, 'v'));
  B.d.Planes.forEach(p => marca(p.ProximoPago, 'v'));
  const primer = new Date(y, mes, 1), desfase = (primer.getDay() + 6) % 7, inicio = new Date(y, mes, 1 - desfase);
  let celdas = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i), k = B.aInput(d), mk = marcas[k] || {};
    celdas += `<button class="dia ${d.getMonth() !== mes ? 'fuera' : ''} ${B.mismoDia(d, B.hoy()) ? 'hoy' : ''} ${B.mismoDia(d, sel) ? 'sel' : ''}" data-act="cal-dia" data-f="${k}">
      <span>${d.getDate()}</span><i>${mk.i ? '<b class="p-i"></b>' : ''}${mk.g ? '<b class="p-g"></b>' : ''}${mk.v ? '<b class="p-v"></b>' : ''}</i></button>`;
  }
  return `<div class="card cal">
    <div class="mes-nav chico">
      <button class="icono" data-act="cal-ant" aria-label="Mes anterior">‹</button>
      <h2>${e(B.mesAnio(m))}</h2>
      <button class="icono" data-act="cal-sig" aria-label="Mes siguiente">›</button>
    </div>
    <div class="sem">${B.DIAS_CORTOS.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="dias">${celdas}</div>
    <div class="leyenda"><span><b class="p-i"></b> Ingreso</span><span><b class="p-g"></b> Gasto</span><span><b class="p-v"></b> Cobro</span></div>
  </div>`;
};

function vMovs() {
  const u = B.ui, dia = u.movModo === 'dia';
  const lista = B.d.Movimientos.filter(m => {
    const d = B.deIso(m.Fecha); if (!d) return false;
    return dia ? B.mismoDia(d, u.movDia) : (d.getFullYear() === u.calMes.getFullYear() && d.getMonth() === u.calMes.getMonth());
  }).sort((a, b) => b.Fecha.localeCompare(a.Fecha));
  const ing = lista.filter(m => m.Tipo === 'Ingreso').reduce((s, m) => s + B.mUsd(m), 0);
  const gas = lista.filter(m => m.Tipo === 'Gasto').reduce((s, m) => s + B.mUsd(m), 0);
  const cobros = dia ? [...B.d.Clientes.filter(c => B.mismoDia(B.deIso(c.ProximoPago), u.movDia)).map(c => ({ n: c.Nombre, c, est: B.cEstado(c) })),
    ...B.d.Planes.filter(p => B.mismoDia(B.deIso(p.ProximoPago), u.movDia)).map(p => ({ n: 'Plan de ' + p.Admin, est: B.estadoDe(B.dias(p.ProximoPago)) }))] : [];
  return `<section class="pagina">
    <h1 class="tit">Movimientos</h1>
    <div class="fila-chips">
      <button class="chipbtn ${dia ? 'act' : ''}" data-act="mov-modo" data-m="dia">Día</button>
      <button class="chipbtn ${!dia ? 'act' : ''}" data-act="mov-modo" data-m="mes">Mes completo</button>
      <button class="chipbtn ${u.calAbierto ? 'act' : ''}" data-act="cal-toggle">📅 Calendario</button>
    </div>
    ${u.calAbierto ? B.calendario() : ''}
    <h2 class="sec-t">${dia ? e(B.diaLargo(u.movDia)) : e(B.mesAnio(u.calMes))}</h2>
    <div class="fila-chips">
      <span class="chip" style="--st:var(--ok)">Ganado ${e(B.usd(ing))}</span>
      <span class="chip" style="--st:var(--danger)">Gastos ${e(B.usd(gas))}</span>
    </div>
    ${cobros.length ? `<div class="card cobros"><small>Cobros de este día</small>${cobros.map(x => `<span class="chip" style="--st:${B.ESTADO_COLOR[x.est]}">${e(x.n)}</span>`).join('')}</div>` : ''}
    <div class="lista">${lista.length ? lista.map(movFila).join('') : vacio('💸', 'Sin movimientos', dia ? 'Este día no tiene ingresos ni gastos.' : 'Este mes no tiene ingresos ni gastos.')}</div>
  </section>`;
}

function movFila(m) {
  const ing = m.Tipo === 'Ingreso';
  return `<div class="card mov">
    <span class="mov-ic ${ing ? 'ing' : 'gas'}">${ing ? '↑' : '↓'}</span>
    <div class="mov-info"><b>${e(m.Descripcion)}</b><small>${e(B.fechaCorta(m.Fecha))} · ${e(B.equivMov(m))}</small></div>
    <div class="mov-der"><b class="${ing ? 'ing' : 'gas'}">${e(B.montoMov(m))}</b></div>
    ${m.Prueba ? `<button class="icono chico" data-act="ver-img" data-r="${e(m.Prueba)}" aria-label="Ver comprobante">🧾</button>` : ''}
    <button class="icono chico" data-act="del-mov" data-id="${m.Id}" aria-label="Eliminar">✕</button>
  </div>`;
}

/* ───────────── Más: apariencia, ajustes, avisos y respaldo ───────────── */
const sec = (k, ic, t, cuerpo) => `<div class="card sec ${B.ui.secs.has(k) ? 'abierto' : ''}" data-sec="${k}">
  <button class="sec-cab" data-act="sec" data-k="${k}" aria-expanded="${B.ui.secs.has(k)}"><span>${ic}</span><b>${t}</b><i>›</i></button>
  <div class="detalle"><div class="det-in sec-cuerpo">${cuerpo}</div></div></div>`;
const chips = (g, ops, act) => `<div class="fila-chips envolver">${ops.map(([v, t, st]) =>
  `<button class="chipbtn ${act(v) ? 'act' : ''}" data-act="aj" data-g="${g}" data-v="${e(v)}" ${st ? `style="${st}"` : ''}>${e(t)}</button>`).join('')}</div>`;
const toggle = (k, t, on) => `<button class="tog ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="tog" data-k="${k}"><span>${e(t)}</span><i></i></button>`;
const colores = (g, hexAct) => `<div class="colores">${B.ACENTOS.map(([n, h]) =>
  `<button class="color ${hexAct && hexAct.toLowerCase() === h.toLowerCase() ? 'act' : ''}" style="--c:${h}" title="${e(n)}" aria-label="${e(n)}" data-act="aj" data-g="${g}" data-v="${h}"></button>`).join('')}</div>`;

function vMas() {
  const a = B.aj, p = B.PRESETS.find(x => x.n === a.preset) || B.PRESETS[0];
  const temas = `<div class="temas">${B.PRESETS.map(t => `
    <button class="tema ${t.n === a.preset ? 'act' : ''}" data-act="aj" data-g="preset" data-v="${e(t.n)}" style="--tb:${t.bg};--ts:${t.s2};--tt:${t.text};--ta:${t.ac}">
      <b>${e(t.n)}</b><small>${t.o ? 'Oscuro' : 'Claro'}</small><span><i></i><i class="a"></i></span></button>`).join('')}</div>`;
  const apariencia = `
    <h3>Modo</h3>${chips('modo', [['o', '🌙 Oscuro'], ['c', '☀ Claro']], v => (v === 'o') === p.o)}
    <h3>Temas</h3>${temas}
    <h3>Color de acento</h3>${colores('acento', a.acento)}
    <label class="campo en-linea"><span>Color propio</span><input type="text" id="hex-acento" value="${e(a.acento)}" maxlength="7" autocapitalize="characters" spellcheck="false"></label>
    <h3>Estilo cristal (Liquid Glass)</h3>
    <p class="nota">Paneles translúcidos con desenfoque, borde de luz y un fondo de color en movimiento.</p>
    ${toggle('cristal', 'Activar modo cristal', a.cristal)}
    ${a.cristal ? `<h3>Transparencia</h3>${chips('nivel', [['0', 'Suave'], ['1', 'Media'], ['2', 'Intensa']], v => +v === a.nivel)}${toggle('animado', 'Fondo de color animado', a.animado)}` : ''}
    <h3>Colores de estado</h3>
    <div class="fila-chips envolver"><span class="chip" style="--st:var(--ok)">✔ Pagado</span><span class="chip" style="--st:var(--warn)">◔ Por vencer</span><span class="chip" style="--st:var(--hoy)">● Vence hoy</span><span class="chip" style="--st:var(--danger)">✖ Debe</span></div>`;

  const identidad = `
    <label class="campo"><span>Nombre de la app</span><input type="text" id="aj-nombre" value="${e(a.nombre)}" maxlength="30"></label>
    <label class="campo"><span>Subtítulo</span><input type="text" id="aj-sub" value="${e(a.sub)}" maxlength="30"></label>
    ${toggle('logo', 'Mostrar el logo', a.logo)}
    <h3>Color del logo</h3>
    ${colores('logocolor', a.logoColor)}
    <div class="fila-chips"><button class="chipbtn ${!a.logoColor ? 'act' : ''}" data-act="aj" data-g="logocolor" data-v="">Igual que el acento</button></div>
    <label class="campo en-linea"><span>Color propio</span><input type="text" id="hex-logo" value="${e(a.logoColor)}" placeholder="#1DB954" maxlength="7" autocapitalize="characters" spellcheck="false"></label>`;

  const letra = `
    <h3>Fuente</h3>
    <div class="fila-chips envolver">${B.FUENTES.map(([n, f]) => `<button class="chipbtn ${a.fuente === n ? 'act' : ''}" data-act="aj" data-g="fuente" data-v="${e(n)}" style="font-family:${e(f)}">${e(n)}</button>`).join('')}</div>
    <h3>Tamaño de la letra y la interfaz</h3>
    ${chips('escala', [['90', 'Pequeño'], ['100', 'Normal'], ['112', 'Grande'], ['125', 'Muy grande']], v => +v === a.escala)}`;

  const distrib = `
    <h3>Espacio alrededor de los paneles</h3>
    ${chips('margen', [['10', 'Compacto'], ['16', 'Normal'], ['24', 'Amplio']], v => +v === a.margen)}
    ${toggle('mostrarTasa', 'Mostrar la tasa BCV arriba', a.mostrarTasa)}`;

  const perm = 'Notification' in window ? Notification.permission : 'no';
  const avisos = `
    <p class="nota">Te avisamos cuando un cliente o un plan vence hoy, está atrasado o por vencer.</p>
    ${toggle('avisos', 'Avisarme de los pagos', B.d.AvisosActivos)}
    <label class="campo en-linea"><span>Avisar a partir de las (0 a 23 h)</span><input type="number" inputmode="numeric" id="aj-hora" min="0" max="23" value="${B.d.AvisoHora}"></label>
    <label class="campo en-linea"><span>Días de anticipación (amarillo)</span><input type="number" inputmode="numeric" id="aj-dias" min="0" max="30" value="${B.d.DiasCerca}"></label>
    <div class="acciones">
      ${perm === 'granted' ? '<span class="chip" style="--st:var(--ok)">✔ Avisos del teléfono permitidos</span>'
        : perm === 'denied' ? '<span class="chip" style="--st:var(--danger)">Avisos bloqueados en el navegador</span>'
        : perm === 'no' ? '' : '<button class="btn" data-act="permiso">🔔 Permitir avisos del teléfono</button>'}
      <button class="btn fantasma" data-act="probar-aviso">Enviar aviso de prueba</button>
      <button class="btn fantasma" data-act="revisar">Revisar pagos ahora</button>
    </div>
    <p class="nota">Una app web no puede despertarse sola cuando está cerrada: el aviso sale al abrirla (una vez al día, pasada la hora elegida) y, en Android con la app instalada, el sistema puede revisarla de vez en cuando. En iPhone los avisos del sistema solo funcionan con la app agregada a la pantalla de inicio.</p>`;

  const msgs = `
    <p class="nota">Las confirmaciones y los avisos salen dentro de la app, con tu estilo.</p>
    <h3>Tiempo en pantalla</h3>
    ${chips('toast', [['2', '2 s'], ['4', '4 s'], ['7', '7 s'], ['12', '12 s']], v => +v === a.toast)}
    <div class="acciones"><button class="btn" data-act="probar-toast">Probar mensaje</button><button class="btn fantasma" data-act="probar-dlg">Probar confirmación</button></div>`;

  const resp = `
    <p class="nota">Un solo archivo .json con tus datos y todas las fotos de comprobantes. Es el mismo formato de la app de Windows: puedes pasar todo de un lado a otro.</p>
    <div class="acciones">
      ${navigator.canShare ? '<button class="btn" data-act="exp-compartir">📤 Guardar / compartir respaldo</button><button class="btn fantasma" data-act="exp-descargar">⬇ Descargar</button>'
        : '<button class="btn" data-act="exp-descargar">⬇ Descargar respaldo</button>'}
      <button class="btn fantasma" data-act="importar">📥 Importar respaldo</button>
      <button class="btn fantasma" data-act="comprobantes" data-t="" data-n="">🧾 Ver todos los comprobantes</button>
    </div>
    <input type="file" id="archivo-respaldo" hidden>
    <p class="nota" id="almacen-estado">Calculando almacenamiento…</p>
    <div class="acciones"><button class="btn fantasma peligro-t" data-act="reset-aj">Restablecer ajustes de la app</button></div>`;

  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent), instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const instalar = instalada ? '<p class="nota">✔ La app ya está instalada en este teléfono.</p>' : `
    ${B.ui.instalar ? '<div class="acciones"><button class="btn" data-act="instalar">📲 Instalar en este teléfono</button></div>' : ''}
    <p class="nota">${iOS ? 'En iPhone: abre esta página en <b>Safari</b>, toca el botón Compartir y elige <b>“Agregar a pantalla de inicio”</b>.'
      : 'En Android (Chrome): menú ⋮ › <b>“Instalar aplicación”</b> o “Agregar a pantalla de inicio”. Así abre en pantalla completa y funciona sin internet.'}</p>`;

  return `<section class="pagina">
    <h1 class="tit">Más</h1>
    ${sec('apariencia', '🎨', 'Apariencia', apariencia)}
    ${sec('identidad', '✨', 'Nombre y logo', identidad)}
    ${sec('letra', '🔤', 'Letra y tamaño', letra)}
    ${sec('distrib', '📐', 'Distribución', distrib)}
    ${sec('avisos', '🔔', 'Avisos de pago', avisos)}
    ${sec('msgs', '💬', 'Mensajes emergentes', msgs)}
    ${sec('resp', '💾', 'Respaldo y comprobantes', resp)}
    ${sec('inst', '📲', 'Instalar la app', instalar)}
    <p class="pie">Bluumxsic · SP-Control (móvil) · tus datos viven solo en este teléfono.<br>
      <b>Versión ${B.VERSION}</b> · <span id="ver-estado">revisando…</span></p>
    <div class="acciones" style="justify-content:center"><button class="btn fantasma" data-act="actualizar">🔄 Buscar actualización</button></div>
  </section>`;
}

/* Compara la versión del código con la de los archivos guardados en el teléfono. */
B.estadoVersion = async () => {
  const v = $('#ver-estado');
  if (!v) return;
  try {
    const ks = ('caches' in window) ? (await caches.keys()).filter(k => k.startsWith('bluumxsic-v')) : [];
    if (!ks.length) { v.textContent = 'sin copia sin conexión'; return; }
    const guardada = ks.map(k => k.replace('bluumxsic-v', '')).sort().pop();
    v.textContent = guardada === B.VERSION ? '✔ al día' : `⚠ archivos guardados: ${guardada}. Cierra la app y ábrela de nuevo`;
  } catch { v.textContent = ''; }
};

B.pintarMas = async () => {
  B.estadoVersion();
  const el = $('#almacen-estado');
  if (!el) return;
  try {
    const n = (await B.db.keys('pruebas')).length;
    let txt = `${n} comprobante(s) guardado(s) en este teléfono.`;
    if (navigator.storage?.estimate) { const s = await navigator.storage.estimate(); txt += ` Usado: ${(s.usage / 1048576).toFixed(1)} MB.`; }
    if (navigator.storage?.persisted) txt += (await navigator.storage.persisted()) ? ' Almacenamiento protegido ✔' : ' Haz un respaldo de vez en cuando: el navegador podría borrar los datos si falta espacio.';
    el.textContent = txt;
  } catch { el.textContent = ''; }
};
