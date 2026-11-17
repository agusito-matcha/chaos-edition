// CHAOS EDITION · arranque, estado global, enrutado de pantallas y eventos de red.
import { $, h, esperar, elige } from './dom.js';
import * as red from './red.js';
import * as son from './sonido.js';
import * as fx from './efectos.js';
import * as anim from './animaciones.js';
import * as P from './pantallas.js';
import { frase, TXT } from './textos.js';
import { AVATARES } from './textos.js';

let perfil = { nombre: '', avatar: elige(AVATARES).id };
try { Object.assign(perfil, JSON.parse(localStorage.getItem('chaos.perfil.v1') || '{}')); } catch (e) { /* nada */ }

const S = { conexion: 'conectando', yo: red.sesion.id ? { id: red.sesion.id, codigo: red.sesion.codigo } : null, sala: null, juego: null, log: [], eid: 0, perfil, mostrarRes: false };
const nombreDe = (pid) => { const j = S.sala && S.sala.jugadores.find((x) => x.id === pid); return j ? j.nombre : 'Jugador'; };

// ---------- avisos ----------
function avisar(msg, tipo = 'info') {
  const cont = $('#avisos');
  while (cont.children.length >= 3) cont.firstChild.remove();
  const a = h('div', { class: 'aviso ' + tipo, role: tipo === 'error' ? 'alert' : 'status' }, msg);
  cont.append(a);
  a.animate([{ transform: 'translateY(-30px) scale(.8)', opacity: 0 }, { transform: 'translateY(4px) scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: fx.fxReducido() ? 100 : 320, easing: 'ease-out' });
  setTimeout(() => a.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 250, fill: 'forwards' }).onfinish = () => a.remove(), tipo === 'error' ? 4200 : 3000);
}

// ---------- contexto para las pantallas ----------
const ctx = {
  S, avisar, enviar: (m) => { if (!red.enviar(m)) avisar('Sin conexión con el servidor. Reintentando…', 'error'); },
  confirmarSalir: () => P.confirmarSalida(ctx), abrirAyuda: P.abrirAyuda, abrirAjustes: () => P.abrirAjustes(ctx), refrescarControles: () => pintarControles(),
};
anim.configurar({ yo: () => S.yo && S.yo.id, nombre: nombreDe, muerto: (pid) => { const j = S.juego && S.juego.jugadores.find((x) => x.id === pid); return !!j && !j.vivo; }, avisar });

// ---------- enrutado con transiciones ----------
const app = $('#app');
let actual = { nombre: null, comp: null }, resComp = null, timerRes = null;
const fabricas = { menu: P.pantallaMenu, sala: P.pantallaSala, juego: P.pantallaJuego };
function deseada() {
  if (!S.yo || !S.sala) return 'menu';
  return S.sala.fase === 'sala' ? 'sala' : 'juego';
}
function ir(nombre) {
  if (actual.nombre === nombre) return;
  const viejo = actual.comp;
  const comp = fabricas[nombre](ctx);
  comp.el.classList.add('entrando');
  app.append(comp.el);
  comp.actualizar();
  const reduc = fx.fxReducido();
  comp.el.animate(reduc ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(40px) scale(.95)', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: reduc ? 150 : 520, easing: 'cubic-bezier(.2,.9,.3,1)' }).onfinish = () => comp.el.classList.remove('entrando');
  if (viejo) {
    viejo.el.classList.add('saliendo');
    viejo.el.animate(reduc ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-30px) scale(1.04)', filter: 'blur(6px)' }], { duration: reduc ? 120 : 340, fill: 'forwards' }).onfinish = () => { viejo.el.remove(); if (viejo.destruir) viejo.destruir(); };
  }
  actual = { nombre, comp };
}
function render() {
  const d = deseada();
  if (d !== 'juego' && actual.nombre === 'juego') { anim.limpiar(); S.log = []; }
  if (d === 'menu') { quitarResultados(); }
  ir(d);
  if (actual.comp) actual.comp.actualizar();
  if (S.sala && S.sala.fase === 'fin' && S.mostrarRes && !resComp) {
    document.querySelectorAll('#escena .texto-fx').forEach((t) => t.remove());
    resComp = P.pantallaResultados(ctx); app.append(resComp.el);
    resComp.el.animate(fx.fxReducido() ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.3,1.2,.4,1)' });
  }
  if ((!S.sala || S.sala.fase !== 'fin') && resComp) quitarResultados();
  $('#reconectando').classList.toggle('visible', !!S.yo && S.conexion !== 'abierta');
}
function quitarResultados() { clearTimeout(timerRes); timerRes = null; S.mostrarRes = false; if (resComp) { resComp.el.remove(); resComp = null; } }

// ---------- mensajes de red ----------
function alMensaje(m) {
  switch (m.t) {
    case '_conectando': S.conexion = 'conectando'; break;
    case '_abierta': S.conexion = 'abierta'; ocultarCarga(); break;
    case '_cerrada': S.conexion = 'cerrada'; break;
    case 'unido': S.yo = { id: m.id, codigo: m.codigo }; if (!m.reconectado) { S.log = []; S.eid = 0; } break;
    case 'estado': {
      const habiaJuego = !!S.juego;
      S.sala = m.sala; S.juego = m.juego;
      const nuevos = (m.eventos || []).filter((e) => e.eid > S.eid);
      if (!S.log.length && !nuevos.length && m.registro) S.log = m.registro.map((e) => frase(e, nombreDe)).filter(Boolean);
      for (const e of nuevos) { const f = frase(e, nombreDe); if (f) S.log.push(f); }
      S.eid = Math.max(S.eid, m.eid || 0);
      if (m.sala.fase === 'fin') {
        if (nuevos.some((e) => e.e === 'victoria')) { clearTimeout(timerRes); timerRes = setTimeout(() => { S.mostrarRes = true; render(); }, 5200); }
        else if (!timerRes && !S.mostrarRes) S.mostrarRes = true;
      }
      render();
      if (nuevos.length) requestAnimationFrame(() => anim.procesar(nuevos));
      else if (m.juego) anim.sincronizarPendiente(m.juego);
      return;
    }
    case '_info': avisar(m.msg); return;
    case 'error': avisar(m.msg, 'error'); son.sfx('error'); break;
    case 'sesion_perdida': S.yo = null; S.sala = null; S.juego = null; avisar('Tu partida ya no existe (el anfitrión se ha desconectado, el servidor se ha reiniciado o ha caducado).', 'error'); break;
    case 'salida': S.yo = null; S.sala = null; S.juego = null; S.log = []; S.eid = 0; history.replaceState(null, '', location.pathname); break;
    default: return;
  }
  render();
}

// ---------- controles globales ----------
function pintarControles() {
  const a = son.ajustesSonido();
  $('#btn-sonido').textContent = a.silencio ? '🔇' : '🔊';
  $('#btn-sonido').setAttribute('aria-label', a.silencio ? 'Activar sonido' : 'Silenciar');
}
$('#btn-sonido').addEventListener('click', () => { const a = son.ajustesSonido(); son.cambiar({ silencio: !a.silencio }); pintarControles(); son.sfx('clic'); });
$('#btn-ajustes').addEventListener('click', () => P.abrirAjustes(ctx));
$('#btn-ayuda').addEventListener('click', () => P.abrirAyuda());

// El sonido solo se activa tras la primera interacción del usuario
let sonidoListo = false;
function desbloquear() {
  if (sonidoListo) return; sonidoListo = true;
  son.iniciar(); son.musica(true);
}
addEventListener('pointerdown', desbloquear, { once: false, capture: true });
addEventListener('keydown', desbloquear, { capture: true });
document.addEventListener('visibilitychange', () => { if (sonidoListo) son.musica(!document.hidden); });

// Respuesta visual inmediata a cada clic (cada tipo de elemento reacciona de forma distinta)
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('.btn, .opcion-avatar, .carta, .pila, .letra, .slot, .rival, .chip-sala, .objetivo, .pedir, .modal-x');
  if (!t) return;
  const x = e.clientX, y = e.clientY;
  if (t.matches('.btn, .modal-x, .chip-sala, .pedir')) {
    son.sfx('clic');
    const r = t.getBoundingClientRect(), o = h('span', { class: 'ripple', style: { left: x - r.left + 'px', top: y - r.top + 'px' } });
    t.append(o); o.animate([{ transform: 'translate(-50%,-50%) scale(0)', opacity: 0.6 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 520 }).onfinish = () => o.remove();
  } else if (t.matches('.opcion-avatar, .slot, .rival')) fx.rafaga(x, y, { n: 8, vel: [40, 160], colores: ['#F47B35', '#FFC83D', '#FFF9F0'], tam: [2, 5] });
  else if (t.matches('.letra')) { t.animate([{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-12deg) scale(1.3)' }, { transform: 'rotate(8deg) scale(.95)' }, { transform: 'none' }], { duration: 420 }); son.sfx('rebote'); }
  else if (t.matches('.carta')) fx.rafaga(x, y, { n: 6, vel: [30, 140], colores: ['#FFC83D', '#FFF9F0'], forma: 'e', tam: [3, 6], g: 200 });
  else if (t.matches('.pila')) { fx.onda(x, y, { tam: 160, dur: 450, color: '#F3DFC0' }); }
}, true);

// Parallax suave: elementos decorativos y pupilas siguen el cursor
let px = 0, py = 0, esperando = false;
addEventListener('pointermove', (e) => {
  px = (e.clientX / innerWidth - 0.5) * 2; py = (e.clientY / innerHeight - 0.5) * 2;
  if (!esperando) { esperando = true; requestAnimationFrame(() => { esperando = false; const r = document.documentElement.style; r.setProperty('--mx', px.toFixed(3)); r.setProperty('--my', py.toFixed(3)); }); }
}, { passive: true });

// ---------- carga ----------
function ocultarCarga() {
  const c = $('#carga'); if (!c || c.dataset.fuera) return; c.dataset.fuera = '1';
  c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards', delay: 350 }).onfinish = () => c.remove();
}
const textoCarga = $('#carga-texto'); let ti = 0;
const rotor = setInterval(() => { if (!textoCarga.isConnected) return clearInterval(rotor); textoCarga.textContent = TXT.cargando[++ti % TXT.cargando.length]; }, 900);
setTimeout(ocultarCarga, 6000); // si el servidor tarda, mostramos el menú igualmente (dirá «Conectando…»)

fx.iniciar();
pintarControles();
render();
red.conectar(alMensaje);
window.__chaos = { S, enviar: ctx.enviar }; // útil para depurar en la consola
