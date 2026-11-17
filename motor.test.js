'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Partida, TIPOS, GATOS } = require('../server/game');

// azar con semilla para que las pruebas sean reproducibles
function semilla(s) { let x = s >>> 0; return (n) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x % n; }; }
const ids = (n) => ['a', 'b', 'c', 'd', 'e'].slice(0, n);

function totalCartas(g) {
  return g.jugadores.reduce((s, j) => s + j.mano.length, 0) + g.mazo.length + g.descarte.length + (g.reinsercion ? 1 : 0);
}
function comprobarInvariantes(g, esperado) {
  assert.equal(totalCartas(g), esperado, 'se han perdido o duplicado cartas');
  const todos = [...g.jugadores.flatMap((j) => j.mano), ...g.mazo, ...g.descarte, ...(g.reinsercion ? [g.reinsercion.bomba] : [])];
  assert.equal(new Set(todos.map((c) => c.id)).size, todos.length, 'ids de carta duplicados');
  for (const j of g.jugadores) if (!j.vivo) assert.equal(j.mano.length, 0);
  if (g.fase !== 'fin') {
    const bombas = todos.filter((c) => c.tipo === 'bomba' && !g.descarte.includes(c)).length;
    assert.equal(bombas, g.vivos().length - 1, 'número de gatitos explosivos incorrecto');
  }
}

test('composición del mazo según número de jugadores', () => {
  for (let n = 2; n <= 5; n++) {
    const g = new Partida(ids(n), { azar: semilla(n) });
    assert.equal(g.jugadores.length, n);
    for (const j of g.jugadores) {
      assert.equal(j.mano.length, 8);
      assert.equal(j.mano.filter((c) => c.tipo === 'desactivador').length, 1);
      assert.equal(j.mano.filter((c) => c.tipo === 'bomba').length, 0);
    }
    assert.equal(g.mazo.filter((c) => c.tipo === 'bomba').length, n - 1);
    assert.equal(g.mazo.filter((c) => c.tipo === 'desactivador').length, Math.max(2, 6 - n));
  }
  assert.throws(() => new Partida(['a']));
  assert.throws(() => new Partida(ids(5).concat('f')));
});

function jugarAlAzar(n, sem) {
  const g = new Partida(ids(n), { azar: semilla(sem) });
  const rnd = semilla(sem * 7 + 1);
  const total = totalCartas(g);
  let pasos = 0;
  const vistos = { jugar: 0, negar: 0, favor: 0, reinsertar: 0, ataque: 0, pareja: 0, trio: 0, futuro: 0, barajar: 0, pasar: 0, cancelada: 0 };
  while (g.fase !== 'fin') {
    if (++pasos > 5000) throw new Error('la partida no termina');
    comprobarInvariantes(g, total);
    const evs = g.vaciarEventos();
    for (const e of evs) { if (e.e === 'efecto') vistos[e.clase]++; if (e.e === 'cancelada') vistos.cancelada++; }
    if (g.fase === 'jugar') {
      const yo = g.actual();
      const r = rnd(10);
      if (r < 4 && yo.mano.length) {
        // intentar una jugada cualquiera (puede ser inválida y debe rechazarse sin romper nada)
        const c = yo.mano[rnd(yo.mano.length)];
        const otros = g.vivos().filter((x) => x.id !== yo.id);
        const obj = otros[rnd(otros.length)].id;
        let sel = [c.id];
        if (GATOS.includes(c.tipo)) { const mismos = yo.mano.filter((x) => x.tipo === c.tipo); sel = mismos.slice(0, 2 + rnd(2)).map((x) => x.id); }
        const antes = JSON.stringify(g.vista(yo.id));
        const res = g.jugar(yo.id, sel, obj, TIPOS[rnd(TIPOS.length)]);
        if (!res.ok) assert.equal(JSON.stringify(g.vista(yo.id)), antes, 'una acción inválida cambió el estado');
      } else g.robar(yo.id);
    } else if (g.fase === 'negar') {
      const quien = g.vivos().filter((j) => j.mano.some((c) => c.tipo === 'negar'));
      if (quien.length && rnd(3) === 0) { const q = quien[rnd(quien.length)]; g.negar(q.id, q.mano.find((c) => c.tipo === 'negar').id); }
      else g.tick(Infinity);
    } else if (g.fase === 'favor') {
      const de = g.j(g.favor.de); g.entregar(de.id, de.mano[rnd(de.mano.length)].id);
    } else if (g.fase === 'reinsertar') {
      g.reinsertar(g.reinsercion.pid, rnd(g.mazo.length + 1));
    }
  }
  comprobarInvariantes(g, total);
  assert.equal(g.vivos().length, 1);
  assert.equal(g.ganador, g.vivos()[0].id);
  return vistos;
}

