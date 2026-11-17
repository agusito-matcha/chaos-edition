# 🚀 Cómo publicar CHAOS EDITION (paso a paso, desde cero)

Al terminar tendrás una dirección web (por ejemplo `https://chaos-edition-xxxx.onrender.com`) que tú y tus amigos podréis abrir desde cualquier Chromebook, sin instalar nada.

> **Antes de empezar, dos cosas honestas:**
> 1. Yo no he podido publicar el juego por ti: mi entorno no tiene acceso a Internet ni a tus cuentas. Por eso **no hay ninguna dirección publicada todavía** y no me invento ninguna. Estos pasos son los que tienes que hacer tú.
> 2. Los pasos describen las pantallas de Render y GitHub **tal como las he leído en su documentación** (consultada el 17 de noviembre de 2026). No he podido abrirlas para hacer capturas, así que no incluyo capturas de esas webs: si algún botón se llama de forma algo distinta, busca el más parecido.

Tiempo estimado: 20–30 minutos la primera vez.

---

## Qué plataforma usar (y por qué)

El juego necesita un servidor que esté encendido y mantenga conexiones abiertas (WebSocket) para que los jugadores se vean en tiempo real. Esto he comprobado de cada plataforma:

| Plataforma | ¿Sirve para este juego? | Notas (comprobadas el 17/11/2026 en su documentación y en comparativas recientes) |
|---|---|---|
| **Render** (recomendada) | ✅ Sí | Tiene plan gratuito para servicios web de Node.js. **Limitaciones:** se «duerme» a los 15 minutos sin actividad y tarda cerca de 1 minuto en despertar; 750 horas gratis al mes; puede reiniciarse en cualquier momento (las partidas en curso se perderían). |
| Railway | ⚠️ Funciona, pero no es realmente gratis | Prueba de 30 días con 5 $ de crédito y después un plan muy limitado. |
| Vercel | ❌ No | Sus funciones no pueden mantener un servidor WebSocket. Solo valdría para la parte visual, no para jugar. |
| Cloudflare | ❌ No tal como está | Cloudflare Pages solo aloja la parte visual; el servidor necesitaría reescribirse para Cloudflare Workers. |
| Tu propio ordenador | ✅ Sí, sin cuentas | Solo vale para jugar en la misma wifi (ver «Plan B» al final). |

**Los planes gratuitos cambian con frecuencia.** Mira siempre la página de precios de Render antes de empezar.

**Qué significa «se duerme» para ti:** si nadie ha jugado en 15 minutos, la primera persona que abra el enlace verá una pantalla de carga de Render hasta un minuto. Es normal. Cuando alguien tiene el juego abierto, el propio juego envía un mensaje cada 20 segundos, lo que, según la documentación de Render, mantiene el servicio despierto.

---

## PASO 1 · Descargar y descomprimir el ZIP

1. Descarga el archivo **`CHAOS_EDITION_COMPLETO.zip`**.
2. En el Chromebook: abre la app **Archivos**, busca el ZIP en **Descargas**, haz clic derecho y elige **Extraer todo**. Se creará una carpeta `CHAOS_EDITION`.
3. En Windows: clic derecho en el ZIP → **Extraer todo…**. En Mac: doble clic.
4. Abre la carpeta. Deberías ver `server`, `public`, `package.json`, `README.md`… (si ves otra carpeta `CHAOS_EDITION` dentro, entra en ella: lo que importa es la carpeta que contiene `package.json`).

## PASO 2 · Crear una cuenta en GitHub (donde se guardan los archivos)

Render coge el juego desde GitHub. Es gratis.

1. Entra en <https://github.com> y pulsa **Sign up** (Registrarse).
2. Pon tu correo, una contraseña y un nombre de usuario; confirma el código que te llegan al correo.

## PASO 3 · Subir los archivos a GitHub

1. Ya con la sesión iniciada, pulsa el **+** de arriba a la derecha → **New repository** (Nuevo repositorio).
2. En **Repository name** escribe `chaos-edition`.
3. Deja marcado **Public** (público). *(Es necesario para el método más sencillo. No hay nada secreto en el juego: no contiene contraseñas ni claves.)*
4. Pulsa **Create repository**.
5. En la página que aparece, busca el enlace **uploading an existing file** y púlsalo.
6. Abre la carpeta `CHAOS_EDITION` que descomprimiste, **selecciona TODO su contenido** (las carpetas `server`, `public`, `test`, `docs` y los archivos sueltos) y **arrástralo** a la zona de GitHub.
   - Importante: arrastra **el contenido**, no la carpeta `CHAOS_EDITION` en sí. Al terminar, en la lista de GitHub debes ver directamente `server`, `public`, `package.json`…
   - Si arrastrar carpetas no funciona en tu navegador, entra en cada carpeta y sube sus archivos conservando la misma estructura, o pulsa **choose your files**.
7. Espera a que terminen de subirse y, abajo, pulsa **Commit changes**.

## PASO 4 · Crear una cuenta en Render

