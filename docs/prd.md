# Documento de Requisitos del Producto: Tab

**Versión:** 0.3.0  
**Fecha:** 2026-09-29  
**Autor:** JA  
**Estado:** Borrador  
**Nombre anterior:** Yummy Track App. Renombrada a Tab el 2026-09-29.  

---

## 1. Descripción General

### 1.1 Problema

En Venezuela, JA y Marcela utilizan regularmente a una conductora de confianza, MC, para sus traslados. El seguimiento de las carreras, sus costos y el monto acumulado adeudado se hace actualmente rebuscando mensajes de chat, lo que resulta tedioso y propenso a errores. Los pagos se realizan en lotes, no por viaje, por lo que es fácil perder la cuenta.

### 1.2 Solución

Tab es una aplicación web ligera, optimizada para móvil e instalable en la pantalla de inicio (PWA), que permite registrar y dar seguimiento a las carreras con MC. Muestra todos los viajes pendientes de pago en una sola pantalla, permite marcarlos como pagados y presenta los totales tanto en dólares (USD) como en bolívares venezolanos (usando la tasa BCV oficial diaria).

El nombre describe el trabajo central: llevar una cuenta abierta. Se suman carreras a medida que ocurren, siempre se sabe cuánto se debe y la cuenta se salda en lote al pagar.

### 1.3 Objetivos (POC)

- Registrar viajes con uno o más usuarios, origen/paradas/destino, fecha, precio en USD opcional y tiempo de espera opcional.
- Mostrar todos los viajes pendientes en la pantalla principal con totales acumulados.
- Marcar viajes como pagados — los viajes pagados se mueven al historial.
- Mostrar totales en USD y bolívares (tasa BCV diaria, en caché).
- Selección de usuario simple y persistente — sin contraseñas.
- 100 % gratuito para operar. Despliegue en Vercel.
- Optimizado para iPhone / Safari y Android / Chrome en modo oscuro.
- Interfaz en español por defecto, con el inglés como segundo idioma (ver Sección 5.6).

### 1.4 Exclusiones del POC

- Soporte para múltiples conductores (siempre el mismo conductor de confianza).
- División de costos por usuario ni seguimiento de reembolsos internos.
- Notificaciones push o recordatorios.
- App nativa iOS/Android. En su lugar, la app se instala como PWA (ver Sección 6.4).
- Panel de administración, gestión de usuarios ni creación de cuentas.
- Servicios de terceros de pago de ningún tipo.
- Reportes complejos, gráficas ni analíticas.

---

### 1.5 Diferido — campos retirados del formulario

Dos campos especificados en este documento **ya no tienen input en la app**, pero siguen
existiendo en la base de datos y en la API. Están diferidos, no eliminados.

| Campo | Estado | Por qué |
|---|---|---|
| `conductor` | Retirado de formulario y de la tarjeta | Las 107 carreras registradas tienen `MC`. El campo nunca varió, así que mostrarlo y pedirlo era ruido puro. |
| `clientes` ("Para quién") | Retirado del formulario | Agregaba fricción en cada registro. Toda carrera nueva se asigna a **JA + Marcela**, igual que ya hacía el atajo de rutas frecuentes. |

**Qué NO cambió — a propósito:**

- La tabla `viaje_clientes` y la columna `viajes.conductor_nombre` siguen intactas, con
  todo el historial (71 carreras solo de JA, 36 compartidas). Nada se migró ni se borró.
- La API sigue **aceptando** ambos campos en `POST` y `PUT /api/viajes`. Solo dejó de
  recibirlos desde la UI.
- Los chips de clientes se siguen mostrando en la tarjeta y en el recibo compartido.
- Editar una carrera vieja **conserva** su asignación original de clientes; no la
  reescribe al default compartido.

Por eso, restaurarlos es trabajo de UI, no una migración.

**Cuándo traerlos de vuelta:** si la app deja de ser de un solo hogar — más de un
conductor, o clientes que no sean siempre los mismos dos. En ese momento
`src/lib/rideDefaults.ts` deja de tener sentido y los campos vuelven al formulario.

**Cómo:** el commit que los retiró está citado abajo; `git show <sha>` devuelve el markup
y la validación exactos en vez de reescribirlos de memoria.

> Commits de retiro:
> - `7cdf065` — defaults compartidos, store y loads (`git show 7cdf065`)
> - `fdf40ac` — inputs del formulario y línea de conductor en la tarjeta (`git show fdf40ac`)
>
> El retiro quedó repartido en dos commits porque `AddRideSheet` y `RideCard`
> cambiaron también por otros motivos en la misma tanda.

Las secciones 3.1, 4 y 5.4 de este documento siguen describiendo ambos campos tal como
estaban especificados. Se dejan como están a propósito: son la especificación a la que
volver, no una descripción del estado actual.

---

### 1.6 Dónde la app ya superó las secciones 3.1, 4 y 5.4

Como las secciones 3.1, 4 y 5.4 se conservan tal cual (ver 1.5), también conservan algunos
datos que la app ya cambió. Donde esas secciones y esta tabla no coinciden, vale esta tabla,
que describe el código.