test('simulación de 400 partidas aleatorias (2-5 jugadores): invariantes y fin correcto', () => {
  const suma = {};
  for (let i = 0; i < 400; i++) {
    const v = jugarAlAzar(2 + (i % 4), i + 1);
    for (const k in v) suma[k] = (suma[k] || 0) + v[k];
  }
  // todas las mecánicas se han ejercitado
  for (const k of ['ataque', 'pareja', 'trio', 'futuro', 'barajar', 'pasar', 'favor', 'cancelada']) assert.ok(suma[k] > 0, 'no se ejerció ' + k);
});

function escenario(n = 3) {
  const g = new Partida(ids(n), { azar: semilla(42) });
  g.vaciarEventos();
  return g;
}
const darCarta = (g, pid, tipo) => { const c = { id: 'x' + Math.random().toString(36).slice(2), tipo }; g.j(pid).mano.push(c); return c; };
const ponerArriba = (g, tipo) => { const c = { id: 'm' + Math.random().toString(36).slice(2), tipo }; g.mazo.unshift(c); return c; };

test('no se puede jugar fuera de turno, ni cartas ajenas, ni dos veces la misma carta', () => {
  const g = escenario();
  const c = darCarta(g, 'b', 'barajar');
  assert.equal(g.jugar('b', [c.id]).ok, false);
  const d = darCarta(g, 'a', 'barajar');
  assert.equal(g.jugar('a', [c.id]).ok, false); // carta de otro jugador
  assert.equal(g.jugar('a', [d.id]).ok, true);
  assert.equal(g.jugar('a', [d.id]).ok, false); // ya jugada
  assert.equal(g.robar('a').ok, false); // fase de negar
  g.tick(Infinity);
  assert.equal(g.fase, 'jugar');
});

test('GATITO EXPLOSIVO elimina; DESACTIVADOR salva y exige reinsertar', () => {
  const g = escenario();
  g.j('a').mano = g.j('a').mano.filter((c) => c.tipo !== 'desactivador');
  ponerArriba(g, 'bomba');
  g.robar('a');
  assert.equal(g.j('a').vivo, false);
  assert.equal(g.actual().id, 'b');
  ponerArriba(g, 'bomba');
  const antes = g.mazo.length;
  assert.equal(g.j('b').mano.some((c) => c.tipo === 'desactivador'), true);
  g.robar('b');
  assert.equal(g.fase, 'reinsertar');
  assert.equal(g.j('b').vivo, true);
  assert.equal(g.robar('b').ok, false);
  assert.equal(g.reinsertar('c', 0).ok, false);
  assert.equal(g.reinsertar('b', 999).ok, false);
  assert.equal(g.reinsertar('b', 2).ok, true);
  assert.equal(g.mazo.length, antes); // el gatito vuelve al mazo
  assert.equal(g.mazo[2].tipo, 'bomba');
  assert.equal(g.actual().id, 'c');
});

test('ATAQUE: el siguiente juega 2 turnos y los ataques se acumulan', () => {
  const g = escenario();
  const at = darCarta(g, 'a', 'ataque');
  g.jugar('a', [at.id]); g.tick(Infinity);
  assert.equal(g.actual().id, 'b'); assert.equal(g.turno.resta, 2);
  const at2 = darCarta(g, 'b', 'ataque');
  g.jugar('b', [at2.id]); g.tick(Infinity);
  assert.equal(g.actual().id, 'c'); assert.equal(g.turno.resta, 4);
  ponerArriba(g, 'favor'); g.robar('c');
  assert.equal(g.actual().id, 'c'); assert.equal(g.turno.resta, 3);
});