1. Entra en <https://render.com> y pulsa **Get Started** / **Sign up**.
2. Elige **Sign up with GitHub** (así se conectan solas las dos cuentas) y acepta.

## PASO 5 · Crear el servidor del juego en Render

1. En el panel de Render pulsa **+ New** (arriba a la derecha) → **Web Service**.
2. Elige **Git Provider** y busca tu repositorio **chaos-edition**. Si no aparece, pulsa **Configure account** y dale permiso de acceso a ese repositorio.
3. Rellena el formulario **exactamente así**:

| Campo | Qué poner |
|---|---|
| **Name** | `chaos-edition` (o el nombre que quieras; formará parte de la dirección web) |
| **Language / Runtime** | `Node` |
| **Branch** | `main` (el que venga por defecto) |
| **Build Command** | `echo "nada que compilar"` *(o déjalo vacío si te deja)* |
| **Start Command** | `node server/index.js` |
| **Instance Type** | **Free** (gratis) |

4. **Variables de entorno (Environment Variables):** **no tienes que añadir ninguna.** Render pone solo el puerto. *(No hay claves ni contraseñas que inventar.)*
5. Pulsa **Create Web Service** (o **Deploy Web Service**).

Se abrirá una pantalla con letras que van saliendo (el «log»). Espera 1–3 minutos hasta ver algo parecido a `CHAOS EDITION está funcionando` y el estado **Live** (en verde).

> **Atajo opcional:** el proyecto incluye `render.yaml`. En Render también puedes hacer **New → Blueprint**, elegir el repositorio y Render rellena estos datos solo.

## PASO 6 · Tu dirección web definitiva

1. En la parte superior de la página de tu servicio en Render, bajo su nombre, verás una dirección que acaba en **`.onrender.com`**. Esa es la dirección de tu juego.
2. Ábrela en otra pestaña. Si todo va bien verás el menú de CHAOS EDITION y, abajo del panel, **«● Conectado con el servidor»**.
3. Comprobación extra: añade `/salud` al final de la dirección. Debe salir un texto con `"ok":true`.

## PASO 7 · Jugar con tus amigos

1. Abre tu dirección, pon tu nombre, elige gato y pulsa **Crear partida**.
2. Aparecerá un **código de 5 caracteres**. Pulsa **Compartir invitación** (copia un enlace que ya lleva el código) y mándalo por el chat.
3. Tus amigos abren el enlace en su Chromebook y entran directamente a tu sala. O abren la dirección del juego y escriben el código en **Unirme con código**.
4. Cuando estéis todos, pulsa **¡Empezar partida!** (mínimo 2 jugadores, máximo 5).

**Mensaje para tus amigos** (cópialo):
> ¡Vamos a jugar a CHAOS EDITION! Abre este enlace en Chrome: **(tu enlace)** . Elige tu nombre y tu gato y entra con el código **XXXXX**. No hay que instalar nada. La primera vez puede tardar hasta un minuto en cargar.

---

## Si algo no va bien

| Problema | Solución |
|---|---|
| La página tarda mucho en abrirse | Está despertando (plan gratuito). Espera hasta 1 minuto y recarga. |
| Pone «Conectando con el servidor…» y no avanza | Recarga la página. Si sigue, mira en Render si el servicio está **Live**; si no, abre **Logs** para ver el error. |
| Render dice «Cannot find module server/index.js» | Subiste la carpeta equivocada: en GitHub deben verse `server` y `public` en la primera pantalla del repositorio. Sube de nuevo el contenido. |
| «No existe ninguna sala con ese código» | La sala se perdió (el servidor se reinició o se durmió) o el código está mal escrito. Crea una sala nueva. |
| Se pierde la conexión a mitad de partida | El juego reconecta solo y recupera tu mano. Si el servidor se reinició, la partida se pierde y hay que empezar otra (limitación del plan gratuito). |
| Quiero actualizar el juego | Sube los archivos nuevos al mismo repositorio de GitHub; Render lo publica de nuevo solo. |

---

## Plan B: jugar sin publicar (misma wifi, sin cuentas)

Solo si tienes un ordenador (no Chromebook) con [Node.js](https://nodejs.org) instalado:

1. Descomprime el ZIP.
2. **Windows:** doble clic en `INICIAR_EN_WINDOWS.bat`. **Mac/Linux:** `INICIAR_EN_MAC_O_LINUX.sh`.
3. En la ventana negra aparecerá algo como `En tu red local: http://192.168.1.35:3000`.
4. Los Chromebooks conectados a la **misma wifi** abren esa dirección en Chrome y juegan. Si el cortafuegos del ordenador pregunta, permite el acceso.

## Si más adelante alojas por separado la parte visual y el servidor (avanzado)

No es necesario para empezar. Si lo haces: en `public/config.js` pon `servidor: 'https://tu-servidor.onrender.com'` y, en el servidor, crea la variable de entorno `ORIGENES_PERMITIDOS` con la dirección de la parte visual (por ejemplo `https://mi-juego.pages.dev`). En Render: tu servicio → **Environment** → **Add Environment Variable**.
