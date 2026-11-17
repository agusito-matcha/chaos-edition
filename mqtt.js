// Cliente MQTT 3.1.1 mínimo sobre WebSocket, escrito a mano (sin librerías).
// Solo usa lo imprescindible: CONNECT (con mensaje de «última voluntad»), SUBSCRIBE, PUBLISH (QoS 0) y PINGREQ.
const enc = new TextEncoder(), dec = new TextDecoder();

const varlen = (n) => { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; o.push(b); } while (n > 0); return o; };
const unir = (...p) => { const t = p.reduce((s, x) => s + x.length, 0), o = new Uint8Array(t); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
const cadena = (s) => { const b = enc.encode(s); return unir(Uint8Array.of(b.length >> 8, b.length & 255), b); };
const paquete = (cab, cuerpo) => unir(Uint8Array.of(cab, ...varlen(cuerpo.length)), cuerpo);

export class MQTT {
  constructor({ url, clientId, will = null, keepalive = 30, alMensaje = () => {}, alCerrar = () => {} }) {
    Object.assign(this, { url, clientId, will, keepalive, alMensaje, alCerrar });
    this.ws = null; this.buf = new Uint8Array(0); this.pid = 0; this.subs = new Map(); this.abierto = false; this.ultimoTx = 0; this.ultimoRx = 0;
  }

  conectar(ms = 7000) {
    return new Promise((res, rej) => {
      let hecho = false;
      const fin = (ok, e) => { if (hecho) return; hecho = true; clearTimeout(t); ok ? res(this) : (this._cerrarWs(), rej(e)); };
      const t = setTimeout(() => fin(false, new Error('tiempo agotado')), ms);
      try { this.ws = new WebSocket(this.url, 'mqtt'); } catch (e) { return fin(false, e); }
      this.ws.binaryType = 'arraybuffer';
      this.ws.onopen = () => {
        let flags = 0x02, cuerpo = [cadena('MQTT'), Uint8Array.of(4), null, Uint8Array.of(this.keepalive >> 8, this.keepalive & 255), cadena(this.clientId)];
        if (this.will) { flags |= 0x04; const w = enc.encode(this.will.payload); cuerpo.push(cadena(this.will.topic), unir(Uint8Array.of(w.length >> 8, w.length & 255), w)); }
        cuerpo[2] = Uint8Array.of(flags);
        this._enviar(paquete(0x10, unir(...cuerpo)));
      };
      this.ws.onmessage = (ev) => { this._datos(new Uint8Array(ev.data), (rc) => (rc === 0 ? (this.abierto = true, fin(true)) : fin(false, new Error('el broker rechazó la conexión (' + rc + ')')))); };
      this.ws.onerror = () => fin(false, new Error('error de WebSocket'));
      this.ws.onclose = () => { const era = this.abierto; this.abierto = false; fin(false, new Error('conexión cerrada')); if (era) this.alCerrar(); };
    });
  }

  _enviar(b) { if (this.ws && this.ws.readyState === 1) { this.ws.send(b); this.ultimoTx = Date.now(); } }
  _cerrarWs() { try { if (this.ws) { this.ws.onclose = null; this.ws.close(); } } catch (e) { /* nada */ } this.abierto = false; }

  suscribir(filtro, ms = 7000) {
    return new Promise((res, rej) => {
      const id = (++this.pid & 0xffff) || (this.pid = 1);
      const t = setTimeout(() => { this.subs.delete(id); rej(new Error('suscripción sin respuesta')); }, ms);
      this.subs.set(id, () => { clearTimeout(t); res(); });
      this._enviar(paquete(0x82, unir(Uint8Array.of(id >> 8, id & 255), cadena(filtro), Uint8Array.of(0))));
    });
  }

  publicar(topic, payload) {
    const p = typeof payload === 'string' ? enc.encode(payload) : payload;
    this._enviar(paquete(0x30, unir(cadena(topic), p)));
  }

  /** Llamar cada pocos segundos (desde un reloj que no se frene con la pestaña en segundo plano). */
  tick() {
    if (!this.abierto) return;
    const ahora = Date.now();
    if (ahora - this.ultimoTx > this.keepalive * 500) this._enviar(Uint8Array.of(0xC0, 0));
    if (this.ultimoRx && ahora - this.ultimoRx > this.keepalive * 1500) { this._cerrarWs(); this.alCerrar(); }
  }

  cerrar() { if (this.abierto) this._enviar(Uint8Array.of(0xE0, 0)); this._cerrarWs(); }

  _datos(nuevos, alConnack) {
    this.ultimoRx = Date.now();
    this.buf = unir(this.buf, nuevos);
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      let mult = 1, len = 0, i = 1, c;
      do { if (i >= b.length) return; c = b[i++]; len += (c & 127) * mult; mult *= 128; } while ((c & 128) && i < 5);
      if (b.length < i + len) return;
      const cab = b[0], cuerpo = b.subarray(i, i + len);
      this.buf = b.subarray(i + len);
      const tipo = cab >> 4;
      if (tipo === 2) alConnack(cuerpo[1]);
      else if (tipo === 9) { const f = this.subs.get((cuerpo[0] << 8) | cuerpo[1]); if (f) { this.subs.delete((cuerpo[0] << 8) | cuerpo[1]); f(); } }
      else if (tipo === 3) {
        const tl = (cuerpo[0] << 8) | cuerpo[1], qos = (cab >> 1) & 3;
        let off = 2 + tl; const topic = dec.decode(cuerpo.subarray(2, off));
        if (qos > 0) { const id = cuerpo.subarray(off, off + 2); off += 2; this._enviar(unir(Uint8Array.of(0x40, 2), id)); }
        try { this.alMensaje(topic, cuerpo.slice(off)); } catch (e) { console.error(e); }
      }
    }
  }
}
