// Arte original de CHAOS EDITION: gatos, avatares e ilustraciones de cartas dibujados en SVG.
// Todo el dibujo está hecho a mano en este archivo: no hay imágenes de terceros.
const INK = '#57351F', CREMA = '#FFF9F0', BEIGE = '#F3DFC0', NAR = '#F47B35', QUE = '#D85D24', CAL = '#8B5A35', AMA = '#FFC83D';

export const GATOS = {
  mandarina: { fur: NAR, dark: QUE, belly: CREMA, eye: INK, acc: 'lazo', marks: 'tabby' },
  canela: { fur: CAL, dark: INK, belly: BEIGE, eye: '#FFD36A', acc: 'bufanda', marks: 'tabby' },
  trufa: { fur: '#57351F', dark: '#3a2313', belly: BEIGE, eye: NAR, acc: 'gafas', marks: 'none' },
  flan: { fur: BEIGE, dark: '#D9B98A', belly: CREMA, eye: INK, acc: 'gorro', marks: 'patch' },
  brasa: { fur: QUE, dark: '#9c3f14', belly: '#FFE2B8', eye: '#FFD36A', acc: 'cascabel', marks: 'tabby' },
  churro: { fur: '#E8C79A', dark: CAL, belly: CREMA, eye: INK, acc: 'bigote', marks: 'patch' },
  nube: { fur: CREMA, dark: '#E6D2B0', belly: '#FFFFFF', eye: CAL, acc: 'cinta', marks: 'none' },
  tizon: { fur: '#3F2616', dark: '#2a190d', belly: CAL, eye: AMA, acc: 'antifaz', marks: 'none' },
};

