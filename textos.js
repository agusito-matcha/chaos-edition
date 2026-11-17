// Todos los textos visibles del juego, en español de España.
export const CARTAS = {
  bomba: { nombre: 'GATITO EXPLOSIVO', icono: '💥', desc: 'Si lo robas y no tienes un DESACTIVADOR, quedas eliminado de la partida.', tipo: 'peligro' },
  desactivador: { nombre: 'DESACTIVADOR', icono: '🧯', desc: 'Te salva al robar un GATITO EXPLOSIVO. Después lo devuelves al mazo en el sitio que quieras.', tipo: 'salvacion' },
  pasar: { nombre: 'PASAR TURNO', icono: '⏭️', desc: 'Terminas tu turno sin robar carta.', tipo: 'accion' },
  ataque: { nombre: 'ATAQUE', icono: '⚔️', desc: 'Terminas tu turno sin robar y el siguiente jugador tiene que jugar 2 turnos seguidos.', tipo: 'accion' },
  favor: { nombre: 'FAVOR', icono: '🤝', desc: 'Elige a otro jugador: tiene que darte una carta de su mano (la que él prefiera).', tipo: 'accion' },
  barajar: { nombre: 'BARAJAR', icono: '🔀', desc: 'Mezcla el mazo de robo para que nadie sepa qué viene.', tipo: 'accion' },
  futuro: { nombre: 'VER EL FUTURO', icono: '🔮', desc: 'Mira en secreto las 3 primeras cartas del mazo. Los demás no ven nada.', tipo: 'accion' },
  negar: { nombre: 'VA A SER QUE NO', icono: '🚫', desc: 'Cancela la acción de otro jugador. Se juega en cualquier momento, cuando alguien juega una carta. ¡Hasta se puede responder a otro «VA A SER QUE NO»!', tipo: 'reaccion' },
  gato_pegon: { nombre: 'GATO PEGÓN', icono: '👊', desc: 'Carta de gato. Dos iguales: robas una carta al azar a otro jugador. Tres iguales: le pides una carta concreta.', tipo: 'gato' },
  gato_ninja: { nombre: 'GATO NINJA', icono: '🥷', desc: 'Carta de gato. Dos iguales: robas una carta al azar a otro jugador. Tres iguales: le pides una carta concreta.', tipo: 'gato' },
  gato_mago: { nombre: 'GATO MAGO', icono: '🪄', desc: 'Carta de gato. Dos iguales: robas una carta al azar a otro jugador. Tres iguales: le pides una carta concreta.', tipo: 'gato' },
  gato_dormilon: { nombre: 'GATO DORMILÓN', icono: '😴', desc: 'Carta de gato. Dos iguales: robas una carta al azar a otro jugador. Tres iguales: le pides una carta concreta.', tipo: 'gato' },
  gato_cabreado: { nombre: 'GATO CABREADO', icono: '😾', desc: 'Carta de gato. Dos iguales: robas una carta al azar a otro jugador. Tres iguales: le pides una carta concreta.', tipo: 'gato' },
};
export const ORDEN_AYUDA = ['bomba', 'desactivador', 'pasar', 'ataque', 'favor', 'barajar', 'futuro', 'negar', 'gato_pegon', 'gato_ninja', 'gato_mago', 'gato_dormilon', 'gato_cabreado'];
export const nombreCarta = (t) => (CARTAS[t] ? CARTAS[t].nombre : t);
export const esGato = (t) => !!CARTAS[t] && CARTAS[t].tipo === 'gato';

export const AVATARES = [
  { id: 'mandarina', nombre: 'Mandarina' }, { id: 'canela', nombre: 'Canela' }, { id: 'trufa', nombre: 'Trufa' }, { id: 'flan', nombre: 'Flan' },
  { id: 'brasa', nombre: 'Brasa' }, { id: 'churro', nombre: 'Churro' }, { id: 'nube', nombre: 'Nube' }, { id: 'tizon', nombre: 'Tizón' },
];

