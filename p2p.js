// Transporte «sin servidor propio» para la versión de UN SOLO ARCHIVO.
// Mismo interfaz que red.js, pero:
//  · el ANFITRIÓN ejecuta el motor de reglas (server/game.js + server/sala.js) dentro de su navegador;
//  · los demás jugadores hablan con él a través de un broker MQTT público (WebSocket seguro);
//  · cada jugador tiene su propia clave (ECDH P-256 + AES-GCM): el broker y los otros jugadores no pueden leer ni falsificar sus mensajes.
import { MQTT } from './mqtt.js';

const CLAVE = 'chaos.sesion.v1', CLAVE_CID = 'chaos.cid.v1', P = 'chaos-edition/v1/';
export const sesion = { codigo: null, id: null, token: null, rol: null };
try { Object.assign(sesion, JSON.parse(sessionStorage.getItem(CLAVE) || '{}')); } catch (e) { /* nada */ }
if (sesion.rol === 'anfitrion') { sesion.codigo = sesion.id = sesion.token = sesion.rol = null; } // si el anfitrión recarga, la sala se pierde
const guardar = () => { try { sessionStorage.setItem(CLAVE, JSON.stringify(sesion)); } catch (e) { /* nada */ } };
export function olvidarSesion() { sesion.codigo = sesion.id = sesion.token = sesion.rol = null; try { sessionStorage.removeItem(CLAVE); } catch (e) { /* nada */ } }

const BROKERS = (() => {
  const p = new URLSearchParams(location.search).get('broker');
  if (p) return p.split(',').map((s) => s.trim()).filter(Boolean);
  return ['wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081', 'wss://broker.hivemq.com:8884/mqtt'];
})();

let oyente = () => {}, rol = null, abierta = false;
const te = new TextEncoder(), td = new TextDecoder();
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => { const a = crypto.getRandomValues(new Uint8Array(n)); return [...a].map((b) => b.toString(16).padStart(2, '0')).join(''); };
const topicUp = (c) => `${P}${c}/up`, topicDown = (c, cid) => `${P}${c}/d/${cid}`;
const cidActual = () => { let c = null; try { c = sessionStorage.getItem(CLAVE_CID); } catch (e) { /* nada */ } if (!c) { c = hex(5); try { sessionStorage.setItem(CLAVE_CID, c); } catch (e) { /* nada */ } } return c; };
const entregar = (m) => setTimeout(() => oyente(m), 0);

// ---------- criptografía ----------
const sub = crypto.subtle;
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(s); };
const deb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const nuevoPar = () => sub.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
const pubRaw = async (par) => b64(new Uint8Array(await sub.exportKey('raw', par.publicKey)));
async function derivar(par, pubB64) {
  const pub = await sub.importKey('raw', deb64(pubB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return sub.deriveKey({ name: 'ECDH', public: pub }, par.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function cifrar(clave, aad, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await sub.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad) }, clave, te.encode(JSON.stringify(obj))));
  return { n: b64(iv), d: b64(ct) };
}
async function descifrar(clave, aad, { n, d }) {
  return JSON.parse(td.decode(await sub.decrypt({ name: 'AES-GCM', iv: deb64(n), additionalData: te.encode(aad) }, clave, deb64(d))));
}

// ---------- reloj que no se frena con la pestaña en segundo plano ----------
const tareas = new Set(); let reloj = null;
function relojar(fn) {
  if (!reloj) {
    const bucle = () => { for (const f of tareas) { try { f(); } catch (e) { console.error(e); } } };
    try { reloj = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(1),250)'], { type: 'text/javascript' }))); reloj.onmessage = bucle; }
    catch (e) { reloj = { alt: setInterval(bucle, 250) }; }
  }
  tareas.add(fn); return () => tareas.delete(fn);
}

// ---------- conexión a brokers ----------
async function conectarBroker(url, opc) { const m = new MQTT({ url, ...opc }); await m.conectar(6500); return m; }