test('PASAR TURNO no roba y consume un turno', () => {
  const g = escenario();
  const n = g.j('a').mano.length, m = g.mazo.length;
  const p = darCarta(g, 'a', 'pasar');
  g.jugar('a', [p.id]); g.tick(Infinity);
  assert.equal(g.actual().id, 'b');
  assert.equal(g.j('a').mano.length, n); assert.equal(g.mazo.length, m);
});

test('VA A SER QUE NO: cancela, se puede negar el no, y la carta jugada se pierde', () => {
  const g = escenario();
  const at = darCarta(g, 'a', 'ataque');
  const n1 = darCarta(g, 'b', 'negar'), n2 = darCarta(g, 'a', 'negar'), n3 = darCarta(g, 'c', 'negar');
  g.jugar('a', [at.id]);
  assert.equal(g.negar('b', 'zzz').ok, false);
  assert.equal(g.negar('b', n1.id).ok, true);
  g.tick(Infinity);
  assert.equal(g.actual().id, 'a'); // cancelado: sigue el turno de a
  assert.equal(g.j('a').mano.some((c) => c.id === at.id), false);
  const at2 = darCarta(g, 'a', 'ataque');
  g.jugar('a', [at2.id]);
  g.negar('b', darCarta(g, 'b', 'negar').id);
  g.negar('a', n2.id); // a niega el no
  g.negar('c', n3.id); // c vuelve a negar
  g.tick(Infinity);
  assert.equal(g.actual().id, 'a'); // 3 noes = cancelada
  const solo = darCarta(g, 'a', 'negar');
  assert.equal(g.jugar('a', [solo.id]).ok, false); // no se juega suelta
  assert.equal(g.negar('a', solo.id).ok, false); // sin acción pendiente
});

test('FAVOR: el objetivo elige qué entrega, la carta pasa a quien lo pidió', () => {
  const g = escenario();
  const f = darCarta(g, 'a', 'favor');
  assert.equal(g.jugar('a', [f.id], 'a').ok, false); // no a sí mismo
  assert.equal(g.jugar('a', [f.id]).ok, false); // sin objetivo
  g.jugar('a', [f.id], 'b'); g.tick(Infinity);
  assert.equal(g.fase, 'favor');
  const elegida = g.j('b').mano[0];
  assert.equal(g.entregar('a', elegida.id).ok, false); // solo el objetivo
  assert.equal(g.entregar('b', 'nada').ok, false);
  const na = g.j('a').mano.length, nb = g.j('b').mano.length;
  assert.equal(g.entregar('b', elegida.id).ok, true);
  assert.equal(g.j('a').mano.length, na + 1); assert.equal(g.j('b').mano.length, nb - 1);
  assert.ok(g.j('a').mano.some((c) => c.id === elegida.id));
  assert.equal(g.fase, 'jugar');
});

test('VER EL FUTURO: solo lo ve quien lo juega', () => {
  const g = escenario();
  const f = darCarta(g, 'a', 'futuro');
  const top = g.mazo.slice(0, 3).map((c) => c.tipo);
  g.jugar('a', [f.id]); g.tick(Infinity);
  const ef = g.vaciarEventos().find((e) => e.e === 'efecto');
  assert.deepEqual(ef.priv.a.cartas, top);
  assert.equal(ef.priv.b, undefined); assert.equal(ef.priv.c, undefined);
  assert.equal(ef.cartas, undefined);
});

test('BARAJAR cambia el orden del mazo sin cambiar su contenido', () => {
  const g = escenario();
  const antes = g.mazo.map((c) => c.id);
  const b = darCarta(g, 'a', 'barajar');
  g.jugar('a', [b.id]); g.tick(Infinity);
  const despues = g.mazo.map((c) => c.id);
  assert.notDeepEqual(despues, antes);
  assert.deepEqual([...despues].sort(), [...antes].sort());
});

