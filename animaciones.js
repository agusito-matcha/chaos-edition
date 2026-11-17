// Animaciones exclusivas de cada carta + reacciones de avatares.
// El servidor manda eventos con identificador único (eid); aquí cada evento se reproduce UNA sola vez, en orden,
// sin bloquear los controles del jugador (todo vive en una capa que no recibe clics).
import { $, h, centro, esperar, azar, elige } from './dom.js';
import * as fx from './efectos.js';
import { sfx } from './sonido.js';
import { crearCarta, crearReverso } from './cartas.js';
import { COLORES as C } from './arte.js';
import { nombreCarta } from './textos.js';

let api = { yo: () => null, nombre: (p) => p, muerto: () => false, avisar: () => {} };
export const configurar = (a) => { api = a; };

const MESA_VENTANA = 3200, MESA_EXT = 2400;
const medio = () => ({ x: innerWidth / 2, y: innerHeight / 2 });
const rect = (sel) => { const e = $(sel); return e ? centro(e) : medio(); };
const posMazo = () => rect('#mazo'), posDescarte = () => rect('#descarte');
const posMesa = () => { const r = rect('#mesa'); return { x: r.x, y: r.y - 10 }; };
const posJ = (pid) => (pid === api.yo() ? rect('#mano') : rect(`.rival[data-pid="${pid}"] .avatar`));
const posAvatar = (pid) => (pid === api.yo() ? rect('#mi-avatar') : rect(`.rival[data-pid="${pid}"] .avatar`));
const reducido = () => fx.fxReducido();

// ---------- reacciones de avatar ----------
const timers = new Map();
const avatares = (pid) => document.querySelectorAll(`[data-pid="${pid}"] .avatar`);
export function reaccion(pid, mood, ms = 1600, sonido = null) {
  avatares(pid).forEach((a) => { const g = a.querySelector('.gato'); if (g) g.dataset.mood = mood; });
  clearTimeout(timers.get(pid));
  if (ms > 0) timers.set(pid, setTimeout(() => avatares(pid).forEach((a) => { const g = a.querySelector('.gato'); if (g) g.dataset.mood = api.muerto(pid) ? 'fuera' : 'neutral'; }), ms));
  if (sonido) sfx(sonido);
}
export function clase(pid, cls, ms = 900) { avatares(pid).forEach((a) => { a.classList.remove(cls); void a.offsetWidth; a.classList.add(cls); setTimeout(() => a.classList.remove(cls), ms); }); }

// ---------- escena de la jugada pendiente ----------
let pend = null, bomba = null, flechaEl = null, ocupado = 0;
const cartaEscena = (tipo, cara = true) => fx.enEscena(cara ? crearCarta(tipo) : crearReverso());
const lugar = (i, n, mesa) => ({ x: mesa.x + (i - (n - 1) / 2) * Math.min(70, innerWidth * 0.1), y: mesa.y });
const rotar = (i, n) => (i - (n - 1) / 2) * 8;
const marco = (el) => el.querySelector('.carta-marco') || el;
const bump = (el, k = 1.18, ms = 320) => marco(el).animate([{ transform: 'scale(1)' }, { transform: `scale(${k})`, offset: 0.35 }, { transform: 'scale(.96)', offset: 0.65 }, { transform: 'scale(1)' }], { duration: reducido() ? 150 : ms });

function nuevaCuenta(ms, etiqueta = '¿Alguien lo frena?') {
  if (pend && pend.cuenta) pend.cuenta.remove();
  const m = posMesa();
  const el = h('div', { class: 'cuenta-fx' }, h('span', {}, etiqueta), h('i'));
  fx.enEscena(el);
  fx.colocar(el, { x: m.x, y: m.y + Math.min(112, innerHeight * 0.16) });
  el.querySelector('i').animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
  if (pend) pend.cuenta = el;
  return el;
}
function quitarPend(vuela = true) {
  if (!pend) return;
  const { els, cuenta } = pend; pend = null;
  if (cuenta) cuenta.remove();
  const d = posDescarte();
  els.forEach((el, i) => {
    if (!vuela) return el.remove();
    const r = el.getBoundingClientRect();
    fx.volar(el, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, d, { dur: 480, arco: 20, e0: 1, e1: 0.4, giro: 14 * (i + 1), easing: 'cubic-bezier(.5,0,.8,.4)' });
  });
}

