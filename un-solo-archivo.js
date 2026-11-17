'use strict';
// Genera dist/index.html: el juego completo (interfaz + motor de reglas + cliente MQTT) en UN SOLO ARCHIVO,
// listo para subir a GitHub Pages o Netlify Drop. Uso: node build/un-solo-archivo.js
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');
const MODULOS = ['dom', 'textos', 'arte', 'sonido', 'efectos', 'cartas', 'mqtt', 'p2p', 'animaciones', 'pantallas', 'main'];
const SERVIDOR = ['azar', 'game', 'sala'];

function envolverES(nombre) {
  let src = leer('public', 'js', nombre + '.js').replace(/'\.\/red\.js'/g, "'./p2p.js'");
  const nombres = [];
  src = src.replace(/^import\s+(.+?)\s+from\s+'\.\/([\w-]+)\.js';?[ \t]*$/gm, (m, que, mod) => {
    if (!MODULOS.includes(mod)) throw new Error(`${nombre}: importa un módulo desconocido ${mod}`);
    if (que.startsWith('* as ')) return `const ${que.slice(5).trim()} = __M.${mod};`;
    return `const ${que.replace(/\s+as\s+/g, ': ')} = __M.${mod};`;
  });
  src = src.replace(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (m, n) => { nombres.push(n); return m.replace(/^export\s+/, ''); });
  if (/^\s*export\s/m.test(src)) throw new Error(`${nombre}: «export» sin transformar`);
  if (/^\s*import\s/m.test(src)) throw new Error(`${nombre}: «import» sin transformar`);
  return `__M.${nombre} = (() => {\n${src}\nreturn { ${nombres.join(', ')} };\n})();`;
}
function envolverCJS(nombre) {
  const src = leer('server', nombre + '.js').replace(/require\('\.\/(\w+)'\)/g, "__S.$1");
  if (/require\(/.test(src.replace(/require\('node:crypto'\)/g, ''))) throw new Error(`${nombre}: require inesperado`);
  return `__S.${nombre} = (() => { const module = { exports: {} }; const exports = module.exports; const require = () => { throw new Error('require no disponible en el navegador'); };\n${src}\nreturn module.exports; })();`;
}

const js = [
  "'use strict';", 'const __M = {}; const __S = {};',
  ...SERVIDOR.map(envolverCJS),
  'globalThis.__CHAOS_SERVIDOR = { Salas: __S.sala.Salas };',
  ...MODULOS.map(envolverES),
].join('\n\n').replace(/<\/script/gi, '<\\/script');

let html = leer('public', 'index.html');
const css = leer('public', 'css', 'estilo.css');
const favicon = 'data:image/svg+xml;base64,' + Buffer.from(leer('public', 'favicon.svg')).toString('base64');
html = html
  .replace('<link rel="icon" href="favicon.svg" type="image/svg+xml">', `<link rel="icon" href="${favicon}" type="image/svg+xml">`)
  .replace('<link rel="stylesheet" href="css/estilo.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="config.js"></script>', '<script>window.CHAOS_P2P = true; window.CHAOS_CONFIG = { servidor: "" };</script>')
  .replace('<script type="module" src="js/main.js"></script>', () => `<script>\n${js}\n</script>`);
if (/src="js\/|href="css\/|config\.js/.test(html)) throw new Error('quedan referencias a archivos externos');

fs.mkdirSync(path.join(RAIZ, 'dist'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'dist', 'index.html'), html);
console.log(`dist/index.html generado: ${(html.length / 1024).toFixed(0)} KB (un solo archivo)`);
