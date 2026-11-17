// Pantallas del juego: menú, sala de espera, partida, resultados y ventanas.
import { h, $, $$, esperar, azar, elige, copiar, centro } from './dom.js';
import { gato, logoMascota } from './arte.js';
import { crearCarta, crearReverso } from './cartas.js';
import { CARTAS, AVATARES, ORDEN_AYUDA, REGLAS, TXT, nombreCarta, esGato, frase } from './textos.js';
import * as fx from './efectos.js';
import * as son from './sonido.js';
import * as anim from './animaciones.js';

const ORDEN_MANO = ['negar', 'desactivador', 'ataque', 'pasar', 'favor', 'barajar', 'futuro', 'bomba', 'gato_pegon', 'gato_ninja', 'gato_mago', 'gato_dormilon', 'gato_cabreado'];
const avatarEl = (av, mood = 'neutral') => h('div', { class: 'avatar', html: gato(av, mood) });
const nombreDe = (S, pid) => { const j = S.sala && S.sala.jugadores.find((x) => x.id === pid); return j ? j.nombre : 'Jugador'; };
const avatarDe = (S, pid) => { const j = S.sala && S.sala.jugadores.find((x) => x.id === pid); return j ? j.avatar : 'mandarina'; };

// ======================= MODALES =======================
export function abrirModal(contenido, { cerrable = true, clase = '', alCerrar = null } = {}) {
  const raiz = $('#modales');
  const fondo = h('div', { class: 'modal-fondo' });
  const caja = h('div', { class: 'modal ' + clase, role: 'dialog', 'aria-modal': 'true' }, contenido);
  fondo.append(caja); raiz.append(fondo);
  const cerrar = () => {
    if (fondo.dataset.cerrando) return; fondo.dataset.cerrando = '1';
    const a = fondo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fx.fxReducido() ? 80 : 180, fill: 'forwards' });
    caja.animate([{ transform: 'none' }, { transform: 'translateY(20px) scale(.94)' }], { duration: fx.fxReducido() ? 80 : 180, fill: 'forwards' });
    a.onfinish = () => { fondo.remove(); if (alCerrar) alCerrar(); };
  };
  if (cerrable) {
    fondo.addEventListener('pointerdown', (e) => { if (e.target === fondo) cerrar(); });
    caja.prepend(h('button', { class: 'modal-x', type: 'button', 'aria-label': 'Cerrar', onclick: cerrar }, '✕'));
    const esc = (e) => { if (e.key === 'Escape' && fondo.isConnected) { cerrar(); removeEventListener('keydown', esc); } };
    addEventListener('keydown', esc);
  }
  fondo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
  if (!fx.fxReducido()) caja.animate([{ transform: 'translateY(30px) scale(.88) rotate(-1.5deg)', opacity: 0 }, { transform: 'translateY(-6px) scale(1.02) rotate(.4deg)', opacity: 1, offset: 0.65 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.3,1.2,.4,1)' });
  const f = caja.querySelector('button.btn, input, button'); if (f && cerrable === false) f.focus();
  return { cerrar, caja, fondo };
}

export function abrirAyuda() {
  let pest = 'reglas';
  const cuerpo = h('div', { class: 'ayuda-cuerpo' });
  const tabs = h('div', { class: 'pestanas' });
  const pintar = () => {
    cuerpo.replaceChildren();
    if (pest === 'reglas') REGLAS.forEach(([ic, t, d]) => cuerpo.append(h('div', { class: 'regla' }, h('span', { class: 'regla-ic' }, ic), h('div', {}, h('b', {}, t), h('p', {}, d)))));
    else ORDEN_AYUDA.forEach((t) => cuerpo.append(h('div', { class: 'ayuda-carta' }, crearCarta(t, { mini: true }), h('div', {}, h('b', {}, CARTAS[t].nombre), h('p', {}, CARTAS[t].desc)))));
    tabs.replaceChildren(...[['reglas', 'Cómo se juega'], ['cartas', 'Las cartas']].map(([k, n]) => h('button', { class: 'pestana' + (k === pest ? ' sel' : ''), type: 'button', onclick: () => { pest = k; pintar(); } }, n)));
  };
  pintar();
  return abrirModal([h('h2', { class: 'titulo-modal' }, '¿Cómo se juega?'), tabs, cuerpo], { clase: 'modal-ayuda' });
}

export function abrirAjustes(ctx) {
  const a = son.ajustesSonido();
  const rango = (etq, clave) => h('label', { class: 'ajuste' }, h('span', {}, etq), h('input', { type: 'range', min: 0, max: 100, value: Math.round(a[clave] * 100), oninput: (e) => { son.cambiar({ [clave]: e.target.value / 100 }); if (clave === 'efectos') son.sfx('clic'); } }));
  const marca = (etq, val, fn) => h('label', { class: 'ajuste marca' }, h('input', { type: 'checkbox', checked: val ? 'checked' : null, onchange: (e) => fn(e.target.checked) }), h('span', {}, etq));
  const m = abrirModal([h('h2', { class: 'titulo-modal' }, 'Ajustes'),
    rango('Música', 'musica'), rango('Efectos de sonido', 'efectos'),
    marca('Silenciar todo', a.silencio, (v) => { son.cambiar({ silencio: v }); ctx.refrescarControles(); }),
    marca('Reducir efectos visuales (mejor para ordenadores lentos)', fx.fxReducido(), (v) => fx.ponerReducido(v)),
    h('div', { class: 'fila-botones' },
      h('button', { class: 'btn btn-crema', type: 'button', onclick: () => { son.iniciar(); son.sfx('explosion'); } }, 'Probar sonido'),
      ctx.S.sala ? h('button', { class: 'btn btn-peligro', type: 'button', onclick: () => { m.cerrar(); ctx.confirmarSalir(); } }, 'Salir de la sala') : null)], { clase: 'modal-ajustes' });
}

export function confirmarSalida(ctx) {
  const m = abrirModal([h('h2', { class: 'titulo-modal' }, '¿Quieres salir?'), h('p', {}, window.CHAOS_ES_ANFITRION ? 'Eres el anfitrión: si sales, la sala se cierra para todos los jugadores.' : ctx.S.sala && ctx.S.sala.fase === 'partida' ? 'Si abandonas, quedarás eliminado de la partida y no podrás volver a entrar.' : 'Saldrás de la sala.'),
    h('div', { class: 'fila-botones' }, h('button', { class: 'btn btn-crema', onclick: () => m.cerrar() }, 'Seguir jugando'), h('button', { class: 'btn btn-peligro', onclick: () => { m.cerrar(); ctx.enviar({ t: 'salir' }); } }, 'Sí, salir'))], { clase: 'modal-peque' });
}

// ======================= MENÚ =======================
export function pantallaMenu(ctx) {
  const { S } = ctx;
  let av = S.perfil.avatar;
  const nombre = h('input', { class: 'campo', maxlength: 16, placeholder: 'Tu nombre de gato', value: S.perfil.nombre, autocomplete: 'off', 'aria-label': 'Tu nombre' });
  const codigo = h('input', { class: 'campo campo-codigo', maxlength: 5, placeholder: 'CÓDIGO', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Código de la sala' });
  codigo.addEventListener('input', () => { codigo.value = codigo.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  const estado = h('div', { class: 'estado-red' });
  const opciones = AVATARES.map((a) => {
    const el = h('button', { class: 'opcion-avatar' + (a.id === av ? ' sel' : ''), type: 'button', 'aria-label': a.nombre, 'aria-pressed': String(a.id === av) },
      avatarEl(a.id), h('span', { class: 'nombre-av' }, a.nombre));
    el.addEventListener('click', () => {
      av = a.id; opciones.forEach((o) => { o.classList.toggle('sel', o === el); o.setAttribute('aria-pressed', String(o === el)); });
      const g = el.querySelector('.gato'); g.dataset.mood = 'alegria'; son.sfx(elige(['sorpresa', 'alivio', 'enfado'])); setTimeout(() => { g.dataset.mood = 'neutral'; }, 900);
    });
    return el;
  });
  const guardarPerfil = () => { S.perfil = { nombre: nombre.value.trim(), avatar: av }; try { localStorage.setItem('chaos.perfil.v1', JSON.stringify(S.perfil)); } catch (e) { /* nada */ } return S.perfil; };
  const conectado = () => { if (S.conexion !== 'abierta') { ctx.avisar('Todavía no hay conexión con el servidor. Espera un momento…', 'error'); return false; } return true; };
  const unirse = h('div', { class: 'bloque-unirse' },
    codigo, h('button', { class: 'btn btn-crema', type: 'button', onclick: () => { if (!conectado()) return; if (codigo.value.length < 5) { ctx.avisar('El código tiene 5 letras o números.', 'error'); codigo.focus(); return; } const p = guardarPerfil(); ctx.enviar({ t: 'unirse', codigo: codigo.value, nombre: p.nombre, avatar: p.avatar }); } }, 'Entrar'));
  const btnUnirse = h('button', { class: 'btn btn-marron', type: 'button', onclick: () => { unirse.classList.toggle('abierto'); if (unirse.classList.contains('abierto')) codigo.focus(); } }, 'Unirme con código');
  const url = new URLSearchParams(location.search).get('sala');
  if (url) { codigo.value = url.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); unirse.classList.add('abierto'); }
  const flotantes = ['bomba', 'negar', 'ataque', 'gato_ninja'].map((t, i) => h('div', { class: 'flota flota-' + i }, crearCarta(t)));
  const el = h('div', { class: 'pantalla menu' },
    h('div', { class: 'menu-hero' }, ...flotantes,
      h('div', { class: 'logo' }, h('div', { class: 'logo-mascota', html: logoMascota() }), h('h1', { class: 'logo-titulo' }, h('span', { class: 'l-chaos' }, 'CHAOS'), h('span', { class: 'l-edition' }, 'EDITION')), h('p', { class: 'lema' }, TXT.lema))),
    h('div', { class: 'menu-panel' },
      h('label', { class: 'etq' }, 'Tu nombre', nombre),
      h('div', { class: 'etq' }, 'Elige tu gato', h('div', { class: 'rejilla-avatares' }, ...opciones)),
      h('div', { class: 'fila-botones col' },
        h('button', { class: 'btn btn-grande', type: 'button', onclick: () => { if (!conectado()) return; const p = guardarPerfil(); ctx.enviar({ t: 'crear', nombre: p.nombre, avatar: p.avatar }); } }, '🐱 Crear partida'),
        btnUnirse, unirse),
      estado));
  return {
    el,
    actualizar() {
      const c = S.conexion;
      estado.className = 'estado-red ' + c;
      const p2p = !!window.CHAOS_P2P;
      estado.textContent = c === 'abierta' ? (p2p ? '● Listo para jugar (las partidas van directas entre los navegadores)' : '● Conectado con el servidor') : (p2p ? '● Preparando…' : '● Conectando con el servidor… (si el servidor estaba dormido puede tardar hasta un minuto)');
    },
  };
}

// ======================= SALA DE ESPERA =======================
export function pantallaSala(ctx) {
  const { S } = ctx;
  const slots = new Map();
  let todosListosAntes = false, editando = false;
  const codigoEl = h('div', { class: 'codigo-grande', 'aria-label': 'Código de la sala' });
  const rejilla = h('div', { class: 'rejilla-sala' });
  const mensaje = h('p', { class: 'msg-sala' });
  const avisoHost = h('p', { class: 'msg-sala aviso-host' }, '👑 Eres el anfitrión: la partida funciona en tu navegador. No cierres esta pestaña ni cambies de red mientras jugáis.');
  const btnListo = h('button', { class: 'btn btn-crema', type: 'button' }, '¡Estoy listo!');
  const btnEmpezar = h('button', { class: 'btn btn-grande', type: 'button', onclick: () => ctx.enviar({ t: 'empezar' }) }, '🚀 ¡Empezar partida!');
  const contador = h('div', { class: 'contador-jugadores' });
  const enlace = () => location.href.split(/[?#]/)[0] + '?sala=' + S.sala.codigo;
  const panelPerfil = h('div', { class: 'panel-perfil' });
  const copiarCodigo = h('button', { class: 'btn btn-crema', type: 'button', onclick: () => copiar(S.sala.codigo).then(() => { ctx.avisar('¡Código copiado!'); son.sfx('copiar'); }).catch(() => ctx.avisar('No se ha podido copiar. Anota el código a mano: ' + S.sala.codigo, 'error')) }, '📋 Copiar código');
  const compartir = h('button', { class: 'btn btn-marron', type: 'button', onclick: async () => {
    const datos = { title: 'CHAOS EDITION', text: `¡Únete a mi partida de CHAOS EDITION! Código: ${S.sala.codigo}`, url: enlace() };
    try { if (navigator.share) { await navigator.share(datos); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    copiar(enlace()).then(() => { ctx.avisar('¡Enlace de invitación copiado! Pégalo en el chat de tus amigos.'); son.sfx('copiar'); }).catch(() => ctx.avisar('Enlace: ' + enlace()));
  } }, '🔗 Compartir invitación');
  btnListo.addEventListener('click', () => { const yo = S.sala.jugadores.find((j) => j.id === S.yo.id); ctx.enviar({ t: 'listo', listo: !(yo && yo.listo) }); son.sfx('listo'); });
  const aspecto = h('button', { class: 'btn btn-peque', type: 'button', onclick: () => { editando = !editando; pintarPerfil(); } }, '✏️ Cambiar mi aspecto');
  function pintarPerfil() {
    panelPerfil.replaceChildren();
    panelPerfil.classList.toggle('abierto', editando);
    if (!editando) return;
    const yo = S.sala.jugadores.find((j) => j.id === S.yo.id) || {};
    let av = yo.avatar;
    const nom = h('input', { class: 'campo', maxlength: 16, value: yo.nombre || '', 'aria-label': 'Nombre' });
    const ops = AVATARES.map((a) => { const b = h('button', { class: 'opcion-avatar mini' + (a.id === av ? ' sel' : ''), type: 'button', 'aria-label': a.nombre, onclick: () => { av = a.id; ops.forEach((o) => o.classList.toggle('sel', o === b)); } }, avatarEl(a.id)); return b; });
    panelPerfil.append(nom, h('div', { class: 'rejilla-avatares mini' }, ...ops), h('button', { class: 'btn', type: 'button', onclick: () => { ctx.enviar({ t: 'perfil', nombre: nom.value, avatar: av }); editando = false; pintarPerfil(); try { localStorage.setItem('chaos.perfil.v1', JSON.stringify({ nombre: nom.value.trim(), avatar: av })); } catch (e) { /* nada */ } } }, 'Guardar'));
  }
  const el = h('div', { class: 'pantalla sala' },
    h('div', { class: 'sala-cab' }, h('h2', { class: 'titulo-pantalla' }, 'Sala de espera'), h('p', { class: 'sub' }, 'Pasa este código a tus amigos para que se unan:'), codigoEl, h('div', { class: 'fila-botones' }, copiarCodigo, compartir)),
    contador, rejilla, mensaje, window.CHAOS_P2P && window.CHAOS_ES_ANFITRION ? avisoHost : null,
    h('div', { class: 'fila-botones sala-pie' }, btnListo, aspecto, btnEmpezar, h('button', { class: 'btn btn-peligro btn-peque', type: 'button', onclick: () => ctx.confirmarSalir() }, 'Salir')),
    panelPerfil);

  function actualizar() {
    const s = S.sala; if (!s) return;
    if (codigoEl.dataset.c !== s.codigo) { codigoEl.dataset.c = s.codigo; codigoEl.replaceChildren(...[...s.codigo].map((ch, i) => h('span', { class: 'letra', style: { '--i': i } }, ch))); }
    const ids = new Set(s.jugadores.map((j) => j.id));
    for (const [id, sl] of slots) if (!ids.has(id)) { slots.delete(id); sl.el.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.6) rotate(8deg)', opacity: 0 }], { duration: 260 }).onfinish = () => sl.el.remove(); }
    s.jugadores.forEach((j, i) => {
      let sl = slots.get(j.id);
      if (!sl) {
        const g = avatarEl(j.avatar), nom = h('div', { class: 'slot-nombre' }), est = h('div', { class: 'slot-estado' }), corona = h('div', { class: 'corona', title: 'Anfitrión' }, '👑');
        const e = h('div', { class: 'slot', data: { pid: j.id } }, corona, g, nom, est);
        sl = { el: e, g, nom, est, corona, av: j.avatar }; slots.set(j.id, sl);
        e.animate([{ transform: 'translateY(40px) scale(.6) rotate(-8deg)', opacity: 0 }, { transform: 'translateY(-8px) scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.3,1.2,.4,1)' });
        if (slots.size > 1) { son.sfx('turno'); fx.rafaga(innerWidth / 2, innerHeight * 0.5, { n: 14, vel: [60, 220] }); }
        e.addEventListener('pointerenter', () => { const gg = e.querySelector('.gato'); gg.dataset.mood = 'alegria'; setTimeout(() => { gg.dataset.mood = 'neutral'; }, 700); });
      }
      if (sl.av !== j.avatar) { sl.av = j.avatar; sl.g.innerHTML = gato(j.avatar); }
      sl.nom.textContent = j.nombre + (j.id === S.yo.id ? ' (tú)' : '');
      sl.corona.style.display = j.id === s.anfitrion ? '' : 'none';
      sl.est.textContent = !j.conectado ? '⚠️ Sin conexión' : j.listo ? '✅ ¡Listo!' : '⏳ Esperando…';
      sl.est.className = 'slot-estado ' + (!j.conectado ? 'off' : j.listo ? 'listo' : '');
      sl.el.classList.toggle('sin-conexion', !j.conectado); sl.el.classList.toggle('es-listo', j.listo && j.conectado);
      if (rejilla.children[i] !== sl.el) rejilla.insertBefore(sl.el, rejilla.children[i] || null);
    });
    $$('.slot-vacio', rejilla).forEach((x) => x.remove());
    for (let k = s.jugadores.length; k < s.max; k++) rejilla.append(h('div', { class: 'slot slot-vacio' }, h('div', { class: 'hueco' }, '🐾'), h('div', { class: 'slot-nombre' }, 'Esperando jugador…')));
    const conect = s.jugadores.filter((j) => j.conectado), esHost = s.anfitrion === S.yo.id;
    const yo = s.jugadores.find((j) => j.id === S.yo.id);
    contador.textContent = `${conect.length} de ${s.max} jugadores conectados`;
    btnListo.textContent = yo && yo.listo ? 'Ya no estoy listo' : '¡Estoy listo!';
    btnEmpezar.style.display = esHost ? '' : 'none';
    const todos = conect.length >= s.min && conect.every((j) => j.listo);
    btnEmpezar.disabled = conect.length < s.min;
    btnEmpezar.classList.toggle('late', todos);
    mensaje.textContent = conect.length < s.min ? 'Hace falta al menos otro jugador para empezar.' : todos ? '¡Todos listos! Que empiece el caos.' : esHost ? 'Cuando estéis todos, pulsa «Empezar partida».' : 'Esperando a que el anfitrión empiece la partida…';
    if (todos && !todosListosAntes) {
      son.sfx('todosListos');
      const c = centro(el);
      fx.texto('¡TODOS LISTOS!', { x: c.x, y: c.y * 0.7, color: '#FFC83D', tam: 70, dur: 1800 });
      for (let i = 0; i < 4; i++) setTimeout(() => fx.lluvia(innerWidth / 2, -10, innerWidth, ['#F47B35', '#FFC83D', '#FFF9F0', '#D85D24'], 20), i * 300);
      $$('.slot .gato', rejilla).forEach((g) => { g.dataset.mood = 'victoria'; setTimeout(() => { g.dataset.mood = 'neutral'; }, 1800); });
    }
    todosListosAntes = todos;
    if (editando) { /* se mantiene abierto */ }
  }
  return { el, actualizar };
}

// ======================= PARTIDA =======================
export function pantallaJuego(ctx) {
  const { S } = ctx;
  const sel = new Set();
  let bloqueo = false, modalEstado = null, modalActivo = null, vistosEnMano = new Set(), ultimoEstadoClave = '', historialAbierto = false;

  const pistaEl = h('div', { class: 'pista' }, 'Pulsa una carta para ver lo que hace.');
  const mazoCnt = h('span', { class: 'cnt' }, '0');
  const mazo = h('button', { class: 'pila mazo', id: 'mazo', type: 'button', 'aria-label': 'Mazo de robo' }, crearReverso(), crearReverso(), crearReverso(), mazoCnt);
  const descarte = h('div', { class: 'pila descarte', id: 'descarte', 'aria-label': 'Mazo de descarte' }, h('div', { class: 'hueco-desc' }, 'Descarte'));
  const estadoEl = h('div', { class: 'estado-partida' });
  const turnosEl = h('div', { class: 'turnos-chip' });
  const mesa = h('div', { class: 'mesa', id: 'mesa' }, mazo, h('div', { class: 'centro-info' }, estadoEl, turnosEl), descarte);
  const rivalesEl = h('div', { class: 'rivales' });
  const manoEl = h('div', { class: 'mano', id: 'mano' });
  const btnJugar = h('button', { class: 'btn btn-grande', type: 'button', disabled: 'disabled' }, 'Jugar');
  const btnRobar = h('button', { class: 'btn', type: 'button' }, '🃏 Robar carta');
  const btnNo = h('button', { class: 'btn btn-no', type: 'button', style: { display: 'none' } }, '🚫 ¡VA A SER QUE NO!');
  const miAvatar = h('div', { class: 'avatar', id: 'mi-avatar' });
  const miNombre = h('div', { class: 'mi-nombre' });
  const miEstado = h('div', { class: 'mi-estado' });
  const miZona = h('div', { class: 'mi-zona', id: 'mi-zona' }, h('div', { class: 'mi-fila' }, h('div', { class: 'mi-info' }, miAvatar, h('div', {}, miNombre, miEstado)), h('div', { class: 'acciones' }, btnJugar, btnRobar, btnNo)), pistaEl, manoEl);
  const listaLog = h('div', { class: 'log-lista', 'aria-live': 'polite' });
  const historial = h('aside', { class: 'historial' }, h('h3', {}, 'Historial'), listaLog);
  const toggleHist = h('button', { class: 'btn btn-icono', type: 'button', 'aria-label': 'Historial de acciones', onclick: () => { historialAbierto = !historialAbierto; historial.classList.toggle('abierto', historialAbierto); } }, '📜');
  const barra = h('header', { class: 'barra' },
    h('div', { class: 'chip-sala', title: 'Código de la sala' }, 'Sala ', h('b', {}, S.sala ? S.sala.codigo : '')),
    window.CHAOS_P2P && window.CHAOS_ES_ANFITRION ? h('div', { class: 'chip-host' }, '👑 Anfitrión: no cierres esta pestaña') : null,
    h('div', { class: 'barra-btns' }, toggleHist));
  const sombraEstado = h('div', { class: 'banner-espectador', style: { display: 'none' } }, '☠️ Estás eliminado. Puedes seguir mirando la partida.');
  const el = h('div', { class: 'pantalla juego' }, barra, rivalesEl, mesa, sombraEstado, miZona, historial);

  // --- utilidades ---
  const miJ = () => S.juego && S.juego.jugadores.find((j) => j.id === S.yo.id);
  const vivo = () => { const j = miJ(); return !!(j && j.vivo); };
  const miTurno = () => S.juego && S.juego.fase === 'jugar' && S.juego.turno === S.yo.id && vivo();
  const tipoDe = (id) => { const c = S.juego.mano.find((x) => x.id === id); return c && c.tipo; };
  const puedeNegar = () => S.juego && S.juego.fase === 'negar' && vivo() && S.juego.mano.some((c) => c.tipo === 'negar');

  function pista(t) { pistaEl.textContent = t; }
  function sacudirCarta(c) { c.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px) rotate(-3deg)' }, { transform: 'translateX(8px) rotate(3deg)' }, { transform: 'none' }], { duration: 300 }); }

  function alPulsarCarta(c) {
    const id = c.dataset.id, tipo = c.dataset.tipo, g = S.juego;
    pista(`${CARTAS[tipo].nombre}: ${CARTAS[tipo].desc}`);
    if (g.fase === 'negar' && vivo()) {
      if (tipo === 'negar') { ctx.enviar({ t: 'negar', carta: id }); fx.rafaga(...Object.values(centro(c)).slice(0, 2), { n: 14, colores: ['#D85D24', '#57351F', '#F47B35'] }); sel.clear(); pintarSel(); }
      else { ctx.avisar('Ahora solo puedes jugar VA A SER QUE NO.', 'error'); sacudirCarta(c); }
      return;
    }
    if (!miTurno()) { ctx.avisar(g.fase === 'jugar' ? 'No es tu turno.' : 'Espera un momento…', 'error'); son.sfx('error'); sacudirCarta(c); return; }
    if (tipo === 'bomba' || tipo === 'desactivador' || tipo === 'negar') {
      ctx.avisar(tipo === 'negar' ? 'VA A SER QUE NO se juega cuando otro jugador juega una carta.' : tipo === 'desactivador' ? 'El DESACTIVADOR se usa solo, cuando robes un GATITO EXPLOSIVO.' : 'No puedes jugar esta carta.', 'error'); sacudirCarta(c); return;
    }
    if (sel.has(id)) sel.delete(id);
    else {
      const primero = [...sel][0];
      if (esGato(tipo) && primero && tipoDe(primero) === tipo && sel.size < 3) sel.add(id);
      else { sel.clear(); sel.add(id); }
    }
    pintarSel();
    c.animate([{ transform: 'translateY(-30px) scale(1.2) rotate(-4deg)' }, { transform: 'translateY(-18px) scale(1.1) rotate(2deg)' }], { duration: 220, easing: 'cubic-bezier(.3,1.5,.5,1)' });
  }

  function etiquetaJugar() {
    if (!sel.size) return null;
    const t = tipoDe([...sel][0]);
    if (!t) return null;
    if (esGato(t)) return sel.size === 1 ? { txt: 'Elige 2 o 3 cartas iguales de gato', ok: false } : sel.size === 2 ? { txt: `Jugar pareja de ${CARTAS[t].nombre}`, ok: true } : { txt: `Jugar trío de ${CARTAS[t].nombre}`, ok: true };
    return { txt: `Jugar ${CARTAS[t].nombre}`, ok: true };
  }
  function pintarSel() {
    for (const c of manoEl.children) c.classList.toggle('sel', sel.has(c.dataset.id));
    const e = etiquetaJugar();
    btnJugar.textContent = e ? e.txt : 'Jugar';
    btnJugar.disabled = !(e && e.ok && miTurno()) || bloqueo;
  }

  function jugarSeleccion() {
    if (!sel.size || !miTurno() || bloqueo) return;
    const ids = [...sel], t = tipoDe(ids[0]);
    const necesitaObjetivo = t === 'favor' || (esGato(t) && ids.length >= 2);
    const enviar = (objetivo, pedida) => { bloqueo = true; setTimeout(() => { bloqueo = false; pintarSel(); }, 700); ctx.enviar({ t: 'jugar', cartas: ids, objetivo, pedida }); sel.clear(); pintarSel(); };
    if (!necesitaObjetivo) return enviar(null, null);
    const posibles = S.juego.jugadores.filter((j) => j.vivo && j.id !== S.yo.id);
    const elegir = (cb) => {
      const m = abrirModal([h('h2', { class: 'titulo-modal' }, t === 'favor' ? '¿A quién le pides el favor?' : '¿A quién le robas?'),
        h('div', { class: 'rejilla-objetivos' }, ...posibles.map((j) => h('button', { class: 'objetivo' + (j.n === 0 ? ' vacio' : ''), type: 'button', disabled: j.n === 0 ? 'disabled' : null, onclick: () => { m.cerrar(); cb(j.id); } }, avatarEl(avatarDe(S, j.id)), h('b', {}, nombreDe(S, j.id)), h('small', {}, j.n === 0 ? 'Sin cartas' : j.n + (j.n === 1 ? ' carta' : ' cartas')))))], { clase: 'modal-objetivo' });
    };
    elegir((obj) => {
      if (ids.length < 3) return enviar(obj, null);
      const tipos = Object.keys(CARTAS).filter((k) => k !== 'bomba');
      const m2 = abrirModal([h('h2', { class: 'titulo-modal' }, `¿Qué carta le pides a ${nombreDe(S, obj)}?`), h('p', { class: 'sub' }, 'Si la tiene, te la tendrá que dar. Si no, no pasa nada.'),
        h('div', { class: 'rejilla-pedida' }, ...tipos.map((k) => h('button', { class: 'pedir', type: 'button', onclick: () => { m2.cerrar(); enviar(obj, k); } }, crearCarta(k, { mini: true }), h('span', {}, CARTAS[k].nombre))))], { clase: 'modal-pedida' });
    });
  }
  btnJugar.addEventListener('click', jugarSeleccion);
  const robar = () => { if (!miTurno()) { ctx.avisar(S.juego && S.juego.fase === 'jugar' ? 'No es tu turno.' : 'Ahora no puedes robar.', 'error'); son.sfx('error'); return; } if (bloqueo) return; bloqueo = true; setTimeout(() => { bloqueo = false; pintarSel(); }, 500); sel.clear(); pintarSel(); ctx.enviar({ t: 'robar' }); };
  btnRobar.addEventListener('click', robar); mazo.addEventListener('click', robar);
  btnNo.addEventListener('click', () => { const c = S.juego.mano.find((x) => x.tipo === 'negar'); if (c) { ctx.enviar({ t: 'negar', carta: c.id }); } });
  addEventListener('keydown', teclas);
  function teclas(e) { if (!el.isConnected) return removeEventListener('keydown', teclas); if (e.target.tagName === 'INPUT') return; if (e.key === 'Enter' && !btnJugar.disabled) jugarSeleccion(); if (e.key === ' ' && miTurno() && !$('.modal')) { e.preventDefault(); robar(); } if (e.key === 'Escape') { sel.clear(); pintarSel(); } }

  // --- mano ---
  function pintarMano(mano) {
    const orden = [...mano].sort((a, b) => ORDEN_MANO.indexOf(a.tipo) - ORDEN_MANO.indexOf(b.tipo) || a.id.localeCompare(b.id));
    const ids = new Set(orden.map((c) => c.id));
    for (const c of [...manoEl.children]) if (!ids.has(c.dataset.id)) { sel.delete(c.dataset.id); c.remove(); }
    orden.forEach((c, i) => {
      let nodo = manoEl.querySelector(`[data-id="${c.id}"]`);
      if (!nodo) {
        nodo = crearCarta(c.tipo, { id: c.id });
        nodo.addEventListener('click', () => alPulsarCarta(nodo));
        nodo.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alPulsarCarta(nodo); } });
        nodo.addEventListener('pointerenter', () => pista(`${CARTAS[c.tipo].nombre}: ${CARTAS[c.tipo].desc}`));
        if (vistosEnMano.size) nodo.classList.add('entra');
        setTimeout(() => nodo.classList.remove('entra'), 800);
      }
      if (manoEl.children[i] !== nodo) manoEl.insertBefore(nodo, manoEl.children[i] || null);
      const n = orden.length, m = (n - 1) / 2, d = i - m;
      nodo.style.setProperty('--rot', (n > 1 ? d * Math.min(3.2, 26 / n) : 0).toFixed(2) + 'deg');
      nodo.style.setProperty('--dy', (Math.abs(d) ** 1.6 * 1.2).toFixed(1) + 'px');
      nodo.style.setProperty('--z', i);
    });
    manoEl.style.setProperty('--n', orden.length);
    vistosEnMano = new Set(ids);
    const reclamo = puedeNegar(), mio = miTurno();
    for (const c of manoEl.children) {
      const t = c.dataset.tipo;
      c.classList.toggle('reclamo', reclamo && t === 'negar');
      c.classList.toggle('apagada', (reclamo && t !== 'negar') || (!reclamo && !mio && S.juego.fase !== 'favor'));
      c.classList.toggle('jugable', mio && !['bomba', 'desactivador', 'negar'].includes(t));
    }
  }

  // --- rivales ---
  const rivales = new Map();
  function pintarRivales() {
    const g = S.juego, otros = g.jugadores.filter((j) => j.id !== S.yo.id);
    rivalesEl.style.setProperty('--n', otros.length);
    const ids = new Set(otros.map((j) => j.id));
    for (const [id, r] of rivales) if (!ids.has(id)) { r.el.remove(); rivales.delete(id); }
    otros.forEach((j, i) => {
      let r = rivales.get(j.id);
      const info = S.sala.jugadores.find((x) => x.id === j.id) || {};
      if (!r) {
        const cnt = h('span', { class: 'cnt-cartas' }), badge = h('div', { class: 'badge-turnos' }), av = avatarEl(info.avatar || 'mandarina'), nom = h('div', { class: 'rival-nombre' }), estado = h('div', { class: 'rival-estado' });
        const abanico = h('div', { class: 'mini-abanico' });
        const e = h('div', { class: 'rival', data: { pid: j.id } }, h('div', { class: 'aro' }, av, badge), nom, h('div', { class: 'rival-cartas' }, abanico, cnt), estado);
        r = { el: e, cnt, badge, nom, estado, abanico, av, n: -1 };
        rivales.set(j.id, r);
        e.addEventListener('pointerenter', () => { const gg = e.querySelector('.gato'); if (gg.dataset.mood === 'neutral') { gg.dataset.mood = 'sorpresa'; setTimeout(() => { if (gg.dataset.mood === 'sorpresa') gg.dataset.mood = 'neutral'; }, 600); } });
      }
      if (rivalesEl.children[i] !== r.el) rivalesEl.insertBefore(r.el, rivalesEl.children[i] || null);
      r.nom.textContent = (info.nombre || 'Jugador') + (S.sala.anfitrion === j.id ? ' 👑' : '');
      r.cnt.textContent = j.vivo ? '×' + j.n : '';
      if (r.n !== j.n) { r.abanico.replaceChildren(...Array.from({ length: Math.min(j.n, 7) }, (_, k) => h('i', { style: { '--k': k, '--t': Math.min(j.n, 7) } }))); r.n = j.n; }
      r.el.classList.toggle('activo', g.turno === j.id);
      r.el.classList.toggle('muerto', !j.vivo);
      r.el.classList.toggle('sin-conexion', info.conectado === false && j.vivo);
      const gg = r.el.querySelector('.gato'); if (!j.vivo && gg.dataset.mood !== 'fuera') gg.dataset.mood = 'fuera'; if (j.vivo && gg.dataset.mood === 'fuera') gg.dataset.mood = 'neutral';
      r.badge.textContent = g.turno === j.id && g.turnos > 1 ? '×' + g.turnos : '';
      r.estado.textContent = !j.vivo ? (j.salio ? 'Se ha ido' : 'Eliminado') : info.conectado === false ? 'Sin conexión' : g.turno === j.id ? (g.fase === 'jugar' ? 'Su turno' : '') : '';
    });
  }

  // --- descarte ---
  let descarteClave = '';
  function pintarDescarte() {
    const d = S.juego.descarte, k = d.n + '|' + d.tope.join();
    if (k === descarteClave) return; descarteClave = k;
    descarte.replaceChildren(...(d.tope.length ? d.tope.map((t, i) => { const c = crearCarta(t, { mini: true }); c.style.setProperty('--r', (i - 1) * 9 + 'deg'); c.style.setProperty('--x', (i - 1) * 8 + 'px'); return c; }) : [h('div', { class: 'hueco-desc' }, 'Descarte')]), h('span', { class: 'cnt' }, d.n));
  }

  // --- ventanas dirigidas por el estado (favor / reinsertar) ---
  function gestionarModales() {
    const g = S.juego;
    let clave = null;
    if (g.fase === 'reinsertar' && g.reinsertar && g.reinsertar.pid === S.yo.id) clave = 'reinsertar';
    else if (g.fase === 'favor' && g.favor && g.favor.de === S.yo.id) clave = 'favor';
    if (clave === modalEstado) return;
    if (modalActivo) { modalActivo.cerrar(); modalActivo = null; }
    modalEstado = clave;
    if (clave === 'reinsertar') {
      const n = g.mazo; let pos = 0;
      const lbl = h('div', { class: 'pos-lbl' });
      const rango = h('input', { type: 'range', min: 0, max: n, value: 0, 'aria-label': 'Posición en el mazo', oninput: () => { pos = Number(rango.value); pintar(); } });
      const pintar = () => { lbl.textContent = pos === 0 ? 'Encima del todo: será la próxima carta que se robe' : pos === n ? 'Debajo del todo: saldrá la última' : `Se robará después de ${pos} carta${pos === 1 ? '' : 's'}`; };
      pintar();
      const rap = (t, p) => h('button', { class: 'btn btn-peque', type: 'button', onclick: () => { pos = typeof p === 'function' ? p() : p; rango.value = pos; pintar(); } }, t);
      modalActivo = abrirModal([h('div', { class: 'cat-modal', html: gato(avatarDe(S, S.yo.id), 'alegria') }), h('h2', { class: 'titulo-modal' }, '¡Te has salvado!'), h('p', {}, `Esconde el GATITO EXPLOSIVO en el mazo (hay ${n} cartas). Que nadie sepa dónde.`), rango, lbl,
        h('div', { class: 'fila-botones' }, rap('Arriba', 0), rap('Al medio', Math.floor(n / 2)), rap('Abajo', n), rap('Al azar 🎲', () => Math.floor(Math.random() * (n + 1)))),
        h('button', { class: 'btn btn-grande', type: 'button', onclick: () => ctx.enviar({ t: 'reinsertar', pos }) }, '🤫 Esconderlo')], { cerrable: false, clase: 'modal-reinsertar' });
    } else if (clave === 'favor') {
      const quien = nombreDe(S, g.favor.a);
      modalActivo = abrirModal([h('h2', { class: 'titulo-modal' }, `${quien} te pide un favor`), h('p', {}, 'Elige la carta que le das:'),
        h('div', { class: 'rejilla-favor' }, ...g.mano.map((c) => { const k = crearCarta(c.tipo, { mini: true }); k.addEventListener('click', () => ctx.enviar({ t: 'entregar', carta: c.id })); return k; }))], { cerrable: false, clase: 'modal-favor' });
    }
  }

  // --- historial ---
  let logPintados = 0;
  function pintarLog() {
    const l = S.log; if (l.length === logPintados) return;
    for (const linea of l.slice(logPintados)) listaLog.append(h('div', { class: 'log-linea' }, linea));
    while (listaLog.children.length > 80) listaLog.firstChild.remove();
    logPintados = l.length; listaLog.scrollTop = listaLog.scrollHeight;
  }

  function actualizar() {
    const g = S.juego; if (!g || !S.sala) return;
    if (el.querySelector('.chip-sala b').textContent !== S.sala.codigo) el.querySelector('.chip-sala b').textContent = S.sala.codigo;
    const yo = miJ(), info = S.sala.jugadores.find((j) => j.id === S.yo.id) || {};
    if (!miAvatar.firstChild) { miAvatar.innerHTML = gato(info.avatar || 'mandarina'); miZona.dataset.pid = S.yo.id; }
    const gg = miAvatar.querySelector('.gato'); if (yo && !yo.vivo) gg.dataset.mood = 'fuera'; else if (gg.dataset.mood === 'fuera') gg.dataset.mood = 'neutral';
    miNombre.textContent = info.nombre || 'Tú';
    miEstado.textContent = yo && !yo.vivo ? 'Eliminado' : g.fase === 'fin' ? '' : miTurno() ? (g.turnos > 1 ? `¡Tu turno! (te quedan ${g.turnos})` : '¡Tu turno!') : '';
    miZona.classList.toggle('mi-turno', miTurno()); miZona.classList.toggle('muerto', !!yo && !yo.vivo);
    sombraEstado.style.display = yo && !yo.vivo && g.fase !== 'fin' ? '' : 'none';
    mazoCnt.textContent = g.mazo;
    mazo.classList.toggle('late', miTurno()); mazo.disabled = false;
    $$('.carta', mazo).forEach((c, i) => c.style.setProperty('--i', i));
    // texto central
    const quien = g.turno ? nombreDe(S, g.turno) : '';
    estadoEl.textContent = g.fase === 'jugar' ? (miTurno() ? 'Tu turno: juega cartas o roba' : `Turno de ${quien}`) : g.fase === 'negar' ? '¿Alguien dice «VA A SER QUE NO»?' : g.fase === 'favor' ? `${nombreDe(S, g.favor.de)} debe darle una carta a ${nombreDe(S, g.favor.a)}` : g.fase === 'reinsertar' ? `${nombreDe(S, g.reinsertar.pid)} esconde el gatito en el mazo…` : g.fase === 'fin' ? '¡Fin de la partida!' : '';
    turnosEl.textContent = g.turnos > 1 && g.fase !== 'fin' ? `${quien} juega ${g.turnos} turnos seguidos` : '';
    turnosEl.style.display = turnosEl.textContent ? '' : 'none';
    btnNo.style.display = puedeNegar() ? '' : 'none'; btnRobar.style.display = puedeNegar() ? 'none' : '';
    btnRobar.disabled = !miTurno();
    pintarMano(yo && yo.vivo ? g.mano : []); pintarRivales(); pintarDescarte(); pintarSel(); pintarLog(); gestionarModales();
    el.style.setProperty('--jug', g.jugadores.length);
    $('.chip-sala', el).classList.toggle('copiable', true);
  }
  $('.chip-sala', el).addEventListener('click', () => copiar(S.sala.codigo).then(() => ctx.avisar('Código de sala copiado: ' + S.sala.codigo)).catch(() => {}));
  const destruir = () => { removeEventListener('keydown', teclas); if (modalActivo) modalActivo.cerrar(); };
  return { el, actualizar, destruir };
}

// ======================= RESULTADOS =======================
export function pantallaResultados(ctx) {
  const { S } = ctx, g = S.juego;
  const ganador = g.ganador, esHost = S.sala.anfitrion === S.yo.id;
  const orden = [...S.sala.jugadores].sort((a, b) => (a.id === ganador ? -1 : b.id === ganador ? 1 : 0));
  const filas = orden.map((j) => { const st = (g.stats || {})[j.id] || {}; return h('tr', { class: j.id === ganador ? 'ganador' : '' }, h('td', {}, avatarEl(j.avatar, j.id === ganador ? 'victoria' : 'fuera'), h('b', {}, j.nombre + (j.id === S.yo.id ? ' (tú)' : ''))), h('td', {}, st.jugadas ?? 0), h('td', {}, st.negadas ?? 0), h('td', {}, st.desactivados ?? 0), h('td', {}, st.robos ?? 0), h('td', {}, j.victorias)); });
  const yoGano = ganador === S.yo.id;
  const el = h('div', { class: 'resultados' },
    h('div', { class: 'res-caja' },
      h('div', { class: 'res-ganador' }, avatarEl(avatarDe(S, ganador), 'victoria'), h('h2', { class: 'titulo-pantalla' }, yoGano ? '¡Has ganado!' : `¡${nombreDe(S, ganador)} gana la partida!`), h('p', { class: 'sub' }, yoGano ? 'El último gato en pie. Eres la leyenda del caos.' : 'El último gato en pie se lleva la gloria.')),
      h('table', { class: 'tabla-stats' }, h('thead', {}, h('tr', {}, h('th', {}, 'Jugador'), h('th', { title: 'Cartas jugadas' }, 'Jugadas'), h('th', { title: 'VA A SER QUE NO' }, 'Noes'), h('th', { title: 'Desactivadores usados' }, 'Salvados'), h('th', { title: 'Cartas robadas' }, 'Robos'), h('th', { title: 'Victorias en esta sala' }, 'Victorias'))), h('tbody', {}, ...filas)),
      h('div', { class: 'fila-botones' },
        esHost ? h('button', { class: 'btn btn-grande', type: 'button', onclick: () => ctx.enviar({ t: 'revancha' }) }, '🔄 Volver a jugar') : h('p', { class: 'sub' }, 'Esperando a que el anfitrión empiece otra partida…'),
        h('button', { class: 'btn btn-peligro', type: 'button', onclick: () => ctx.enviar({ t: 'salir' }) }, 'Salir'))));
  return { el, actualizar() {} };
}
