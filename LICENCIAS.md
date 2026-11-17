# Licencias y originalidad

## Qué es original de este proyecto
- **Todo el arte**: gatos, avatares, ilustraciones de las 13 cartas, reverso de carta, logotipo y mascota. Están dibujados con código SVG en `public/js/arte.js`. No hay imágenes de terceros.
- **Todo el sonido y la música**: se sintetizan en el navegador con Web Audio (`public/js/sonido.js`). No hay archivos de audio.
- **Todo el código** del cliente y del servidor, incluido el servidor WebSocket.
- Nombres de cartas y textos: los definidos en el encargo (GATITO EXPLOSIVO, DESACTIVADOR, PASAR TURNO, ATAQUE, FAVOR, BARAJAR, VER EL FUTURO, VA A SER QUE NO, CARTAS DE GATO) y los gatos propios (GATO PEGÓN, NINJA, MAGO, DORMILÓN, CABREADO).

## Recursos de terceros
| Recurso | Uso | Licencia |
|---|---|---|
| Fuente **Bagel Fat One** (Google Fonts) | Títulos. Se carga desde los servidores de Google, no va dentro del proyecto | SIL Open Font License 1.1 |
| Fuente **Nunito** (Google Fonts) | Texto. Se carga desde Google, no va dentro del proyecto | SIL Open Font License 1.1 |
| Node.js | Entorno donde corre el servidor (no se incluye) | MIT |

Si la fuente no carga (sin Internet o con filtros del centro), el juego usa fuentes del sistema y sigue funcionando; solo cambia el aspecto de los títulos.
No se usa ninguna librería de JavaScript de terceros.

## Sobre la inspiración
CHAOS EDITION se inspira en la **dinámica general** de los juegos de cartas de supervivencia, azar y sabotaje (robar cartas, evitar una carta explosiva, frenar jugadas del rival). Las reglas del juego no se pueden proteger por derechos de autor, pero **los nombres, el arte y la marca de otros juegos sí**.
Aquí no se copia ninguna ilustración, logotipo, personaje ni diseño de carta de otro juego.
Aun así, antes de **vender** el juego conviene consultar a un profesional de propiedad intelectual (yo no soy abogado y esto no es asesoramiento legal).

## Licencia de este proyecto
El proyecto no incluye una licencia de código abierto: la elige quien lo publique. Si quieres que otras personas puedan copiarlo o modificarlo, añade una (por ejemplo MIT); si no, tú conservas todos los derechos.