const S = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const estrella = (x, y, r, c = AMA) => `<polygon points="${x},${y - r} ${x + r * 0.28},${y - r * 0.28} ${x + r},${y} ${x + r * 0.28},${y + r * 0.28} ${x},${y + r} ${x - r * 0.28},${y + r * 0.28} ${x - r},${y} ${x - r * 0.28},${y - r * 0.28}" fill="${c}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;

// ---- expresiones de la cara (cada una es un grupo; el CSS enseña solo la activa) ----
function caras(a) {
  const ojoB = (x, ry = 10, rx = 8) => `<ellipse class="ojo" cx="${x}" cy="62" rx="${rx}" ry="${ry}" fill="${CREMA}" ${S(2.5)}/>`;
  const pupila = (x, r = 4.6, y = 63) => `<circle class="pupila" cx="${x}" cy="${y}" r="${r}" fill="${a.eye}"/><circle cx="${x + 2}" cy="${y - 3}" r="1.5" fill="#fff"/>`;
  const boca = `<path d="M52 91 Q56 97 60 91 Q64 97 68 91" fill="none" ${S(3)}/>`;
  return {
    neutral: `${ojoB(44)}${ojoB(76)}${pupila(44)}${pupila(76)}${boca}`,
    sorpresa: `${ojoB(44, 12, 10)}${ojoB(76, 12, 10)}${pupila(44, 2.8, 62)}${pupila(76, 2.8, 62)}<path d="M33 46 Q44 38 55 46 M65 46 Q76 38 87 46" fill="none" ${S(3)}/><ellipse cx="60" cy="95" rx="6" ry="8" fill="${INK}"/><ellipse cx="60" cy="98" rx="3.5" ry="3" fill="${QUE}"/>`,
    alegria: `<path d="M35 64 Q44 50 53 64 M67 64 Q76 50 85 64" fill="none" ${S(4.5)}/><path d="M48 88 Q60 108 72 88Z" fill="${INK}" ${S(2.5)}/><path d="M54 98 Q60 106 66 98 Q60 94 54 98Z" fill="${QUE}"/><ellipse cx="30" cy="80" rx="7" ry="4.5" fill="${NAR}" opacity=".55"/><ellipse cx="90" cy="80" rx="7" ry="4.5" fill="${NAR}" opacity=".55"/>`,
    enfado: `<path d="M33 48 L54 58 M87 48 L66 58" fill="none" ${S(4.5)}/><path d="M36 64 Q44 56 52 64 Q44 70 36 64Z" fill="${AMA}" ${S(2.5)}/><path d="M68 64 Q76 56 84 64 Q76 70 68 64Z" fill="${AMA}" ${S(2.5)}/><rect x="42" y="58" width="4" height="12" rx="2" fill="${INK}"/><rect x="74" y="58" width="4" height="12" rx="2" fill="${INK}"/><path d="M47 96 L51 89 L55 96 L60 89 L65 96 L69 89 L73 96" fill="${CREMA}" ${S(2.5)}/><ellipse cx="30" cy="78" rx="7" ry="4" fill="${QUE}" opacity=".6"/><ellipse cx="90" cy="78" rx="7" ry="4" fill="${QUE}" opacity=".6"/>`,
    confusion: `${ojoB(44, 10, 8)}<ellipse class="ojo" cx="76" cy="64" rx="6" ry="7" fill="${CREMA}" ${S(2.5)}/>${pupila(44)}${pupila(77, 3.2, 63)}<path d="M33 48 L55 46" fill="none" ${S(3.5)}/><path d="M68 42 Q78 36 88 44" fill="none" ${S(3.5)}/><path d="M50 93 Q55 86 60 93 T70 93" fill="none" ${S(3)}/><text x="92" y="30" font-family="'Bagel Fat One',Impact,sans-serif" font-size="26" fill="${AMA}" stroke="${INK}" stroke-width="1.5">?</text>`,
    tristeza: `${ojoB(44, 10, 8)}${ojoB(76, 10, 8)}${pupila(44, 5, 66)}${pupila(76, 5, 66)}<path d="M33 52 L54 47 M87 52 L66 47" fill="none" ${S(3.5)}/><path d="M50 96 Q60 87 70 96" fill="none" ${S(3)}/><path d="M42 74 Q38 84 42 87 Q47 84 42 74Z" fill="${CREMA}" ${S(1.6)}/><path d="M78 74 Q74 84 78 87 Q83 84 78 74Z" fill="${CREMA}" ${S(1.6)}/>`,
    victoria: `${estrella(44, 62, 13)}${estrella(76, 62, 13)}<path d="M46 88 Q60 112 74 88Z" fill="${INK}" ${S(2.5)}/><path d="M53 100 Q60 108 67 100 Q60 95 53 100Z" fill="${QUE}"/><ellipse cx="29" cy="82" rx="7" ry="4.5" fill="${NAR}" opacity=".6"/><ellipse cx="91" cy="82" rx="7" ry="4.5" fill="${NAR}" opacity=".6"/>${estrella(14, 24, 7)}${estrella(106, 20, 6)}`,
    fuera: `<path d="M36 54 L52 70 M52 54 L36 70 M68 54 L84 70 M84 54 L68 70" fill="none" ${S(4.5)}/><path d="M48 92 H72" fill="none" ${S(3.5)}/><path d="M56 92 Q58 106 64 100 L64 92Z" fill="${QUE}" ${S(2)}/>`,
    sueno: `<path d="M36 62 Q44 70 52 62 M68 62 Q76 70 84 62" fill="none" ${S(4)}/><path d="M54 92 Q60 97 66 92" fill="none" ${S(3)}/><circle cx="82" cy="86" r="9" fill="${CREMA}" opacity=".75" ${S(1.8)}/><text x="88" y="22" font-family="'Bagel Fat One',Impact,sans-serif" font-size="20" fill="${CREMA}" stroke="${INK}" stroke-width="1.4">Z</text><text x="100" y="12" font-family="'Bagel Fat One',Impact,sans-serif" font-size="13" fill="${CREMA}" stroke="${INK}" stroke-width="1.2">z</text>`,
  };
}

function marcas(a) {
  if (a.marks === 'tabby') return `<path d="M60 27 V41 M49 29 L52 40 M71 29 L68 40 M18 62 H30 M19 72 L30 70 M102 62 H90 M101 72 L90 70" fill="none" stroke="${a.dark}" stroke-width="4.5" stroke-linecap="round"/>`;
  if (a.marks === 'patch') return `<path d="M62 26 C84 24 104 40 104 62 C98 66 86 62 80 50 C74 40 66 36 62 26Z" fill="${a.dark}" opacity=".75"/>`;
  return '';
}
function accesorio(nombre, a) {
  switch (nombre) {
    case 'lazo': return `<g transform="translate(84 26) rotate(18)"><path d="M0 0 L-16 -10 L-16 10Z M0 0 L16 -10 L16 10Z" fill="${AMA}" ${S(2.5)}/><circle r="5" fill="${QUE}" ${S(2)}/></g>`;
    case 'bufanda': return `<path d="M22 100 Q60 122 98 100 L102 112 Q60 134 18 112Z" fill="${NAR}" ${S(3)}/><path d="M80 112 L84 128 L96 124 L92 110Z" fill="${QUE}" ${S(2.5)}/><path d="M34 106 L36 118 M60 112 V124 M84 106 L82 118" stroke="${CREMA}" stroke-width="3" stroke-linecap="round"/>`;
    case 'gafas': return `<circle cx="44" cy="62" r="13" fill="${CREMA}" fill-opacity=".25" ${S(3.5)}/><circle cx="76" cy="62" r="13" fill="${CREMA}" fill-opacity=".25" ${S(3.5)}/><path d="M57 60 Q60 56 63 60" fill="none" ${S(3.5)}/>`;
    case 'gorro': return `<path d="M26 38 Q60 -2 94 38 Q60 30 26 38Z" fill="${NAR}" ${S(3)}/><path d="M28 36 Q60 28 92 36" fill="none" stroke="${CREMA}" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="8" r="7" fill="${CREMA}" ${S(2.5)}/>`;
    case 'cascabel': return `<path d="M30 98 Q60 114 90 98" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M30 98 Q60 114 90 98" fill="none" stroke="${QUE}" stroke-width="3.5" stroke-linecap="round"/><circle cx="60" cy="110" r="8" fill="${AMA}" ${S(2.5)}/><path d="M56 112 H64" ${S(2)}/>`;
    case 'bigote': return `<path d="M42 86 Q51 78 60 85 Q69 78 78 86 Q69 94 60 88 Q51 94 42 86Z" fill="${INK}"/>`;
    case 'cinta': return `<path d="M20 48 Q60 34 100 48 L99 56 Q60 42 21 56Z" fill="${AMA}" ${S(2.5)}/><circle cx="60" cy="45" r="5" fill="${QUE}" ${S(2)}/>`;
    case 'antifaz': return `<path d="M18 52 Q60 42 102 52 L100 72 Q80 78 66 68 Q60 64 54 68 Q40 78 20 72Z" fill="#2a190d" ${S(2.5)}/>`;
    default: return '';
  }
}