test('CARTAS DE GATO: pareja roba al azar, trío pide una carta concreta', () => {
  const g = escenario();
  const c1 = darCarta(g, 'a', 'gato_ninja'), c2 = darCarta(g, 'a', 'gato_ninja'), c3 = darCarta(g, 'a', 'gato_mago');
  assert.equal(g.jugar('a', [c1.id, c3.id], 'b').ok, false); // distintos gatos
  assert.equal(g.jugar('a', [c1.id], 'b').ok, false); // uno solo
  g.jugar('a', [c1.id, c2.id], 'b'); g.tick(Infinity);
  const ef = g.vaciarEventos().find((e) => e.e === 'efecto');
  assert.equal(ef.exito, true); assert.ok(ef.priv.a.carta && ef.priv.b.carta && !ef.priv.c);
  // trío
  const t = [1, 2, 3].map(() => darCarta(g, 'a', 'gato_pegon'));
  const objetivo = g.j('b'); const mia = darCarta(g, 'b', 'futuro');
  assert.equal(g.jugar('a', t.map((c) => c.id), 'b', 'bomba').ok, false); // no se puede pedir la bomba
  assert.equal(g.jugar('a', t.map((c) => c.id), 'b').ok, false); // falta pedida
  g.jugar('a', t.map((c) => c.id), 'b', 'futuro'); g.tick(Infinity);
  const e2 = g.vaciarEventos().find((e) => e.e === 'efecto');
  assert.equal(e2.exito, true);
  assert.ok(g.j('a').mano.some((c) => c.id === mia.id));
  assert.equal(objetivo.mano.some((c) => c.id === mia.id), false);
  // trío fallido
  const t2 = [1, 2, 3].map(() => darCarta(g, 'a', 'gato_mago'));
  g.j('b').mano = g.j('b').mano.filter((c) => c.tipo !== 'ataque');
  g.jugar('a', t2.map((c) => c.id), 'b', 'ataque'); g.tick(Infinity);
  assert.equal(g.vaciarEventos().find((e) => e.e === 'efecto').exito, false);
});

test('privacidad: la vista de un jugador nunca incluye las manos ni el mazo de otros', () => {
  const g = escenario(4);
  for (const j of g.jugadores) {
    const v = g.vista(j.id);
    const s = JSON.stringify(v);
    for (const otro of g.jugadores) if (otro.id !== j.id) for (const c of otro.mano) assert.equal(s.includes('"' + c.id + '"'), false, 'fuga de carta ajena');
    for (const c of g.mazo) assert.equal(s.includes('"' + c.id + '"'), false, 'fuga del mazo');
    assert.equal(v.mano.length, j.mano.length);
    assert.equal(typeof v.mazo, 'number');
  }
});

test('abandonar: el turno pasa, el ganador se determina y no hay bloqueos', () => {
  const g = escenario(3);
  g.salir('a');
  assert.equal(g.actual().id, 'b'); assert.equal(g.j('a').vivo, false);
  g.salir('c');
  assert.equal(g.fase, 'fin'); assert.equal(g.ganador, 'b');
  const h = escenario(3);
  const f = darCarta(h, 'a', 'favor'); h.jugar('a', [f.id], 'b'); h.tick(Infinity);
  h.salir('b'); // el objetivo se va durante el favor
  assert.equal(h.fase, 'jugar'); assert.equal(h.actual().id, 'a');
  const k = escenario(3); ponerArriba(k, 'bomba'); k.robar('a'); assert.equal(k.fase, 'reinsertar');
  k.salir('a'); assert.equal(k.fase, 'jugar'); assert.equal(k.actual().id, 'b');
  assert.equal(k.mazo.filter((c) => c.tipo === 'bomba').length, 3); // 2 originales + 1 añadida por la prueba
});

test('temporizadores: robo automático por inactividad y reinserción/favor automáticos', () => {
  let t = 1000;
  const g = new Partida(ids(3), { azar: semilla(5), ahora: () => t });
  const m = g.mazo.length;
  t += 121000; g.tick();
  assert.equal(g.mazo.length, m - 1); // robó solo
  assert.equal(g.actual().id !== 'a' || g.fase !== 'jugar', true);
  // jugador desconectado en su turno: roba pronto
  const h = new Partida(ids(3), { azar: semilla(6), ahora: () => t });
  h.conectar('a', false); t += 13000; h.tick();
  assert.notEqual(h.actual().id, 'a');
});