export const REGLAS = [
  ['🎯', 'El objetivo', 'Ser el último jugador que sigue en la partida. Roba cartas con cuidado: en el mazo se esconden GATITOS EXPLOSIVOS.'],
  ['🃏', 'Tu turno', 'Puedes jugar todas las cartas de acción que quieras y, para terminar, tienes que ROBAR una carta del mazo.'],
  ['💥', 'Si sale un gatito', 'Si robas un GATITO EXPLOSIVO y tienes un DESACTIVADOR, lo usas y escondes el gatito en el mazo donde quieras. Si no, quedas eliminado.'],
  ['🚫', 'Frenar jugadas', 'Cada vez que alguien juega una carta hay unos segundos para responder con VA A SER QUE NO y cancelarla. ¡Y también se puede cancelar un «no»!'],
  ['🐱', 'Combinar gatos', 'Dos cartas iguales de gato: robas una carta al azar a otro jugador. Tres iguales: le pides una carta concreta.'],
  ['🕹️', 'Cómo se juega', 'Pulsa una carta para seleccionarla y después «Jugar». Para robar, pulsa el mazo o «Robar carta». Las cartas de gato se seleccionan de dos en dos o de tres en tres.'],
];

/** Frase para el historial a partir de un evento. nombre(pid) devuelve el nombre del jugador. */
export function frase(e, nombre) {
  const N = nombre;
  switch (e.e) {
    case 'inicio': return '¡Empieza la partida! Se reparten las cartas.';
    case 'turno': return e.turnos > 1 ? `Turno de ${N(e.pid)} (le quedan ${e.turnos} turnos)` : `Turno de ${N(e.pid)}`;
    case 'robar': return `${N(e.por)} roba una carta`;
    case 'auto': return `${N(e.por)} tardaba demasiado: roba automáticamente`;
    case 'jugar': {
      const c = e.cartas.length > 1 ? `${e.cartas.length} × ${nombreCarta(e.cartas[0])}` : nombreCarta(e.cartas[0]);
      const o = e.objetivo ? ` contra ${N(e.objetivo)}` : '';
      const p = e.pedida ? ` (pide ${nombreCarta(e.pedida)})` : '';
      return `${N(e.por)} juega ${c}${o}${p}`;
    }
    case 'negar': return e.contra ? `🚫 ${N(e.por)} dice: ¡VA A SER QUE NO! (contra ${N(e.contra)})` : `🚫 ${N(e.por)} dice: ¡VA A SER QUE NO!`;
    case 'cancelada': return `La jugada de ${N(e.por)} queda cancelada`;
    case 'efecto': return fraseEfecto(e, N);
    case 'sinefecto': return `La jugada de ${N(e.por)} no tiene efecto`;
    case 'bomba': return `💥 ¡${N(e.por)} ha robado un GATITO EXPLOSIVO!`;
    case 'desactivador': return `🧯 ${N(e.por)} usa un DESACTIVADOR y se salva`;
    case 'reinsertada': return `${N(e.por)} esconde el gatito en el mazo`;
    case 'eliminado': return `☠️ ${N(e.por)} se ha quedado eliminado`;
    case 'salio': return `${N(e.por)} ha abandonado la partida`;
    case 'entregar': return `${N(e.de)} entrega una carta a ${N(e.a)}`;
    case 'victoria': return `🏆 ¡${N(e.por)} gana la partida!`;
    default: return '';
  }
}
function fraseEfecto(e, N) {
  switch (e.clase) {
    case 'pasar': return `${N(e.por)} termina su turno sin robar`;
    case 'ataque': return `⚔️ ${N(e.objetivo)} tendrá que jugar ${e.turnos} turnos`;
    case 'favor': return `${N(e.por)} pide un favor a ${N(e.objetivo)}`;
    case 'barajar': return `${N(e.por)} baraja el mazo`;
    case 'futuro': return `${N(e.por)} mira el futuro`;
    case 'pareja': return e.exito ? `${N(e.por)} roba una carta a ${N(e.objetivo)}` : `${N(e.por)} no consigue nada`;
    case 'trio': return e.exito ? `${N(e.por)} consigue ${nombreCarta(e.pedida)} de ${N(e.objetivo)}` : `${N(e.objetivo)} no tiene ${nombreCarta(e.pedida)}`;
    default: return '';
  }
}

export const TXT = {
  lema: 'Gatitos, bombas y muchísimo caos',
  cargando: ['Encendiendo mechas…', 'Peinando a los gatos…', 'Barajando el caos…', 'Escondiendo bombas…'],
  reconectando: 'Se ha perdido la conexión. Reconectando…',
};