/** Interior de la cabeza. moods: lista de expresiones a incluir (todas en el avatar, una sola en las cartas). */
function interior(id, moods, accOverride, activa) {
  const a = GATOS[id] || GATOS.mandarina;
  const c = caras(a);
  const acc = accOverride === undefined ? a.acc : accOverride;
  const mascara = acc === 'antifaz' ? accesorio('antifaz', a) : '';
  const frente = acc === 'antifaz' ? '' : accesorio(acc, a);
  return `<path d="M22 54 L16 10 L52 30Z" fill="${a.fur}" ${S(3.5)}/><path d="M98 54 L104 10 L68 30Z" fill="${a.fur}" ${S(3.5)}/>
<path d="M25 44 L23 22 L42 33Z" fill="#F4A77A" opacity=".85"/><path d="M95 44 L97 22 L78 33Z" fill="#F4A77A" opacity=".85"/>
<path d="M14 66 C14 36 34 24 60 24 S106 36 106 66 C106 92 86 106 60 106 S14 92 14 66Z" fill="${a.fur}" ${S(4)}/>
${marcas(a)}<ellipse cx="60" cy="84" rx="21" ry="15" fill="${a.belly}" opacity=".95"/>
<path d="M54 77 H66 L60 84Z" fill="${QUE}" ${S(2)}/>
<path d="M20 82 L2 78 M20 88 L4 92 M100 82 L118 78 M100 88 L116 92" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
${mascara}${moods.map((m) => `<g class="m m-${m}${m === activa ? ' on' : ''}">${c[m]}</g>`).join('')}${frente}`;
}

const TODAS = ['neutral', 'sorpresa', 'alegria', 'enfado', 'confusion', 'tristeza', 'victoria', 'fuera', 'sueno'];
/** Avatar completo (gato con expresiones intercambiables mediante data-mood). */
export function gato(id, mood = 'neutral') {
  return `<svg class="gato" data-mood="${mood}" viewBox="0 0 120 130" aria-hidden="true">${interior(id, TODAS)}</svg>`;
}
const cab = (id, mood, x, y, s = 1, acc) => `<g transform="translate(${x} ${y}) scale(${s})">${interior(id, [mood], acc, mood)}</g>`;

