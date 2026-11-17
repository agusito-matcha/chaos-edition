# 🐱💥 CHAOS EDITION

Videojuego de cartas multijugador online (2–5 jugadores) con gatitos, bombas y muchísimo caos.
Se juega desde el navegador (Chromebook, ordenador o tablet) con un código de sala. Todo en español de España.

- **Para jugar:** lee `COMO_JUGAR.md`.
- **Para publicarlo en Internet:** lee `COMO_PUBLICAR_EL_JUEGO.md`.
- **Versión de UN SOLO ARCHIVO para GitHub Pages (sin servidor):** lee `COMO_PUBLICAR_EN_GITHUB_PAGES.md` y usa `dist/index.html`.
- **Qué se ha probado de verdad (y qué no):** `docs/PRUEBAS.md`.
- **Licencias y originalidad:** `LICENCIAS.md`.

## Arrancar en tu ordenador (opcional)
Necesitas [Node.js](https://nodejs.org) 18 o superior. No hay que instalar nada más (cero dependencias).

```
node server/index.js        # o: npm start
```
Abre `http://localhost:3000`. Los dispositivos de tu misma wifi pueden entrar con la dirección «En tu red local» que se muestra al arrancar.

## Dos formas de publicarlo
1. **Con servidor** (`node server/index.js`, p. ej. en Render): el servidor decide las reglas. Más seguro y estable.
2. **Un solo archivo** (`dist/index.html`, p. ej. en GitHub Pages): el anfitrión ejecuta las reglas en su navegador y los demás se conectan por un broker MQTT público, con cifrado individual. Más fácil, pero depende del anfitrión y de servicios públicos. Se genera con `npm run build:un-solo-archivo`.

## Estructura
```
server/ws.js      Servidor WebSocket propio (RFC 6455), sin dependencias
server/game.js    Reglas del juego: servidor autoritativo (turnos, cartas, privacidad, temporizadores)
server/sala.js    Salas, códigos, jugadores, reconexión, protocolo de mensajes, validación
server/index.js   Servidor HTTP (sirve el juego) + upgrade a WebSocket
server/azar.js    Aleatoriedad segura común a Node y navegador (el motor corre en ambos)
build/            Empaquetador que genera el juego en un solo archivo
public/js/mqtt.js Cliente MQTT 3.1.1 escrito a mano (sin librerías)
public/js/p2p.js  Transporte sin servidor: anfitrión + invitados cifrados (ECDH P-256 + AES-GCM)
public/           El juego en el navegador (JavaScript moderno sin compilar)
  js/arte.js        Gatos, avatares e ilustraciones de cartas dibujados en SVG
  js/animaciones.js Animación exclusiva de cada carta + reacciones de avatares
  js/efectos.js     Partículas, ondas, sacudidas, vuelos de cartas (ligero, con modo reducido)
  js/sonido.js      Sonidos y música sintetizados con Web Audio (sin archivos de audio)
  js/pantallas.js   Menú, sala de espera, partida, resultados, ventanas
  js/red.js         Cliente WebSocket con reconexión automática
test/             Pruebas automáticas (npm test)
```

## Decisión técnica importante (stack)
El encargo pedía React + TypeScript + Vite + Tailwind + Framer Motion + GSAP + Zustand + Howler + Socket.IO.
El entorno donde se ha construido **no tenía acceso a Internet**, así que no se podían instalar ni compilar esas librerías,
y lo que no se puede compilar ni probar no se debe entregar. Se eligió por eso una arquitectura **sin dependencias**:

| Pedido | Lo que se ha hecho |
|---|---|
| React/Vite/TypeScript | JavaScript moderno (módulos ES) sin paso de compilación |
| Tailwind | CSS propio con variables y contenedores (`css/estilo.css`) |
| Motion / GSAP | Web Animations API del navegador + motor de partículas propio |
| Zustand | Un objeto de estado simple (`main.js`) |
| Howler.js | Web Audio API (sonidos sintetizados, sin licencias) |
| Socket.IO | WebSocket propio, con reconexión, latidos y validación |

Ventajas: nada que instalar ni compilar (más fácil de publicar), cero dependencias que se queden obsoletas, arranque instantáneo
y memoria baja en Chromebooks. Si más adelante quieres migrar a React/Vite, la lógica de reglas (`server/game.js`) y el protocolo no cambian.

## Configuración
- `PORT`: puerto (lo ponen solos Render, Railway…). Por defecto 3000.
- `ORIGENES_PERMITIDOS`: solo si alojas la parte visual y el servidor en sitios distintos (lista separada por comas).
- `public/config.js`: `servidor` solo para ese mismo caso. Normalmente se deja vacío.