| Especificación original | Lo que hace la app |
|---|---|
| `precio_usd` requerido y `> 0` (3.1, 4) | **Opcional.** La columna admite `NULL` y el precio debe ser `>= 0`. Una carrera sin precio muestra "Sin precio" en la tarjeta y en el recibo, y suma 0 al total. El precio se puede agregar o corregir tocándolo en la tarjeta. |
| La fecha es solo `creado_en`, fijada al guardar (3.1, 4) | **La fecha del viaje es editable.** El formulario tiene un campo Fecha (por defecto, hoy). Se guarda en `creado_en` a las 12:00 UTC del día elegido, e Inicio ordena por ella. |
| `viajes` no tiene columna de borrado (4) | **Borrado lógico:** columna `viajes.borrado_en TIMESTAMPTZ`. Eliminar llena esa columna, y la carrera pasa a la papelera de Historial, desde donde se puede restaurar (ver 3.7). |
| Pagar es irreversible (3.1) | **Se puede deshacer:** "Devolver a pendientes" en Historial pone `pagado_en` en `NULL` (ver 3.5). |
| Eliminar dice *"Esta acción no se puede deshacer"* (5.4) | La confirmación dice que la carrera se podrá restaurar desde la papelera en Historial. |
| Menú ··· como dropdown (5.4) | El menú ··· abre una hoja inferior con Editar, Eliminar y Cancelar. |
| Barra de resumen con "Carreras Pendientes" y "Monto Pendiente" (5.4) | Las etiquetas son "Pendientes" y "Total". La barra también tiene "Compartir" (ver 3.8) y "Marcar todo pagado", con confirmación. |
| Historial es una sola lista (5.4) | Historial tiene dos pestañas: **Pagadas** y **Papelera**. |

---

## 2. Usuarios y Autenticación

### 2.1 Perfiles de Usuario

| Nombre | Iniciales | Rol |
|---|---|---|
| JA | JA | Cliente — toma carreras |
| Marcela | M | Cliente — toma carreras |
| Maria Carolina | MC | Conductora — realiza los viajes |

**Distinción de roles:** JA y Marcela son los **clientes** — las carreras se registran a su nombre. MC es la **conductora** — no es pasajera, pero también puede usar la app para registrar carreras y asignarlas a JA, Marcela o ambos.

### 2.2 Modelo de Sesión

- Al abrir la app por primera vez, el usuario ve una pantalla de bienvenida a pantalla completa — "¿Quién eres?" — con tres tarjetas grandes y seleccionables, una por usuario.
- La selección se persiste en `localStorage` bajo la clave `tab_active_user`.
- El pie del drawer muestra el usuario activo: sus iniciales, su nombre y su rol, con un enlace "Cambiar" que borra la elección y vuelve a "¿Quién eres?". Elegir a otra persona solo cambia las iniciales.
- Sin contraseñas por persona. La identidad es exclusivamente local al dispositivo. Lo único que se pide es el PIN de la casa, una vez por dispositivo y antes de esta pantalla (Sección 2.3).
- El usuario activo no cambia cómo se asigna una carrera: toda carrera nueva se asigna a JA + Marcela, con MC como conductora (`src/lib/rideDefaults.ts`, ver Sección 1.5).

**Justificación:** La app es un registro compartido entre los tres. Identidad local al dispositivo es suficiente.

### 2.3 Acceso a la app (PIN de la casa)

La app de producción es pública en internet, así que toda página y toda ruta de `/api/*` exige un PIN compartido por la casa. No hay cuentas ni cambios en la base de datos.

- **Pantalla `/acceso`:** el wordmark, "Ingresa el PIN", un campo de PIN y el botón "Entrar". El PIN son **exactamente 6 dígitos**; el sexto dígito envía el formulario solo. Al acertar, vuelve a la página que se había pedido (`?next=`).
- **Una vez por dispositivo:** al acertar, el servidor deja una cookie `tab_session` firmada (HMAC-SHA256), `httpOnly`, `Secure`, `SameSite=Lax`, que dura unos 400 días. La app instalada en la pantalla de inicio tiene sus propias cookies, así que cada teléfono ingresa el PIN una vez dentro de la app instalada.
- **Sin sesión válida:** las páginas redirigen (303) a `/acceso`, y `/api/*` responde 401 en JSON para cualquier método. Los recursos estáticos y de la PWA (`/manifest.webmanifest`, `/icons/*`, `/og.png`, `/_app/*`) quedan libres.
- **Sesión vencida o revocada:** si una llamada a `/api/*` recibe 401, la app lleva a `/acceso` con el aviso "Tu sesión expiró. Ingresa el PIN de nuevo." y luego regresa. Un 401 no se trata como falta de conexión: no se encola nada nuevo, y lo que ya estaba en la cola se envía después de ingresar el PIN.
- **Revocar todos los dispositivos:** cambiar `SESSION_SECRET` en Vercel y volver a desplegar. Cambiar el PIN: generar un nuevo `HOUSEHOLD_PIN_HASH` (no cierra sesiones abiertas; para eso, rotar también `SESSION_SECRET`).
- **Fuerza bruta:** 5 PIN incorrectos en 15 minutos desde una misma IP bloquean esa IP 15 minutos ("Demasiados intentos. Intenta de nuevo en {min} min."), y cada intento tarda al menos 0,5 s. Es en memoria y por instancia: un esfuerzo razonable, no una garantía.
- **Demo:** con `DEMO_MODE=on` no hay PIN. Si `PUBLIC_DEMO_URL` está definida, la pantalla muestra "¿Solo quieres probar? Ver demo".

---

## 3. Especificaciones de Funcionalidades

### 3.1 Registro de Viajes

Un **viaje** (carrera) representa un trayecto desde un origen hasta un destino final, posiblemente con paradas intermedias.

**Campos requeridos:**

| Campo | Tipo | Notas |
|---|---|---|
| `clientes` | Arreglo (1–2) | Quién tomó la carrera: JA, Marcela o ambos |
| `conductor` | Texto | Nombre del conductor — default "MC"; editable por si cambia |
| `origen` | Ubicación | Punto de partida |
| `paradas` | Arreglo de Ubicación | Cero o más paradas intermedias |
| `destino` | Ubicación | Punto de llegada final |
| `precio_usd` | Decimal | Costo total en dólares estadounidenses |

**Campos opcionales:**

| Campo | Tipo | Notas |
|---|---|---|
| `minutos_espera` | Entero | Tiempo de espera acumulado durante el viaje, en minutos |
| `notas` | Texto | Nota de formato libre |

**Estados:**

- `pendiente` — sin pagar, visible en Inicio.
- `pagado` — liquidado, movido al Historial. La transición es irreversible en el POC.

### 3.2 Viajes con Múltiples Paradas

