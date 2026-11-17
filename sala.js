'use strict';
// Gestión de salas, jugadores, conexiones y protocolo de mensajes.
const { randomInt, randomHex, igualesSeguro } = require('./azar');
const { Partida } = require('./game');

const AVATARES = ['mandarina', 'canela', 'trufa', 'flan', 'brasa', 'churro', 'nube', 'tizon'];
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1
const MAX_JUGADORES = 5, MIN_JUGADORES = 2, MAX_SALAS = 400;
const GRACIA_SALA_MS = 45000;      // tiempo para reconectar en la sala de espera
const SALA_VACIA_MS = 10 * 60000;  // una sala sin nadie conectado se borra

const limpiarNombre = (s) => String(s ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
const normalizarCodigo = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

class Sala {
  constructor(codigo) {
    this.codigo = codigo;
    this.jugadores = [];          // {id, token, nombre, avatar, listo, conn, conectado, victorias, timerGracia}
    this.anfitrion = null;
    this.fase = 'sala';           // sala | partida | fin
    this.partida = null;
    this.eid = 0;
    this.registro = [];           // últimos eventos públicos
    this.ultimaActividad = Date.now();
  }

  jugador(id) { return this.jugadores.find((j) => j.id === id); }
  conectados() { return this.jugadores.filter((j) => j.conectado); }

  vistaSala() {
    return {
      codigo: this.codigo, fase: this.fase, anfitrion: this.anfitrion, max: MAX_JUGADORES, min: MIN_JUGADORES,
      jugadores: this.jugadores.map((j) => ({ id: j.id, nombre: j.nombre, avatar: j.avatar, listo: j.listo, conectado: j.conectado, victorias: j.victorias, salio: !!j.abandono })),
    };
  }

  // Envía a cada jugador SU vista (privacidad) y los eventos que le corresponden.
  difundir(eventosCrudos = []) {
    this.ultimaActividad = Date.now();
    const evs = eventosCrudos.map((e) => ({ ...e, eid: ++this.eid }));
    for (const e of evs) { const { priv, ...pub } = e; this.registro.push(pub); }
    if (this.registro.length > 40) this.registro.splice(0, this.registro.length - 40);
    const sala = this.vistaSala();
    for (const j of this.jugadores) {
      if (!j.conn || !j.conectado) continue;
      const eventos = evs.map((e) => { const { priv, ...pub } = e; return priv && priv[j.id] ? { ...pub, ...priv[j.id] } : pub; });
      this.enviarA(j, { t: 'estado', sala, juego: this.partida ? this.partida.vista(j.id) : null, eventos, eid: this.eid, registro: this.registro });
    }
  }
  enviarA(j, msg) { try { j.conn.enviar(JSON.stringify(msg)); } catch (e) { /* conexión rota */ } }

  tick() {
    if (this.partida && this.fase === 'partida') {
      if (this.partida.tick()) this.despuesDeAccion();
    }
  }
  despuesDeAccion() {
    const ev = this.partida.vaciarEventos();
    if (this.partida.fase === 'fin' && this.fase === 'partida') {
      this.fase = 'fin';
      const g = this.jugador(this.partida.ganador); if (g) g.victorias++;
    }
    this.difundir(ev);
  }
}

class Salas {
  constructor() {
    this.salas = new Map();
    this.intervalo = setInterval(() => this.barrer(), 250);
    if (this.intervalo.unref) this.intervalo.unref();
    this.lento = setInterval(() => this.limpiar(), 30000);
    if (this.lento.unref) this.lento.unref();
  }
  cerrar() { clearInterval(this.intervalo); clearInterval(this.lento); }
  barrer() { for (const s of this.salas.values()) { try { s.tick(); } catch (e) { console.error('Error en sala', s.codigo, e); } } }
  limpiar() {
    const ahora = Date.now();
    for (const [c, s] of this.salas) {
      if (s.conectados().length === 0 && ahora - s.ultimaActividad > SALA_VACIA_MS) this.salas.delete(c);
    }
  }
  nuevoCodigo() {
    for (let n = 0; n < 50; n++) {
      let c = ''; for (let i = 0; i < 5; i++) c += LETRAS[randomInt(LETRAS.length)];
      if (!this.salas.has(c)) return c;
    }
    return null;
  }

  // Cada conexión nueva pasa por aquí.
  conectar(conn) {
    const ctx = { conn, sala: null, jugador: null, fallos: 0, ventana: Date.now(), msgs: 0 };
    conn.on('mensaje', (txt) => this.mensaje(ctx, txt));
    conn.on('cierre', () => this.desconectado(ctx));
    return ctx;
  }

  error(ctx, texto, extra = {}) { ctx.conn.enviar(JSON.stringify({ t: 'error', msg: texto, ...extra })); }

  mensaje(ctx, txt) {
    const ahora = Date.now();
    if (ahora - ctx.ventana > 1000) { ctx.ventana = ahora; ctx.msgs = 0; }
    ctx.msgs++;
    if (ctx.msgs > 80) return ctx.conn.cerrar(1008);
    if (ctx.msgs > 30) return this.error(ctx, 'Vas demasiado rápido. Respira un segundo.');
    let m;
    try { m = JSON.parse(txt); } catch (e) { return this.error(ctx, 'Mensaje no válido.'); }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return this.error(ctx, 'Mensaje no válido.');
    try { this.despachar(ctx, m); } catch (e) { console.error('Error procesando', m.t, e); this.error(ctx, 'Ha ocurrido un error inesperado.'); }
  }

  despachar(ctx, m) {
    switch (m.t) {
      case 'ping': return ctx.conn.enviar('{"t":"pong"}');
      case 'crear': return this.crear(ctx, m);
      case 'unirse': return this.unirse(ctx, m);
      case 'reconectar': return this.reconectar(ctx, m);
    }
    const sala = ctx.sala, yo = ctx.jugador;
    if (!sala || !yo) return this.error(ctx, 'Primero tienes que entrar en una sala.');
    const g = sala.partida;
    const res = (r) => { if (r && r.ok === false) this.error(ctx, r.error); else if (g) sala.despuesDeAccion(); };
    switch (m.t) {
      case 'perfil':
        if (sala.fase !== 'sala') return;
        yo.nombre = this.nombreUnico(sala, limpiarNombre(m.nombre), yo) ; if (AVATARES.includes(m.avatar)) yo.avatar = m.avatar;
        return sala.difundir();
      case 'listo':
        if (sala.fase !== 'sala') return;
        yo.listo = !!m.listo; return sala.difundir();
      case 'empezar': return this.empezar(ctx);
      case 'jugar': return res(g && sala.fase === 'partida' ? g.jugar(yo.id, Array.isArray(m.cartas) ? m.cartas.filter((x) => typeof x === 'string').slice(0, 3) : [], typeof m.objetivo === 'string' ? m.objetivo : null, typeof m.pedida === 'string' ? m.pedida : null) : { ok: false, error: 'No hay partida en curso.' });
      case 'negar': return res(g && sala.fase === 'partida' ? g.negar(yo.id, String(m.carta)) : { ok: false, error: 'No hay partida en curso.' });
      case 'robar': return res(g && sala.fase === 'partida' ? g.robar(yo.id) : { ok: false, error: 'No hay partida en curso.' });
      case 'entregar': return res(g && sala.fase === 'partida' ? g.entregar(yo.id, String(m.carta)) : { ok: false, error: 'No hay partida en curso.' });
      case 'reinsertar': return res(g && sala.fase === 'partida' ? g.reinsertar(yo.id, m.pos) : { ok: false, error: 'No hay partida en curso.' });
      case 'revancha': return this.revancha(ctx);
      case 'salir': return this.salir(ctx);
      default: return this.error(ctx, 'Acción desconocida.');
    }
  }

  nombreUnico(sala, nombre, yo) {
    let base = nombre || 'Gato', n = base, i = 2;
    while (sala.jugadores.some((j) => j !== yo && j.nombre.toLowerCase() === n.toLowerCase())) n = base.slice(0, 13) + ' ' + i++;
    return n;
  }

  fallo(ctx) { ctx.fallos++; if (ctx.fallos >= 8) ctx.conn.cerrar(1008); }

  alta(ctx, sala, m) {
    const j = {
      id: randomHex(4), token: randomHex(16),
      nombre: this.nombreUnico(sala, limpiarNombre(m.nombre), null), avatar: AVATARES.includes(m.avatar) ? m.avatar : AVATARES[randomInt(AVATARES.length)],
      listo: false, conn: ctx.conn, conectado: true, victorias: 0, timerGracia: null,
    };
    sala.jugadores.push(j);
    if (!sala.anfitrion) sala.anfitrion = j.id;
    ctx.sala = sala; ctx.jugador = j;
    ctx.conn.enviar(JSON.stringify({ t: 'unido', codigo: sala.codigo, id: j.id, token: j.token }));
    sala.difundir();
    return j;
  }

  crear(ctx, m) {
    if (ctx.sala) return this.error(ctx, 'Ya estás en una sala.');
    if (this.salas.size >= MAX_SALAS) return this.error(ctx, 'El servidor está lleno ahora mismo. Inténtalo más tarde.');
    const codigo = this.nuevoCodigo();
    if (!codigo) return this.error(ctx, 'No se ha podido crear la sala.');
    const sala = new Sala(codigo);
    this.salas.set(codigo, sala);
    this.alta(ctx, sala, m);
  }

  unirse(ctx, m) {
    if (ctx.sala) return this.error(ctx, 'Ya estás en una sala.');
    const sala = this.salas.get(normalizarCodigo(m.codigo));
    if (!sala) { this.fallo(ctx); return this.error(ctx, 'No existe ninguna sala con ese código.', { codigoMalo: true }); }
    if (sala.fase !== 'sala') return this.error(ctx, 'Esa partida ya ha empezado.');
    if (sala.jugadores.length >= MAX_JUGADORES) return this.error(ctx, 'La sala está llena (máximo 5 jugadores).');
    this.alta(ctx, sala, m);
  }

  reconectar(ctx, m) {
    const sala = this.salas.get(normalizarCodigo(m.codigo));
    const j = sala && sala.jugadores.find((x) => typeof m.token === 'string' && x.token.length > 0 && igualesSeguro(x.token, m.token));
    if (!j) { this.fallo(ctx); return ctx.conn.enviar(JSON.stringify({ t: 'sesion_perdida' })); }
    if (j.conn && j.conn !== ctx.conn) { j.conn.removeAllListeners('cierre'); j.conn.cerrar(4000); }
    clearTimeout(j.timerGracia);
    j.conn = ctx.conn; j.conectado = true; ctx.sala = sala; ctx.jugador = j;
    if (sala.partida) sala.partida.conectar(j.id, true);
    ctx.conn.enviar(JSON.stringify({ t: 'unido', codigo: sala.codigo, id: j.id, token: j.token, reconectado: true }));
    sala.difundir();
  }

  empezar(ctx) {
    const { sala, jugador } = ctx;
    if (sala.anfitrion !== jugador.id) return this.error(ctx, 'Solo el anfitrión puede empezar la partida.');
    if (sala.fase !== 'sala') return this.error(ctx, 'La partida ya ha empezado.');
    // los jugadores desconectados de la sala de espera se descartan
    for (const j of [...sala.jugadores]) if (!j.conectado) this.quitar(sala, j);
    if (sala.jugadores.length < MIN_JUGADORES) return this.error(ctx, 'Hacen falta al menos 2 jugadores.');
    sala.partida = new Partida(sala.jugadores.map((j) => j.id));
    sala.fase = 'partida';
    sala.registro = [];
    sala.difundir(sala.partida.vaciarEventos());
  }

  revancha(ctx) {
    const { sala, jugador } = ctx;
    if (sala.anfitrion !== jugador.id) return this.error(ctx, 'Solo el anfitrión puede empezar otra partida.');
    if (sala.fase !== 'fin') return;
    for (const j of [...sala.jugadores]) if (!j.conectado) this.quitar(sala, j);
    sala.jugadores.forEach((j) => { j.listo = false; });
    sala.partida = null; sala.fase = 'sala'; sala.registro = [];
    sala.difundir();
  }

  salir(ctx) {
    const { sala, jugador } = ctx;
    ctx.sala = null; ctx.jugador = null;
    this.quitar(sala, jugador, true);
    try { ctx.conn.enviar('{"t":"salida"}'); } catch (e) { /* nada */ }
  }

  quitar(sala, j) {
    clearTimeout(j.timerGracia);
    if (sala.fase === 'partida' && sala.partida) {
      // Durante la partida el jugador se queda en la lista (para mostrar su nombre) pero queda eliminado.
      sala.partida.salir(j.id);
      j.conectado = false; j.conn = null; j.abandono = true; j.token = '';
      if (sala.anfitrion === j.id) sala.anfitrion = (sala.conectados()[0] || {}).id || null;
      sala.despuesDeAccion();
    } else {
      sala.jugadores = sala.jugadores.filter((x) => x !== j);
      if (sala.anfitrion === j.id) sala.anfitrion = (sala.conectados()[0] || sala.jugadores[0] || {}).id || null;
      if (sala.jugadores.length === 0) this.salas.delete(sala.codigo); else sala.difundir();
    }
  }

  desconectado(ctx) {
    const { sala, jugador: j } = ctx;
    if (!sala || !j || j.conn !== ctx.conn) return;
    j.conectado = false;
    if (sala.partida) sala.partida.conectar(j.id, false);
    if (sala.fase === 'sala') {
      j.timerGracia = setTimeout(() => { if (!j.conectado && this.salas.get(sala.codigo) === sala) this.quitar(sala, j); }, GRACIA_SALA_MS);
      if (j.timerGracia.unref) j.timerGracia.unref();
    }
    if (sala.anfitrion === j.id) { const otro = sala.conectados()[0]; if (otro) sala.anfitrion = otro.id; }
    sala.difundir();
  }
}

module.exports = { Salas, Sala, AVATARES, limpiarNombre, normalizarCodigo };
