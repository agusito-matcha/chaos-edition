'use strict';
// Servidor WebSocket mínimo (RFC 6455) sin dependencias externas.
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 16 * 1024;

class Conexion extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.cerrada = false;
    this.fragmentos = [];
    this.viva = true;
    socket.setNoDelay(true);
    socket.on('data', (c) => this._datos(c));
    socket.on('close', () => this._fin());
    socket.on('error', () => this._fin());
  }

  _datos(chunk) {
    if (this.cerrada) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const f = this._leerTrama();
      if (f === null) return;
      if (f === 'mala') return this.cerrar(1002);
      this._trama(f);
      if (this.cerrada) return;
    }
  }

  _leerTrama() {
    const b = this.buffer;
    if (b.length < 2) return null;
    const fin = !!(b[0] & 0x80);
    const op = b[0] & 0x0f;
    if (!(b[1] & 0x80)) return 'mala'; // los clientes SIEMPRE enmascaran
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (b.length < 4) return null;
      len = b.readUInt16BE(2); off = 4;
    } else if (len === 127) {
      if (b.length < 10) return null;
      const big = b.readBigUInt64BE(2);
      if (big > BigInt(MAX_PAYLOAD)) return 'mala';
      len = Number(big); off = 10;
    }
    if (len > MAX_PAYLOAD) return 'mala';
    if (b.length < off + 4 + len) return null;
    const mask = b.subarray(off, off + 4);
    const payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    this.buffer = b.subarray(off + 4 + len);
    return { fin, op, payload };
  }

  _trama({ fin, op, payload }) {
    if (op === 0x8) return this.cerrar(1000);
    if (op === 0x9) return this._enviarTrama(0xA, payload);
    if (op === 0xA) { this.viva = true; return; }
    if (op === 0x1 || op === 0x2) this.opFrag = op;
    if (op === 0x1 || op === 0x2 || op === 0x0) {
      this.fragmentos.push(payload);
      if (this.fragmentos.reduce((s, x) => s + x.length, 0) > MAX_PAYLOAD) return this.cerrar(1009);
      if (fin) {
        const todo = Buffer.concat(this.fragmentos);
        this.fragmentos = [];
        if (this.opFrag === 0x2) this.emit('binario', todo); else this.emit('mensaje', todo.toString('utf8'));
      }
    }
    // los mensajes binarios se ignoran
  }

  _enviarTrama(op, payload) {
    if (this.cerrada || this.socket.destroyed) return;
    const len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    this.socket.write(Buffer.concat([head, payload]));
    if (this.socket.writableLength > 1024 * 1024) this.terminar();
  }

  enviar(texto) { this._enviarTrama(0x1, Buffer.from(texto, 'utf8')); }
  enviarBinario(buf) { this._enviarTrama(0x2, Buffer.from(buf)); }
  ping() { this._enviarTrama(0x9, Buffer.alloc(0)); }

  cerrar(codigo = 1000) {
    if (this.cerrada) return;
    const p = Buffer.alloc(2); p.writeUInt16BE(codigo, 0);
    this._enviarTrama(0x8, p);
    this.socket.end();
    setTimeout(() => this.terminar(), 500).unref();
  }
  terminar() { try { this.socket.destroy(); } catch (e) { /* nada */ } this._fin(); }
  _fin() { if (this.cerrada) return; this.cerrada = true; this.emit('cierre'); }
}

function aceptar(req, socket, { origenOk, subprotocolo } = {}) {
  const key = req.headers['sec-websocket-key'];
  const up = String(req.headers.upgrade || '').toLowerCase();
  if (up !== 'websocket' || !key || req.headers['sec-websocket-version'] !== '13') {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return null;
  }
  if (origenOk && !origenOk(req)) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return null; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n' + (subprotocolo && String(req.headers['sec-websocket-protocol'] || '').includes(subprotocolo) ? 'Sec-WebSocket-Protocol: ' + subprotocolo + '\r\n' : '') + '\r\n');
  return new Conexion(socket);
}

module.exports = { aceptar, Conexion };
