// Motor de efectos ligero: partículas en un único canvas, ondas, sacudidas, vuelos de cartas.
// Pensado para Chromebooks modestos: límite global de partículas, el bucle se detiene si no hay nada que dibujar,
// y existe un modo «efectos reducidos» (también se activa solo con prefers-reduced-motion).
import { $, h, azar, elige } from './dom.js';
import { COLORES } from './arte.js';

const KEY = 'chaos.fx.v1';
const cfg = { reducido: matchMedia('(prefers-reduced-motion: reduce)').matches };
try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* nada */ }
export const fxReducido = () => cfg.reducido;
export function ponerReducido(v) { cfg.reducido = !!v; try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* nada */ } document.documentElement.classList.toggle('reducido', cfg.reducido); }
const f = () => (cfg.reducido ? 0.35 : 1);
const MAX = 240;

let lienzo, c2, W = 0, H = 0, escena, mundo;
let parts = [], activo = false, ultimo = 0;

export function iniciar() {
  lienzo = $('#lienzo'); c2 = lienzo.getContext('2d'); escena = $('#escena'); mundo = $('#mundo');
  document.documentElement.classList.toggle('reducido', cfg.reducido);
  const ajustar = () => { const d = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; lienzo.width = W * d; lienzo.height = H * d; c2.setTransform(d, 0, 0, d, 0, 0); };
  ajustar(); addEventListener('resize', ajustar);
}

function dibujar(p) {
  const a = Math.max(0, p.vida / p.vida0);
  c2.globalAlpha = p.forma === 'h' ? a * 0.38 : Math.min(1, a * 1.6);
  c2.fillStyle = p.color;
  c2.save(); c2.translate(p.x, p.y);
  if (p.forma === 'h') { c2.beginPath(); c2.arc(0, 0, p.tam * (1.6 - a * 0.6), 0, 6.283); c2.fill(); }
  else if (p.forma === 'e') { c2.rotate(p.rot); c2.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? p.tam * 0.35 : p.tam; c2.lineTo(Math.cos(i * 0.785) * r, Math.sin(i * 0.785) * r); } c2.closePath(); c2.fill(); }
  else if (p.forma === 'q') { c2.rotate(p.rot); c2.fillRect(-p.tam / 2, -p.tam / 3, p.tam, p.tam * 0.66); }
  else { c2.beginPath(); c2.arc(0, 0, p.tam * (0.4 + a * 0.6), 0, 6.283); c2.fill(); }
  c2.restore();
}
function bucle(t) {
  const dt = Math.min(0.05, (t - ultimo) / 1000 || 0.016); ultimo = t;
  c2.clearRect(0, 0, W, H);
  for (const p of parts) {
    p.vida -= dt; p.vx *= p.fr; p.vy = p.vy * p.fr + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.vida > 0) dibujar(p);
  }
  c2.globalAlpha = 1;
  parts = parts.filter((p) => p.vida > 0);
  if (parts.length) requestAnimationFrame(bucle); else { activo = false; c2.clearRect(0, 0, W, H); }
}
function arrancar() { if (!activo) { activo = true; ultimo = performance.now(); requestAnimationFrame(bucle); } }

export function rafaga(x, y, o = {}) {
  const n = Math.round((o.n ?? 26) * f());
  const colores = o.colores || [COLORES.NAR, COLORES.AMA, COLORES.QUE];
  const [v1, v2] = o.vel || [90, 340], [l1, l2] = o.vida || [0.5, 1.1], [t1, t2] = o.tam || [3, 8], [a1, a2] = o.angulo || [0, 6.283];
  for (let i = 0; i < n && parts.length < MAX; i++) {
    const a = azar(a1, a2), v = azar(v1, v2), vida = azar(l1, l2);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.g ?? 520, fr: o.friccion ?? 0.985, vida, vida0: vida, tam: azar(t1, t2), color: elige(colores), forma: o.forma || elige(['c', 'q', 'e']), rot: azar(0, 6), vr: azar(-9, 9) });
  }
  arrancar();
}
export function humo(x, y, n = 8) {
  n = Math.round(n * f());
  for (let i = 0; i < n && parts.length < MAX; i++) {
    const a = azar(-2.6, -0.5), v = azar(20, 90), vida = azar(0.9, 1.6);
    parts.push({ x: x + azar(-20, 20), y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: -30, fr: 0.97, vida, vida0: vida, tam: azar(18, 42), color: elige(['#57351F', '#8B5A35', '#F3DFC0']), forma: 'h', rot: 0, vr: 0 });
  }
  arrancar();
}
export function lluvia(x, y, ancho, colores, n = 14) { // partículas que caen / suben suavemente (celebración, magia)
  n = Math.round(n * f());
  for (let i = 0; i < n && parts.length < MAX; i++) {
    const vida = azar(1.2, 2.2);
    parts.push({ x: x + azar(-ancho / 2, ancho / 2), y, vx: azar(-30, 30), vy: azar(-60, 60), g: 120, fr: 0.99, vida, vida0: vida, tam: azar(4, 9), color: elige(colores), forma: elige(['e', 'q', 'c']), rot: azar(0, 6), vr: azar(-6, 6) });
  }
  arrancar();
}