// =====================================================================
//  ANFITRIÓN
// =====================================================================
class Virtual { // conexión simulada para el motor de salas
  constructor(enviarFn) { this.o = {}; this.enviarFn = enviarFn; this.cerrada = false; }
  on(e, f) { (this.o[e] = this.o[e] || []).push(f); return this; }
  removeAllListeners(e) { delete this.o[e]; }
  emit(e, ...a) { for (const f of this.o[e] || []) f(...a); }
  enviar(t) { if (!this.cerrada) this.enviarFn(t); }
  cerrar() { this.terminar(); }
  terminar() { if (this.cerrada) return; this.cerrada = true; this.emit('cierre'); }
}

let salas = null, local = null, canales = [], remotos = new Map(), colaRx = Promise.resolve(), codigoSala = null, esperandoUnido = false, quitarReloj = [], ticks = 0, desmontando = false;

function iniciarAnfitrion() {
  if (salas) return;
  const { Salas } = globalThis.__CHAOS_SERVIDOR;
  salas = new Salas();
  clearInterval(salas.intervalo); clearInterval(salas.lento); // los relojes los pone el Worker (no se frenan en segundo plano)
  local = new Virtual((txt) => alLocal(JSON.parse(txt)));
  salas.conectar(local);
  quitarReloj.push(relojar(() => {
    salas.barrer(); ticks++;
    if (ticks % 20 === 0) { for (const c of canales) c.mqtt.tick(); barridoRemotos(); }
    if (ticks % 120 === 0) salas.limpiar();
  }));
}

function alLocal(m) {
  if (m.t === 'unido') { sesion.codigo = m.codigo; sesion.id = m.id; sesion.token = m.token; sesion.rol = 'anfitrion'; guardar(); rol = 'anfitrion'; esperandoUnido = false; codigoSala = m.codigo; window.CHAOS_ES_ANFITRION = true; abrirCanales(m.codigo); }
  else if (m.t === 'error' && esperandoUnido) { esperandoUnido = false; rol = null; }
  else if (m.t === 'salida') { desmontar(); entregar(m); return; }
  entregar(m);
}

async function abrirCanales(codigo) {
  entregar({ t: '_conectando' });
  const intentos = BROKERS.map((url) => conectarCanal(codigo, url).catch(() => null));
  // en cuanto haya 2 canales (o todos hayan respondido) seguimos
  await Promise.race([new Promise((res) => { let ok = 0, fin = 0; intentos.forEach((p) => p.then((c) => { fin++; if (c) ok++; if (ok >= 2 || fin === intentos.length) res(); })); })]);
  if (!canales.length) { entregar({ t: 'error', msg: 'No se ha podido conectar con ningún servicio de mensajería. Comprueba tu Internet (o que el colegio no bloquee las conexiones) y crea la sala de nuevo.' }); desmontar(); entregar({ t: 'salida' }); return; }
  abierta = true; entregar({ t: '_abierta' });
}

async function conectarCanal(codigo, url) {
  const canal = { url, mqtt: null };
  const mqtt = await conectarBroker(url, {
    clientId: 'chaos-h-' + hex(6), keepalive: 30,
    alMensaje: (topic, payload) => { colaRx = colaRx.then(() => rxAnfitrion(canal, payload)).catch(() => {}); },
    alCerrar: () => { canales = canales.filter((c) => c !== canal); if (!desmontando && salas) reabrirCanal(codigo, url, canal); },
  });
  await mqtt.suscribir(topicUp(codigo));
  canal.mqtt = mqtt; canales.push(canal);
  return canal;
}
async function reabrirCanal(codigo, url, vieja) {
  if (!canales.length) { abierta = false; entregar({ t: '_cerrada' }); }
  for (let i = 0; i < 40 && !desmontando && codigoSala === codigo; i++) {
    await esperar(Math.min(8000, 1000 * (i + 1)));
    try { await conectarCanal(codigo, url); abierta = true; entregar({ t: '_abierta' }); return; } catch (e) { /* reintenta */ }
  }
}