- Un viaje puede tener cero o más paradas intermedias entre el origen y el destino.
- Las paradas están ordenadas. El usuario las agrega secuencialmente (origen → parada 1 → parada 2 → destino).
- Cada parada usa el mismo modelo de Ubicación (desplegable de comunes + texto libre).
- No hay precio por tramo — el viaje tiene un precio total único.

### 3.3 Tiempo de Espera

- Campo entero `minutos_espera` en el viaje.
- Representa el tiempo de espera acumulado durante todo el trayecto (por ejemplo, 30 minutos de espera en el punto B antes de continuar hacia C).
- El tiempo de espera no afecta el campo de precio — es meramente informativo.
- Se muestra en la tarjeta del viaje como "30 min espera" si es distinto de cero.

### 3.4 Gestión de Destinos

**Lista de ubicaciones** — todas las ubicaciones viven en una sola tabla compartida entre los tres usuarios. La lista se pre-carga con los destinos comunes (ver Sección 8) y crece con el uso.

Cada entrada tiene:
- `nombre` — etiqueta legible (ej. "Sambil Chacao", "El Retiro")
- `dirección` — cadena de texto descriptiva opcional

La UI presenta la lista como un desplegable con búsqueda integrada (filtrado en tiempo real por nombre).

**Añadir destinos nuevos:** Cuando el lugar buscado no existe en la lista, cualquier usuario puede escribir un nombre nuevo directamente en el campo de búsqueda. Al guardar la carrera, ese destino se crea en la base de datos como una ubicación permanente — aparecerá en el desplegable de todos los usuarios en adelante. No hay distinción entre "ubicaciones comunes" y "ubicaciones personalizadas"; todas son iguales y reutilizables.

**Deduplicación:** El desplegable muestra sugerencias mientras el usuario escribe, lo que reduce entradas duplicadas por error. Los nombres son únicos en la base de datos: escribir un nombre que ya existe reutiliza esa ubicación. No hay deduplicación aproximada (mayúsculas, acentos o variantes cuentan como nombres distintos).

### 3.5 Pago e Historial

- Cualquier usuario en el dispositivo puede marcar cualquier viaje como pagado.
- Marcar un viaje como pagado establece `pagado_en = ahora()` y lo elimina de la lista de Inicio.
- **Marcar todo pagado** (barra de resumen) paga de una vez todas las carreras pendientes, tras un modal de confirmación con la cantidad y el total.
- Los viajes pagados son accesibles en la pestaña **Pagadas** de **Historial**, ordenados por fecha de pago, la más reciente primero. Cada tarjeta muestra "Pagado" con la fecha.
- **Devolver a pendientes:** si un viaje se marcó como pagado por error, este botón en Historial pone `pagado_en` en `NULL` y la carrera vuelve a Inicio.
- La página de Inicio siempre muestra **todos los viajes pendientes** sin importar su antigüedad (sin ciclo mensual).

**Edición:** Los viajes pendientes pueden editarse en su totalidad desde el menú ···, incluida la fecha. El precio también se puede editar directamente en la tarjeta. Los viajes pagados son de solo lectura, salvo "Devolver a pendientes".

### 3.6 Conversión de Moneda (Tasa BCV)

- Todos los precios se ingresan y almacenan en **USD**.
- La app obtiene y almacena en caché la tasa de cambio oficial BCV diaria (bolívares por USD).
- El resumen en la página de Inicio muestra el monto total pendiente en USD y bolívares.
- Las tarjetas individuales de viaje muestran el equivalente en bolívares como texto secundario de menor tamaño.
- La tasa en caché se actualiza una vez al día (TTL: 24 horas). Solo se consulta la fuente cuando la última tasa guardada tiene 24 horas o más; entre actualizaciones se usa el valor en caché.
- Si la tasa no puede obtenerse (sin conexión, API no disponible), se usa la última tasa conocida y la barra de resumen muestra el indicador "tasa de ayer" en color `warning`.
- Si no existe ninguna tasa en caché, la conversión a bolívares se oculta y solo se muestran los montos en USD.

**Fuente de la tasa BCV: `ve.dolarapi.com`**

| Criterio | Evaluación |
|---|---|
| URL | `https://ve.dolarapi.com/v1/dolares/oficial` |
| Costo | Gratuito, sin clave de API |
| Formato | JSON; la app lee el campo `promedio` (bolívares por USD) |
| Tasa | Oficial BCV |
| Mantenimiento | Cero: sin dependencia de scraping ni cambios de HTML |

La tasa se obtiene del lado del servidor (`src/lib/server/bcv.ts`) para evitar problemas de CORS y centralizar el caché en la base de datos. Cada tasa nueva se inserta en `bcv_tasa_cache`. Si `ve.dolarapi.com` no responde, se devuelve la última tasa almacenada, marcada como desactualizada.

### 3.7 Eliminación y Papelera

- Eliminar una carrera pendiente (menú ··· → Eliminar, con confirmación) es un **borrado lógico**: establece `borrado_en = ahora()` y la carrera sale de Inicio. No se borra ninguna fila.
- Las carreras eliminadas aparecen en la pestaña **Papelera** de Historial, con la fecha de borrado. La pestaña muestra un contador cuando hay alguna.
- **Restaurar** pone `borrado_en` en `NULL` y la carrera vuelve a aparecer en Inicio.
- Las carreras en la papelera no cuentan en los totales ni en "Marcar todo pagado".

### 3.8 Exportar Resumen (recibo en texto)

- El botón **Compartir** de la barra de resumen arma un recibo en texto plano con todas las carreras pendientes: encabezado "TAB" y fecha, luego una línea por carrera (fecha, ruta, pasajeros y precio en USD con su equivalente en Bs), y al final la cantidad y el total.
- Una carrera sin precio aparece como "Sin precio". Sin tasa BCV, el recibo solo lleva USD.
- El recibo sigue el idioma de la interfaz (ver 5.6). Los nombres de lugares y de personas van tal cual.
- Las carreras en cola sin conexión no se incluyen, porque todavía no existen en el servidor.
- Se abre la hoja de compartir del sistema (`navigator.share`). Si no está disponible o el usuario la cancela, el texto se copia al portapapeles con un toast "Resumen copiado".

