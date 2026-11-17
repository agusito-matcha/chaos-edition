'use strict';
// CHAOS EDITION · Motor de reglas autoritativo.
// Todo lo que ocurre en una partida se decide aquí; los clientes solo piden acciones.
const { randomInt } = require('./azar');

const GATOS = ['gato_pegon', 'gato_ninja', 'gato_mago', 'gato_dormilon', 'gato_cabreado'];
const TIPOS = ['bomba', 'desactivador', 'pasar', 'ataque', 'favor', 'barajar', 'futuro', 'negar', ...GATOS];
const SIMPLES = ['pasar', 'ataque', 'favor', 'barajar', 'futuro'];

const CFG = {
  NEGAR_MS: 3200,      // ventana para responder con VA A SER QUE NO
  NEGAR_EXT_MS: 2400,  // ventana tras cada VA A SER QUE NO
  FAVOR_MS: 30000,
  REINSERTAR_MS: 30000,
  TURNO_MS: 120000,
  TURNO_DESCONECTADO_MS: 12000,
  MANO_INICIAL: 7,
};

const err = (m) => ({ ok: false, error: m });
const ok = () => ({ ok: true });

class Partida {
  /**
   * @param {string[]} ids  identificadores de jugador, en orden de asiento (2-5)
   * @param {{ahora?:()=>number, azar?:(n:number)=>number}} [opts]
   */
  constructor(ids, opts = {}) {
    if (ids.length < 2 || ids.length > 5) throw new Error('Se necesitan entre 2 y 5 jugadores');
    this.ahora = opts.ahora || Date.now;
    this.azar = opts.azar || ((n) => randomInt(n));
    this.eventos = [];
    this.aid = 0;
    this.pendiente = null;
    this.favor = null;
    this.reinsercion = null;
    this.timer = null;
    this.ganador = null;
    this.descarte = [];
    this.fase = 'jugar';

    const N = ids.length;
    const base = [];
    const poner = (t, n) => { for (let i = 0; i < n; i++) base.push(t); };
    poner('ataque', 4); poner('pasar', 4); poner('favor', 4); poner('barajar', 4); poner('futuro', 5); poner('negar', 5);
    GATOS.forEach((g) => poner(g, 4));
    const extrasDesactivador = Math.max(2, 6 - N);
    const total = base.length + N + extrasDesactivador + (N - 1);
    const numeros = this.mezclar([...Array(total).keys()]);
    let k = 0;
    const carta = (tipo) => ({ id: 'k' + numeros[k++], tipo });

    this.jugadores = ids.map((id) => ({ id, mano: [], vivo: true, conectado: true, salio: false, stats: { jugadas: 0, negadas: 0, desactivados: 0, robos: 0 } }));
    const mazoBase = this.mezclar(base.map(carta));
    for (const j of this.jugadores) {
      for (let i = 0; i < CFG.MANO_INICIAL; i++) j.mano.push(mazoBase.pop());
      j.mano.push(carta('desactivador'));
    }
    const resto = mazoBase;
    for (let i = 0; i < extrasDesactivador; i++) resto.push(carta('desactivador'));
    for (let i = 0; i < N - 1; i++) resto.push(carta('bomba'));
    this.mazo = this.mezclar(resto); // índice 0 = parte superior
    this.turno = { idx: 0, resta: 1 };
    this.emitir('inicio', { orden: ids });
    this.emitir('turno', { pid: ids[0], turnos: 1 });
    this.armarTurno();
  }

