'use strict';
// Prueba de navegador (opcional, no se ejecuta con "npm test"): necesita Playwright instalado.
//   npm i -D playwright && npx playwright install chromium && node test/navegador.manual.js
// Abre 3 navegadores reales, juega una partida con manos preparadas y hace capturas en ./capturas
const fs = require('node:fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/claude/.npm-global/lib/node_modules/playwright')); }
const { crearServidor } = require('../server/index');

const OUT = process.env.CAPTURAS || 'capturas';
fs.mkdirSync(OUT, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const resultados = [];
const check = (nombre, ok, extra = '') => { resultados.push({ nombre, ok }); console.log((ok ? '  ✔ ' : '  ✘ ') + nombre + (extra ? ' — ' + extra : '')); };

(async () => {
  const srv = crearServidor(); await new Promise((r) => srv.listen(3101, '127.0.0.1', r));
  const b = await chromium.launch();
  const errores = [];
  const abrir = async (n) => {
    const c = await b.newContext({ viewport: { width: 1366, height: 650 } }); const p = await c.newPage(); p.nombre = n;
    p.on('pageerror', (e) => errores.push(n + ': ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errores.push(n + ' consola: ' + m.text()); });
    await p.goto('http://127.0.0.1:3101/'); await p.waitForSelector('.estado-red.abierta'); return p;
  };
  const A = await abrir('A'), B = await abrir('B'), C = await abrir('C');
  await A.fill('input[aria-label="Tu nombre"]', 'Ana'); await A.$eval('text=Crear partida', (e) => e.click());
  await A.waitForSelector('.codigo-grande .letra');
  const codigo = await A.$$eval('.codigo-grande .letra', (l) => l.map((x) => x.textContent).join(''));
  for (const [p, n] of [[B, 'Beto'], [C, 'Cleo']]) {
    await p.fill('input[aria-label="Tu nombre"]', n); await p.$eval('text=Unirme con código', (e) => e.click());
    await p.fill('input[aria-label="Código de la sala"]', codigo); await p.$eval('text=Entrar', (e) => e.click()); await p.waitForSelector('.codigo-grande .letra');
  }
  const sala = () => srv.salas.salas.get(codigo), game = () => sala().partida;
  const ids = {}; for (const p of [A, B, C]) ids[p.nombre] = await p.evaluate(() => window.__chaos.S.yo.id);
  ids.Ana = ids.A; ids.Beto = ids.B; ids.Cleo = ids.C;
  await A.$eval('button:has-text("Empezar partida")', (e) => e.click());
  await A.waitForSelector('.mano .carta'); await espera(2600);
  check('la partida arranca en los 3 navegadores', (await B.$$('.mano .carta')).length === 8 && (await C.$$('.mano .carta')).length === 8);

  let n = 0;
  const dar = (nombre, tipos) => { game().j(ids[nombre]).mano = tipos.map((t) => ({ id: 't' + ++n, tipo: t })); };
  const arriba = (tipos) => { for (const t of [...tipos].reverse()) game().mazo.unshift({ id: 'm' + ++n, tipo: t }); };
  const libre = async () => { for (let i = 0; i < 60; i++) { const g = game(); if (g.fase === 'jugar' && !g.pendiente) { await espera(250); return; } await espera(250); } throw new Error('la partida no vuelve a fase de jugar: ' + game().fase); };
  const clicCarta = (p, tipo, k = 0) => p.evaluate(([t, k]) => document.querySelectorAll(`.mano .carta[data-tipo="${t}"]`)[k].click(), [tipo, k]);
  const jugarBtn = (p) => p.evaluate(() => document.querySelector('.acciones .btn-grande').click());
  const shot = (p, nombre) => p.screenshot({ path: `${OUT}/${nombre}.png` });

  dar('Ana', ['barajar', 'futuro', 'ataque', 'pasar', 'negar', 'gato_ninja', 'gato_ninja', 'gato_mago', 'gato_mago', 'gato_mago', 'favor', 'desactivador']);
  dar('Beto', ['negar', 'favor', 'gato_pegon', 'barajar', 'desactivador', 'desactivador', 'desactivador', 'desactivador', 'desactivador']);
  dar('Cleo', ['gato_dormilon', 'gato_cabreado', 'pasar']);
  sala().difundir(); await espera(600);

  // BARAJAR
  await clicCarta(A, 'barajar'); await jugarBtn(A); await espera(1500); await shot(A, 'anim-barajar'); await libre();
  check('BARAJAR: se resuelve y el turno sigue siendo de Ana', game().actual().id === ids.Ana);

  // VER EL FUTURO: solo lo ve quien lo juega
  arriba(['pasar', 'favor', 'barajar']);
  await clicCarta(A, 'futuro'); await jugarBtn(A); await espera(5000);
  const carasA = await A.$$eval('#escena .carta:not(.reverso)', (e) => e.length), carasB = await B.$$eval('#escena .carta:not(.reverso)', (e) => e.length);
  await shot(A, 'anim-futuro-A'); await shot(B, 'anim-futuro-B-no-ve');
  check('VER EL FUTURO: Ana ve 3 cartas reveladas, Beto ninguna', carasA >= 3 && carasB === 0, `Ana=${carasA} Beto=${carasB}`);
  await libre(); await espera(1500);

  // PASAR TURNO frenado con VA A SER QUE NO
  await clicCarta(A, 'pasar'); await jugarBtn(A); await espera(900);
  await clicCarta(B, 'negar'); await espera(750); await shot(A, 'anim-va-a-ser-que-no'); await shot(B, 'anim-va-a-ser-que-no-B');
  await libre();
  check('VA A SER QUE NO cancela PASAR TURNO (sigue jugando Ana)', game().actual().id === ids.Ana && game().j(ids.Beto).mano.every((c) => c.tipo !== 'negar'));
  const textoB = await B.evaluate(() => document.querySelector('.log-lista').textContent);
  check('el historial recoge «VA A SER QUE NO»', /VA A SER QUE NO/.test(textoB));

  // PAREJA de gatos ninja contra Beto
  const manoBeto = game().j(ids.Beto).mano.length;
  await clicCarta(A, 'gato_ninja', 0); await clicCarta(A, 'gato_ninja', 1); await jugarBtn(A);
  await A.waitForSelector('.modal-objetivo .objetivo'); await shot(A, 'modal-objetivo');
  await A.evaluate(() => { const bs = [...document.querySelectorAll('.modal-objetivo .objetivo')]; bs.find((x) => /Beto/.test(x.textContent)).click(); });
  await espera(1100); await shot(A, 'anim-gato-ninja'); await libre();
  check('PAREJA: Ana roba una carta a Beto', game().j(ids.Beto).mano.length === manoBeto - 1);

  // TRÍO de gatos mago pidiendo DESACTIVADOR
  await clicCarta(A, 'gato_mago', 0); await clicCarta(A, 'gato_mago', 1); await clicCarta(A, 'gato_mago', 2); await jugarBtn(A);
  await A.waitForSelector('.modal-objetivo .objetivo');
  await A.evaluate(() => [...document.querySelectorAll('.modal-objetivo .objetivo')].find((x) => /Beto/.test(x.textContent)).click());
  await A.waitForSelector('.modal-pedida .pedir'); await shot(A, 'modal-pedir-carta');
  const nombresPedir = await A.$$eval('.modal-pedida .pedir span', (e) => e.map((x) => x.textContent));
  await A.evaluate(() => [...document.querySelectorAll('.modal-pedida .pedir')].find((x) => /DESACTIVADOR/.test(x.textContent)).click());
  await espera(1200); await shot(A, 'anim-gato-mago'); await libre();
  check('TRÍO: se pide una carta concreta y la selección no ofrece GATITO EXPLOSIVO', !nombresPedir.includes('GATITO EXPLOSIVO') && nombresPedir.includes('DESACTIVADOR'));

  // FAVOR
  await clicCarta(A, 'favor'); await jugarBtn(A);
  await A.waitForSelector('.modal-objetivo .objetivo');
  await A.evaluate(() => [...document.querySelectorAll('.modal-objetivo .objetivo')].find((x) => /Beto/.test(x.textContent)).click());
  await B.waitForSelector('.modal-favor .carta', { timeout: 9000 }); await shot(B, 'modal-favor'); await shot(A, 'anim-favor-flecha');
  const antes = game().j(ids.Ana).mano.length;
  await B.evaluate(() => document.querySelector('.modal-favor .carta').click());
  await espera(900); await libre();
  check('FAVOR: Beto elige y Ana recibe la carta', game().j(ids.Ana).mano.length === antes + 1);

  // ATAQUE
  await clicCarta(A, 'ataque'); await jugarBtn(A); await espera(520); await shot(A, 'anim-ataque'); await shot(B, 'anim-ataque-B');
  await libre();
  check('ATAQUE: Beto debe jugar 2 turnos', game().actual().id === ids.Beto && game().turno.resta === 2);

  // GATITO EXPLOSIVO con DESACTIVADOR (Beto)
  arriba(['bomba', 'pasar']);
  await B.evaluate(() => document.querySelector('#mazo').click());
  await espera(1500); await shot(B, 'anim-gatito-explosivo'); await shot(C, 'anim-gatito-explosivo-C');
  await B.waitForSelector('.modal-reinsertar'); await shot(B, 'modal-reinsertar');
  check('GATITO EXPLOSIVO con DESACTIVADOR: Beto sigue vivo y debe reinsertar', game().j(ids.Beto).vivo && game().fase === 'reinsertar');
  await B.evaluate(() => [...document.querySelectorAll('.modal-reinsertar .btn')].find((x) => /Abajo/.test(x.textContent)).click());
  await B.evaluate(() => [...document.querySelectorAll('.modal-reinsertar .btn-grande')][0].click());
  await espera(1800); await shot(A, 'anim-desactivador-A');
  check('el gatito vuelve al mazo (debajo del todo)', game().mazo[game().mazo.length - 1].tipo === 'bomba');
  await B.evaluate(() => document.querySelector('#mazo').click()); // segundo turno: roba 'pasar'
  await espera(800);
  check('turno de Cleo tras los 2 turnos de Beto', game().actual().id === ids.Cleo);

  // GATITO EXPLOSIVO sin desactivador: Cleo queda eliminada
  arriba(['bomba']);
  await C.evaluate(() => document.querySelector('#mazo').click());
  await espera(2300); await shot(C, 'anim-eliminada-C'); await shot(A, 'anim-eliminada-vista-A');
  check('Cleo queda eliminada', !game().j(ids.Cleo).vivo);
  await C.waitForSelector('.banner-espectador', { state: 'visible', timeout: 4000 }).then(() => check('Cleo ve el aviso de espectadora', true), () => check('Cleo ve el aviso de espectadora', false));

  // Ana sin DESACTIVADOR roba el último gatito: gana Beto
  game().j(ids.Ana).mano = game().j(ids.Ana).mano.filter((c) => c.tipo !== 'desactivador'); sala().difundir();
  await libre(); arriba(['bomba']);
  await A.evaluate(() => document.querySelector('#mazo').click());
  await espera(4900); await shot(B, 'anim-victoria-B');
  check('Beto gana la partida', game().fase === 'fin' && game().ganador === ids.Beto);
  await B.waitForSelector('.res-caja', { timeout: 6000 }); await espera(500); await shot(B, 'resultados-B'); await shot(A, 'resultados-A');
  check('aparece la pantalla de resultados con estadísticas', (await B.$$('.tabla-stats tbody tr')).length === 3);

  // volver a jugar
  await A.evaluate(() => [...document.querySelectorAll('.res-caja .btn')].find((x) => /Volver a jugar/.test(x.textContent)).click());
  await A.waitForSelector('.pantalla.sala', { timeout: 6000 }); await B.waitForSelector('.pantalla.sala', { timeout: 6000 });
  check('«Volver a jugar» devuelve a todos a la sala de espera', true);

  // privacidad en el DOM y textos
  const html = [];
  for (const p of [A, B, C]) html.push(await p.evaluate(() => document.documentElement.outerHTML));
  check('ningún texto del juego contiene la palabra inglesa de la carta prohibida', !/\bno[p]e\b/i.test(html.join(' ')));
  check('sin errores de JavaScript en ningún navegador', errores.length === 0, errores.join(' | '));

  await b.close(); srv.close(); srv.closeAllConnections?.();
  const fallos = resultados.filter((r) => !r.ok).length;
  console.log(`\n${resultados.length - fallos}/${resultados.length} comprobaciones correctas`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('FALLO DE LA PRUEBA', e); process.exit(2); });