### 3.9 Carreras Rápidas

- Sobre la barra de resumen hay atajos para las rutas más frecuentes (por ejemplo El Rocío → El Limón). Tocar uno abre un modal centrado con forma de tarjeta con pestaña: la pestaña lleva un icono y el título "¿Registrar esta carrera?", y la tarjeta muestra los clientes (JA y Marcela), "Hoy" con la hora, y la ruta con "Desde", "Hasta" y "vía …" para las paradas.
- "Registrar carrera" crea la carrera sin precio, con la fecha actual y para los dos clientes. "Cancelar", tocar el fondo o Escape cierran el modal sin crear nada.
- Al pulsar "Registrar carrera" los botones se pliegan y la pestaña muestra "Registrando…" con un indicador de carga. Mientras guarda, el modal no se puede cerrar.
- **Guardada en el servidor:** el título pasa a "Carrera registrada" con un ✓. El modal se cierra solo a los 1,5 segundos, o antes con un toque en cualquier parte.
- **Sin conexión:** la carrera rápida entra en la misma cola que el formulario (ver Sección 7.2). El modal muestra un reloj, "Carrera guardada" y "Se enviará cuando vuelva la conexión.", y se cierra solo a los 2,5 segundos, o antes con un toque.
- **Si la petición falla:** la pestaña se pone en rojo con "No se pudo registrar" y el aviso "Revisa tu conexión e intenta de nuevo.". Vuelven los botones: "Reintentar" reenvía la misma carrera y "Cancelar" cierra el modal. La carrera no se encola.
- Las carreras rápidas no muestran toasts: el modal es la confirmación.

---

## 4. Modelo de Datos

```sql
usuarios
  id           SERIAL PRIMARY KEY
  nombre       TEXT NOT NULL         -- 'JA' | 'Marcela' | 'Maria Carolina'
  iniciales    TEXT NOT NULL         -- 'JA' | 'M' | 'MC'
  rol          TEXT NOT NULL         -- 'cliente' | 'conductora'

ubicaciones
  id           SERIAL PRIMARY KEY
  nombre       TEXT NOT NULL
  direccion    TEXT

viajes
  id           SERIAL PRIMARY KEY
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
  pagado_en    TIMESTAMPTZ           -- NULL = pendiente
  conductor_nombre TEXT NOT NULL DEFAULT 'MC'
  precio_usd   NUMERIC(10,2) NOT NULL
  minutos_espera INTEGER
  notas        TEXT

viaje_clientes                       -- a quién se le asigna la carrera (siempre clientes)
  viaje_id     INTEGER FK → viajes.id
  usuario_id   INTEGER FK → usuarios.id  -- solo usuarios con rol = 'cliente'
  PRIMARY KEY (viaje_id, usuario_id)

viaje_paradas                        -- paradas ordenadas: incluye origen y destino
  id           SERIAL PRIMARY KEY
  viaje_id     INTEGER FK → viajes.id
  orden        INTEGER NOT NULL      -- 0 = origen, N = destino (índice más alto)
  ubicacion_id INTEGER NOT NULL FK → ubicaciones.id

bcv_tasa_cache
  id           SERIAL PRIMARY KEY
  tasa_ves_por_usd  NUMERIC(18,4) NOT NULL
  obtenida_en  TIMESTAMPTZ NOT NULL
```

**Restricciones:**
- Cada viaje debe tener al menos 2 paradas (origen + destino, es decir `orden` 0 y 1+).
- `ubicacion_id` en `viaje_paradas` es NOT NULL — toda ubicación debe existir en la tabla `ubicaciones` antes de guardar la carrera. Si es nueva, se inserta primero.
- `precio_usd` debe ser > 0.
- `viaje_clientes` solo puede referenciar usuarios con `rol = 'cliente'` (JA, Marcela). MC no puede ser cliente de una carrera.
- Cada viaje debe tener al menos 1 cliente asignado.

---

## 5. UI / UX (Alto Nivel)

Las especificaciones detalladas de componentes se producirán en un documento separado de UI Specs. Esta sección define restricciones, sistema de diseño e inventario de páginas.

### 5.1 Restricciones de Diseño

| Restricción | Especificación |
|---|---|
| Esquema de color | Solo modo oscuro: el tema `tab` (ver 5.2). Sin selector claro/oscuro en el POC |
| Dispositivos objetivo | iPhone (375–430 px) en Safari y Android (~360–412 px) en Chrome |
| Área mínima de toque | 44 × 44 pt (Apple HIG) |
| Tipografía | **Poppins**, autoalojada, con la pila del sistema como respaldo (ver 5.2) |
| Opacidad mínima del texto | **60 %.** Ningún texto por debajo de 60 % de opacidad, salvo controles deshabilitados y placeholders |
| Idioma | Español por defecto e inglés como segundo idioma, en todos los textos, etiquetas, mensajes de error y estados (ver 5.6) |
| Animaciones | Presentes pero sutiles — ver Sección 5.5 |
| Conexión | Usable con conectividad degradada o intermitente |

### 5.2 Sistema de Diseño

| Capa | Tecnología | Justificación |
|---|---|---|
| Estilos base | Tailwind CSS v4 | Utilidades; excelente soporte de modo oscuro |
| Componentes UI | DaisyUI 5 (plugin Tailwind) | Biblioteca de componentes semánticos, themed, accesibles; cero costo |
| Tema | Tema propio `tab` en `src/app.css` | Único tema que se publica (`themes: false`): los temas de DaisyUI no se incluyen |
| Tipografía | Poppins (OFL) vía `@fontsource/poppins` | Acompaña al wordmark geométrico; autoalojada, sin conexión a terceros |

