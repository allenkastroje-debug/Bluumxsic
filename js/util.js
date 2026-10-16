/* Utilidades: fechas, números en formato venezolano, texto seguro. */
'use strict';
const B = window.B = {};

/* Versión de la app: súbela aquí y en sw.js (VERSION) cada vez que publiques cambios. */
B.VERSION = '1.7';
B.MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
B.DIAS_CORTOS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

B.uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    }));

B.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
B.pad = n => String(n).padStart(2, '0');

/* ───── Fechas ─────
   Se guardan como "2026-10-14T00:00:00" (igual que la app de la PC) para que el respaldo sea intercambiable. */
B.hoy = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
B.aIso = d => `${d.getFullYear()}-${B.pad(d.getMonth() + 1)}-${B.pad(d.getDate())}T00:00:00`;
B.aInput = d => `${d.getFullYear()}-${B.pad(d.getMonth() + 1)}-${B.pad(d.getDate())}`;
B.deIso = s => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
B.dias = iso => { const d = B.deIso(iso); return d ? Math.round((d - B.hoy()) / 864e5) : 0; };
B.mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
B.addMeses = (d, n) => {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ult = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), ult));
};
B.fechaCorta = iso => { const d = B.deIso(iso); return d ? `${B.pad(d.getDate())}/${B.pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—'; };
B.mesAnio = d => `${B.MESES[d.getMonth()]} ${d.getFullYear()}`;
B.diaLargo = d => `${B.pad(d.getDate())} de ${B.MESES[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
B.ahoraIso = () => { const d = new Date(); return `${B.aIso(d).slice(0, 10)}T${B.pad(d.getHours())}:${B.pad(d.getMinutes())}:${B.pad(d.getSeconds())}`; };
B.horaTexto = v => {
  const d = v ? new Date(v) : null;
  if (!d || isNaN(d)) return '';
  let h = d.getHours(); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
  return `${B.pad(d.getDate())}/${B.pad(d.getMonth() + 1)} ${h}:${B.pad(d.getMinutes())} ${ap}`;
};

/* ───── Números: 1.234,56 ───── */
B.num = v => {
  const neg = v < 0, [e, d] = Math.abs(v).toFixed(2).split('.');
  return (neg ? '-' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d;
};
B.usd = v => (v < 0 ? '-' : '') + '$ ' + B.num(Math.abs(v));
B.ves = v => (v < 0 ? '-' : '') + 'Bs ' + B.num(Math.abs(v));
B.dinero = (v, m) => m === 'USD' ? B.usd(v) : B.ves(v);
B.tasaTxt = v => { const [e, d] = (Math.round(v * 10000) / 10000).toFixed(4).split('.'); return e.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };

/* "1.234,56", "5,5", "5.5" → número. Con miles=false un punto suelto es decimal (para la tasa). */
B.tryNum = (s, miles = true) => {
  if (s == null) return null;
  s = String(s).trim().replace(/\$/g, '').replace(/bs/ig, '').replace(/\s/g, '');
  if (!s) return null;
  const c = s.lastIndexOf(','), p = s.lastIndexOf('.');
  if (c >= 0 && p >= 0) s = c > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c >= 0) s = s.replace(',', '.');
  else if (p >= 0 && miles && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

B.limpiarNombre = t => {
  const r = String(t ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/\.+$/, '');
  return r || 'Sin nombre';
};

B.esperar = ms => new Promise(r => setTimeout(r, ms));
B.$ = (s, r = document) => r.querySelector(s);
B.$$ = (s, r = document) => [...r.querySelectorAll(s)];