// ---- ilustraciones de carta (viewBox 200 x 150) ----
const ARTE = {
  bomba: () => `<ellipse cx="100" cy="142" rx="50" ry="6" fill="#000" opacity=".2"/>
<path d="M56 62 L52 22 L90 46Z M144 62 L148 22 L110 46Z" fill="#3a2313" ${S(4)}/>
<circle cx="100" cy="88" r="54" fill="#3a2313" ${S(4)}/><ellipse cx="76" cy="58" rx="16" ry="7" fill="#fff" opacity=".2" transform="rotate(-30 76 58)"/>
<ellipse cx="80" cy="86" rx="11" ry="14" fill="${AMA}" ${S(2.5)}/><ellipse cx="120" cy="86" rx="11" ry="14" fill="${AMA}" ${S(2.5)}/>
<ellipse cx="80" cy="87" rx="3" ry="11" fill="${INK}"/><ellipse cx="120" cy="87" rx="3" ry="11" fill="${INK}"/>
<ellipse cx="100" cy="116" rx="10" ry="12" fill="${NAR}" ${S(3)}/><ellipse cx="100" cy="119" rx="5" ry="5" fill="${QUE}"/>
<path d="M100 36 Q104 18 126 18" fill="none" stroke="${BEIGE}" stroke-width="6" stroke-linecap="round"/><path d="M100 36 Q104 18 126 18" fill="none" ${S(1.6)} opacity=".5"/>
<g class="chispa" style="transform-origin:128px 16px">${estrella(128, 16, 16)}<circle cx="128" cy="16" r="5" fill="${NAR}"/></g>`,
  desactivador: () => `<ellipse cx="100" cy="142" rx="40" ry="5" fill="#000" opacity=".18"/>
<path d="M80 40 L82 18 L96 34Z M120 40 L118 18 L104 34Z" fill="${INK}" ${S(3)}/>
<rect x="70" y="44" width="60" height="92" rx="24" fill="${QUE}" ${S(4)}/><rect x="70" y="80" width="60" height="30" fill="${BEIGE}" ${S(3)}/>
<ellipse cx="100" cy="98" rx="8" ry="7" fill="${CAL}"/><circle cx="88" cy="88" r="3.4" fill="${CAL}"/><circle cx="96" cy="84" r="3.4" fill="${CAL}"/><circle cx="104" cy="84" r="3.4" fill="${CAL}"/><circle cx="112" cy="88" r="3.4" fill="${CAL}"/>
<rect x="88" y="32" width="24" height="16" rx="5" fill="${INK}"/><path d="M82 30 H122 L130 42" fill="none" ${S(5)}/>
<path d="M126 44 Q162 44 152 82" fill="none" ${S(7)}/><path d="M144 80 H160 L152 96Z" fill="${INK}"/>
<g class="espuma">${[[162, 108, 15], [180, 98, 11], [150, 120, 13], [174, 122, 10], [188, 114, 8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${CREMA}" ${S(2.4)}/>`).join('')}</g>${estrella(36, 56, 11)}${estrella(48, 100, 7)}`,
  pasar: () => `<path d="M8 52 H56 M0 76 H46 M14 100 H60" stroke="${BEIGE}" stroke-width="6" stroke-linecap="round" opacity=".85"/>
${cab('canela', 'alegria', 40, 14, 0.9)}
<path d="M132 36 L162 75 L132 114 M156 36 L186 75 L156 114" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M132 36 L162 75 L132 114 M156 36 L186 75 L156 114" fill="none" stroke="${CREMA}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`,
  ataque: () => `<polygon points="100,2 116,38 152,18 140,56 190,60 148,84 176,124 132,108 118,146 100,114 82,146 68,108 24,124 52,84 10,60 60,56 48,18 84,38" fill="${AMA}" ${S(3)}/>
