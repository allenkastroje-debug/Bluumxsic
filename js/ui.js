/* Mensajes propios de la app: avisos emergentes (toast), diálogos de confirmación y hojas inferiores. Nada de alert()/confirm() del navegador. */
'use strict';

B.TIPOS = {
  Exito:    { icono: '✔', color: 'var(--ok)' },
  Error:    { icono: '✖', color: 'var(--danger)' },
  Peligro:  { icono: '!', color: 'var(--danger)' },
  Aviso:    { icono: '!', color: 'var(--warn)' },
  Pregunta: { icono: '?', color: 'var(--accent)' },
  Info:     { icono: 'i', color: 'var(--accent)' },
};

/* ───── Toast ───── */
B.toast = (titulo, texto = '', tipo = 'Exito') => {
  const cont = document.getElementById('toasts'), t = B.TIPOS[tipo] || B.TIPOS.Info;
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.setProperty('--tc', t.color);
  el.innerHTML = `<span class="toast-ic">${t.icono}</span><div><b>${B.esc(titulo)}</b>${texto ? `<small>${B.esc(texto)}</small>` : ''}</div>`;
  const quitar = () => {
    if (!el.isConnected) return;
    el.classList.add('sale');
    setTimeout(() => el.remove(), 260);
  };
  el.addEventListener('click', quitar);
  cont.appendChild(el);
  while (cont.children.length > 3) cont.firstElementChild.remove();
  setTimeout(quitar, Math.max(2, (B.aj && B.aj.toast) || 4) * 1000);
  return quitar;
};

/* ───── Cargando: pantalla con ruedita mientras se hace algo largo (queda por debajo de los cuadros) ───── */
B.cargando = (titulo, texto = '') => {
  const el = document.createElement('div');
  el.className = 'cargando';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="cargando-caja"><span class="rueda"></span><b></b><small></small></div>`;
  const b = el.querySelector('b'), sm = el.querySelector('small');
  b.textContent = titulo; sm.textContent = texto;
  document.body.appendChild(el);
  return {
    texto: (t, x = '') => { b.textContent = t; sm.textContent = x; },
    cerrar: () => { el.remove(); },
  };
};

/* ───── Diálogo (devuelve una promesa con true/false) ───── */
B.dialogo = ({ titulo, texto = '', tipo = 'Info', si = 'Aceptar', no = null, peligro = false }) => new Promise(res => {
  const capas = document.getElementById('capas'), t = B.TIPOS[tipo] || B.TIPOS.Info;
  const el = document.createElement('div');
  el.className = 'capa capa-dlg';
  el.innerHTML = `
    <div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
      <div class="dlg-cab">
        <span class="dlg-ic" style="--tc:${t.color}">${t.icono}</span>
        <h2 id="dlg-t">${B.esc(titulo)}</h2>
      </div>
      ${texto ? `<p class="dlg-txt">${B.esc(texto).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="dlg-bot">
        ${no ? `<button class="btn fantasma" data-r="0">${B.esc(no)}</button>` : ''}
        <button class="btn ${peligro ? 'peligro' : ''}" data-r="1">${B.esc(si)}</button>
      </div>
    </div>`;
  const teclas = e => { if (e.key === 'Escape') cerrar(false); };
  let cerrado = false;
  const cerrar = v => {
    if (cerrado) return; cerrado = true;
    document.removeEventListener('keydown', teclas);
    el.classList.add('sale');
    setTimeout(() => { el.remove(); res(v); }, 170);
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-r]');
    if (b) cerrar(b.dataset.r === '1');
    else if (e.target === el && no) cerrar(false);
  });
  document.addEventListener('keydown', teclas);
  capas.appendChild(el);
  (el.querySelector('[data-r="1"]')).focus({ preventScroll: true });
});

B.confirmar = (titulo, texto, o = {}) => B.dialogo({
  titulo, texto, tipo: o.peligro ? 'Peligro' : 'Pregunta', si: o.si || 'Aceptar', no: o.no || 'Cancelar', peligro: !!o.peligro,
});
B.info = (texto, titulo = 'SP-Control', tipo = 'Info') => B.dialogo({ titulo, texto, tipo, si: 'Entendido' });
B.aviso = texto => B.info(texto, 'Revisa esto', 'Aviso');
B.error = texto => B.info(texto, 'Algo salió mal', 'Error');

/* ───── Hoja inferior (formularios). El botón "atrás" del teléfono la cierra. ───── */
B._hojas = [];
B._ignorarPop = 0;
window.addEventListener('popstate', () => {
  if (B._ignorarPop > 0) { B._ignorarPop--; return; }
  const h = B._hojas[B._hojas.length - 1];
  if (h) h.cerrar(true);
});

B.sheet = (titulo, html, o = {}) => {
  const capas = document.getElementById('capas');
  const el = document.createElement('div');
  el.className = 'capa capa-hoja';
  el.innerHTML = `
    <div class="hoja ${o.alta ? 'alta' : ''}" role="dialog" aria-modal="true" aria-label="${B.esc(titulo)}">
      <div class="agarre"></div>
      <div class="hoja-cab"><h2>${B.esc(titulo)}</h2><button class="x" data-cerrar aria-label="Cerrar">✕</button></div>
      <div class="hoja-cuerpo">${html}</div>
    </div>`;
  let cerrada = false;
  const h = {
    el, cuerpo: el.querySelector('.hoja-cuerpo'),
    $: s => el.querySelector(s), $$: s => [...el.querySelectorAll(s)],
    cerrar(desdePop = false) {
      if (cerrada) return; cerrada = true;
      B._hojas = B._hojas.filter(x => x !== h);
      el.classList.add('sale');
      setTimeout(() => el.remove(), 230);
      if (!desdePop) { B._ignorarPop++; history.back(); }
      if (o.alCerrar) o.alCerrar();
    },
  };
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('[data-cerrar]')) h.cerrar();
  });
  capas.appendChild(el);
  B._hojas.push(h);
  history.pushState({ hoja: 1 }, '');
  return h;
};

/* Lee los campos con name="" de un contenedor. */
B.leer = cont => {
  const r = {};
  cont.querySelectorAll('[name]').forEach(i => {
    if (i.type === 'radio') { if (i.checked) r[i.name] = i.value; }
    else if (i.type === 'checkbox') r[i.name] = i.checked;
    else r[i.name] = i.value;
  });
  return r;
};