DaisyUI provee los componentes base (botones, tarjetas, drawers, badges, modales, etc.). Los componentes usan solo los roles de DaisyUI, así que toman los colores del tema `tab` sin conocer los valores.

**Tokens del tema `tab` (oscuro).** Los neutros derivan del matiz del Índigo de marca.

| Token | Hex | Uso |
|---|---|---|
| `base-100` | `#0b0a29` | Fondo de página; `background_color` del manifest (splash) |
| `base-200` | `#13113f` | Superficies elevadas: tarjetas, navbar, drawer y hojas inferiores (con `bg-base-200` explícito). También el `theme-color` (barra de estado) |
| `base-300` | `#1f1b62` | Bordes, inputs, filas presionadas y fondo de los toasts |
| `base-content` | `#f8f8f8` | Texto (Off-white de marca) |
| `brand-indigo` | `#1c1a9b` | Índigo de marca, solo en la barra de resumen (`bg-brand-indigo`). No es un rol de DaisyUI |
| `primary` / `-content` | `#4342f5` / `#f8f8f8` | Violeta de marca: botón "+", avatar, chips de clientes, Restaurar |
| `accent` / `-content` | `#d7fe65` / `#0b0a29` | Lima de marca: "Marcar Pagado", "Sí, pagar todo", el punto del wordmark |
| `success` / `-content` | `#d7fe65` / `#0b0a29` | Igual que `accent`: pagado es la acción central, así que lleva el color insignia |
| `info` / `-content` | `#97a1ff` / `#0b0a29` | Violeta claro para **texto** de marca: "Sin precio", `+ Crear "…"` en el buscador de ubicaciones |
| `warning` / `-content` | `#f6d56b` / `#0b0a29` | Butter. **Solo** el banner sin conexión y "tasa de ayer" |
| `error` / `-content` | `#f66b71` / `#0b0a29` | Validación y Eliminar |
| `neutral` / `-content` | `#1f1b62` / `#f8f8f8` | Relleno de filas activas de menú y el contador de la papelera (igual a `base-300`) |
| `secondary` / `-content` | `#4342f5` / `#f8f8f8` | Sin uso; replica `primary` |

**Texto y contraste.**

- Tres niveles de opacidad de texto: **100 %** principal, **80 %** secundario, **60 %** terciario (precio en Bs, paradas, notas, fechas, etiquetas de la barra de resumen, estados vacíos). El 60 % pasa WCAG AA sobre todas las superficies, incluido el Índigo de la barra de resumen.
- Las tarjetas en cola sin conexión se atenúan a **80 %** de opacidad, para que su texto de 60 % siga pasando AA.
- El violeta (`primary`) **nunca** es texto sobre fondo oscuro: para texto de marca se usa `info` o Lima.
- Nunca Violeta sobre Índigo, y nunca Lima junto a Off-white: su contraste es 2,00:1 y 1,08:1.
- `warning` queda reservado para advertencias reales. "Devolver a pendientes" es un botón fantasma neutro al 80 %.

**Tipografía.**

- Poppins, subconjunto Latin (cubre todos los caracteres del español), pesos **400, 500, 600 y 700**, más **400 itálica** para las notas. Ningún peso por debajo de 400.
- Es la `--font-sans` de Tailwind, con `ui-sans-serif, system-ui, -apple-system, sans-serif` como respaldo. Los archivos usan `font-display: swap` y `src/hooks.server.ts` los precarga (solo los `.woff2`).
- Poppins no tiene cifras tabulares (`tnum`), así que los totales usan sus dígitos proporcionales.

**Marca.**

- El wordmark "tab." (`src/lib/components/Wordmark.svelte`) es un SVG en línea: letras en Off-white y el punto en Lima. Es una versión modificada de Glitz, entregada como contornos, así que no se usa ninguna fuente para él.
- El ícono de la app, el ícono maskable y el favicon usan el glifo "b." en Lima sobre un campo Violeta (`design/icons/`).

### 5.3 Estructura de Navegación

```
Barra de navegación superior (menos de 1024 px)
├── Izquierda: Hamburguesa → Drawer lateral
├── Centro:    Wordmark "tab." (SVG)
└── Derecha:   vacío (mismo ancho que la hamburguesa)

Drawer lateral (un solo menú)
├── Arriba
│   ├── Wordmark "tab."
│   ├── Inicio          (por defecto)
│   └── Historial       (pestañas Pagadas y Papelera)
└── Abajo, fijo
    ├── Idioma: Español / English → lista pequeña hacia arriba
    ├── Separador
    └── Usuario activo: iniciales, nombre, rol y "Cambiar" → "¿Quién eres?"
```

Desde `lg` (1024 px) el drawer queda abierto como barra lateral, sin barra superior ni hamburguesa; el banner de la demo va arriba de la columna de contenido. Entre 768 y 1023 px se comporta como en el teléfono. El pie respeta las zonas seguras (notch e indicador de inicio) en la PWA instalada. Las filas nuevas del pie (el "Recorrido" de F4) van encima de Idioma.

### 5.4 Inventario de Páginas

#### Inicio (`/`)

**Barra de resumen** (pegajosa, parte superior del contenido):
- `Carreras Pendientes` — cantidad de viajes sin pagar
- `Monto Pendiente` — suma en USD (texto grande) y bolívares (texto secundario más pequeño, con indicador de frescura si la tasa está desactualizada)

**Lista de viajes** — todos los viajes pendientes, más recientes primero.

---

#### Especificación de la Tarjeta de Viaje (Ride Card)

La tarjeta es el elemento central de la app. Toda la información relevante de una carrera debe estar visible sin expandir nada.

**Zonas de la tarjeta:**

```
┌──────────────────────────────────────────────────┐
│  Casa → CC Sambil → Clínica El Ávila        [···]│
│                                                  │
│  $12.00                        Bs 440.000,00     │
│                                                  │
│  [JA] [M]                           ⏱ 15 min    │
│  Conductor: MC                                   │
│  "Llevamos medicamentos — espera en farmacia"    │
│  Hoy · 3:45 PM                                   │
├──────────────────────────────────────────────────┤
│              [ Marcar como Pagado ]              │
└──────────────────────────────────────────────────┘
```