// ---------- entradas de cada carta al jugarla ----------
async function jugar(ev) {
  quitarPend(false);
  const n = ev.cartas.length, mesa = posMesa(), desde = posJ(ev.por);
  const els = ev.cartas.map((t) => cartaEscena(t));
  pend = { aid: ev.aid, els, cuenta: null };
  clase(ev.por, 'salta', 700);
  const destino = (i) => lugar(i, n, mesa);
  const vuelos = (opts, desdeFn) => Promise.all(els.map((el, i) => fx.volar(el, desdeFn ? desdeFn(i) : desde, destino(i), { quitar: false, giro: rotar(i, n), ...opts })));
  switch (ev.clase) {
    case 'pasar':
      sfx('pasar');
      await vuelos({ dur: 240, arco: 0, easing: 'cubic-bezier(.1,.9,.2,1)', estela: [C.BEIGE, C.CREMA] });
      fx.onda(mesa.x, mesa.y, { color: C.CREMA, tam: 260, dur: 420 });
      break;
    case 'ataque':
      await vuelos({ dur: 340, arco: 0, e0: 2.6, e1: 1, easing: 'cubic-bezier(.7,0,1,.55)' }, () => ({ x: mesa.x, y: -160 }));
      sfx('ataque'); fx.sacudir(13, 450); fx.destello(C.NAR, 260, 0.5);
      fx.onda(mesa.x, mesa.y, { color: C.NAR, tam: Math.min(520, innerWidth), dur: 600, grosor: 12 });
      fx.rafaga(mesa.x, mesa.y, { n: 38, colores: [C.NAR, C.AMA, C.QUE, C.CREMA], vel: [150, 520] });
      bump(els[0], 1.25, 380);
      break;
    case 'favor':
      sfx('jugar');
      await vuelos({ dur: 620, arco: 110, easing: 'cubic-bezier(.3,1.2,.4,1)' });
      bump(els[0], 1.12);
      break;
    case 'barajar':
      sfx('jugar');
      await vuelos({ dur: 640, arco: 150, giro: 720 });
      break;
    case 'futuro':
      sfx('jugar');
      await vuelos({ dur: 700, arco: -50, easing: 'cubic-bezier(.2,.8,.3,1)' }, () => posMazo());
      els[0].classList.add('brilla-fx');
      fx.rafaga(mesa.x, mesa.y, { n: 16, colores: [C.AMA, C.CREMA], g: -140, vel: [20, 120], forma: 'e' });
      break;
    case 'pareja':
    case 'trio':
      sfx(ev.clase);
      await vuelos({ dur: 560, arco: 100 }, (i) => ({ x: desde.x + (i - 1) * 90, y: desde.y }));
      await esperar(80);
      await efectoGato(ev.cartas[0], els, mesa, ev);
      break;
    default: sfx('jugar'); await vuelos({ dur: 500 });
  }
  if (!pend || pend.aid !== ev.aid) return;
  nuevaCuenta(MESA_VENTANA);
}