<path d="M100 66 C68 66 60 104 80 120 C92 130 108 130 120 120 C140 104 132 66 100 66Z" fill="${NAR}" ${S(4)}/>
${[[62, 62], [86, 42], [114, 42], [138, 62]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="14" fill="${NAR}" ${S(4)}/><path d="M${x - 4} ${y - 12} L${x} ${y - 26} L${x + 4} ${y - 12}Z" fill="${CREMA}" ${S(2)}/>`).join('')}
<ellipse cx="100" cy="106" rx="12" ry="9" fill="${QUE}"/>`,
  favor: () => `${cab('churro', 'sorpresa', 24, 12, 1)}
<path d="M158 52 C158 38 140 34 140 48 C140 34 122 38 122 52 C122 66 140 76 140 84 C140 76 158 66 158 52Z" transform="translate(6 -6)" fill="${QUE}" ${S(3)}/>
<g transform="rotate(14 150 110)"><rect x="132" y="84" width="38" height="52" rx="7" fill="${CREMA}" ${S(3)}/>${estrella(151, 110, 11)}</g>
<ellipse cx="152" cy="138" rx="26" ry="12" fill="${CAL}" ${S(3)}/><circle cx="132" cy="132" r="6" fill="${CAL}" ${S(2.5)}/><circle cx="148" cy="128" r="6" fill="${CAL}" ${S(2.5)}/><circle cx="164" cy="130" r="6" fill="${CAL}" ${S(2.5)}/>`,
  barajar: () => `<g transform="rotate(-24 100 80)"><rect x="66" y="26" width="64" height="92" rx="9" fill="${BEIGE}" ${S(3.5)}/></g><g transform="rotate(24 100 80)"><rect x="70" y="26" width="64" height="92" rx="9" fill="${CAL}" ${S(3.5)}/></g><rect x="68" y="24" width="64" height="94" rx="9" fill="${NAR}" ${S(3.5)}/>
<ellipse cx="100" cy="72" rx="14" ry="11" fill="${CREMA}" opacity=".9"/>${estrella(100, 72, 9, QUE)}
<path d="M26 110 A66 66 0 0 1 78 12" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M26 110 A66 66 0 0 1 78 12" fill="none" stroke="${CREMA}" stroke-width="6" stroke-linecap="round"/>
<path d="M174 40 A66 66 0 0 1 122 138" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M174 40 A66 66 0 0 1 122 138" fill="none" stroke="${CREMA}" stroke-width="6" stroke-linecap="round"/>
<path d="M66 6 L86 14 L72 30Z" fill="${CREMA}" ${S(2.5)}/><path d="M134 144 L114 136 L128 120Z" fill="${CREMA}" ${S(2.5)}/>`,
  futuro: () => `<circle cx="100" cy="70" r="52" fill="${AMA}" opacity=".25"/><path d="M62 128 Q100 104 138 128 L150 146 H50Z" fill="${INK}" ${S(3)}/>
<circle cx="100" cy="70" r="46" fill="${BEIGE}" ${S(4)}/><circle cx="100" cy="70" r="38" fill="${CAL}" opacity=".7"/>
<ellipse cx="100" cy="70" rx="26" ry="16" fill="${AMA}" ${S(3)}/><ellipse cx="100" cy="70" rx="6" ry="16" fill="${INK}"/>
<path d="M70 44 Q80 34 92 32" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>${estrella(28, 40, 11)}${estrella(172, 52, 9)}${estrella(160, 112, 7)}${estrella(36, 108, 7)}`,
  negar: () => `<circle cx="100" cy="76" r="54" fill="${CREMA}" ${S(4)}/>
<path d="M100 56 C80 56 76 86 88 98 C96 106 106 106 114 98 C126 86 120 56 100 56Z" fill="${CAL}" ${S(3)}/>${[[74, 56], [90, 38], [110, 38], [126, 56]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="10" fill="${CAL}" ${S(3)}/>`).join('')}
<circle cx="100" cy="76" r="54" fill="none" stroke="${QUE}" stroke-width="15"/><path d="M62 114 L138 38" stroke="${QUE}" stroke-width="15" stroke-linecap="round"/>
<circle cx="100" cy="76" r="61" fill="none" ${S(3)}/>`,
  gato_pegon: () => `<path d="M170 44 L192 28 M178 70 L200 68 M170 98 L192 110" stroke="${AMA}" stroke-width="6" stroke-linecap="round"/>