**Descripción de cada elemento:**

| Elemento | Zona | Comportamiento |
|---|---|---|
| **Línea de ruta** | Cabecera | `Origen → Parada 1 → … → Destino`. Si el texto no cabe en una línea se trunca con `…` pero el toque/hover expande. Hace evidente cuántas paradas tiene el viaje. |
| **Menú ···** | Cabecera, derecha | Toque abre un dropdown con dos opciones: **Editar** y **Eliminar**. Eliminar muestra un modal de confirmación antes de proceder. |
| **Precio USD** | Cuerpo | `$X.XX` en tipografía grande y negrita — el dato más importante. |
| **Precio Bs** | Cuerpo | `Bs X.XXX,XX` en texto secundario más pequeño, junto al precio USD. Si la tasa BCV no está disponible se muestra `Bs —`. |
| **Chips de clientes** | Cuerpo | Chips con las iniciales de quién tomó la carrera: `[JA]`, `[M]`, o ambos. Color de acento para distinguirlos. |
| **Badge de espera** | Cuerpo | `⏱ Xmin` — visible solo si `minutos_espera > 0`. Alineado a la derecha junto a los chips. |
| **Conductor** | Cuerpo | `Conductor: MC` — texto secundario pequeño. Si el nombre del conductor es el default "MC" se muestra igual. Solo se vuelve notable si es diferente. |
| **Notas** | Cuerpo | Línea en itálica, visible solo si `notas` no está vacío. Se trunca a 2 líneas; toque expande. |
| **Fecha y hora** | Cuerpo | Formato relativo: "Hoy · 3:45 PM", "Ayer · 11:20 AM", "Lun 5 may · 9:00 AM". |
| **Botón Marcar como Pagado** | Pie | Botón ancho completo, color de acento primario. Acción optimista — el botón se desactiva y la tarjeta sale con slide-out al confirmar. |

**Menú ··· — opciones:**

```
┌──────────────┐
│  Editar      │
│  Eliminar    │
└──────────────┘
```

- **Editar:** Abre el bottom sheet de edición pre-poblado con los datos actuales del viaje.
- **Eliminar:** Muestra un modal de confirmación: *"¿Eliminar esta carrera? Esta acción no se puede deshacer."* con botones [Cancelar] [Eliminar].

**Tarjeta en Historial (variante pagada):**

La misma estructura, con dos diferencias:
1. El botón "Marcar como Pagado" es reemplazado por una línea de texto `Pagado el Jue 8 may · 2:10 PM`.
2. El menú ··· se omite (solo lectura en el POC).

---

**FAB** — botón flotante "+" (inferior derecho) → hoja de agregar viaje.

#### Historial (`/historial`)

- Lista de viajes pagados, más recientes primero.
- Misma tarjeta que Inicio pero en variante pagada (ver arriba).

#### Agregar / Editar Viaje (bottom sheet)

- Formulario en una sola pantalla deslizable desde la parte inferior.
- **Campos:** clientes (chips multi-selección: JA, M), conductor (texto, default "MC"), origen, paradas (agregar/eliminar dinámicamente), destino, precio USD, minutos de espera (opcional), notas (opcional).
- **Ubicaciones:** select con búsqueda sobre la lista común + opción "Otra dirección" → campo de texto libre.
- La acción **Guardar** es optimista (ver Sección 7).
- La acción **Cancelar** descarta cambios sin confirmación (el estado no se envió al servidor).

#### Selección de Usuario (primer lanzamiento)

- Overlay a pantalla completa, tres tarjetas grandes y seleccionables.
- Se persiste en `localStorage`; no se muestra de nuevo hasta que el usuario toca "Cambiar" en el pie del drawer.

### 5.5 Animaciones

Las animaciones deben sentirse nativas a móvil: rápidas, fluidas y con propósito. No deben agregar latencia percibida.

| Interacción | Animación |
|---|---|
| Agregar un nuevo viaje | La tarjeta hace slide-in desde abajo y aparece en la parte superior de la lista (duración: ~250 ms, ease-out) |
| Marcar viaje como pagado | La tarjeta hace slide-out hacia la derecha con fade de salida antes de eliminarse de la lista (~300 ms) |
| Abrir / cerrar el bottom sheet | Slide up desde la parte inferior de la pantalla (~280 ms) |
| Abrir / cerrar el drawer lateral | Slide in desde la izquierda (~220 ms) |
| Toast de éxito / error | Fade in desde la parte superior + auto-dismiss (~2 s) |
| Lista de idiomas del drawer | Fade y desplazamiento corto hacia arriba (~150 ms) |

Todas las animaciones deben respetar `prefers-reduced-motion` (reducir a crossfade instantáneo o sin animación).

### 5.6 Idiomas

La interfaz está en **español** (el idioma base) y en **inglés**. Los datos nunca se traducen.

- **Cuál se usa:** el servidor lo decide en cada petición. Primero, una elección guardada (la cookie `tab_lang`). Sin ella, **la app real siempre empieza en español**, aunque el teléfono esté en inglés, y **la demo** (`DEMO_MODE=on`) sigue el `Accept-Language` del navegador. El resultado va en `<html lang>`, de donde lo lee el cliente, y se copia a `localStorage` (`tab_lang`).
- **El cambio:** la fila "Idioma" del drawer, que abre una lista pequeña con "Español" y "English", y un selector pequeño ES / EN en `/acceso` y en "¿Quién eres?". Guarda la cookie (unos 400 días) y recarga la página. `POST /api/language` guarda la cookie y está detrás del PIN, como toda la API; en `/acceso` todavía no hay sesión, así que la pantalla guarda la misma cookie desde el navegador. Sin cambios en la base de datos.
- **No se traduce:** nombres de lugares (también en las carreras rápidas), notas, nombres de personas ni nada que haya escrito el usuario.
- **El recibo** sigue el idioma de la interfaz.
- **Fechas y números** siguen el idioma, con una tabla de patrones por idioma (`src/lib/format.ts`). El español conserva la salida es-VE de siempre ("17 sept. 2026", "Bs. 5.919,42", "Hoy · 3:45 p. m."). El inglés usa en-US ("Sep 17, 2026", "Bs 5,919.42", "Today · 3:45 PM"). Los dólares usan el formato en-US en ambos ("$1,234.50").
- **Los textos** viven en `messages/es.json` y `messages/en.json` (Paraglide JS), con las mismas claves y parámetros. Los errores de la API también: el servidor responde en el idioma de la petición.