async function rxAnfitrion(canal, payload) {
  let o; try { o = JSON.parse(td.decode(payload)); } catch (e) { return; }
  if (!o || typeof o.c !== 'string' || !/^[0-9a-f]{6,20}$/.test(o.c)) return;
  const cid = o.c;
  const down = (obj) => canal.mqtt && canal.mqtt.abierto && canal.mqtt.publicar(topicDown(codigoSala, cid), JSON.stringify(obj));
  if (o.h) { // saludo: negociamos una clave nueva para este jugador
    if (typeof o.h !== 'string' || o.h.length > 200) return;
    let par, clave; try { par = await nuevoPar(); clave = await derivar(par, o.h); } catch (e) { return; }
    const ent = remotos.get(cid) || { cid, conn: null, token: null };
    Object.assign(ent, { clave, seqRx: 0, seqTx: 0, cola: Promise.resolve(), canal, ultimo: Date.now() });
    remotos.set(cid, ent);
    down({ h: await pubRaw(par) });
    return;
  }
  const ent = remotos.get(cid);
  if (o.x) { return; } // «última voluntad» del broker: la vigilancia de actividad se encarga de marcar la desconexión
  if (!ent || !ent.clave) { down({ k: 1 }); return; } // no te conozco: vuelve a saludar
  if (typeof o.n !== 'string' || typeof o.d !== 'string') return;
  let msg; try { msg = await descifrar(ent.clave, `${codigoSala}|${cid}|up`, o); } catch (e) { return; } // falsificado o corrupto
  if (!msg || typeof msg.s !== 'number' || msg.s <= ent.seqRx || typeof msg.r !== 'string') return; // repetido
  ent.seqRx = msg.s; ent.ultimo = Date.now(); ent.canal = canal;
  if (!ent.conn || ent.conn.cerrada) {
    ent.conn = new Virtual((txt) => enviarARemoto(ent, txt));
    salas.conectar(ent.conn);
    if (ent.token) ent.conn.emit('mensaje', JSON.stringify({ t: 'reconectar', codigo: codigoSala, token: ent.token }));
  }
  ent.conn.emit('mensaje', msg.r);
}

function enviarARemoto(ent, txt) {
  const codigo = codigoSala; // se captura ahora: al desmontar la sala el valor global se borra
  if (txt.startsWith('{"t":"unido"')) { try { ent.token = JSON.parse(txt).token; } catch (e) { /* nada */ } }
  ent.cola = ent.cola.then(async () => {
    const canal = ent.canal && ent.canal.mqtt && ent.canal.mqtt.abierto ? ent.canal : canales[0];
    if (!canal || !ent.clave) return;
    const s = ++ent.seqTx;
    const c = await cifrar(ent.clave, `${codigo}|${ent.cid}|down`, { s, r: txt });
    canal.mqtt.publicar(topicDown(codigo, ent.cid), JSON.stringify(c));
  }).catch(() => {});
}

function barridoRemotos() {
  const ahora = Date.now();
  for (const ent of remotos.values()) if (ent.conn && !ent.conn.cerrada && ahora - ent.ultimo > 45000) ent.conn.terminar();
}

function desmontar() {
  if (desmontando) return; desmontando = true;
  for (const ent of remotos.values()) if (ent.clave) enviarARemoto(ent, '{"t":"sesion_perdida"}');
  const cerrar = canales.slice();
  setTimeout(() => { cerrar.forEach((c) => c.mqtt.cerrar()); }, 600);
  quitarReloj.forEach((q) => q()); quitarReloj = [];
  if (salas) salas.cerrar();
  salas = null; local = null; canales = []; remotos = new Map(); codigoSala = null; rol = null; abierta = false; window.CHAOS_ES_ANFITRION = false;
  olvidarSesion();
  setTimeout(() => { desmontando = false; }, 700);
}

