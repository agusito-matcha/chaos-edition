// Cliente WebSocket con reconexión automática y recuperación de sesión.
const CLAVE = 'chaos.sesion.v1'; // sessionStorage: cada pestaña tiene su propia sesión
let ws = null, abierto = false, intentos = 0, timerRec = null, timerPing = null, ultimoMsg = 0, oyente = () => {}, cerradoAposta = false;
export const sesion = { codigo: null, id: null, token: null };
try { Object.assign(sesion, JSON.parse(sessionStorage.getItem(CLAVE) || '{}')); } catch (e) { /* nada */ }
const guardar = () => { try { sessionStorage.setItem(CLAVE, JSON.stringify(sesion)); } catch (e) { /* nada */ } };
export function olvidarSesion() { sesion.codigo = sesion.id = sesion.token = null; try { sessionStorage.removeItem(CLAVE); } catch (e) { /* nada */ } }

function url() {
  const cfg = (window.CHAOS_CONFIG && window.CHAOS_CONFIG.servidor) || '';
  if (cfg) return cfg.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
}
export function conectar(cb) {
  if (cb) oyente = cb;
  cerradoAposta = false;
  clearTimeout(timerRec);
  try { ws = new WebSocket(url()); } catch (e) { return programar(); }
  oyente({ t: '_conectando', intento: intentos });
  ws.onopen = () => {
    abierto = true; intentos = 0; ultimoMsg = Date.now();
    if (sesion.codigo && sesion.token) enviar({ t: 'reconectar', codigo: sesion.codigo, token: sesion.token });
    oyente({ t: '_abierta' });
    clearInterval(timerPing);
    timerPing = setInterval(() => {
      if (Date.now() - ultimoMsg > 50000) { try { ws.close(); } catch (e) { /* nada */ } return; }
      enviar({ t: 'ping' });
    }, 20000);
  };
  ws.onmessage = (ev) => {
    ultimoMsg = Date.now();
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'unido') { sesion.codigo = m.codigo; sesion.id = m.id; sesion.token = m.token; guardar(); }
    if (m.t === 'sesion_perdida' || m.t === 'salida') olvidarSesion();
    oyente(m);
  };
  ws.onclose = () => { abierto = false; clearInterval(timerPing); oyente({ t: '_cerrada' }); if (!cerradoAposta) programar(); };
  ws.onerror = () => { /* onclose se encarga */ };
}
function programar() {
  intentos++;
  clearTimeout(timerRec);
  timerRec = setTimeout(() => conectar(), Math.min(5000, 400 * 2 ** Math.min(intentos, 4)));
}
export function enviar(obj) { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; } return false; }
export const estaAbierta = () => abierto;
export function reconectarYa() { if (!abierto) { clearTimeout(timerRec); conectar(); } }