### 5.7 Demo pública

Una copia de Tab para que cualquiera la pruebe sin PIN: **`tab-ve-demo.vercel.app`**, un segundo proyecto de Vercel con **su propia base de datos Neon**, que no comparte nada con producción. Es el mismo código con `DEMO_MODE=on`; producción nunca define esa variable, y sin ella nada de lo siguiente se ejecuta.

- **Sin PIN:** `/acceso` redirige a la app.
- **Datos de ejemplo compartidos:** una sola base para todos los visitantes, con personas neutras: **Ana (A)** y **Luis (L)** como clientes y **Carla (C)** como conductora (`conductor_nombre` = "C"). Los nombres reales nunca aparecen en la demo. La semilla (`src/lib/server/demo/seed.ts`, aparte de `scripts/seed.ts`) carga la lista de lugares de la sección 8 más Fresco Market (todos los lugares de las carreras rápidas) y 14 carreras con horas de pared de Caracas relativas al momento del reinicio: 5 pendientes (con precio, "Sin precio", con una parada, con espera, con nota), 7 pagadas en Historial y 2 en la Papelera. Las notas son datos y no se traducen.
- **Se reinicia sola cada 4 horas,** sin cron: en una petición de la demo, cada instancia mira la hora del último reinicio como mucho una vez por minuto, y si pasaron más de 4 horas, borra todo y vuelve a sembrar. La tasa BCV en caché se conserva.
- **El banner,** bajo la barra de navegación (lejos del aviso sin conexión, que va abajo): "Demo compartida. Se reinicia cada 4 horas." en el teléfono, una versión larga en pantallas anchas, y el botón **"Reiniciar"**, que pide confirmación con el diálogo estándar. Al confirmar, la página se recarga con los datos de ejemplo y un aviso "Demo reiniciada". Reiniciar también afecta a quien esté usando la demo en ese momento.
- **Límites (solo en la demo):** 30 cambios por IP cada 10 minutos (luego 429, "Demasiados cambios seguidos…"); "Reiniciar" 5 veces por IP por hora y una vez por minuto en total; y un tope de 300 carreras: la siguiente carrera nueva fuerza un reinicio (o un 429 "La demo está llena…" si hubo uno hace menos de un minuto). Los límites por IP son en memoria y por instancia; el tope y el minuto entre reinicios se cuentan en la base.
- **Sin cambios en `schema.ts`:** la hora del último reinicio vive en `demo.reset_state`, un esquema aparte que crea el propio reinicio. Producción nunca lo toca, y `drizzle-kit` solo mira `public`.
- **La tasa BCV** es la real (`ve.dolarapi.com`), en la caché de la propia base de la demo, como en producción.

---

## 6. Arquitectura Técnica

### 6.1 Stack

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend + rutas API | SvelteKit 2 (Svelte 5, runes) | Requisito del usuario; excelente soporte en Vercel |
| Base de datos | Neon (Postgres serverless, driver HTTP) | Tier gratuito; integración nativa con Vercel; SQL estándar |
| ORM | Drizzle ORM | Ligero, tipado fuertemente, compatible con Neon + SvelteKit |
| Despliegue | Vercel (`adapter-vercel`, runtime `nodejs22.x`) | Tier gratuito; soporte zero-config para SvelteKit |
| Estilos | Tailwind CSS v4 + DaisyUI 5, tema `tab` | Utilities + componentes temáticos; costo cero |
| Tipografía | Poppins vía `@fontsource/poppins` | Autoalojada; ver Sección 5.2 |
| Toasts | `svelte-sileo` | Notificaciones de éxito y error |
| Idiomas | Paraglide JS (compilado con su CLI) | Solo envía los textos que usa cada página; ver 5.6 |
| Tasa BCV | `ve.dolarapi.com` + tabla `bcv_tasa_cache` | Gratuita; el caché es seguro para serverless y evita llamadas externas en cada carga de página |

Producción: `https://tab-ve.vercel.app`.

### 6.2 Mapa de Rutas SvelteKit

```
/                      → Página de inicio (SSR + cliente): carreras pendientes
/historial             → Página de historial (SSR + cliente): pagadas y papelera
/acceso                → PIN de la casa (GET pantalla, POST verificar); ver 2.3
/api/language          → POST { lang } (guarda el idioma en una cookie); ver 5.6
/api/viajes            → POST (crear), PATCH (marcar todo pagado)
/api/viajes/[id]       → PUT (editar), DELETE (borrado lógico),
                         PATCH (marcar pagado; o con cuerpo { precioUsd },
                         { unpay: true } o { restore: true })
/api/ubicaciones       → GET (todas las ubicaciones, por nombre)
/api/tasa-bcv          → GET (devuelve tasa en caché, actualiza si vence)
/api/demo/reset        → POST, solo con DEMO_MODE=on (lo responde el hook, no hay archivo de ruta); ver 5.7
```

Las listas de carreras no pasan por la API: las cargan los `load` del servidor de `/` y `/historial`.

### 6.3 Restricciones del Tier Gratuito

- Neon tier gratuito: 0.5 GB de almacenamiento, 190 horas de cómputo/mes. Más que suficiente para el POC.
- Vercel tier gratuito: 100 GB de ancho de banda, invocaciones de funciones serverless ilimitadas. Sin preocupaciones a esta escala.
- Sin APIs de terceros de pago en ninguna capa del stack.

