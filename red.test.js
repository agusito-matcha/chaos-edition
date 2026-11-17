'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const { crearServidor } = require('../server/index');
const { Sala } = require('../server/sala');

let servidor, puerto;
const fugas = [];

test.before(async () => {
  // Vigila CADA mensaje que sale del servidor: no puede contener cartas de la mano de otro jugador ni el mazo.
  const original = Sala.prototype.enviarA;
  Sala.prototype.enviarA = function (j, msg) {
    if (this.partida) {
      const s = JSON.stringify(msg);
      for (const otro of this.partida.jugadores) {
        if (otro.id === j.id) continue;
        for (const c of otro.mano) if (s.includes('"' + c.id + '"')) fugas.push(`${j.nombre} recibió la carta ${c.id} de ${otro.id}`);
      }
      for (const c of this.partida.mazo) if (s.includes('"' + c.id + '"')) fugas.push('fuga del mazo ' + c.id);
    }
    return original.call(this, j, msg);
  };
  servidor = crearServidor();
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  puerto = servidor.address().port;
});
test.after(() => { servidor.close(); servidor.closeAllConnections?.(); });

class Cliente {
  constructor(nombre) {
    this.nombre = nombre; this.msgs = []; this.esperas = []; this.eventos = []; this.ultimo = null;
  }
  abrir() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${puerto}/ws`);
      this.ws.onopen = () => res(this);
      this.ws.onerror = rej;
      this.ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data); this.msgs.push(m);
        if (m.t === 'unido') { this.id = m.id; this.token = m.token; this.codigo = m.codigo; }
        if (m.t === 'estado') { this.ultimo = m; this.eventos.push(...m.eventos); }
        this.esperas = this.esperas.filter((e) => { if (e.p(m)) { e.r(m); return false; } return true; });
      };
    });
  }
  enviar(o) { this.ws.send(JSON.stringify(o)); }
  esperar(p, ms = 8000) {
    const previo = this.msgs.find(p); if (previo && p.incluirPrevios) return Promise.resolve(previo);
    return new Promise((r, rej) => { const t = setTimeout(() => rej(new Error('tiempo agotado esperando mensaje (' + this.nombre + ')')), ms); this.esperas.push({ p, r: (m) => { clearTimeout(t); r(m); } }); });
  }
  cerrar() { this.ws.close(); }
}
const nuevo = async (n) => new Cliente(n).abrir();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

test('HTTP: sirve el juego, /salud, y bloquea rutas fuera de public', async () => {
  const get = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: puerto, path: p, headers: { 'Accept-Encoding': 'identity' } }, (r) => { let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => res({ s: r.statusCode, b, h: r.headers })); }).on('error', rej));
  assert.equal((await get('/salud')).s, 200);
  assert.equal((await get('/%2e%2e/server/game.js')).s >= 400, true);
  assert.equal((await get('/../package.json')).s >= 400, true);
  assert.equal((await get('/no-existe.js')).s, 404);
  const raiz = await get('/');
  assert.equal(raiz.s, 200); assert.match(raiz.b, /CHAOS EDITION/); assert.ok(raiz.h['content-security-policy']);
});

test('WebSocket: rechaza orígenes ajenos y mensajes no enmascarados/ilegibles', async () => {
  const handshake = (origen) => new Promise((res) => {
    const s = net.connect(puerto, '127.0.0.1', () => s.write(`GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${puerto}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nOrigin: ${origen}\r\n\r\n`));
    s.once('data', (d) => { res(d.toString().split('\r\n')[0]); s.destroy(); });
  });
  assert.match(await handshake('http://evil.example'), /403/);
  assert.match(await handshake(`http://127.0.0.1:${puerto}`), /101/);
  const c = await nuevo('raro');
  c.ws.send('esto no es json');
  const e = await c.esperar((m) => m.t === 'error');
  assert.match(e.msg, /no válido/);
  c.enviar({ t: 'jugar', cartas: ['x'] });
  assert.match((await c.esperar((m) => m.t === 'error' && /sala/.test(m.msg))).msg, /sala/);
  c.cerrar();
});

