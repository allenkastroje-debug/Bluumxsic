/* Temas, colores de acento, modo cristal (Liquid Glass), fuente y tamaño. Mismos temas que la app de la PC. */
'use strict';

B.PRESETS = [
  { n: 'Spotify Oscuro', o: true,  ac: '#1DB954', bg: '#121212', side: '#0B0B0B', s: '#181818', s2: '#262626', line: '#333333', text: '#FFFFFF', muted: '#B3B3B3' },
  { n: 'Spotify Claro',  o: false, ac: '#1DB954', bg: '#F3F4F6', side: '#FFFFFF', s: '#FFFFFF', s2: '#EDEEF1', line: '#DADCE2', text: '#121212', muted: '#6B6F7B' },
  { n: 'Medianoche',     o: true,  ac: '#5865F2', bg: '#1E1F22', side: '#17181A', s: '#2B2D31', s2: '#383A40', line: '#3F4147', text: '#F2F3F5', muted: '#A3A6AA' },
  { n: 'Ciruela',        o: true,  ac: '#ECB22E', bg: '#1F0A20', side: '#3F0E40', s: '#2B1230', s2: '#3A1B3F', line: '#4F2C55', text: '#FFFFFF', muted: '#C9B3CB' },
  { n: 'Océano',         o: true,  ac: '#14B8A6', bg: '#06161C', side: '#041015', s: '#0C222B', s2: '#133540', line: '#1E4755', text: '#E8F7F7', muted: '#8DB3B8' },
  { n: 'Rosa y negro',   o: true,  ac: '#FF3D9A', bg: '#0A0A0D', side: '#0F0F14', s: '#15151C', s2: '#1E1E28', line: '#2B2B38', text: '#F5F5F8', muted: '#9C9CB2' },
  { n: 'Arena',          o: false, ac: '#F97316', bg: '#FBF6EF', side: '#FFFFFF', s: '#FFFFFF', s2: '#F4ECE0', line: '#E6DAC8', text: '#2B2118', muted: '#7A6A58' },
];

B.ACENTOS = [
  ['Verde Spotify', '#1DB954'], ['Esmeralda', '#10B981'], ['Turquesa', '#14B8A6'], ['Cian', '#06B6D4'],
  ['Azul', '#3B82F6'], ['Índigo', '#5865F2'], ['Violeta', '#8B5CF6'], ['Magenta', '#D946EF'],
  ['Rosado', '#FF3D9A'], ['Rojo', '#E5173F'], ['Naranja', '#F97316'], ['Amarillo', '#EAB308'],
  ['Lima', '#84CC16'], ['Gris', '#94A3B8'],
];

B.FUENTES = [
  ['Sistema', 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif'],
  ['Redondeada', 'ui-rounded,"SF Pro Rounded","Nunito","Quicksand",system-ui,sans-serif'],
  ['Clásica', '"Helvetica Neue",Helvetica,Arial,sans-serif'],
  ['Humanista', '"Trebuchet MS","Gill Sans",Verdana,sans-serif'],
  ['Serif', 'Georgia,"Times New Roman",serif'],
  ['Monoespaciada', 'ui-monospace,"SF Mono",Menlo,Consolas,monospace'],
];

B.AJ_DEF = {
  preset: 'Spotify Oscuro', acento: '#1DB954',
  cristal: false, nivel: 1, animado: true,
  nombre: 'Bluumxsic', sub: 'SP-Control', logo: true, logoColor: '',
  fuente: 'Sistema', escala: 100, margen: 16, mostrarTasa: true, toast: 4,
};

B.color = {
  parse(hex, resp) {
    const ok = h => /^#?[0-9a-f]{6}$/i.test((h || '').trim()) ? h.trim().replace('#', '') : null;
    const h = ok(hex) || ok(resp) || '808080';
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  },
  esValido: hex => /^#?[0-9a-f]{6}$/i.test((hex || '').trim()),
  mezcla: (a, b, t) => ({ r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) }),
  css: (c, a = 1) => a >= 1 ? `rgb(${c.r} ${c.g} ${c.b})` : `rgb(${c.r} ${c.g} ${c.b} / ${a})`,
  hex: c => '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase(),
  aHsv(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 0) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return { h, s: mx ? d / mx : 0, v: mx };
  },
  deHsv(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  },
};