// =====================================================================
//  INVITADO
// =====================================================================
let inv = null;

async function saludar(codigo, cid, brokerUrl) { // conecta, se suscribe y negocia la clave. Devuelve el estado o lanza error.
  const up = topicUp(codigo), down = topicDown(codigo, cid);
  const est = { codigo, cid, mqtt: null, clave: null, seqTx: 0, seqRx: 0, colaTx: Promise.resolve(), colaRx: Promise.resolve(), ultimoRx: Date.now(), hello: null, url: brokerUrl, cerrado: false };
  est.mqtt = await conectarBroker(brokerUrl, {
    clientId: `chaos-${cid}-${hex(3)}`, keepalive: 30, will: { topic: up, payload: JSON.stringify({ c: cid, x: 1 }) },
    alMensaje: (t, payload) => rxInvitado(est, payload), alCerrar: () => { if (!est.cerrado && inv === est) caidaInvitado(); },
  });
  await est.mqtt.suscribir(down);
  const par = await nuevoPar(), pub = await pubRaw(par);
  for (let i = 0; i < 2 && !est.clave; i++) {
    const espera = new Promise((res) => { est.hello = res; });
    est.mqtt.publicar(up, JSON.stringify({ c: cid, h: pub }));
    const hostPub = await Promise.race([espera, esperar(2500).then(() => null)]);
    if (hostPub) { est.clave = await derivar(par, hostPub); est.seqTx = 0; est.seqRx = 0; }
  }
  if (!est.clave) { est.cerrado = true; est.mqtt.cerrar(); const e = new Error('sin sala'); e.sinSala = true; throw e; }
  return est;
}

function rxInvitado(est, payload) {
  let o; try { o = JSON.parse(td.decode(payload)); } catch (e) { return; }
  if (!o) return;
  if (o.h && est.hello) { const f = est.hello; est.hello = null; f(o.h); return; }
  if (o.k && est.clave && inv === est) { est.clave = null; reSaludar(est); return; }
  if (!est.clave || typeof o.n !== 'string' || typeof o.d !== 'string') return;
  est.colaRx = est.colaRx.then(async () => {
    let msg; try { msg = await descifrar(est.clave, `${est.codigo}|${est.cid}|down`, o); } catch (e) { return; }
    if (!msg || typeof msg.s !== 'number' || msg.s <= est.seqRx || typeof msg.r !== 'string') return;
    est.seqRx = msg.s; est.ultimoRx = Date.now();
    let m; try { m = JSON.parse(msg.r); } catch (e) { return; }
    if (m.t === 'unido') est.uniendo = false;
    if (m.t === 'unido') { sesion.codigo = m.codigo; sesion.id = m.id; sesion.token = m.token; sesion.rol = 'invitado'; guardar(); }
    if (m.t === 'salida' || m.t === 'sesion_perdida') { cerrarInvitado(); olvidarSesion(); }
    if (m.t === 'error' && est.uniendo) { cerrarInvitado(); oyente({ t: '_abierta' }); }
    oyente(m);
  }).catch(() => {});
}

async function reSaludar(est) { // el anfitrión perdió nuestra clave (p. ej. se reinició el broker): negociamos otra
  try { const nueva = await saludar(est.codigo, est.cid, est.url); est.cerrado = true; try { est.mqtt.cerrar(); } catch (e) { /* nada */ } inv = nueva; if (sesion.token) enviarInv({ t: 'reconectar', codigo: sesion.codigo, token: sesion.token }); } catch (e) { caidaInvitado(); }
}

function cerrarInvitado() { if (inv) { inv.cerrado = true; try { inv.mqtt.cerrar(); } catch (e) { /* nada */ } } inv = null; rol = null; abierta = false; }