// Cada gato tiene su propia animación al juntarse las cartas.
async function efectoGato(tipo, els, mesa, ev) {
  els.forEach((e) => bump(e, 1.2, 380));
  sfx(tipo);
  switch (tipo) {
    case 'gato_pegon':
      fx.sacudir(10, 380); fx.texto('¡PAM!', { x: mesa.x, y: mesa.y - 120, color: C.AMA, tam: 70, dur: 900 });
      fx.rafaga(mesa.x, mesa.y, { n: 26, colores: [C.AMA, C.NAR], vel: [120, 420] }); fx.onda(mesa.x, mesa.y, { color: C.AMA, tam: 300, dur: 450 });
      break;
    case 'gato_ninja':
      fx.humo(mesa.x, mesa.y + 50, 9); fx.rafaga(mesa.x, mesa.y, { n: 22, colores: [C.CAL, C.BEIGE, C.INK], forma: 'e', vel: [260, 620], g: 0, friccion: 0.95 });
      if (!reducido()) els.forEach((e, i) => marco(e).animate([{ filter: 'blur(0)', transform: 'translateX(0)' }, { filter: 'blur(5px)', transform: `translateX(${(i % 2 ? -1 : 1) * 60}px)` }, { filter: 'blur(0)', transform: 'translateX(0)' }], { duration: 420 }));
      break;
    case 'gato_mago':
      fx.lluvia(mesa.x, mesa.y + 80, 260, [C.AMA, C.CREMA, C.NAR], 26); fx.rafaga(mesa.x, mesa.y, { n: 22, forma: 'e', colores: [C.AMA, C.CREMA], g: -160, vel: [40, 200] });
      fx.texto('✨', { x: mesa.x, y: mesa.y - 110, tam: 80, dur: 1000 });
      break;
    case 'gato_dormilon':
      for (let i = 0; i < 4; i++) { const b = h('div', { class: 'burbuja-fx', style: { left: mesa.x + azar(-70, 70) + 'px', top: mesa.y + 40 + 'px', width: azar(18, 38) + 'px', height: '0' } }); b.style.height = b.style.width; fx.enEscena(b); b.style.transform = ''; b.animate([{ transform: 'translateY(0) scale(.4)', opacity: 0.9 }, { transform: `translateY(${-azar(120, 200)}px) scale(1.1)`, opacity: 0 }], { duration: 1500, delay: i * 180, easing: 'ease-out', fill: 'both' }).onfinish = () => b.remove(); }
      fx.texto('Zzz…', { x: mesa.x + 70, y: mesa.y - 100, tam: 54, dur: 1400, color: C.CREMA });
      break;
    case 'gato_cabreado':
      fx.destello(C.QUE, 280, 0.35); fx.humo(mesa.x - 70, mesa.y, 4); fx.humo(mesa.x + 70, mesa.y, 4);
      els.forEach((e) => marco(e).animate(Array.from({ length: 12 }, (_, i) => ({ transform: `translate(${i % 2 ? 5 : -5}px,${i % 3 ? 2 : -2}px) rotate(${i % 2 ? 2 : -2}deg)` })), { duration: 560 }));
      reaccion(ev.por, 'enfado', 1500);
      break;
    default: break;
  }
  await esperar(reducido() ? 120 : 420);
}