  // ---------- utilidades ----------
  mezclar(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.azar(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  j(id) { return this.jugadores.find((x) => x.id === id); }
  actual() { return this.jugadores[this.turno.idx]; }
  vivos() { return this.jugadores.filter((x) => x.vivo); }
  emitir(e, pub = {}, priv = null) { this.eventos.push({ e, ...pub, priv }); }
  vaciarEventos() { const ev = this.eventos; this.eventos = []; return ev; }
  siguienteVivo(desde = this.turno.idx) {
    let i = desde;
    do { i = (i + 1) % this.jugadores.length; } while (!this.jugadores[i].vivo);
    return i;
  }

  armarTurno() {
    this.fase = 'jugar';
    const c = this.actual();
    this.timer = { tipo: 'turno', en: this.ahora() + (c.conectado ? CFG.TURNO_MS : CFG.TURNO_DESCONECTADO_MS) };
  }
  avanzar() {
    this.turno = { idx: this.siguienteVivo(), resta: 1 };
    this.emitir('turno', { pid: this.actual().id, turnos: 1 });
    this.armarTurno();
  }
  pasoTurno() { // se ha consumido un turno
    this.turno.resta--;
    if (this.turno.resta <= 0) this.avanzar();
    else { this.emitir('turno', { pid: this.actual().id, turnos: this.turno.resta }); this.armarTurno(); }
  }
  comprobarFin() {
    const v = this.vivos();
    if (v.length === 1 && this.fase !== 'fin') {
      this.fase = 'fin'; this.ganador = v[0].id; this.timer = null; this.pendiente = null; this.favor = null; this.reinsercion = null;
      this.emitir('victoria', { por: v[0].id });
      return true;
    }
    return this.fase === 'fin';
  }
  conectar(pid, conectado) {
    const p = this.j(pid); if (!p) return;
    p.conectado = conectado;
    if (this.fase === 'jugar' && this.actual().id === pid) this.armarTurno();
    if (this.fase === 'favor' && this.favor.de === pid) this.timer = { tipo: 'favor', en: this.ahora() + (conectado ? CFG.FAVOR_MS : 1500) };
    if (this.fase === 'reinsertar' && this.reinsercion.pid === pid && !conectado) this.timer = { tipo: 'reinsertar', en: this.ahora() + 1500 };
  }

  // ---------- acciones de jugador ----------
  jugar(pid, cartaIds, objetivoId, pedida) {
    if (this.fase !== 'jugar') return err('Ahora no puedes jugar cartas.');
    const yo = this.j(pid);
    if (!yo || !yo.vivo || this.actual().id !== pid) return err('No es tu turno.');
    if (!Array.isArray(cartaIds) || cartaIds.length < 1 || cartaIds.length > 3 || new Set(cartaIds).size !== cartaIds.length) return err('Selección de cartas no válida.');
    const cartas = cartaIds.map((id) => yo.mano.find((c) => c.id === id));
    if (cartas.some((c) => !c)) return err('Esa carta no está en tu mano.');
    let clase;
    if (cartas.length === 1) {
      const t = cartas[0].tipo;
      if (SIMPLES.includes(t)) clase = t;
      else if (t === 'negar') return err('VA A SER QUE NO solo se juega para frenar la acción de otro jugador.');
      else if (t === 'desactivador') return err('El DESACTIVADOR se usa solo al robar un GATITO EXPLOSIVO.');
      else return err('Las cartas de gato se juegan en parejas o en tríos del mismo gato.');
    } else {
      const t = cartas[0].tipo;
      if (!GATOS.includes(t) || cartas.some((c) => c.tipo !== t)) return err('Solo puedes combinar cartas del mismo gato.');
      clase = cartas.length === 2 ? 'pareja' : 'trio';
    }
    let objetivo = null;
    if (clase === 'favor' || clase === 'pareja' || clase === 'trio') {
      objetivo = this.j(objetivoId);
      if (!objetivo || !objetivo.vivo || objetivo.id === pid) return err('Elige a otro jugador que siga en la partida.');
      if (objetivo.mano.length === 0) return err('Ese jugador no tiene cartas.');
    }
    if (clase === 'trio' && !(typeof pedida === 'string' && TIPOS.includes(pedida) && pedida !== 'bomba')) return err('Elige qué carta quieres pedir.');

    yo.mano = yo.mano.filter((c) => !cartaIds.includes(c.id));
    this.descarte.push(...cartas);
    yo.stats.jugadas++;
    this.pendiente = { aid: ++this.aid, clase, actor: pid, cartas: cartas.map((c) => c.tipo), objetivo: objetivo ? objetivo.id : null, pedida: clase === 'trio' ? pedida : null, negadas: [] };
    this.fase = 'negar';
    this.timer = { tipo: 'negar', en: this.ahora() + CFG.NEGAR_MS };
    this.emitir('jugar', { aid: this.pendiente.aid, por: pid, cartas: this.pendiente.cartas, clase, objetivo: this.pendiente.objetivo, pedida: this.pendiente.pedida });
    return ok();
  }

  negar(pid, cartaId) {
    if (this.fase !== 'negar' || !this.pendiente) return err('Ahora no hay ninguna acción que frenar.');
    const yo = this.j(pid);
    if (!yo || !yo.vivo) return err('No puedes jugar cartas.');
    const c = yo.mano.find((x) => x.id === cartaId);
    if (!c || c.tipo !== 'negar') return err('Esa carta no es VA A SER QUE NO.');
    yo.mano = yo.mano.filter((x) => x.id !== cartaId);
    this.descarte.push(c);
    yo.stats.negadas++;
    const contra = this.pendiente.negadas.length ? this.pendiente.negadas[this.pendiente.negadas.length - 1] : this.pendiente.actor;
    this.pendiente.negadas.push(pid);
    this.timer = { tipo: 'negar', en: this.ahora() + CFG.NEGAR_EXT_MS };
    this.emitir('negar', { aid: this.pendiente.aid, por: pid, contra, cancelada: this.pendiente.negadas.length % 2 === 1 });
    return ok();
  }

  robar(pid, auto = false) {
    if (this.fase !== 'jugar') return err('Ahora no puedes robar.');
    const yo = this.j(pid);
    if (!yo || !yo.vivo || this.actual().id !== pid) return err('No es tu turno.');
    if (this.mazo.length === 0) return err('El mazo está vacío.');
    if (auto) this.emitir('auto', { por: pid });
    const carta = this.mazo.shift();
    yo.stats.robos++;
    if (carta.tipo !== 'bomba') {
      yo.mano.push(carta);
      this.emitir('robar', { por: pid }, { [pid]: { carta: carta.tipo } });
      this.pasoTurno();
      return ok();
    }
    const idx = yo.mano.findIndex((c) => c.tipo === 'desactivador');
    if (idx >= 0) {
      const [d] = yo.mano.splice(idx, 1);
      this.descarte.push(d);
      yo.stats.desactivados++;
      this.emitir('bomba', { por: pid, salvado: true });
      this.emitir('desactivador', { por: pid });
      this.fase = 'reinsertar';
      this.reinsercion = { pid, bomba: carta };
      this.timer = { tipo: 'reinsertar', en: this.ahora() + (yo.conectado ? CFG.REINSERTAR_MS : 1500) };
      return ok();
    }
    this.emitir('bomba', { por: pid, salvado: false });
    this.eliminar(pid, carta, false);
    return ok();
  }

  eliminar(pid, bomba, salio) {
    const p = this.j(pid);
    this.descarte.push(...p.mano);
    if (bomba) this.descarte.push(bomba);
    p.mano = []; p.vivo = false; p.salio = salio;
    this.emitir(salio ? 'salio' : 'eliminado', { por: pid });
    if (this.comprobarFin()) return;
    this.avanzar();
  }

  reinsertar(pid, pos) {
    if (this.fase !== 'reinsertar' || !this.reinsercion || this.reinsercion.pid !== pid) return err('Ahora no tienes que devolver ningún gatito.');
    if (!Number.isInteger(pos) || pos < 0 || pos > this.mazo.length) return err('Posición no válida.');
    this.mazo.splice(pos, 0, this.reinsercion.bomba);
    this.reinsercion = null;
    this.emitir('reinsertada', { por: pid });
    this.pasoTurno();
    return ok();
  }

  entregar(pid, cartaId) {
    if (this.fase !== 'favor' || !this.favor || this.favor.de !== pid) return err('Nadie te ha pedido un favor.');
    const de = this.j(pid), a = this.j(this.favor.a);
    const c = de.mano.find((x) => x.id === cartaId);
    if (!c) return err('Esa carta no está en tu mano.');
    de.mano = de.mano.filter((x) => x.id !== cartaId);
    a.mano.push(c);
    this.favor = null;
    this.emitir('entregar', { de: de.id, a: a.id }, { [de.id]: { carta: c.tipo }, [a.id]: { carta: c.tipo } });
    this.armarTurno();
    return ok();
  }

  // ---------- resolución ----------
  resolver() {
    const pd = this.pendiente; this.pendiente = null;
    if (pd.negadas.length % 2 === 1) {
      this.emitir('cancelada', { aid: pd.aid, por: pd.actor, clase: pd.clase });
      this.armarTurno();
      return;
    }
    const actor = this.j(pd.actor);
    const obj = pd.objetivo ? this.j(pd.objetivo) : null;
    switch (pd.clase) {
      case 'pasar':
        this.emitir('efecto', { aid: pd.aid, clase: 'pasar', por: pd.actor });
        this.pasoTurno();
        break;
      case 'ataque': {
        const turnos = (this.turno.resta > 1 ? this.turno.resta : 0) + 2;
        const idx = this.siguienteVivo();
        this.emitir('efecto', { aid: pd.aid, clase: 'ataque', por: pd.actor, objetivo: this.jugadores[idx].id, turnos });
        this.turno = { idx, resta: turnos };
        this.emitir('turno', { pid: this.jugadores[idx].id, turnos });
        this.armarTurno();
        break;
      }
      case 'favor':
        if (obj && obj.vivo && obj.mano.length > 0) {
          this.fase = 'favor'; this.favor = { de: obj.id, a: actor.id };
          this.timer = { tipo: 'favor', en: this.ahora() + (obj.conectado ? CFG.FAVOR_MS : 1500) };
          this.emitir('efecto', { aid: pd.aid, clase: 'favor', por: pd.actor, objetivo: obj.id });
        } else { this.emitir('sinefecto', { clase: 'favor', por: pd.actor }); this.armarTurno(); }
        break;
      case 'barajar':
        this.mezclar(this.mazo);
        this.emitir('efecto', { aid: pd.aid, clase: 'barajar', por: pd.actor });
        this.armarTurno();
        break;
      case 'futuro': {
        const top = this.mazo.slice(0, 3).map((c) => c.tipo);
        this.emitir('efecto', { aid: pd.aid, clase: 'futuro', por: pd.actor, n: top.length }, { [pd.actor]: { cartas: top } });
        this.armarTurno();
        break;
      }
      case 'pareja':
      case 'trio': {
        let robada = null;
        if (obj && obj.vivo && obj.mano.length > 0) {
          if (pd.clase === 'pareja') robada = obj.mano[this.azar(obj.mano.length)];
          else robada = obj.mano.find((c) => c.tipo === pd.pedida) || null;
        }
        if (robada) {
          obj.mano = obj.mano.filter((c) => c.id !== robada.id);
          actor.mano.push(robada);
          this.emitir('efecto', { aid: pd.aid, clase: pd.clase, por: pd.actor, objetivo: obj.id, gato: pd.cartas[0], pedida: pd.pedida, exito: true },
            { [actor.id]: { carta: robada.tipo }, [obj.id]: { carta: robada.tipo } });
        } else {
          this.emitir('efecto', { aid: pd.aid, clase: pd.clase, por: pd.actor, objetivo: obj ? obj.id : null, gato: pd.cartas[0], pedida: pd.pedida, exito: false });
        }
        this.armarTurno();
        break;
      }
      default: this.armarTurno();
    }
  }

  tick(ahora = this.ahora()) {
    if (!this.timer || ahora < this.timer.en) return false;
    const t = this.timer.tipo; this.timer = null;
    if (t === 'negar' && this.fase === 'negar') this.resolver();
    else if (t === 'favor' && this.fase === 'favor') {
      const de = this.j(this.favor.de);
      this.entregar(de.id, de.mano[this.azar(de.mano.length)].id);
    } else if (t === 'reinsertar' && this.fase === 'reinsertar') {
      this.reinsertar(this.reinsercion.pid, this.azar(this.mazo.length + 1));
    } else if (t === 'turno' && this.fase === 'jugar') this.robar(this.actual().id, true);
    return true;
  }

  // Un jugador abandona la partida.
  salir(pid) {
    const p = this.j(pid);
    if (!p || !p.vivo || this.fase === 'fin') return;
    const eraSuTurno = this.actual().id === pid;
    if (this.fase === 'reinsertar' && this.reinsercion.pid === pid) {
      this.mazo.splice(this.azar(this.mazo.length + 1), 0, this.reinsercion.bomba); this.reinsercion = null;
    }
    const huboNegar = this.fase === 'negar' && this.pendiente && this.pendiente.actor === pid;
    if (huboNegar) this.pendiente = null;
    if (this.fase === 'favor' && (this.favor.de === pid || this.favor.a === pid)) this.favor = null;
    this.eliminar2(pid);
    if (this.fase === 'fin') return;
    if (eraSuTurno) this.avanzar();
    else if (this.fase !== 'negar') this.armarTurno();
  }
  eliminar2(pid) { // eliminación por abandono sin avanzar turno
    const p = this.j(pid);
    this.descarte.push(...p.mano); p.mano = []; p.vivo = false; p.salio = true;
    this.emitir('salio', { por: pid });
    this.comprobarFin();
  }

  // ---------- vistas (privacidad) ----------
  vista(pid) {
    const yo = this.j(pid);
    const v = {
      fase: this.fase,
      turno: this.fase === 'fin' ? null : this.actual().id,
      turnos: this.turno.resta,
      mazo: this.mazo.length,
      descarte: { n: this.descarte.length, tope: this.descarte.slice(-3).map((c) => c.tipo) },
      jugadores: this.jugadores.map((x) => ({ id: x.id, n: x.mano.length, vivo: x.vivo, salio: x.salio })),
      pendiente: this.pendiente && {
        aid: this.pendiente.aid, clase: this.pendiente.clase, actor: this.pendiente.actor, cartas: this.pendiente.cartas,
        objetivo: this.pendiente.objetivo, pedida: this.pendiente.pedida, negadas: [...this.pendiente.negadas],
        ms: Math.max(0, (this.timer ? this.timer.en : 0) - this.ahora()),
      },
      favor: this.favor && { de: this.favor.de, a: this.favor.a },
      reinsertar: this.reinsercion && { pid: this.reinsercion.pid },
      mano: yo ? yo.mano.map((c) => ({ id: c.id, tipo: c.tipo })) : [],
      ganador: this.ganador,
    };
    if (this.fase === 'fin') v.stats = Object.fromEntries(this.jugadores.map((x) => [x.id, x.stats]));
    return v;
  }
}

module.exports = { Partida, CFG, TIPOS, GATOS };