export function onda(x, y, { color = COLORES.NAR, tam = 280, dur = 650, grosor = 7 } = {}) {
  const el = h('div', { class: 'onda-fx', style: { left: x - tam / 2 + 'px', top: y - tam / 2 + 'px', width: tam + 'px', height: tam + 'px', borderColor: color, borderWidth: grosor + 'px' } });
  escena.append(el);
  const a = el.animate([{ transform: 'scale(.05)', opacity: 0.95 }, { transform: 'scale(1)', opacity: 0 }], { duration: cfg.reducido ? dur * 0.6 : dur, easing: 'cubic-bezier(.1,.7,.2,1)' });
  a.onfinish = () => el.remove();
}
export function sacudir(px = 8, ms = 420) {
  if (cfg.reducido || !mundo) return;
  const k = []; for (let i = 0; i < 9; i++) { const d = 1 - i / 9; k.push({ transform: `translate(${azar(-px, px) * d}px,${azar(-px, px) * d}px) rotate(${azar(-0.4, 0.4) * d}deg)` }); }
  k.push({ transform: 'none' });
  mundo.animate(k, { duration: ms, easing: 'linear' });
}
export function destello(color = '#fff', ms = 350, op = 0.7) {
  const el = h('div', { class: 'destello-fx', style: { background: color } });
  escena.append(el);
  el.animate([{ opacity: op }, { opacity: 0 }], { duration: cfg.reducido ? ms * 0.6 : ms, easing: 'ease-out' }).onfinish = () => el.remove();
}
export function vineta(color = 'rgba(120,20,0,.75)', ms = 1400) {
  const el = h('div', { class: 'vineta-fx', style: { boxShadow: `inset 0 0 25vmin 8vmin ${color}` } });
  escena.append(el);
  el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: ms, easing: 'ease-in-out' }).onfinish = () => el.remove();
}
/** Texto grande que «rebota» al aparecer. */
export function texto(msg, { x = innerWidth / 2, y = innerHeight / 2, color = COLORES.CREMA, tam = 64, dur = 1500, rot = -4, contorno = COLORES.INK } = {}) {
  const el = h('div', { class: 'texto-fx', style: { left: x + 'px', top: y + 'px', fontSize: `min(${tam}px, 11vw)`, color, '--contorno': contorno } }, msg);
  escena.append(el);
  const k = cfg.reducido
    ? [{ opacity: 0, transform: `translate(-50%,-50%) rotate(${rot}deg)` }, { opacity: 1, offset: 0.2, transform: `translate(-50%,-50%) rotate(${rot}deg)` }, { opacity: 0, transform: `translate(-50%,-50%) rotate(${rot}deg)` }]
    : [{ opacity: 0, transform: `translate(-50%,-50%) scale(.2) rotate(${rot * 4}deg)` }, { opacity: 1, offset: 0.14, transform: `translate(-50%,-50%) scale(1.3) rotate(${rot}deg)` }, { offset: 0.24, transform: `translate(-50%,-50%) scale(.94) rotate(${rot}deg)` }, { offset: 0.32, transform: `translate(-50%,-50%) scale(1.04) rotate(${rot}deg)` }, { opacity: 1, offset: 0.8, transform: `translate(-50%,-50%) scale(1) rotate(${rot}deg)` }, { opacity: 0, transform: `translate(-50%,-62%) scale(1.1) rotate(${rot}deg)` }];
  el.animate(k, { duration: dur, easing: 'ease-out' }).onfinish = () => el.remove();
  return el;
}

/** Vuela un elemento (ya añadido a #escena con position:fixed) desde un punto a otro. Devuelve una promesa. */
export function volar(el, desde, hasta, { dur = 650, arco = 80, giro = 0, e0 = 1, e1 = 1, easing = 'cubic-bezier(.3,.9,.3,1)', quitar = true, estela = null } = {}) {
  const w = el.offsetWidth || 100, hh = el.offsetHeight || 140;
  const pos = (p, s, r, dy = 0) => `translate(${p.x - w / 2}px,${p.y - hh / 2 + dy}px) scale(${s}) rotate(${r}deg)`;
  const d = cfg.reducido ? dur * 0.5 : dur;
  const k = cfg.reducido
    ? [{ transform: pos(desde, e0, 0), opacity: 0.2 }, { transform: pos(hasta, e1, 0), opacity: 1 }]
    : [{ transform: pos(desde, e0, 0) }, { transform: pos({ x: (desde.x + hasta.x) / 2, y: (desde.y + hasta.y) / 2 }, (e0 + e1) / 2 * 1.15, giro / 2, -arco) }, { transform: pos(hasta, e1, giro) }];
  const a = el.animate(k, { duration: d, easing, fill: 'forwards' });
  if (estela && !cfg.reducido) { const t0 = performance.now(); const paso = () => { if (performance.now() - t0 > d || !el.isConnected) return; const r = el.getBoundingClientRect(); rafaga(r.left + r.width / 2, r.top + r.height / 2, { n: 2, vel: [5, 40], g: 0, tam: [2, 5], colores: estela, vida: [0.25, 0.5], forma: 'c' }); requestAnimationFrame(paso); }; paso(); }
  return a.finished.then(() => { if (quitar) el.remove(); return el; }).catch(() => el);
}
/** Coloca un elemento recién creado en #escena sin animar (position fixed en 0,0). */
export function enEscena(el) { el.classList.add('en-escena'); escena.append(el); return el; }
export function colocar(el, p, s = 1, r = 0) { const w = el.offsetWidth, hh = el.offsetHeight; el.style.transform = `translate(${p.x - w / 2}px,${p.y - hh / 2}px) scale(${s}) rotate(${r}deg)`; }