// ---------- VA A SER QUE NO ----------
async function negar(ev) {
  const mesa = posMesa(), izq = Math.random() < 0.5;
  sfx('negar');
  const simbolo = h('div', { class: 'simbolo-no-fx', html: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#D85D24" stroke-width="12"/><path d="M20 80 L80 20" stroke="#D85D24" stroke-width="12" stroke-linecap="round"/><circle cx="50" cy="50" r="48" fill="none" stroke="#57351F" stroke-width="3"/></svg>' });
  fx.enEscena(simbolo); fx.colocar(simbolo, mesa, 0.2);
  simbolo.animate(reducido() ? [{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }] : [{ transform: simbolo.style.transform.replace('scale(0.2)', 'scale(0.2)'), opacity: 0 }, { transform: simbolo.style.transform.replace('scale(0.2)', 'scale(1.4)'), opacity: 0.95, offset: 0.35 }, { transform: simbolo.style.transform.replace('scale(0.2)', 'scale(1)'), opacity: 0.9, offset: 0.55 }, { transform: simbolo.style.transform.replace('scale(0.2)', 'scale(1.1)'), opacity: 0 }], { duration: 1300, easing: 'ease-out' }).onfinish = () => simbolo.remove();
  const carta = cartaEscena('negar');
  const desde = { x: izq ? -140 : innerWidth + 140, y: mesa.y + 20 };
  await fx.volar(carta, desde, { x: mesa.x + (izq ? -30 : 30), y: mesa.y + 10 }, { dur: 280, arco: 0, giro: izq ? -10 : 10, e0: 1.4, e1: 1.25, easing: 'cubic-bezier(.2,1.5,.4,1)', quitar: false });
  fx.sacudir(14, 480); fx.destello(C.QUE, 220, 0.4);
  fx.onda(mesa.x, mesa.y, { color: C.QUE, tam: 480, dur: 600, grosor: 14 }); fx.onda(mesa.x, mesa.y, { color: C.CAL, tam: 300, dur: 450, grosor: 8 });
  fx.rafaga(mesa.x, mesa.y, { n: 36, colores: [C.NAR, C.CAL, C.INK, C.QUE], vel: [150, 500] });
  fx.texto('¡VA A SER QUE NO!', { x: mesa.x, y: mesa.y - Math.min(160, innerHeight * 0.22), color: C.CREMA, tam: 78, dur: 1700, rot: -5, contorno: C.QUE });
  if (pend) {
    pend.els.forEach((e) => { e.classList.toggle('tachada-fx', ev.cancelada); marco(e).animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-7deg) translateX(-10px)' }, { transform: 'rotate(6deg) translateX(10px)' }, { transform: 'rotate(0)' }], { duration: 420 }); });
    nuevaCuenta(MESA_EXT, ev.cancelada ? '¿Alguien lo frena?' : '¡Se salva! ¿Y ahora?');
  }
  reaccion(ev.contra, 'confusion', 1800, ev.contra === api.yo() ? 'confusion' : null);
  reaccion(ev.por, 'alegria', 1200);
  clase(ev.contra, 'golpeado', 700);
  await esperar(reducido() ? 250 : 700);
  fx.volar(carta, { x: mesa.x + (izq ? -30 : 30), y: mesa.y + 10 }, posDescarte(), { dur: 450, e0: 1.25, e1: 0.4, easing: 'cubic-bezier(.5,0,.8,.4)' });
}
async function cancelada() {
  if (pend) {
    const m = posMesa(); fx.rafaga(m.x, m.y, { n: 20, colores: [C.CAL, C.INK, C.NAR], vel: [60, 260] }); fx.humo(m.x, m.y, 4);
    pend.els.forEach((e) => { e.classList.add('tachada-fx'); });
    await esperar(reducido() ? 150 : 500);
  }
  quitarPend(true);
}

// ---------- efectos de resolución ----------
function flecha(a, b) {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'flecha-fx'); svg.setAttribute('width', innerWidth); svg.setAttribute('height', innerHeight);
  const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - 110, ang = Math.atan2(b.y - cy, b.x - cx);
  const punta = [[0, 0], [-26, -14], [-26, 14]].map(([x, y]) => `${b.x + x * Math.cos(ang) - y * Math.sin(ang)},${b.y + x * Math.sin(ang) + y * Math.cos(ang)}`).join(' ');
  svg.innerHTML = `<path d="M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}" fill="none" stroke="#57351F" stroke-width="14" stroke-linecap="round" opacity=".5"/><path class="marcha" d="M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}" fill="none" stroke="#FFC83D" stroke-width="8" stroke-linecap="round" stroke-dasharray="16 14"/><polygon points="${punta}" fill="#FFC83D" stroke="#57351F" stroke-width="3" stroke-linejoin="round"/>`;
  $('#escena').append(svg);
  return svg;
}
async function efecto(ev) {
  const mesa = posMesa(), por = ev.por;
  switch (ev.clase) {
    case 'pasar': {
      fx.onda(...Object.values(posAvatar(por)).slice(0, 2), { color: C.BEIGE, tam: 200, dur: 500 });
      clase(por, 'salta', 600); reaccion(por, 'alegria', 900);
      quitarPend(true); break;
    }
    case 'ataque': {
      const o = posAvatar(ev.objetivo);
      reaccion(ev.objetivo, 'enfado', 2000, ev.objetivo === api.yo() ? 'enfado' : null); clase(ev.objetivo, 'golpeado', 900);
      fx.onda(o.x, o.y, { color: C.NAR, tam: 300, dur: 600, grosor: 10 }); fx.rafaga(o.x, o.y, { n: 22, colores: [C.NAR, C.QUE, C.AMA] }); fx.sacudir(7, 300);
      fx.texto(`×${ev.turnos} turnos`, { x: o.x, y: o.y + 10, tam: 40, color: C.AMA, dur: 1600, rot: 4 });
      quitarPend(true); break;
    }
    case 'favor': {
      const a = posAvatar(por), b = posAvatar(ev.objetivo);
      if (flechaEl) flechaEl.remove(); flechaEl = flecha(a, b); sfx('favor');
      clase(ev.objetivo, 'brilla', 1800); fx.onda(b.x, b.y, { color: C.AMA, tam: 220, dur: 700 });
      fx.texto('🤝', { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 70, tam: 70, dur: 1400 });
      quitarPend(true); break;
    }
    case 'barajar': {
      sfx('barajar');
      const m = posMazo(), N = reducido() ? 3 : 6;
      for (let i = 0; i < N; i++) {
        const el = fx.enEscena(crearReverso()); el.classList.add('mini-escena');
        const pasos = 14, k = [];
        for (let s = 0; s <= pasos; s++) { const t = s / pasos, ang = (t * 2 + i / N) * Math.PI * 2, r = 70 * Math.sin(t * Math.PI) + 4; k.push({ transform: `translate(${m.x + Math.cos(ang) * r - 35}px,${m.y + Math.sin(ang) * r * 0.7 - 49}px) rotate(${t * 540 + i * 40}deg) scale(${0.9 - 0.15 * Math.sin(t * Math.PI)})` }); }
        el.animate(k, { duration: reducido() ? 400 : 1000, delay: i * 60, easing: 'ease-in-out', fill: 'both' }).onfinish = () => el.remove();
      }
      for (let i = 0; i < 3; i++) setTimeout(() => fx.rafaga(m.x, m.y, { n: 12, colores: [C.NAR, C.BEIGE, C.QUE], vel: [80, 200], g: 0, friccion: 0.94, tam: [2, 5] }), i * 260);
      fx.onda(m.x, m.y, { color: C.BEIGE, tam: 260, dur: 900 });
      const mz = $('#mazo'); if (mz && !reducido()) mz.animate([{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(360deg) scale(.75)', offset: 0.5 }, { transform: 'rotate(720deg) scale(1.12)', offset: 0.85 }, { transform: 'rotate(720deg) scale(1)' }], { duration: 1100, easing: 'ease-in-out' });
      quitarPend(true); await esperar(reducido() ? 100 : 500); break;
    }
    case 'futuro': {
      sfx('futuro');
      const m = posMazo(), mio = por === api.yo(), n = Math.max(1, ev.n || 1), tipos = ev.cartas || [];
      const els = [];
      for (let i = 0; i < n; i++) {
        const el = mio ? fx.enEscena(crearReverso()) : fx.enEscena(crearReverso()); el.classList.add('mini-escena', 'brilla-fx');
        const p = { x: m.x + (i - (n - 1) / 2) * 92, y: m.y - Math.min(190, innerHeight * 0.26) };
        fx.volar(el, m, p, { dur: 600, arco: 20, giro: (i - 1) * 6, e1: 1.15, quitar: false, easing: 'cubic-bezier(.2,.9,.3,1)' });
        els.push({ el, p, i });
      }
      fx.rafaga(m.x, m.y - 60, { n: 26, colores: [C.AMA, C.CREMA, C.NAR], g: -120, vel: [30, 160], forma: 'e' });
      fx.onda(m.x, m.y, { color: C.AMA, tam: 300, dur: 800 });
      quitarPend(true);
      await esperar(reducido() ? 200 : 700);
      if (mio) {
        els.forEach(({ el, p, i }) => {
          const cara = fx.enEscena(crearCarta(tipos[i])); cara.classList.add('mini-escena', 'brilla-fx'); cara.style.pointerEvents = 'auto';
          fx.volar(cara, p, p, { dur: 1, e0: 1.15, e1: 1.15, giro: (i - 1) * 6, quitar: false });
          cara.animate([{ opacity: 0, filter: 'brightness(2)' }, { opacity: 1, filter: 'brightness(1)' }], { duration: 400, fill: 'both' });
          el.remove();
          const ocultar = () => { cara.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).onfinish = () => cara.remove(); };
          cara.addEventListener('click', ocultar); setTimeout(ocultar, 4500 + i * 120);
        });
        api.avisar('Solo tú ves estas cartas. Primera = la de arriba del mazo (toca una carta para ocultarlas).');
      } else els.forEach(({ el }) => setTimeout(() => fx.volar(el, { x: el.getBoundingClientRect().x + 50, y: el.getBoundingClientRect().y + 70 }, m, { dur: 450, e1: 0.8, easing: 'ease-in' }), 900));
      break;
    }
    case 'pareja':
    case 'trio': {
      const o = posAvatar(ev.objetivo || por), a = posAvatar(por);
      if (ev.exito) {
        clase(ev.objetivo, 'golpeado', 700); reaccion(ev.objetivo, 'confusion', 1400);
        const el = fx.enEscena(ev.carta ? crearCarta(ev.carta) : crearReverso()); el.classList.add('mini-escena');
        sfx('entregar'); fx.volar(el, o, a, { dur: 700, arco: 90, giro: 25, estela: [C.AMA, C.NAR] });
        fx.texto(ev.carta ? `¡${nombreCarta(ev.carta)}!` : '¡Robada!', { x: a.x, y: a.y - 70, tam: 44, color: C.AMA, dur: 1500 });
        reaccion(por, 'alegria', 1200);
      } else { fx.texto(ev.clase === 'trio' ? `No tiene ${nombreCarta(ev.pedida)}` : '¡Nada!', { x: mesa.x, y: mesa.y - 100, tam: 44, dur: 1500 }); reaccion(por, 'tristeza', 1200, 'triste'); }
      quitarPend(true); break;
    }
    default: quitarPend(true);
  }
}

// ---------- bombas ----------
async function bombaRevelada(ev) {
  const m = posMazo(), mesa = posMesa();
  quitarPend(false);
  sfx('bombaGiro');
  const dorso = fx.enEscena(crearReverso());
  await fx.volar(dorso, m, { x: mesa.x, y: mesa.y - 20 }, { dur: 520, arco: 60, e0: 0.8, e1: 1.9, quitar: false, easing: 'cubic-bezier(.2,.9,.3,1)' });
  // se gira lentamente para revelar el gatito
  if (!reducido()) await marco(dorso).animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: 420, easing: 'ease-in' }).finished;
  dorso.remove();
  bomba = cartaEscena('bomba'); fx.colocar(bomba, { x: mesa.x, y: mesa.y - 20 }, 1.9);
  bomba.classList.add('bomba-viva');
  if (!reducido()) marco(bomba).animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0)' }], { duration: 420, easing: 'ease-out' });
  await esperar(reducido() ? 80 : 380);
  sfx('explosion'); fx.sacudir(16, 700); fx.destello('#FFE9A8', 400, 0.8);
  fx.rafaga(mesa.x, mesa.y - 20, { n: 56, colores: [C.NAR, C.AMA, C.QUE, '#FFE9A8'], vel: [160, 620] });
  fx.humo(mesa.x, mesa.y + 20, 10); fx.onda(mesa.x, mesa.y - 20, { color: C.AMA, tam: Math.min(640, innerWidth), dur: 800, grosor: 14 });
  fx.texto('¡GATITO EXPLOSIVO!', { x: mesa.x, y: mesa.y - Math.min(190, innerHeight * 0.27), color: C.AMA, tam: 84, dur: 2000, rot: -3, contorno: C.INK });
  reaccion(ev.por, 'sorpresa', 1800, 'sorpresa');
  document.querySelectorAll('.rival .avatar').forEach((a) => { const pid = a.closest('[data-pid]').dataset.pid; if (pid !== ev.por) reaccion(pid, 'sorpresa', 900); });
  await esperar(reducido() ? 300 : 1100);
}
async function desactivador(ev) {
  const mesa = posMesa(), d = fx.enEscena(crearCarta('desactivador')), desde = posJ(ev.por);
  await fx.volar(d, desde, { x: mesa.x + 70, y: mesa.y - 20 }, { dur: 480, arco: 60, e0: 0.8, e1: 1.5, quitar: false });
  d.classList.add('brilla-fx'); sfx('desactivar');
  fx.onda(mesa.x, mesa.y - 20, { color: C.CREMA, tam: 420, dur: 700, grosor: 12 }); fx.onda(mesa.x, mesa.y - 20, { color: C.AMA, tam: 260, dur: 600 });
  fx.rafaga(mesa.x, mesa.y - 20, { n: 30, colores: [C.CREMA, C.AMA, C.BEIGE], g: 80, vel: [60, 280], forma: 'e' });
  fx.texto('¡DESACTIVADO!', { x: mesa.x, y: mesa.y - Math.min(190, innerHeight * 0.27), color: C.CREMA, tam: 72, dur: 1700, contorno: C.CAL });
  if (bomba) { bomba.classList.remove('bomba-viva'); bomba.classList.add('apagada-fx'); }
  reaccion(ev.por, 'alegria', 2000, 'alivio'); clase(ev.por, 'salta', 800);
  await esperar(reducido() ? 200 : 900);
  const m = posMazo();
  if (bomba) { const b = bomba; bomba = null; fx.volar(b, { x: mesa.x, y: mesa.y - 20 }, m, { dur: 650, arco: 40, e0: 1.9, e1: 0.5, giro: 20, easing: 'cubic-bezier(.4,0,.2,1)' }); }
  fx.volar(d, { x: mesa.x + 70, y: mesa.y - 20 }, posDescarte(), { dur: 500, e0: 1.5, e1: 0.4, easing: 'cubic-bezier(.5,0,.8,.4)' });
}
async function eliminado(ev) {
  const mesa = posMesa(), o = posAvatar(ev.por);
  if (bomba) { const b = bomba; bomba = null; fx.rafaga(mesa.x, mesa.y - 20, { n: 40, colores: [C.INK, C.CAL, C.NAR], vel: [80, 420] }); fx.humo(mesa.x, mesa.y, 8); b.animate([{ opacity: 1 }, { opacity: 0, transform: b.style.transform + ' scale(1.4)' }], { duration: 500, fill: 'forwards' }).onfinish = () => b.remove(); }
  fx.vineta('rgba(110,20,0,.8)', 1600); fx.sacudir(8, 400);
  reaccion(ev.por, 'fuera', 0, ev.por === api.yo() ? 'perder' : 'triste'); clase(ev.por, 'cae', 1200);
  fx.rafaga(o.x, o.y, { n: 30, colores: [C.INK, C.CAL, C.BEIGE], vel: [60, 260], g: 700 });
  fx.texto(`☠️ ${api.nombre(ev.por)}`, { x: innerWidth / 2, y: innerHeight * 0.36, color: C.CREMA, tam: 66, dur: 1800, rot: 3, contorno: '#6e1b00' });
  fx.texto('¡se ha quedado eliminado!', { x: innerWidth / 2, y: innerHeight * 0.36 + 62, color: C.BEIGE, tam: 32, dur: 1800, rot: 2 });
  await esperar(reducido() ? 200 : 900);
}
async function victoria(ev) {
  sfx('ganar'); reaccion(ev.por, 'victoria', 0); clase(ev.por, 'salta', 1500);
  const o = posAvatar(ev.por);
  for (let i = 0; i < 5; i++) setTimeout(() => { fx.lluvia(innerWidth / 2, -10, innerWidth, [C.NAR, C.AMA, C.CREMA, C.BEIGE, C.QUE], 22); fx.rafaga(o.x + azar(-60, 60), o.y + azar(-40, 40), { n: 16, colores: [C.AMA, C.NAR, C.CREMA], vel: [100, 400], forma: 'e' }); }, i * 450);
  fx.texto(`🏆 ¡${api.nombre(ev.por)} gana!`, { x: innerWidth / 2, y: innerHeight * 0.38, color: C.AMA, tam: 76, dur: 3800, rot: -3 });
  await esperar(1000);
}

// ---------- el resto de eventos ----------
async function robar(ev) {
  const m = posMazo(), d = posJ(ev.por);
  sfx('robar');
  const el = fx.enEscena(crearReverso()); el.classList.add('mini-escena');
  fx.volar(el, m, d, { dur: 420, arco: 40, e0: 0.9, e1: ev.por === api.yo() ? 1.1 : 0.55, giro: 12 });
  const mz = $('#mazo'); if (mz) mz.animate([{ transform: 'scale(1)' }, { transform: 'scale(.93) rotate(-2deg)' }, { transform: 'scale(1)' }], { duration: 260 });
  await esperar(120);
}
async function inicio(ev) {
  await esperar(550);
  sfx('empezar');
  const m = posMazo(), maxPorJugador = reducido() ? 2 : 4;
  let k = 0;
  for (let r = 0; r < maxPorJugador; r++) for (const pid of ev.orden) {
    const el = fx.enEscena(crearReverso()); el.classList.add('mini-escena');
    fx.volar(el, m, posJ(pid), { dur: 380, arco: 50, e1: pid === api.yo() ? 1 : 0.5, giro: azar(-25, 25) });
    if (k++ % 3 === 0) sfx('repartir');
    await esperar(55);
  }
}
async function turno(ev) {
  const mio = ev.pid === api.yo();
  clase(ev.pid, 'turno-fx', 900);
  const o = posAvatar(ev.pid);
  fx.onda(o.x, o.y, { color: mio ? C.AMA : C.NAR, tam: mio ? 320 : 200, dur: 600 });
  if (mio) { sfx('miTurno'); fx.texto(ev.turnos > 1 ? `¡TE TOCA! (×${ev.turnos})` : '¡TE TOCA!', { x: innerWidth / 2, y: innerHeight * 0.42, color: C.AMA, tam: 64, dur: 1300, rot: -3 }); }
  else sfx('turno');
}
async function entregar(ev) {
  if (flechaEl) { flechaEl.remove(); flechaEl = null; }
  const a = posAvatar(ev.de), b = posAvatar(ev.a);
  const el = fx.enEscena(ev.carta ? crearCarta(ev.carta) : crearReverso()); el.classList.add('mini-escena');
  sfx('entregar'); fx.volar(el, a, b, { dur: 700, arco: 80, giro: 20, estela: [C.AMA, C.NAR] });
  reaccion(ev.a, 'alegria', 1200);
}

const MANEJADORES = { inicio, turno, robar, jugar, negar, cancelada, efecto, bomba: bombaRevelada, desactivador, eliminado, victoria, entregar,
  reinsertada: async (ev) => { const m = posMazo(); fx.onda(m.x, m.y, { color: C.CAL, tam: 180, dur: 500 }); const mz = $('#mazo'); if (mz) mz.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'cubic-bezier(.3,1.6,.5,1)' }); },
  salio: async (ev) => { api.avisar(`${api.nombre(ev.por)} ha abandonado la partida`); reaccion(ev.por, 'fuera', 0); },
  auto: async (ev) => { api.avisar(`${api.nombre(ev.por)} tardaba demasiado y ha robado automáticamente`); },
  sinefecto: async () => { quitarPend(true); },
};

