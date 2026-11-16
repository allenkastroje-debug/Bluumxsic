/* Iconos propios de SP-Control: trazo redondeado y un relleno suave del color del texto.
   Los textos del programa siguen usando los símbolos de siempre (🏠, ✔, 🔒…); este módulo los cambia
   por estos dibujos en cuanto aparecen en pantalla, así todo queda con el mismo estilo y el color del tema. */
'use strict';

(() => {
  const D = (d, o = '') => `<path d="${d}"${o}/>`;
  const R = d => D(d, ' fill="currentColor" fill-opacity=".2"');          // relleno suave
  const C = (x, y, r, o = '') => `<circle cx="${x}" cy="${y}" r="${r}"${o}/>`;
  const CR = (x, y, r) => C(x, y, r, ' fill="currentColor" fill-opacity=".2"');
  const CS = (x, y, r) => C(x, y, r, ' fill="currentColor" stroke="none"');
  const RR = (x, y, w, h, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="currentColor" fill-opacity=".2"/>`;

  const ICONOS = {
    grafica: RR(4, 12, 4, 8, 1.5) + RR(10, 4, 4, 16, 1.5) + RR(16, 9, 4, 11, 1.5),
    clientes: CR(9, 8, 3.5) + D('M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6') + C(17.5, 9, 2.5) + D('M17.2 14.2c2.7.2 4.3 1.9 4.3 4.8'),
    casa: D('M3.5 11 12 4l8.5 7') + R('M5.5 9.7V20h13V9.7L12 4.5z') + D('M10 20v-5.5h4V20'),
    movs: D('M5 8h14M15 4l4 4-4 4') + D('M19 16H5m4 4-4-4 4-4'),
    mas: RR(4, 4, 6.5, 6.5, 2) + RR(13.5, 4, 6.5, 6.5, 2) + RR(4, 13.5, 6.5, 6.5, 2) + RR(13.5, 13.5, 6.5, 6.5, 2),
    x: D('M6.5 6.5l11 11M17.5 6.5l-11 11'),
    check: D('M5 12.5l4.5 4.5L19 7.5'),
    punto: CS(12, 12, 5),
    medio: C(12, 12, 8) + D('M12 12V4a8 8 0 0 1 8 8z', ' fill="currentColor" stroke="none"'),
    chispa: R('M11 3.5l1.9 5.4 5.4 1.9-5.4 1.9L11 18.1l-1.9-5.4-5.4-1.9 5.4-1.9z') + D('M19 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z'),
    buscar: CR(11, 11, 6.5) + D('M16 16l4.5 4.5'),
    chat: R('M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'),
    telefono: R('M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z'),
    recibo: R('M6 3h12v18l-3-2-3 2-3-2-3 2z') + D('M9 8h6M9 12h6'),
    lapiz: R('M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z') + D('M14.5 6.5l3 3'),
    calendario: RR(3.5, 5, 17, 15.5, 3) + D('M8 3v4M16 3v4M3.5 10h17'),
    arriba: D('M12 19V5M6 11l6-6 6 6'),
    abajo: D('M12 5v14M6 13l6 6 6-6'),
    luna: R('M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'),
    sol: CR(12, 12, 4) + D('M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8'),
    campana: R('M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z') + D('M10 20.7a2 2 0 0 0 4 0'),
    subir: D('M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4'),
    bajar: D('M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14'),
    bandeja: D('M12 4v10M8 10l4 4 4-4') + R('M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3z'),
    candado: RR(5, 10.5, 14, 10, 2.5) + D('M8 10.5V8a4 4 0 0 1 8 0v2.5') + CS(12, 15.5, 1.3),
    huella: D('M12 4a7 7 0 0 0-7 7v2.5M12 8a3 3 0 0 0-3 3v3.5c0 2-1 3.5-2 4.5M12 8a3 3 0 0 1 3 3v2c0 2.5 1 4.5 2.5 6M12 12v3c0 2.5-.8 4.5-2 6M19 11a7 7 0 0 0-3-5.7'),
    letra: D('M3.5 19l5-14 5 14M5.3 14.5h6.4M16 19l2.8-7 2.7 7M17 16.5h3.6'),
    regla: R('M4 16.5L16.5 4l3.5 3.5L7.5 20z') + D('M8.5 12.5l1.8 1.8M11.5 9.5l1.8 1.8M14.5 6.5l1.2 1.2'),
    paleta: R('M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.5-1.3-1.7-1.3-3 0-1 .8-1.7 1.9-1.7H17a3.5 3.5 0 0 0 3.5-3.5C20.5 6.7 16.7 3.5 12 3.5z') + CS(7.5, 11, 1.1) + CS(10, 7.5, 1.1) + CS(14.5, 7.5, 1.1),
    disco: R('M4 6a2 2 0 0 1 2-2h10l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z') + D('M8 4v5h7V4M8 20v-6h8v6'),
    instalar: RR(7, 2.5, 10, 19, 2.5) + D('M12 8v6M9.5 11.5 12 14l2.5-2.5'),
    refrescar: D('M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4'),
    papelera: D('M4.5 7h15M9.5 7V4.5h5V7') + R('M6.5 7l1 13h9l1-13z') + D('M10 11v5M14 11v5'),
    alerta: R('M12 4l9.5 16h-19z') + D('M12 10v4.5') + CS(12, 17.3, 1),
    camara: R('M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z') + C(12, 13, 3.5),
    imagen: RR(3.5, 4.5, 17, 15, 3) + C(9, 10, 1.7) + D('M4 18l5-5 4 4 3-3 4.5 4.5'),
    borrar: R('M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z') + D('M12.5 9.5l5 5M17.5 9.5l-5 5'),
  };

  /* símbolo del texto → icono */
  const MAPA = {
    '📊': 'grafica', '👥': 'clientes', '🏠': 'casa', '💸': 'movs', '⚙': 'mas',
    '✔': 'check', '✖': 'x', '✕': 'x', '●': 'punto', '◔': 'medio', '🎉': 'chispa',
    '🔍': 'buscar', '💬': 'chat', '📞': 'telefono', '🧾': 'recibo', '✎': 'lapiz', '📅': 'calendario',
    '↑': 'arriba', '↓': 'abajo', '🌙': 'luna', '☀': 'sol', '🔔': 'campana', '📤': 'subir', '⬇': 'bajar', '📥': 'bandeja',
    '🔒': 'candado', '☝': 'huella', '🔤': 'letra', '📐': 'regla', '🎨': 'paleta', '💾': 'disco', '📲': 'instalar',
    '🔄': 'refrescar', '🗑': 'papelera', '⚠': 'alerta', '📷': 'camara', '🖼': 'imagen', '⌫': 'borrar',
  };

  B.ico = (nombre, clase = '') =>
    `<svg class="ico ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONOS[nombre] || ''}</svg>`;

  const RX = new RegExp('(' + Object.keys(MAPA).join('|') + ')\\uFE0F?\\uFE0E?', 'g');
  const NO = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'TITLE', 'SVG', 'OPTION']);

  const cambiar = nodo => {
    const t = nodo.nodeValue;
    if (!t) return;
    RX.lastIndex = 0;
    if (!RX.test(t)) return;
    RX.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let ult = 0, m;
    while ((m = RX.exec(t))) {
      if (m.index > ult) frag.appendChild(document.createTextNode(t.slice(ult, m.index)));
      const s = document.createElement('span');
      s.className = 'ic'; s.innerHTML = B.ico(MAPA[m[1]]);
      frag.appendChild(s);
      ult = m.index + m[0].length;
    }
    if (ult < t.length) frag.appendChild(document.createTextNode(t.slice(ult)));
    nodo.parentNode.replaceChild(frag, nodo);
  };

  const recorrer = raiz => {
    if (raiz.nodeType === 3) { if (raiz.parentNode && !NO.has(raiz.parentNode.nodeName.toUpperCase())) cambiar(raiz); return; }
    if (raiz.nodeType !== 1 || NO.has(raiz.nodeName.toUpperCase())) return;
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const lista = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) if (!NO.has(n.parentNode.nodeName.toUpperCase())) lista.push(n);
    lista.forEach(cambiar);
  };

  const iniciar = () => {
    recorrer(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') recorrer(m.target);
        else m.addedNodes.forEach(recorrer);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
