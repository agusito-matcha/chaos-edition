// Sonido 100 % sintetizado con Web Audio: no hay archivos de audio ni licencias de terceros.
// No suena nada hasta la primera interacción del usuario (política de los navegadores y requisito del juego).
const KEY = 'chaos.sonido.v1';
const def = { musica: 0.3, efectos: 0.7, silencio: false };
let ajustes = { ...def };
try { ajustes = { ...def, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { /* sin almacenamiento */ }

let ctx = null, master, gMus, gSfx, ruido, musicaOn = false, timerMus = null, paso = 0, proxima = 0;
const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(ajustes)); } catch (e) { /* nada */ } };

function aplicar() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(ajustes.silencio ? 0 : 1, t, 0.03);
  gMus.gain.setTargetAtTime(ajustes.musica * 0.5, t, 0.05);
  gSfx.gain.setTargetAtTime(ajustes.efectos, t, 0.03);
}

export function iniciar() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); gMus = ctx.createGain(); gSfx = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  gMus.connect(master); gSfx.connect(master); master.connect(comp); comp.connect(ctx.destination);
  const n = ctx.sampleRate * 1.5, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  ruido = buf;
  aplicar();
  if (musicaOn) arrancarMusica();
}

// ---- bloques de construcción ----
function tono({ f = 440, f2 = null, dur = 0.2, tipo = 'sine', vol = 0.3, t0 = 0, ataque = 0.005, filtro = 0, q = 1, dest = null }) {
  if (!ctx || ajustes.silencio) return;
  const t = ctx.currentTime + t0, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let nodo = o;
  if (filtro) { const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = filtro; fl.Q.value = q; o.connect(fl); nodo = fl; }
  nodo.connect(g); g.connect(dest || gSfx);
  o.start(t); o.stop(t + dur + 0.05);
}
function soplo({ dur = 0.2, vol = 0.3, t0 = 0, f = 1000, f2 = null, tipo = 'lowpass', q = 1, dest = null }) {
  if (!ctx || ajustes.silencio) return;
  const t = ctx.currentTime + t0, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = ruido; fl.type = tipo; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(dest || gSfx);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const NOTAS = { do: 261.63, re: 293.66, mi: 329.63, fa: 349.23, sol: 392, la: 440, si: 493.88 };
const arpegio = (fs, paso = 0.07, o = {}) => fs.forEach((f, i) => tono({ f, dur: 0.22, tipo: 'triangle', vol: 0.22, t0: i * paso, ...o }));
// Maullido sintético: diente de sierra filtrado con contorno de afinación
function maullido(base = 600, dur = 0.38, vol = 0.22, t0 = 0) {
  tono({ f: base * 0.9, f2: base * 1.35, dur: dur * 0.45, tipo: 'sawtooth', vol, t0, filtro: base * 2, q: 3, ataque: 0.03 });
  tono({ f: base * 1.35, f2: base * 0.7, dur: dur * 0.55, tipo: 'sawtooth', vol, t0: t0 + dur * 0.4, filtro: base * 1.6, q: 3, ataque: 0.01 });
}

const SFX = {
  clic: () => tono({ f: 520, f2: 760, dur: 0.07, tipo: 'square', vol: 0.12 }),
  hover: () => tono({ f: 900, dur: 0.025, tipo: 'sine', vol: 0.04 }),
  error: () => { tono({ f: 200, f2: 140, dur: 0.18, tipo: 'sawtooth', vol: 0.18 }); },
  copiar: () => arpegio([NOTAS.sol, NOTAS.si * 2], 0.06),
  listo: () => arpegio([NOTAS.do, NOTAS.mi, NOTAS.sol], 0.05),
  todosListos: () => arpegio([NOTAS.do, NOTAS.mi, NOTAS.sol, NOTAS.do * 2, NOTAS.mi * 2, NOTAS.sol * 2], 0.07, { vol: 0.25 }),
  empezar: () => { soplo({ dur: 0.5, f: 300, f2: 4000, tipo: 'bandpass', vol: 0.3 }); arpegio([NOTAS.do, NOTAS.sol, NOTAS.do * 2], 0.1); },
  repartir: () => soplo({ dur: 0.08, f: 3000, f2: 1200, tipo: 'bandpass', vol: 0.2 }),
  robar: () => { soplo({ dur: 0.16, f: 2500, f2: 900, tipo: 'bandpass', vol: 0.35 }); tono({ f: 300, f2: 220, dur: 0.1, vol: 0.12, tipo: 'triangle', t0: 0.05 }); },
  jugar: () => { tono({ f: 280, f2: 520, dur: 0.12, tipo: 'triangle', vol: 0.25 }); soplo({ dur: 0.1, f: 1800, vol: 0.15 }); },
  turno: () => tono({ f: NOTAS.sol, dur: 0.18, tipo: 'sine', vol: 0.16 }),
  miTurno: () => { tono({ f: NOTAS.mi, dur: 0.16, tipo: 'triangle', vol: 0.22 }); tono({ f: NOTAS.sol, dur: 0.2, tipo: 'triangle', vol: 0.22, t0: 0.1 }); tono({ f: NOTAS.do * 2, dur: 0.3, tipo: 'triangle', vol: 0.24, t0: 0.2 }); },
  bombaGiro: () => { tono({ f: 90, f2: 400, dur: 1.1, tipo: 'sawtooth', vol: 0.14, filtro: 500 }); for (let i = 0; i < 8; i++) tono({ f: 1200, dur: 0.03, tipo: 'square', vol: 0.07, t0: i * 0.14 }); },
  explosion: () => { soplo({ dur: 1.1, f: 3500, f2: 60, vol: 0.9 }); tono({ f: 140, f2: 30, dur: 0.9, tipo: 'sine', vol: 0.7 }); soplo({ dur: 0.4, f: 800, tipo: 'highpass', vol: 0.3 }); },
  desactivar: () => { soplo({ dur: 0.5, f: 4000, f2: 400, tipo: 'bandpass', vol: 0.35 }); arpegio([NOTAS.mi * 2, NOTAS.sol * 2, NOTAS.do * 4, NOTAS.mi * 4], 0.08, { t0: 0.2, vol: 0.2 }); },
  alivio: () => maullido(700, 0.3, 0.16),
  ganar: () => { arpegio([NOTAS.do, NOTAS.mi, NOTAS.sol, NOTAS.do * 2, NOTAS.sol, NOTAS.do * 2, NOTAS.mi * 2, NOTAS.sol * 2], 0.11, { vol: 0.28, tipo: 'square' }); tono({ f: NOTAS.do * 4, dur: 0.8, t0: 0.9, tipo: 'triangle', vol: 0.25 }); },
  perder: () => { [NOTAS.sol, NOTAS.fa, NOTAS.mi, NOTAS.re].forEach((f, i) => tono({ f: f * 0.5, f2: f * 0.45, dur: 0.35, tipo: 'sawtooth', vol: 0.2, t0: i * 0.28, filtro: 700, q: 2 })); },
  pasar: () => { soplo({ dur: 0.3, f: 500, f2: 5000, tipo: 'bandpass', vol: 0.4, q: 3 }); },
  ataque: () => { tono({ f: 120, f2: 40, dur: 0.35, tipo: 'sine', vol: 0.8 }); soplo({ dur: 0.25, f: 2500, f2: 200, vol: 0.5 }); tono({ f: 900, f2: 200, dur: 0.12, tipo: 'sawtooth', vol: 0.18 }); },
  favor: () => { arpegio([NOTAS.mi, NOTAS.sol], 0.12, { vol: 0.25 }); arpegio([NOTAS.sol, NOTAS.do * 2], 0.12, { t0: 0.35, vol: 0.25 }); },
  entregar: () => arpegio([NOTAS.do * 2, NOTAS.sol * 2], 0.06, { vol: 0.2 }),
  barajar: () => { for (let i = 0; i < 14; i++) soplo({ dur: 0.05, f: 2500 + Math.random() * 1500, tipo: 'bandpass', vol: 0.2, t0: i * 0.055 }); tono({ f: 200, f2: 700, dur: 0.8, tipo: 'sine', vol: 0.1 }); },
  futuro: () => { arpegio([NOTAS.la, NOTAS.do * 2, NOTAS.mi * 2, NOTAS.la * 2, NOTAS.mi * 4], 0.12, { tipo: 'sine', vol: 0.18 }); soplo({ dur: 1, f: 6000, f2: 1500, tipo: 'bandpass', q: 6, vol: 0.08 }); },
  negar: () => { // «bonk» cómico descendente + trompetilla
    tono({ f: 700, f2: 120, dur: 0.35, tipo: 'sawtooth', vol: 0.32, filtro: 900, q: 2 });
    tono({ f: 400, f2: 90, dur: 0.3, tipo: 'square', vol: 0.18, t0: 0.12 });
    tono({ f: 160, f2: 60, dur: 0.4, tipo: 'sine', vol: 0.5, t0: 0.05 });
  },
  rebote: () => tono({ f: 300, f2: 700, dur: 0.12, tipo: 'sine', vol: 0.2 }),
  gato_pegon: () => { tono({ f: 150, f2: 50, dur: 0.2, tipo: 'sine', vol: 0.7 }); soplo({ dur: 0.1, f: 3000, vol: 0.4 }); maullido(500, 0.25, 0.16, 0.1); },
  gato_ninja: () => { soplo({ dur: 0.35, f: 800, f2: 7000, tipo: 'bandpass', vol: 0.35, q: 4 }); tono({ f: 1500, f2: 400, dur: 0.1, tipo: 'square', vol: 0.1, t0: 0.25 }); },
  gato_mago: () => { arpegio([NOTAS.mi * 2, NOTAS.sol * 2, NOTAS.si * 2, NOTAS.mi * 4, NOTAS.sol * 4], 0.05, { vol: 0.16, tipo: 'sine' }); maullido(900, 0.25, 0.1, 0.1); },
  gato_dormilon: () => { tono({ f: 130, f2: 100, dur: 0.7, tipo: 'sine', vol: 0.2 }); tono({ f: 135, f2: 105, dur: 0.7, tipo: 'sine', vol: 0.2, t0: 0.8 }); soplo({ dur: 0.5, f: 300, vol: 0.06, t0: 0.1 }); },
  gato_cabreado: () => { maullido(380, 0.5, 0.3); tono({ f: 90, dur: 0.5, tipo: 'sawtooth', vol: 0.15, filtro: 200 }); },
  pareja: () => arpegio([NOTAS.sol, NOTAS.do * 2], 0.07, { tipo: 'square', vol: 0.12 }),
  trio: () => arpegio([NOTAS.do, NOTAS.mi, NOTAS.sol, NOTAS.do * 2], 0.06, { tipo: 'square', vol: 0.14 }),
  sorpresa: () => maullido(900, 0.25, 0.15),
  enfado: () => maullido(350, 0.4, 0.16),
  confusion: () => { tono({ f: 400, f2: 600, dur: 0.12, tipo: 'triangle', vol: 0.18 }); tono({ f: 600, f2: 380, dur: 0.18, tipo: 'triangle', vol: 0.18, t0: 0.13 }); },
  triste: () => maullido(450, 0.55, 0.14),
};

export function sfx(nombre) {
  if (!ctx || !SFX[nombre]) return;
  try { SFX[nombre](); } catch (e) { /* un sonido nunca debe romper el juego */ }
}

// ---- música de fondo generativa (muy suave) ----
const BAJO = [110, 110, 130.8, 110, 146.8, 110, 164.8, 130.8];
const ESCALA = [220, 261.6, 293.7, 329.6, 392, 440, 523.3];
function programar() {
  if (!ctx || !musicaOn) return;
  while (proxima < ctx.currentTime + 0.4) {
    const dt = proxima - ctx.currentTime, i = paso % 16;
    if (i % 2 === 0) tono({ f: BAJO[(i / 2) % 8], dur: 0.2, tipo: 'triangle', vol: 0.35, t0: Math.max(0, dt), dest: gMus });
    if (i % 4 === 2) soplo({ dur: 0.04, f: 7000, tipo: 'highpass', vol: 0.1, t0: Math.max(0, dt), dest: gMus });
    if (Math.random() < 0.45) tono({ f: ESCALA[Math.floor(Math.random() * ESCALA.length)], dur: 0.16, tipo: 'sine', vol: 0.16, t0: Math.max(0, dt), dest: gMus });
    paso++; proxima += 60 / 104 / 2;
  }
}
function arrancarMusica() { if (timerMus || !ctx) return; proxima = ctx.currentTime + 0.1; timerMus = setInterval(programar, 100); }
export function musica(on) {
  musicaOn = on;
  if (on) arrancarMusica(); else { clearInterval(timerMus); timerMus = null; }
}

export const ajustesSonido = () => ({ ...ajustes });
export function cambiar(parte) { ajustes = { ...ajustes, ...parte }; guardar(); aplicar(); }