let cadena = Promise.resolve();
export function procesar(eventos) {
  for (const ev of eventos) {
    ocupado++;
    cadena = cadena.then(() => (MANEJADORES[ev.e] ? MANEJADORES[ev.e](ev) : null)).catch((e) => console.error('Animación', ev.e, e)).then(() => { ocupado--; });
  }
}
/** Tras reconexión o carga: si hay una jugada en curso que no se ha animado, la mostramos ya colocada. */
export function sincronizarPendiente(juego) {
  if (ocupado > 0) return;
  const p = juego && juego.pendiente;
  if (!p && pend) return quitarPend(false);
  if (p && (!pend || pend.aid !== p.aid)) {
    quitarPend(false);
    const mesa = posMesa(), n = p.cartas.length;
    const els = p.cartas.map((t, i) => { const e = cartaEscena(t); fx.colocar(e, lugar(i, n, mesa), 1, rotar(i, n)); return e; });
    pend = { aid: p.aid, els, cuenta: null };
    nuevaCuenta(Math.max(300, p.ms), '¿Alguien lo frena?');
    if (p.negadas.length % 2 === 1) els.forEach((e) => e.classList.add('tachada-fx'));
  }
}
export function limpiar() { quitarPend(false); if (bomba) { bomba.remove(); bomba = null; } if (flechaEl) { flechaEl.remove(); flechaEl = null; } const e = $('#escena'); if (e) e.innerHTML = ''; }
