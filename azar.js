'use strict';
// Aleatoriedad y comparaciones seguras que funcionan igual en Node.js y en el navegador.
const wc = globalThis.crypto && globalThis.crypto.getRandomValues ? globalThis.crypto : require('node:crypto').webcrypto;

function randomInt(n) { // entero uniforme en [0, n) sin sesgo
  const lim = Math.floor(0x100000000 / n) * n;
  const a = new Uint32Array(1);
  let x;
  do { wc.getRandomValues(a); x = a[0]; } while (x >= lim);
  return x % n;
}
function randomHex(bytes) {
  const a = new Uint8Array(bytes); wc.getRandomValues(a);
  let s = ''; for (const b of a) s += b.toString(16).padStart(2, '0');
  return s;
}
function igualesSeguro(a, b) { // comparación de tiempo constante
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
module.exports = { randomInt, randomHex, igualesSeguro };