test('salas: crear, unirse, código inválido, nombres, límite de 5, anfitrión', async () => {
  const a = await nuevo('A'); a.enviar({ t: 'crear', nombre: '  <b>Ana</b>\u0000  ', avatar: 'canela' });
  const u = await a.esperar((m) => m.t === 'unido');
  assert.match(u.codigo, /^[A-HJ-NP-Z2-9]{5}$/);
  await espera(100);
  assert.ok(!/[<>]/.test(a.ultimo.sala.jugadores[0].nombre));
  assert.equal(a.ultimo.sala.anfitrion, a.id);

  const malo = await nuevo('M'); malo.enviar({ t: 'unirse', codigo: 'ZZZZZ', nombre: 'x' });
  assert.match((await malo.esperar((m) => m.t === 'error')).msg, /No existe/); malo.cerrar();

  const otros = [];
  for (let i = 0; i < 4; i++) { const c = await nuevo('J' + i); c.enviar({ t: 'unirse', codigo: u.codigo.toLowerCase(), nombre: 'Ana', avatar: 'zzz' }); await c.esperar((m) => m.t === 'unido'); otros.push(c); }
  await espera(100);
  const nombres = a.ultimo.sala.jugadores.map((j) => j.nombre);
  assert.equal(new Set(nombres.map((n) => n.toLowerCase())).size, 5, 'nombres duplicados: ' + nombres);
  assert.ok(a.ultimo.sala.jugadores.every((j) => ['mandarina', 'canela', 'trufa', 'flan', 'brasa', 'churro', 'nube', 'tizon'].includes(j.avatar)));
  const sexto = await nuevo('6'); sexto.enviar({ t: 'unirse', codigo: u.codigo, nombre: 'seis' });
  assert.match((await sexto.esperar((m) => m.t === 'error')).msg, /llena/);
  otros[0].enviar({ t: 'empezar' });
  assert.match((await otros[0].esperar((m) => m.t === 'error')).msg, /anfitrión/);
  // el anfitrión se va: otro hereda
  a.enviar({ t: 'salir' }); await a.esperar((m) => m.t === 'salida');
  await espera(100);
  assert.notEqual(otros[0].ultimo.sala.anfitrion, a.id);
  assert.equal(otros[0].ultimo.sala.jugadores.length, 4);
  [sexto, a, ...otros].forEach((c) => c.cerrar());
});

// Un "bot" que juega por una conexión real
function bot(c, opciones = {}) {
  let jugadas = 0, ocupado = false;
  const reaccionar = (m) => {
    if (m.t !== 'estado' || !m.juego) return;
    const g = m.juego, yo = c.id;
    if (g.fase === 'favor' && g.favor.de === yo) c.enviar({ t: 'entregar', carta: g.mano[0].id });
    else if (g.fase === 'reinsertar' && g.reinsertar.pid === yo) c.enviar({ t: 'reinsertar', pos: 0 });
    else if (g.fase === 'jugar' && g.turno === yo) {
      const sim = g.mano.find((x) => ['pasar', 'barajar', 'futuro'].includes(x.tipo));
      if (sim && jugadas < (opciones.max ?? 1) && !ocupado) { jugadas++; c.enviar({ t: 'jugar', cartas: [sim.id] }); }
      else c.enviar({ t: 'robar' });
    }
  };
  c.ws.addEventListener('message', (ev) => reaccionar(JSON.parse(ev.data)));
}

test('partida completa de 3 jugadores por red: privacidad, eventos únicos, final y revancha', async () => {
  const cs = [await nuevo('H'), await nuevo('B'), await nuevo('C')];
  cs[0].enviar({ t: 'crear', nombre: 'Hosti', avatar: 'brasa' }); const u = await cs[0].esperar((m) => m.t === 'unido');
  for (const [i, c] of cs.slice(1).entries()) { c.enviar({ t: 'unirse', codigo: u.codigo, nombre: 'Jug' + i, avatar: 'nube' }); await c.esperar((m) => m.t === 'unido'); }
  cs[1].enviar({ t: 'listo', listo: true });
  await espera(100);
  assert.equal(cs[0].ultimo.sala.jugadores.find((j) => j.id === cs[1].id).listo, true);
  cs.forEach((c) => bot(c));
  cs[0].enviar({ t: 'empezar' });
  await Promise.all(cs.map((c) => c.esperar((m) => m.t === 'estado' && m.juego && m.juego.fase === 'fin', 60000)));
  await espera(100);

  // cada jugador ve una sola victoria y los mismos eid sin repetir
  for (const c of cs) {
    const eids = c.eventos.map((e) => e.eid);
    assert.equal(new Set(eids).size, eids.length, 'eventos repetidos para ' + c.nombre);
    assert.deepEqual(eids, [...eids].sort((x, y) => x - y));
    assert.equal(c.eventos.filter((e) => e.e === 'victoria').length, 1);
  }
  const ganador = cs[0].eventos.find((e) => e.e === 'victoria').por;
  assert.equal(cs[0].ultimo.juego.ganador, ganador);
  assert.equal(cs[0].ultimo.juego.jugadores.filter((j) => j.vivo).length, 1);
  assert.equal(cs[0].ultimo.sala.fase, 'fin');
  // privacidad: lo que se envió a cada uno no revela cartas ajenas, y el robo ajeno no lleva carta
  assert.deepEqual(fugas, []);
  for (const c of cs) for (const e of c.eventos) if (e.e === 'robar' && e.por !== c.id) assert.equal(e.carta, undefined, 'carta robada visible para otros');

  // un no-anfitrión no puede iniciar la revancha; el anfitrión sí
  cs[1].enviar({ t: 'revancha' }); await cs[1].esperar((m) => m.t === 'error');
  cs[0].enviar({ t: 'revancha' });
  const s = await cs[2].esperar((m) => m.t === 'estado' && m.sala.fase === 'sala');
  assert.equal(s.juego, null);
  assert.equal(s.sala.jugadores.reduce((a, j) => a + j.victorias, 0), 1);
  cs[0].enviar({ t: 'empezar' });
  const n = await cs[2].esperar((m) => m.t === 'estado' && m.juego && m.juego.fase === 'jugar');
  assert.equal(n.juego.mano.length, 8);
  cs.forEach((c) => c.cerrar());
});