${cab('mandarina', 'enfado', 8, 14, 1, 'ninguno')}
<circle cx="150" cy="84" r="28" fill="${NAR}" ${S(4)}/><path d="M136 70 V96 M150 66 V100 M164 70 V96" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>${estrella(182, 26, 10)}`,
  gato_ninja: () => `<circle cx="40" cy="128" r="16" fill="${BEIGE}" opacity=".7"/><circle cx="62" cy="136" r="12" fill="${BEIGE}" opacity=".6"/><circle cx="176" cy="132" r="14" fill="${BEIGE}" opacity=".6"/>
${cab('tizon', 'neutral', 24, 12, 1)}
<g transform="translate(160 54) rotate(20)"><path d="M0 -26 L7 -7 L26 0 L7 7 L0 26 L-7 7 L-26 0 L-7 -7Z" fill="${CAL}" ${S(3)}/><circle r="6" fill="${BEIGE}" ${S(2)}/></g><path d="M126 54 H150 M120 66 H146" stroke="${BEIGE}" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,
  gato_mago: () => `${cab('flan', 'alegria', 40, 22, 1, 'ninguno')}
<path d="M62 52 L104 -4 L142 52Z" fill="${INK}" ${S(4)}/><ellipse cx="102" cy="53" rx="46" ry="9" fill="${INK}" ${S(4)}/><path d="M66 46 Q102 56 138 46" fill="none" stroke="${AMA}" stroke-width="6"/>${estrella(100, 28, 7)}${estrella(114, 40, 4)}
${estrella(24, 40, 12)}${estrella(176, 70, 10)}${estrella(26, 100, 7)}${estrella(180, 118, 7)}<circle cx="14" cy="70" r="3" fill="${AMA}"/><circle cx="190" cy="40" r="3" fill="${AMA}"/>`,
  gato_dormilon: () => `<circle cx="168" cy="40" r="22" fill="${AMA}" ${S(3)}/>
${cab('nube', 'sueno', 34, 14, 1.02, 'cinta')}${estrella(22, 36, 6)}${estrella(180, 110, 7)}`,
  gato_cabreado: () => `<path d="M30 140 Q10 90 40 70 Q36 100 56 90 Q56 50 86 30 Q84 74 110 56 Q140 36 150 70 Q172 62 170 140Z" fill="${NAR}" opacity=".85" ${S(3)}/>
<path d="M50 140 Q40 112 62 100 Q66 120 84 110 Q96 90 114 100 Q132 90 140 140Z" fill="${AMA}" opacity=".9"/>
${cab('brasa', 'enfado', 38, 16, 0.96, 'ninguno')}<circle cx="22" cy="40" r="10" fill="${BEIGE}" opacity=".7"/><circle cx="182" cy="34" r="12" fill="${BEIGE}" opacity=".7"/>`,
};

export function arteCarta(tipo) {
  return `<svg class="arte-svg" viewBox="0 0 200 150" aria-hidden="true">${(ARTE[tipo] || ARTE.pasar)()}</svg>`;
}

export function reversoSVG() {
  return `<svg class="reverso-svg" viewBox="0 0 100 140" aria-hidden="true"><path d="M-10 70 Q30 20 50 70 T110 70" fill="none" stroke="${QUE}" stroke-width="9" opacity=".7"/><path d="M-10 100 Q30 50 50 100 T110 100" fill="none" stroke="${QUE}" stroke-width="7" opacity=".5"/><path d="M-10 40 Q30 -10 50 40 T110 40" fill="none" stroke="${QUE}" stroke-width="7" opacity=".5"/>
<ellipse cx="50" cy="80" rx="19" ry="15" fill="${BEIGE}" stroke="${INK}" stroke-width="3.5"/>${[[28, 62], [42, 52], [58, 52], [72, 62]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="8.5" fill="${BEIGE}" stroke="${INK}" stroke-width="3.5"/>`).join('')}<ellipse cx="50" cy="82" rx="9" ry="7" fill="${QUE}"/>
${estrella(16, 20, 7, BEIGE)}${estrella(84, 120, 7, BEIGE)}${estrella(86, 24, 4, AMA)}${estrella(14, 118, 4, AMA)}</svg>`;
}

/** Mascota del logotipo: gatito-bomba con mecha. */
export function logoMascota() {
  return `<svg class="logo-mascota" viewBox="0 0 200 170" aria-hidden="true">${ARTE.bomba().replace('viewBox', 'viewBox')}</svg>`;
}
export const COLORES = { INK, CREMA, BEIGE, NAR, QUE, CAL, AMA };
