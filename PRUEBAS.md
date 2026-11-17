# Qué se ha probado de verdad (y qué no)

Fecha de las pruebas: 17 de noviembre de 2026. Entorno: Node.js 22 y Chromium (Playwright), **sin conexión a Internet**.

## ✅ Probado y superado
**Reglas del juego** (`test/motor.test.js`, 14 pruebas, `npm test`)
- Composición del mazo con 2, 3, 4 y 5 jugadores.
- **400 partidas completas simuladas** con jugadas aleatorias (incluidas jugadas inválidas): no se pierden ni se duplican cartas, el número de gatitos explosivos es siempre correcto, toda partida termina con un único ganador, y una acción inválida nunca altera el estado.
- Cada carta con efectos reales: GATITO EXPLOSIVO, DESACTIVADOR + reinserción, PASAR TURNO, ATAQUE (y acumulación), FAVOR, BARAJAR, VER EL FUTURO (solo lo ve quien lo juega), VA A SER QUE NO (cadena de noes), parejas y tríos de gatos.
- No se puede jugar fuera de turno, ni cartas ajenas, ni la misma carta dos veces.
- Abandonos durante favor, reinserción o jugada pendiente; temporizadores de inactividad.

**Red y servidor** (`test/red.test.js`, 6 pruebas, WebSockets reales)
- Crear/unirse a salas, códigos inválidos, nombres saneados y sin duplicados, límite de 5 jugadores, herencia de anfitrión.
- Partida completa de 3 clientes y revancha; eventos con identificador único sin repeticiones.
- **Privacidad:** cada mensaje saliente del servidor se inspecciona: ninguna carta de la mano de otro ni del mazo se filtra. Se comprobó con una «prueba de mutación» (se introdujo una fuga a propósito y 3 pruebas la detectaron).
- Reconexión con token secreto, token falso rechazado, segunda pestaña expulsa a la primera, abandono en partida.
- Acciones repetidas rechazadas; mensajes ilegibles; origen (Origin) ajeno rechazado; rutas fuera de `public/` bloqueadas.

**Navegador real** (`test/navegador.manual.js`, 19 comprobaciones, 3 navegadores a la vez)
- Menú → crear sala → 2 jugadores se unen con el código → sala de espera → partida → todas las cartas jugadas con la interfaz → bomba desactivada y reinsertada → eliminación → victoria → resultados → «Volver a jugar».
- VER EL FUTURO: el jugador ve 3 cartas reveladas y su rival 0 en pantalla.
- Cero errores de JavaScript en consola. Ningún texto de la interfaz con la palabra inglesa prohibida.
- Revisión visual de capturas: menú, sala, partida, animaciones de varias cartas, resultados, y vista de móvil (390×780).

## ✅ Versión de UN SOLO ARCHIVO (sin servidor) — `test/mqtt.test.js` y `test/p2p.manual.js`
Contra un **broker MQTT local de pruebas** (`test/mini-broker.js`), abriendo `dist/index.html` **directamente desde el disco** en 4 navegadores:
- Cliente MQTT: publicar/suscribir, comodines, mensajes de 12 KB con acentos, mensaje de «última voluntad», fallo rápido sin broker.
- Anfitrión crea sala; código inexistente → error claro; 2 invitados entran; partida completa con bots hasta el final; resultados; «Volver a jugar».
- **Cifrado:** los 15+ mensajes que pasaron por el broker se inspeccionaron: ninguno contiene cartas, nombres, tokens ni estados en claro.
- Corte de conexión de un invitado a mitad de partida → reconecta solo y sigue; recarga de página de un invitado → vuelve a su sala; el anfitrión sale → los invitados vuelven al menú con aviso.
- Sin errores de JavaScript.

## ⚠️ NO probado
- **Brokers MQTT públicos reales** (`broker.emqx.io`, `test.mosquitto.org`, `broker.hivemq.com`): mi entorno no tiene Internet. Las direcciones y puertos de los dos primeros las comprobé en listados públicos de brokers; el de HiveMQ (wss, puerto 8884) **no pude confirmarlo**. El cliente MQTT sigue el estándar 3.1.1, pero no lo he visto funcionar contra ellos.
- Ataques activos al cifrado (repetición/falsificación de mensajes): están implementados (AES-GCM autenticado + números de secuencia), pero no hay una prueba automática específica.
- Servir el archivo desde GitHub Pages / Netlify (HTTPS real).
- El resto de lo ya indicado abajo (Chromebooks físicos, rendimiento real, audio, tipografías, táctil). (no pude hacerlo desde mi entorno)
- **Publicación real en Render/Internet**: no hay publicación hecha ni dirección web. La guía está basada en la documentación de Render, no en haberla seguido.
- **Varios Chromebooks físicos**: se probó con varios navegadores en una misma máquina, conectados por red local al servidor. El protocolo es el mismo, pero no se ha probado en dispositivos distintos ni con latencia real de Internet.
- **Rendimiento en un Chromebook modesto**: el diseño es ligero (límite de 240 partículas, modo de efectos reducidos), pero no medí fluidez real en hardware real.
- **Audio**: los sonidos están implementados con Web Audio y la lógica se ejecuta sin errores, pero en un entorno sin altavoces no puedo comprobar cómo suenan.
- **Tipografías de Google Fonts**: aquí no cargaban (sin Internet); las capturas usan la fuente de reserva. Con conexión, los títulos se verán con *Bagel Fat One* (más gruesa y redondeada).
- **Pantallas táctiles reales** (se probó el tamaño móvil, no el toque).
- Uso prolongado (horas) ni muchas salas simultáneas.

## Limitaciones conocidas del diseño
- Las partidas viven en la memoria del servidor: si se reinicia (en el plan gratuito de Render puede ocurrir) se pierden.
- Sin cuentas de usuario ni estadísticas persistentes (decisión de privacidad: solo se guarda el nombre y el avatar en tu navegador).
