// Componentes de carta (DOM).
import { h } from './dom.js';
import { CARTAS } from './textos.js';
import { arteCarta, reversoSVG } from './arte.js';

export function crearCarta(tipo, { id = '', desc = false, mini = false } = {}) {
  const c = CARTAS[tipo];
  return h('div', { class: `carta t-${tipo} k-${c.tipo}${mini ? ' mini' : ''}`, data: { tipo, id }, role: 'button', tabindex: '0', 'aria-label': c.nombre },
    h('div', { class: 'carta-marco' },
      h('span', { class: 'carta-icono', 'aria-hidden': 'true' }, c.icono),
      h('div', { class: 'carta-arte', html: arteCarta(tipo) }),
      h('div', { class: 'carta-nombre' }, c.nombre),
      desc ? h('div', { class: 'carta-desc' }, c.desc) : null));
}
export const crearReverso = () => h('div', { class: 'carta reverso', 'aria-hidden': 'true' }, h('div', { class: 'carta-marco', html: reversoSVG() }));
