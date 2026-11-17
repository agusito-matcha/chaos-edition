# 🧩 CHAOS EDITION en UN SOLO ARCHIVO (GitHub Pages, sin servidor)

Esta versión es **un único archivo `index.html`** (209 KB) con todo dentro: el juego, las reglas, el arte, el sonido y la conexión entre jugadores. Lo subes a GitHub Pages (o Netlify Drop), pasas el enlace por clase y se juega al instante. **No hay que crear ningún servidor.**

## Cómo funciona (explicado fácil)
- Quien **crea la partida es el «anfitrión»**: las reglas del juego se ejecutan **dentro de su navegador**.
- Los demás jugadores se conectan al anfitrión a través de un **servicio gratuito y público de mensajes (MQTT)**. Es como un «buzón» de Internet por el que pasan los mensajes.
- Todo lo que viaja por ese buzón va **cifrado con una clave distinta para cada jugador**: el buzón público (y los demás jugadores) no pueden leer tus cartas ni hacerse pasar por ti.
- *No he usado PeerJS (WebRTC)*: necesita descargar una librería externa que yo no podía probar aquí, y las conexiones WebRTC suelen bloquearse en las redes de los colegios. MQTT va por WebSocket seguro (como una web normal) y está escrito dentro del propio archivo, así que lo he podido probar de verdad.

## Pasos para publicarlo (unos 10 minutos)
1. **Cuenta en GitHub:** entra en <https://github.com>, pulsa **Sign up** y créala (gratis).
2. **Repositorio:** pulsa **+ → New repository**. Nombre: `chaos-edition`. Marca **Public**. Pulsa **Create repository**.
3. **Subir el archivo:** en la página del repositorio pulsa **uploading an existing file**, arrastra **`index.html`** (el archivo que te he dado) y pulsa **Commit changes**. *(Solo ese archivo; no hace falta nada más.)*
4. **Activar Pages:** pestaña **Settings** → menú izquierdo **Pages** → en *Build and deployment* → *Source*: **Deploy from a branch** → *Branch*: **main** y carpeta **/(root)** → **Save**.
5. **Esperar 1–2 minutos** y recarga la página de Pages: arriba aparecerá tu dirección: `https://TU-USUARIO.github.io/chaos-edition/`. **Esa es la dirección del juego.**
6. Ábrela en Chrome. Debe poner «● Listo para jugar (las partidas van directas entre los navegadores)».

> **Alternativa:** en <https://app.netlify.com/drop> puedes arrastrar una carpeta que contenga el `index.html` y te da un enlace. Puede pedirte crear una cuenta para que el enlace no caduque; compruébalo en su web.

## Cómo jugar con tus compañeros
1. **Tú (anfitrión):** abre el enlace → nombre y gato → **Crear partida**. Verás un código de 5 caracteres.
2. Pulsa **🔗 Compartir invitación** y pasa el enlace por el chat de la clase (ya lleva el código). Los demás lo abren y entran directamente; o escriben el código en **Unirme con código**.
3. Pulsa **¡Empezar partida!** cuando estéis todos (2 a 5 jugadores). Las reglas están en `COMO_JUGAR.md`.

## ⚠️ Límites que debes conocer (son propios de este método)
| Límite | Qué significa para vosotros |
|---|---|
| **El anfitrión es el «servidor»** | Si el anfitrión cierra la pestaña, recarga la página o se queda sin Internet, **la partida se acaba** para todos. Elegid como anfitrión al Chromebook más estable, **con la pestaña visible** y enchufado. |
| **El anfitrión ve todo** | Al ejecutar las reglas en su navegador, un anfitrión que sepa usar las herramientas de desarrollador podría mirar las cartas. Los demás jugadores **no** pueden verse las cartas entre sí. Para jugar con amigos/clase es suficiente; para torneos serios, usad la versión con servidor. |
| **Servicio público sin garantías** | Los «buzones» MQTT gratuitos (`broker.emqx.io`, `test.mosquitto.org`, `broker.hivemq.com`) **no garantizan disponibilidad** y pueden caerse o limitar el uso. El juego prueba varios automáticamente. Si ninguno funciona, no hay forma de jugar con este método hasta que vuelvan. |
| **Redes de colegio** | Algunos centros bloquean los puertos que usan estos servicios (8084, 8081, 8884). Si no conecta, prueba con otra red (por ejemplo, el móvil como punto de acceso) o pide a quien administre la red que permita WebSocket seguro a esos servidores. |
| **Salas efímeras** | Nada se guarda: al cerrar el anfitrión, la sala desaparece. |
| **Varias partidas a la vez** | Posible: cada una usa su código. (Dos partidas con el mismo código a la vez sería rarísimo: hay 32⁵ ≈ 33 millones de combinaciones.) |

## Si algo falla
| Problema | Solución |
|---|---|
| «No existe ninguna sala con ese código (o el anfitrión ha cerrado su pestaña)» | Revisa el código (5 caracteres) y que el anfitrión siga con la pestaña abierta. Puede tardar unos 10 segundos en decirlo. |
| «No se ha podido conectar con el servicio de mensajería» | Probad con otra red, o esperad unos minutos: el servicio público puede estar caído. |
| Se pierde la conexión a mitad de partida | El jugador reconecta solo (hasta 90 s). Si era el anfitrión y recargó, la partida se pierde. |
| La página se queda en «Preparando…» | Recarga; comprueba que abres la dirección `https://…github.io/…` y no el archivo suelto. |

## Para ti, si quieres tocar algo (avanzado)
- **Usar otro servicio MQTT:** añade `?broker=wss://tu-servicio:puerto/mqtt` a la dirección (varios separados por comas). **Todos los jugadores deben usar la misma dirección con ese `?broker=`.**
- **Regenerar el archivo** tras cambiar el código fuente (en el ZIP completo): `node build/un-solo-archivo.js` crea `dist/index.html`.
- **Prueba automática:** `node build/un-solo-archivo.js && node test/p2p.manual.js` (necesita Playwright; usa un broker local de pruebas).
