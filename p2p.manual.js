'use strict';
// Prueba de navegador de la versión de UN SOLO ARCHIVO (dist/index.html) contra un broker MQTT local.
//   node build/un-solo-archivo.js && node test/p2p.manual.js
const fs = require('node:fs'), path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/claude/.npm-global/lib/node_modules/playwright')); }
const { crearBroker } = require('./mini-broker');
const OUT = process.env.CAPTURAS || 'capturas'; fs.mkdirSync(OUT, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const resultados = [];
const check = (n, ok, extra = '') => { resultados.push(ok); console.log((ok ? '  ✔ ' : '  ✘ ') + n + (extra ? ' — ' + extra : '')); };

(async () => {
  const broker = crearBroker(); await new Promise((r) => broker.listen(0, '127.0.0.1', r));
  const trafico = []; broker.alPublicar = (t, p) => trafico.push([t, p.toString('utf8')]);
  const URL = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html') + '?broker=' + encodeURIComponent(`ws://127.0.0.1:${broker.address().port}/mqtt`);
  const b = await chromium.launch(); const errores = [];
  const abrir = async (n, url = URL) => {
    const c = await b.newContext({ viewport: { width: 1366, height: 650 } }); const p = await c.newPage(); p.nombre = n;
    p.on('pageerror', (e) => errores.push(n + ': ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errores.push(n + ' consola: ' + m.text()); });
    await p.goto(url); await p.waitForSelector('.estado-red.abierta'); return p;
  };
  const A = await abrir('A'), B = await abrir('B'), C = await abrir('C'), D = await abrir('D');
  check('el menú dice que no hace falta servidor', /sin servidor|directas/.test(await A.textContent('.estado-red')) || /directas/.test(await A.textContent('.estado-red')));
  check('crypto.subtle disponible (contexto seguro) abriendo el archivo desde el disco', await A.evaluate(() => !!(window.crypto && crypto.subtle)));

  await A.fill('input[aria-label="Tu nombre"]', 'Ana'); await A.$eval('text=Crear partida', (e) => e.click());
  await A.waitForSelector('.codigo-grande .letra');
  const codigo = await A.$$eval('.codigo-grande .letra', (l) => l.map((x) => x.textContent).join(''));
  check('el anfitrión crea una sala con código de 5 caracteres', /^[A-HJ-NP-Z2-9]{5}$/.test(codigo), codigo);
  await A.waitForFunction(() => window.__chaosP2P.canales().length >= 1);

  // código inexistente
  await D.$eval('text=Unirme con código', (e) => e.click()); await D.fill('input[aria-label="Código de la sala"]', 'ZZZZZ'); await D.$eval('text=Entrar', (e) => e.click());
  await D.waitForSelector('.aviso.error', { timeout: 20000 });
  check('un código inexistente da un error claro en español', /No existe ninguna sala/.test(await D.textContent('#avisos')));

  for (const [p, n] of [[B, 'Beto'], [C, 'Cleo']]) {
    await p.fill('input[aria-label="Tu nombre"]', n); await p.$eval('text=Unirme con código', (e) => e.click());
    await p.fill('input[aria-label="Código de la sala"]', codigo); await p.$eval('text=Entrar', (e) => e.click());
    await p.waitForSelector('.codigo-grande .letra', { timeout: 20000 });
  }
  await A.waitForFunction(() => document.querySelectorAll('.rejilla-sala .slot:not(.slot-vacio)').length === 3);
  check('los 3 jugadores aparecen en la sala de espera de todos', (await B.$$('.rejilla-sala .slot:not(.slot-vacio)')).length === 3 && (await C.$$('.rejilla-sala .slot:not(.slot-vacio)')).length === 3);
  check('el anfitrión ve el aviso de no cerrar la pestaña', /no cierres/i.test(await A.textContent('.pantalla.sala')));
  await A.screenshot({ path: `${OUT}/p2p-sala.png` });

  await A.$eval('button:has-text("Empezar partida")', (e) => e.click());
  for (const p of [A, B, C]) await p.waitForSelector('.mano .carta', { timeout: 15000 });
  await espera(1500);
  check('todos reciben 8 cartas', (await A.$$('.mano .carta')).length === 8 && (await B.$$('.mano .carta')).length === 8 && (await C.$$('.mano .carta')).length === 8);
  await B.screenshot({ path: `${OUT}/p2p-partida-B.png` });

  // PRIVACIDAD: ningún mensaje que pasó por el broker público contiene datos de la partida en claro
  const claro = trafico.filter(([t, p]) => /"mano"|"tipo"|"estado"|desactivador|"token"|Beto|Cleo|"jugadores"/.test(p));
  check('el broker público solo ve mensajes cifrados (nada de cartas, nombres ni tokens)', trafico.length > 5 && claro.length === 0, `${trafico.length} mensajes, ${claro.length} en claro`);
  const idsOtros = await B.evaluate(() => JSON.stringify(window.__chaos.S.juego.mano.map((c) => c.id)));
  check('Beto solo conoce su propia mano', JSON.parse(idsOtros).length === 8);

  // Los bots juegan hasta el final usando la interfaz real (robo, reinserción, favores)
  const bot = (p) => p.evaluate(() => {
    const S = window.__chaos.S; let ult = 0;
    setInterval(() => {
      const g = S.juego, yo = S.yo && S.yo.id; if (!g || !yo || Date.now() - ult < 120) return; ult = Date.now();
      if (g.fase === 'favor' && g.favor.de === yo) window.__chaos.enviar({ t: 'entregar', carta: g.mano[0].id });
      else if (g.fase === 'reinsertar' && g.reinsertar.pid === yo) window.__chaos.enviar({ t: 'reinsertar', pos: 0 });
      else if (g.fase === 'jugar' && g.turno === yo) window.__chaos.enviar({ t: 'robar' });
    }, 100);
  });
  // reconexión a mitad de partida: se corta la conexión de Beto con el broker
  await Promise.all([A, B, C].map(bot));
  await espera(1200);
  const manoAntes = await B.evaluate(() => window.__chaos.S.juego.mano.length);
  const cortado = [...broker.clientes].find((c) => c.will && c.will.payload.toString().includes('"x":1'));
  cortado.conn.terminar();
  await B.waitForFunction(() => window.__chaos.S.conexion !== 'abierta', null, { timeout: 8000 }).catch(() => {});
  await B.waitForFunction(() => window.__chaos.S.conexion === 'abierta' && window.__chaos.S.juego, null, { timeout: 30000 });
  check('tras perder la conexión, el jugador reconecta solo y sigue en la partida', await B.evaluate(() => !!window.__chaos.S.sala && window.__chaos.S.sala.jugadores.every((j) => j.conectado)));

  for (const p of [A, B, C]) await p.waitForFunction(() => window.__chaos.S.juego && window.__chaos.S.juego.fase === 'fin', null, { timeout: 120000 });
  check('la partida termina con un único ganador en los 3 navegadores', (await Promise.all([A, B, C].map((p) => p.evaluate(() => window.__chaos.S.juego.ganador)))).every((g, i, a) => g && g === a[0]));
  await A.waitForSelector('.res-caja', { timeout: 15000 }); await espera(600); await A.screenshot({ path: `${OUT}/p2p-resultados-A.png` });
  check('pantalla de resultados con estadísticas', (await A.$$('.tabla-stats tbody tr')).length === 3);

  // recarga de un invitado: recupera su sitio
  await A.$eval('.res-caja .btn:has-text("Volver a jugar")', (e) => e.click());
  await C.waitForSelector('.pantalla.sala', { timeout: 10000 });
  await C.reload(); await C.waitForSelector('.pantalla.sala', { timeout: 30000 });
  check('un invitado que recarga la página vuelve a su sala', /Sala de espera/.test(await C.textContent('.pantalla.sala')));

  // el anfitrión sale: la sala se cierra para todos
  await A.evaluate(() => window.__chaos.enviar({ t: 'salir' }));
  await B.waitForSelector('.pantalla.menu', { timeout: 15000 });
  check('si el anfitrión sale, los invitados vuelven al menú con un aviso', /ya no existe/.test(await B.textContent('#avisos')) );

  const html = await A.evaluate(() => document.documentElement.outerHTML);
  check('ningún texto con la palabra inglesa prohibida', !/\bno[p]e\b/i.test(html));
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '));
  await b.close(); broker.close(); broker.closeAllConnections?.();
  const fallos = resultados.filter((x) => !x).length; console.log(`\n${resultados.length - fallos}/${resultados.length} comprobaciones correctas`); process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('FALLO DE LA PRUEBA', e); process.exit(2); });