async function unirInvitado(msgInicial, codigo, reconectando = false) {
  const cid = cidActual();
  oyente({ t: '_conectando' });
  let ultimoError = null;
  for (const url of BROKERS) {
    try {
      if (!reconectando) entregar({ t: '_info', msg: 'Buscando la sala ' + codigo + '…' });
      const est = await saludar(codigo, cid, url);
      inv = est; rol = 'invitado'; abierta = true; est.uniendo = !reconectando;
      oyente({ t: '_abierta' });
      enviarInv(msgInicial); return true;
    } catch (e) { ultimoError = e; }
  }
  if (!reconectando) {
    entregar({ t: 'error', msg: ultimoError && ultimoError.sinSala ? 'No existe ninguna sala con ese código (o el anfitrión ha cerrado su pestaña).' : 'No se ha podido conectar con el servicio de mensajería. Comprueba tu Internet o prueba con otra red.', codigoMalo: true });
    entregar({ t: '_abierta' });
  }
  return false;
}

function enviarInv(obj) {
  const est = inv; if (!est || !est.clave) return false;
  est.colaTx = est.colaTx.then(async () => {
    const s = ++est.seqTx;
    const c = await cifrar(est.clave, `${est.codigo}|${est.cid}|up`, { s, r: JSON.stringify(obj) });
    est.mqtt.publicar(topicUp(est.codigo), JSON.stringify({ c: est.cid, ...c }));
  }).catch(() => {});
  return true;
}

let reintentando = false;
async function caidaInvitado() {
  if (reintentando || !sesion.codigo) return; reintentando = true;
  const viejo = inv; if (viejo) { viejo.cerrado = true; try { viejo.mqtt.cerrar(); } catch (e) { /* nada */ } } inv = null; abierta = false;
  oyente({ t: '_cerrada' });
  const inicio = Date.now();
  while (Date.now() - inicio < 90000 && sesion.codigo && rol !== null) {
    await esperar(1500);
    if (await unirInvitado({ t: 'reconectar', codigo: sesion.codigo, token: sesion.token }, sesion.codigo, true)) { reintentando = false; return; }
  }
  reintentando = false;
  if (sesion.codigo) { cerrarInvitado(); olvidarSesion(); oyente({ t: 'sesion_perdida' }); }
}

// =====================================================================
//  Interfaz pública (igual que red.js)
// =====================================================================
let relojInv = null;
export function conectar(cb) {
  if (cb) oyente = cb;
  window.CHAOS_P2P_LISTO = true;
  if (!relojInv) relojInv = relojar(() => { // vigilancia del invitado (cada ~5 s) y latido (cada ~15 s)
    if (rol !== 'invitado' || !inv) return;
    const n = ++ticks;
    if (n % 20 === 0) { inv.mqtt.tick(); if (Date.now() - inv.ultimoRx > 45000) caidaInvitado(); }
    if (n % 60 === 0) enviarInv({ t: 'ping' });
  });
  if (sesion.codigo && sesion.token && sesion.rol === 'invitado') { rol = 'invitado'; caidaInvitado(); }
  else { abierta = true; entregar({ t: '_abierta' }); }
}
export function enviar(obj) {
  if (rol === 'anfitrion' && local) { local.emit('mensaje', JSON.stringify(obj)); return true; }
  if (rol === 'invitado') return enviarInv(obj);
  if (obj.t === 'ping') return true;
  if (obj.t === 'crear') { iniciarAnfitrion(); esperandoUnido = true; local.emit('mensaje', JSON.stringify(obj)); return true; }
  if (obj.t === 'unirse') {
    const codigo = String(obj.codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (codigo.length !== 5) { entregar({ t: 'error', msg: 'El código tiene 5 letras o números.' }); return true; }
    unirInvitado({ ...obj, codigo }, codigo); return true;
  }
  return false;
}
window.__chaosP2P = { salas: () => salas, canales: () => canales, remotos: () => remotos };
export const estaAbierta = () => abierta;
export function reconectarYa() { /* la reconexión es automática */ }
