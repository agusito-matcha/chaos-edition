'use strict';
// Broker MQTT minimalista (solo para pruebas locales): CONNECT, SUBSCRIBE, PUBLISH, PINGREQ, DISCONNECT, mensaje de última voluntad.
const http = require('node:http');
const { aceptar } = require('../server/ws');

const coincide = (filtro, topic) => {
  const f = filtro.split('/'), t = topic.split('/');
  for (let i = 0; i < f.length; i++) { if (f[i] === '#') return true; if (i >= t.length) return false; if (f[i] !== '+' && f[i] !== t[i]) return false; }
  return f.length === t.length;
};
const varlen = (n) => { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; o.push(b); } while (n > 0); return o; };
const str = (s) => { const b = Buffer.from(s); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 255]), b]); };
const paquete = (cab, cuerpo) => Buffer.concat([Buffer.from([cab, ...varlen(cuerpo.length)]), cuerpo]);

function crearBroker() {
  const clientes = new Set();
  const server = http.createServer((q, r) => { r.writeHead(404); r.end(); });
  const publicar = (topic, payload) => { if (server.alPublicar) server.alPublicar(topic, payload); const p = paquete(0x30, Buffer.concat([str(topic), payload])); for (const c of clientes) if ([...c.filtros].some((f) => coincide(f, topic))) c.conn.enviarBinario(p); };
  server.on('upgrade', (req, socket) => {
    const conn = aceptar(req, socket, { subprotocolo: 'mqtt' }); if (!conn) return;
    const c = { conn, filtros: new Set(), will: null, buf: Buffer.alloc(0), limpio: false };
    clientes.add(c);
    conn.on('binario', (d) => {
      c.buf = Buffer.concat([c.buf, d]);
      for (;;) {
        const b = c.buf; if (b.length < 2) return;
        let mult = 1, len = 0, i = 1, x; do { if (i >= b.length) return; x = b[i++]; len += (x & 127) * mult; mult *= 128; } while (x & 128);
        if (b.length < i + len) return;
        const cab = b[0], cu = b.subarray(i, i + len); c.buf = b.subarray(i + len);
        const tipo = cab >> 4;
        if (tipo === 1) { // CONNECT
          let o = 2 + cu.readUInt16BE(0) + 1; const flags = cu[o]; o += 3; // nivel ya contado: protocolo(2+4) nivel(1) -> flags
          o = 2 + cu.readUInt16BE(0) + 1; const fl = cu[o]; o += 1 + 2; // flags + keepalive
          const idl = cu.readUInt16BE(o); o += 2 + idl;
          if (fl & 0x04) { const tl = cu.readUInt16BE(o); const topic = cu.subarray(o + 2, o + 2 + tl).toString(); o += 2 + tl; const pl = cu.readUInt16BE(o); c.will = { topic, payload: Buffer.from(cu.subarray(o + 2, o + 2 + pl)) }; }
          conn.enviarBinario(Buffer.from([0x20, 2, 0, 0]));
        } else if (tipo === 8) { // SUBSCRIBE
          const id = cu.subarray(0, 2); const tl = cu.readUInt16BE(2); c.filtros.add(cu.subarray(4, 4 + tl).toString());
          conn.enviarBinario(Buffer.concat([Buffer.from([0x90, 3]), id, Buffer.from([0])]));
        } else if (tipo === 3) { const tl = cu.readUInt16BE(0); publicar(cu.subarray(2, 2 + tl).toString(), Buffer.from(cu.subarray(2 + tl))); }
        else if (tipo === 12) conn.enviarBinario(Buffer.from([0xD0, 0]));
        else if (tipo === 14) { c.limpio = true; conn.cerrar(); }
      }
    });
    conn.on('cierre', () => { clientes.delete(c); if (!c.limpio && c.will) publicar(c.will.topic, c.will.payload); });
  });
  server.clientes = clientes;
  return server;
}
module.exports = { crearBroker };