test('reconexión: el jugador recupera su mano y la partida sigue; el token es secreto', async () => {
  const cs = [await nuevo('H'), await nuevo('B')];
  cs[0].enviar({ t: 'crear', nombre: 'Ana', avatar: 'flan' }); const u = await cs[0].esperar((m) => m.t === 'unido');
  cs[1].enviar({ t: 'unirse', codigo: u.codigo, nombre: 'Beto' }); await cs[1].esperar((m) => m.t === 'unido');
  cs[0].enviar({ t: 'empezar' });
  await cs[1].esperar((m) => m.t === 'estado' && m.juego);
  const manoAntes = cs[1].ultimo.juego.mano.map((c) => c.id).sort();
  const { id, token, codigo } = cs[1];
  assert.ok(!JSON.stringify(cs[0].msgs).includes(token), 'el token de otro jugador se ha filtrado');
  cs[1].ws.close();
  await cs[0].esperar((m) => m.t === 'estado' && m.sala.jugadores.some((j) => !j.conectado));
  const b2 = await nuevo('B2');
  b2.enviar({ t: 'reconectar', codigo, token: 'falso' });
  await b2.esperar((m) => m.t === 'sesion_perdida');
  const b3 = await nuevo('B3');
  b3.enviar({ t: 'reconectar', codigo, token });
  const est = await b3.esperar((m) => m.t === 'estado' && m.juego);
  assert.equal(b3.id, id);
  assert.deepEqual(est.juego.mano.map((c) => c.id).sort(), manoAntes);
  assert.equal(est.sala.jugadores.every((j) => j.conectado), true);
  // una segunda pestaña con el mismo token expulsa a la anterior
  const b4 = await nuevo('B4'); b4.enviar({ t: 'reconectar', codigo, token });
  await b4.esperar((m) => m.t === 'estado' && m.juego);
  await espera(200);
  assert.equal(b3.ws.readyState === WebSocket.CLOSED || b3.ws.readyState === WebSocket.CLOSING, true);
  // abandonar en partida: el otro gana
  b4.enviar({ t: 'salir' });
  const fin = await cs[0].esperar((m) => m.t === 'estado' && m.juego && m.juego.fase === 'fin');
  assert.equal(fin.juego.ganador, cs[0].id);
  assert.deepEqual(fugas, []);
  cs[0].cerrar(); b2.cerrar(); b3.cerrar(); b4.cerrar();
});

test('acciones repetidas y fuera de turno son rechazadas sin duplicar efectos', async () => {
  const cs = [await nuevo('H'), await nuevo('B')];
  cs[0].enviar({ t: 'crear', nombre: 'Ana' }); const u = await cs[0].esperar((m) => m.t === 'unido');
  cs[1].enviar({ t: 'unirse', codigo: u.codigo, nombre: 'Beto' }); await cs[1].esperar((m) => m.t === 'unido');
  cs[0].enviar({ t: 'empezar' });
  await cs[0].esperar((m) => m.t === 'estado' && m.juego);
  const turno = cs[0].ultimo.juego.turno;
  const [quien, otro] = turno === cs[0].id ? [cs[0], cs[1]] : [cs[1], cs[0]];
  otro.enviar({ t: 'robar' });
  assert.match((await otro.esperar((m) => m.t === 'error')).msg, /turno/);
  const antes = quien.ultimo.juego.mano.length;
  quien.enviar({ t: 'robar' }); quien.enviar({ t: 'robar' });
  await espera(200);
  // el segundo robo es del turno siguiente (otro jugador): debe rechazarse
  assert.equal(quien.msgs.filter((m) => m.t === 'error').length >= 1, true);
  assert.equal(quien.ultimo.juego.mano.length, antes + 1);
  const robos = cs[0].eventos.filter((e) => e.e === 'robar' || e.e === 'bomba').length;
  assert.equal(robos, 1);
  cs.forEach((c) => c.cerrar());
});