### 6.4 PWA Instalable

La app se puede agregar a la pantalla de inicio (iOS con Safari, Android con Chrome) y abre como app independiente. El detalle de la implementación está en [pwa-implementation-plan.md](./pwa-implementation-plan.md).

- **Manifest** (`static/manifest.webmanifest`): `name` y `short_name` "Tab", `display: standalone`, orientación vertical, `lang: es`, `theme_color` `#13113f` y `background_color` `#0b0a29`.
- **Íconos** (`static/icons/`): 180 px para iOS, 192 y 512 px, un maskable de 512 px y favicons de 32 y 48 px, generados desde `design/icons/`.
- **Modo standalone:** `viewport-fit=cover` con márgenes de área segura (notch e indicador de inicio), sin rebote de scroll y un pull-to-refresh propio.
- **Sin service worker.** Abrir la app instalada sin señal muestra la página de error del navegador. La resiliencia de la Sección 7 cubre la pérdida de conexión con la app ya abierta.

---

## 7. Comportamiento Offline y Resiliencia

### 7.1 UI Optimista

- Al marcar como pagada, eliminar, restaurar o devolver a pendientes, el botón muestra un indicador de carga. En cuanto el servidor confirma, la tarjeta sale de la lista sin esperar a que se recarguen los datos, y un toast confirma la acción.
- Si la llamada falla, la tarjeta se queda donde estaba y un toast de error pide intentar de nuevo.

### 7.2 Cola sin Conexión

- Solo las **carreras nuevas** (formulario y carreras rápidas) se encolan. Si no hay conexión al guardar, o la conexión se cae durante la petición, la carrera se guarda en `localStorage` bajo la clave `tab_pending_rides`. En el formulario, un toast avisa que se enviará al volver la conexión. En una carrera rápida, el aviso aparece en el propio modal (ver Sección 3.9), sin toast, y solo se encola si no hay conexión al guardar: si la petición falla, el modal muestra el error con "Reintentar".
- Las carreras en cola aparecen arriba en Inicio, atenuadas al 80 % y con un indicador "Pendiente". Cuentan en los totales, pero no se pueden editar, pagar ni eliminar, y no entran en el recibo exportado.
- La cola se envía en orden al abrir la app con conexión y cada vez que el navegador emite el evento `online`. Cada carrera que el servidor acepta sale de la cola; las que fallan se quedan para el siguiente intento.
- Editar, pagar, eliminar y restaurar no se encolan: requieren conexión.

### 7.3 Indicador sin Conexión

- Mientras `navigator.onLine` es falso, un banner fijo al pie de la pantalla, en color `warning`, avisa que no hay conexión y que las carreras se guardarán al reconectar.
- No hay copia local de la lista de carreras: los datos vienen del `load` del servidor.

### 7.4 Fallback de Tasa BCV

- El servidor almacena la tasa en la base de datos con una marca de tiempo `obtenida_en`.
- Si la obtención en vivo falla pero existe un valor en caché, se devuelve el valor en caché.
- La respuesta de `/api/tasa-bcv` es `{ tasa, obtenidaEn, stale }`, donde `stale` indica que la tasa es del caché vencido, para que la UI pueda mostrar el indicador de frescura. Si no hay ninguna tasa, responde 503.

---

## 8. Lista de Ubicaciones — Seed Inicial

Las siguientes 25 ubicaciones se cargan en la tabla `ubicaciones` mediante la migración seed. Cualquier ubicación nueva que los usuarios creen desde la app se agrega a esta misma tabla de forma permanente.

| # | Nombre |
|---|---|
| 1 | Sambil Chacao |
| 2 | Sambil La Candelaria |
| 3 | San Ignacio |
| 4 | Cerro Verde |
| 5 | CCCT |
| 6 | Las Mercedes |
| 7 | Altamira |
| 8 | Los Palos Grandes |
| 9 | El Picacho |
| 10 | El Retiro |
| 11 | Líder |
| 12 | Millenium |
| 13 | El Limón |
| 14 | El Rocío |
| 15 | Rosalito |
| 16 | Bello Monte |
| 17 | Prime |
| 18 | El 93 |
| 19 | Galerías Las Américas |
| 20 | Ferretotal |
| 21 | El Coliseo |
| 22 | La Casona |
| 23 | La Superior |
| 24 | Los Altos |
| 25 | La Redoma |

Las columnas `direccion` se dejan en NULL en el seed inicial. Se pueden enriquecer después directamente en la DB si se desea.

---

## 9. Exclusiones Explícitas del POC

Las siguientes funcionalidades están explícitamente fuera de alcance para esta versión:

- Soporte para múltiples conductores
- División de costos por usuario ni seguimiento de deudas
- UI de administración para gestionar o eliminar ubicaciones (se añaden desde el flujo de carrera, no desde un panel)
- Notificaciones push o SMS
- Selector de modo claro / oscuro
- PWA offline-first con service worker completo (la resiliencia básica de la Sección 7 es suficiente)
- Exportación a CSV o PDF (el resumen en texto de la Sección 3.8 sí existe)
- Búsqueda o filtros en la página de Historial
- Paginación (carga-más es aceptable si la lista crece, pero no requerida inicialmente)
- Suite de pruebas automatizadas (pruebas manuales son aceptables para el POC)

---

## 10. Preguntas Abiertas / Spikes Pendientes

Todos los spikes resueltos. No quedan preguntas abiertas.

| # | Pregunta | Estado |
|---|---|---|
| S1 | Lista de ubicaciones seed | ✅ 25 ubicaciones en Sección 8 |
| S2 | Tasa BCV oficial vs paralela | ✅ Siempre tasa BCV oficial. Es solo referencia — el pago real puede ser a otra tasa |
| S3 | Límites del tier gratuito de Neon | ✅ Sin problema — storage < 1 MB en años de uso; compute < 3 CUH/mes vs 190 disponibles |