B.oscuro = true;

B.aplicarTema = () => {
  const a = B.aj, p = B.PRESETS.find(x => x.n === a.preset) || B.PRESETS[0];
  const K = B.color, root = document.documentElement, set = (k, v) => root.style.setProperty(k, v);
  B.oscuro = p.o;
  const ac = K.parse(a.acento, p.ac), txt = K.parse(p.text);
  const blanco = { r: 255, g: 255, b: 255 }, negro = { r: 0, g: 0, b: 0 };
  const cristal = !!a.cristal, nivel = Math.min(2, Math.max(0, a.nivel | 0));

  const s = K.parse(p.s), s2 = K.parse(p.s2), side = K.parse(p.side), bg = K.parse(p.bg);
  if (!cristal) {
    set('--bg', K.css(bg)); set('--side', K.css(side)); set('--surface', K.css(s)); set('--surface2', K.css(s2));
    set('--line', K.css(K.parse(p.line))); set('--panel', K.css(s));
    set('--radio', '16px'); set('--blur', 'none');
  } else {
    const a1 = [0.62, 0.46, 0.30][nivel], a2 = [0.78, 0.62, 0.46][nivel];
    const velo = p.o ? K.mezcla(s, blanco, .10) : blanco, velo2 = p.o ? K.mezcla(s2, blanco, .14) : K.mezcla(s2, blanco, .5);
    set('--bg', K.css(bg)); set('--side', K.css(side, a1 * .85));
    set('--surface', K.css(velo, a1)); set('--surface2', K.css(velo2, a2 * (p.o ? .75 : 1)));
    set('--panel', K.css(velo, p.o ? .88 : .94));
    set('--line', p.o ? 'rgb(255 255 255 / .20)' : 'rgb(255 255 255 / .85)');
    set('--radio', '24px');
    set('--blur', `blur(${[14, 22, 30][nivel]}px) saturate(165%)`);
  }
  set('--text', K.css(txt)); set('--muted', K.css(K.parse(p.muted)));
  set('--rowalt', p.o ? 'rgb(255 255 255 / .05)' : 'rgb(0 0 0 / .04)');
  set('--accent', K.css(ac)); set('--accent-soft', K.css(K.mezcla(ac, blanco, .35)));
  set('--accent-deep', K.css(K.mezcla(ac, negro, .45))); set('--accent-faint', K.css(ac, .2));
  const lum = (0.299 * ac.r + 0.587 * ac.g + 0.114 * ac.b) / 255;
  set('--on-accent', lum > .55 ? '#101010' : '#ffffff');
  set('--grad', `linear-gradient(135deg, ${K.css(ac)}, ${K.css(K.mezcla(ac, negro, .30))})`);
  set('--ok', p.o ? '#1ED760' : '#16A34A'); set('--warn', p.o ? '#FFD60A' : '#B88700');
  set('--hoy', p.o ? '#FF8A1F' : '#E26A00'); set('--danger', p.o ? '#FF4D5E' : '#D92D3F');
  set('--logo', K.css(K.esValido(a.logoColor) ? K.parse(a.logoColor) : ac));

  // orbes de color detrás del cristal
  const hv = K.aHsv(ac), ao = p.o ? .55 : .42;
  set('--orbe-a', K.css(ac, ao));
  set('--orbe-b', K.css(K.deHsv(hv.h + 45, Math.max(hv.s, .55), Math.max(hv.v, .85)), ao));
  set('--orbe-c', K.css(K.deHsv(hv.h - 55, Math.max(hv.s, .55), Math.max(hv.v, .8)), ao));

  // fuente, tamaño y márgenes
  const f = B.FUENTES.find(x => x[0] === a.fuente) || B.FUENTES[0];
  set('--fuente', f[1]);
  set('--escala', String(Math.min(140, Math.max(80, a.escala | 0)) / 100));
  set('--margen', Math.min(32, Math.max(8, a.margen | 0)) + 'px');
  root.style.fontSize = (16 * Math.min(140, Math.max(80, a.escala | 0)) / 100) + 'px';

  root.dataset.cristal = cristal ? '1' : '0';
  root.dataset.orbes = cristal && a.animado ? '1' : '0';
  root.dataset.modo = p.o ? 'oscuro' : 'claro';
  root.style.colorScheme = p.o ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', K.hex(bg));
};
