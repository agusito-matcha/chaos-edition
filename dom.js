// Utilidades mínimas de DOM (sin dependencias).
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
export const azar = (a, b) => a + Math.random() * (b - a);
export const elige = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Crea un elemento. props: class, html (solo contenido propio/SVG de confianza), on*, style (objeto), data (objeto), resto = atributos. */
export function h(tag, props = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'data') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

export function centro(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

export function copiar(texto) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto);
  return new Promise((res, rej) => {
    const t = h('textarea', { value: texto, style: { position: 'fixed', opacity: 0 } });
    t.value = texto; document.body.append(t); t.select();
    try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } t.remove();
  });
}
