'use strict';
// CHAOS EDITION · servidor HTTP (archivos del juego) + WebSocket (partidas en tiempo real).
// No necesita instalar nada: solo Node.js 18 o superior.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const os = require('node:os');
const { aceptar } = require('./ws');
const { Salas } = require('./sala');

const PUBLICO = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};
const COMPRIMIBLES = new Set(['.html', '.css', '.js', '.json', '.svg', '.webmanifest', '.txt']);
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
const cache = new Map();

function leer(ruta, ext) {
  const st = fs.statSync(ruta);
  const c = cache.get(ruta);
  if (c && c.mtime === st.mtimeMs) return c;
  const raw = fs.readFileSync(ruta);
  const gz = COMPRIMIBLES.has(ext) ? zlib.gzipSync(raw, { level: 9 }) : null;
  const nuevo = { mtime: st.mtimeMs, raw, gz };
  cache.set(ruta, nuevo);
  return nuevo;
}

function servir(req, res, salas) {
  const url = new URL(req.url, 'http://x');
  const cabeceras = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP };
  if (url.pathname === '/salud') {
    res.writeHead(200, { ...cabeceras, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ ok: true, juego: 'CHAOS EDITION', salas: salas.salas.size }));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, cabeceras); return res.end(); }
  let p;
  try { p = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400, cabeceras); return res.end(); }
  if (p.includes('\0')) { res.writeHead(400, cabeceras); return res.end(); }
  if (p === '/' || p === '') p = '/index.html';
  const completa = path.join(PUBLICO, path.normalize(p));
  if (!completa.startsWith(PUBLICO + path.sep)) { res.writeHead(403, cabeceras); return res.end('Prohibido'); }
  let st;
  try { st = fs.statSync(completa); } catch (e) { res.writeHead(404, { ...cabeceras, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
  if (!st.isFile()) { res.writeHead(404, cabeceras); return res.end('No encontrado'); }
  const ext = path.extname(completa).toLowerCase();
  const f = leer(completa, ext);
  const h = { ...cabeceras, 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' };
  const acepta = String(req.headers['accept-encoding'] || '').includes('gzip');
  if (f.gz && acepta) { h['Content-Encoding'] = 'gzip'; h.Vary = 'Accept-Encoding'; res.writeHead(200, h); return res.end(req.method === 'HEAD' ? undefined : f.gz); }
  res.writeHead(200, h);
  res.end(req.method === 'HEAD' ? undefined : f.raw);
}

function crearServidor() {
  const salas = new Salas();
  const permitidos = (process.env.ORIGENES_PERMITIDOS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origenOk = (req) => {
    const o = req.headers.origin;
    if (!o) return true; // clientes que no son navegador
    try {
      const u = new URL(o);
      return u.host === req.headers.host || permitidos.includes(o) || permitidos.includes(u.host);
    } catch (e) { return false; }
  };
  const server = http.createServer((req, res) => servir(req, res, salas));
  const conexiones = new Set();
  server.on('upgrade', (req, socket) => {
    if (new URL(req.url, 'http://x').pathname !== '/ws') { socket.end('HTTP/1.1 404 Not Found\r\n\r\n'); return; }
    const conn = aceptar(req, socket, { origenOk });
    if (!conn) return;
    conexiones.add(conn);
    conn.on('cierre', () => conexiones.delete(conn));
    salas.conectar(conn);
  });
  const latido = setInterval(() => {
    for (const c of conexiones) {
      if (!c.viva) { c.terminar(); continue; }
      c.viva = false; c.ping();
    }
  }, 25000);
  latido.unref();
  server.on('close', () => { clearInterval(latido); salas.cerrar(); });
  server.salas = salas;
  return server;
}

if (require.main === module) {
  const puerto = Number(process.env.PORT) || 3000;
  const server = crearServidor();
  server.listen(puerto, '0.0.0.0', () => {
    console.log('\n🐱💥 CHAOS EDITION está funcionando');
    console.log('   En este ordenador:  http://localhost:' + puerto);
    for (const lista of Object.values(os.networkInterfaces())) {
      for (const i of lista || []) if (i.family === 'IPv4' && !i.internal) console.log('   En tu red local:    http://' + i.address + ':' + puerto + '   (otros dispositivos del mismo wifi)');
    }
    console.log('');
  });
  const apagar = () => { server.close(); setTimeout(() => process.exit(0), 300).unref(); };
  process.on('SIGTERM', apagar); process.on('SIGINT', apagar);
}

module.exports = { crearServidor };
