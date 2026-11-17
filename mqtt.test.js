'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearBroker } = require('./mini-broker');

let broker, url, MQTT;
test.before(async () => {
  ({ MQTT } = await import('../public/js/mqtt.js'));
  broker = crearBroker(); await new Promise((r) => broker.listen(0, '127.0.0.1', r)); url = `ws://127.0.0.1:${broker.address().port}/mqtt`;
});
test.after(() => { broker.close(); broker.closeAllConnections?.(); });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const cliente = async (id, extra = {}) => { const recibidos = []; const c = new MQTT({ url, clientId: id, alMensaje: (t, p) => recibidos.push([t, new TextDecoder().decode(p)]), ...extra }); await c.conectar(); c.recibidos = recibidos; return c; };

test('MQTT: publicar/suscribir, comodines y mensajes de 12 KB con acentos', async () => {
  const a = await cliente('a1'), b = await cliente('b1');
  await b.suscribir('chaos/sala/+/d'); await b.suscribir('otro/#');
  a.publicar('chaos/sala/X/d', 'hola ñandú 🐱'); a.publicar('otro/x/y', 'deep'); a.publicar('nada/aqui', 'no');
  const grande = 'z'.repeat(12000); a.publicar('otro/grande', grande);
  await espera(400);
  assert.deepEqual(b.recibidos.slice(0, 2), [['chaos/sala/X/d', 'hola ñandú 🐱'], ['otro/x/y', 'deep']]);
  assert.equal(b.recibidos.length, 3); assert.equal(b.recibidos[2][1].length, 12000);
  a.cerrar(); b.cerrar();
});

test('MQTT: mensaje de última voluntad al caer sin despedirse (y no al cerrar bien)', async () => {
  const obs = await cliente('obs'); await obs.suscribir('will/#');
  const x = await cliente('x', { will: { topic: 'will/x', payload: 'ADIOS-X' } });
  const y = await cliente('y', { will: { topic: 'will/y', payload: 'ADIOS-Y' } });
  x.ws.close(); y.cerrar();
  await espera(400);
  assert.deepEqual(obs.recibidos, [['will/x', 'ADIOS-X']]);
  obs.cerrar();
});

test('MQTT: connect a un puerto sin broker falla rápido con error claro', async () => {
  const c = new MQTT({ url: 'ws://127.0.0.1:1/mqtt', clientId: 'q' });
  await assert.rejects(() => c.conectar(2000));
});
