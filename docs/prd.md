# Documento de Requisitos del Producto — Yummy Track App

**Versión:** 0.2.0  
**Fecha:** 2026-05-12  
**Autor:** JA  
**Estado:** Borrador  

---

## 1. Descripción General

### 1.1 Problema

Yummy es el servicio de transporte por aplicación predominante en Venezuela. JA y Marcela utilizan regularmente a una conductora de confianza, MC, para sus traslados. El seguimiento de las carreras, sus costos y el monto acumulado adeudado se hace actualmente rebuscando mensajes de chat, lo que resulta tedioso y propenso a errores. Los pagos se realizan en lotes, no por viaje, por lo que es fácil perder la cuenta.

### 1.2 Solución

Yummy Track App es una aplicación web ligera y optimizada para móvil que permite registrar y dar seguimiento a los viajes de Yummy. Muestra todos los viajes pendientes de pago en una sola pantalla, permite marcarlos como pagados y presenta los totales tanto en dólares (USD) como en bolívares venezolanos (usando la tasa BCV diaria).

### 1.3 Objetivos (POC)

- Registrar viajes con uno o más usuarios, origen/paradas/destino, precio en USD y tiempo de espera opcional.
- Mostrar todos los viajes pendientes en la pantalla principal con totales acumulados.
- Marcar viajes como pagados — los viajes pagados se mueven al historial.
- Mostrar totales en USD y bolívares (tasa BCV diaria, en caché).
- Selección de usuario simple y persistente — sin contraseñas.
- 100 % gratuito para operar. Despliegue en Vercel.
- Optimizado para iPhone / Safari y Android / Chrome en modo oscuro.
- Interfaz completamente en español.

### 1.4 Exclusiones del POC

- Soporte para múltiples conductores (siempre el mismo conductor de confianza).
- División de costos por usuario ni seguimiento de reembolsos internos.
- Notificaciones push o recordatorios.
- App nativa iOS/Android (PWA es aceptable como mejora futura).
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
- La selección se persiste en `localStorage` bajo la clave `yummy_active_user`.
- El ícono de avatar en la esquina superior derecha de la barra de navegación muestra las iniciales del usuario activo. Al tocarlo se abre un popover pequeño para cambiar de usuario.
- Sin contraseñas, sin tokens, sin sesión del lado del servidor. La identidad es exclusivamente local al dispositivo.
- Cuando MC está activa, el formulario de nueva carrera pre-selecciona su nombre como conductora pero exige asignar al menos un cliente (JA, Marcela o ambos).

**Justificación:** La app es un registro compartido entre los tres. Identidad local al dispositivo es suficiente.

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
- Se muestra en la tarjeta del viaje como "⏱ 30 min espera" si es distinto de cero.

### 3.4 Gestión de Destinos

**Lista de ubicaciones** — todas las ubicaciones viven en una sola tabla compartida entre los tres usuarios. La lista se pre-carga con los destinos comunes (ver Sección 8) y crece con el uso.

Cada entrada tiene:
- `nombre` — etiqueta legible (ej. "Sambil Chacao", "El Retiro")
- `dirección` — cadena de texto descriptiva opcional

La UI presenta la lista como un desplegable con búsqueda integrada (filtrado en tiempo real por nombre).

**Añadir destinos nuevos:** Cuando el lugar buscado no existe en la lista, cualquier usuario puede escribir un nombre nuevo directamente en el campo de búsqueda. Al guardar la carrera, ese destino se crea en la base de datos como una ubicación permanente — aparecerá en el desplegable de todos los usuarios en adelante. No hay distinción entre "ubicaciones comunes" y "ubicaciones personalizadas"; todas son iguales y reutilizables.

**Deduplicación:** El desplegable muestra sugerencias mientras el usuario escribe, lo que reduce entradas duplicadas por error. No hay deduplicación automática en el POC.

### 3.5 Pago e Historial

- Cualquier usuario en el dispositivo puede marcar cualquier viaje como pagado.
- Marcar un viaje como pagado establece `pagado_en = ahora()` y lo elimina de la lista de Inicio.
- Los viajes pagados son accesibles en la página de **Historial**, listados en orden cronológico inverso.
- No hay deshacer en el POC — si un viaje se marca como pagado por error, permanece en el historial.
- La página de Inicio siempre muestra **todos los viajes pendientes** sin importar su antigüedad (sin ciclo mensual).

**Edición:** Los viajes pendientes pueden editarse en su totalidad (todos los campos). Los viajes pagados son de solo lectura en el POC.

### 3.6 Conversión de Moneda (Tasa BCV)

- Todos los precios se ingresan y almacenan en **USD**.
- La app obtiene y almacena en caché la tasa de cambio oficial BCV diaria (bolívares por USD).
- El resumen en la página de Inicio muestra el monto total pendiente en USD y bolívares.
- Las tarjetas individuales de viaje muestran el equivalente en bolívares como texto secundario de menor tamaño.
- La tasa en caché se actualiza una vez al día (TTL: 24 horas). La app usa el valor en caché entre actualizaciones.
- Si la tasa no puede obtenerse (sin conexión, API no disponible), se usa la última tasa conocida con un indicador visual (ej. "Tasa del día anterior").
- Si no existe ninguna tasa en caché, la conversión a bolívares se oculta y se muestra una advertencia pequeña.

**Fuente de la tasa BCV seleccionada: `yadio.io`**

| Criterio | Evaluación |
|---|---|
| URL | `https://yadio.io/api/rate/USD/VES` |
| Costo | Gratuito, sin clave de API |
| Formato | JSON `{ "rate": 123456.78, ... }` |
| Confiabilidad | Ampliamente usado en la comunidad dev venezolana; provee tasa BCV oficial |
| Mantenimiento | Cero — sin dependencia de scraping ni cambios de HTML |

La tasa se obtiene del lado del servidor (ruta API de SvelteKit) para evitar problemas de CORS y centralizar el caché en la base de datos. Si `yadio.io` no responde, se devuelve la última tasa almacenada en `bcv_rate_cache`.

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
| Esquema de color | Solo modo oscuro (sin selector claro/oscuro en el POC) |
| Dispositivos objetivo | iPhone (375–430 px) en Safari y Android (~360–412 px) en Chrome |
| Área mínima de toque | 44 × 44 pt (Apple HIG) |
| Tipografía | Pila de fuente del sistema (`-apple-system, BlinkMacSystemFont, "Segoe UI"`) |
| Idioma | 100 % español — todos los textos, etiquetas, mensajes de error y estados |
| Animaciones | Presentes pero sutiles — ver Sección 5.5 |
| Conexión | Usable con conectividad degradada o intermitente |

### 5.2 Sistema de Diseño

| Capa | Tecnología | Justificación |
|---|---|---|
| Estilos base | Tailwind CSS v4 | Utilidades; excelente soporte de modo oscuro |
| Componentes UI | DaisyUI (plugin Tailwind) | Biblioteca de componentes semánticos, themed, accesibles; cero costo |

DaisyUI provee los componentes base (botones, tarjetas, drawers, badges, modales, toasts, etc.) con theming de modo oscuro nativo. Los colores y tokens de marca de Yummy Track se definen sobre el tema oscuro de DaisyUI.

### 5.3 Estructura de Navegación

```
Barra de navegación superior
├── Izquierda: Hamburguesa → Drawer lateral
├── Centro:    "Yummy Track" (nombre de la app)
└── Derecha:   Chip de avatar (iniciales del usuario) → Popover cambio de usuario

Drawer lateral
├── Inicio          (por defecto)
└── Historial
    [Futuro: Configuración]
```

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
- Se persiste en `localStorage`; no se muestra de nuevo hasta que el usuario toca su avatar para cambiar.

### 5.5 Animaciones

Las animaciones deben sentirse nativas a móvil: rápidas, fluidas y con propósito. No deben agregar latencia percibida.

| Interacción | Animación |
|---|---|
| Agregar un nuevo viaje | La tarjeta hace slide-in desde abajo y aparece en la parte superior de la lista (duración: ~250 ms, ease-out) |
| Marcar viaje como pagado | La tarjeta hace slide-out hacia la derecha con fade de salida antes de eliminarse de la lista (~300 ms) |
| Abrir / cerrar el bottom sheet | Slide up desde la parte inferior de la pantalla (~280 ms) |
| Abrir / cerrar el drawer lateral | Slide in desde la izquierda (~220 ms) |
| Toast de éxito / error | Fade in desde la parte superior + auto-dismiss (~2 s) |
| Cambio de usuario | Fade cruzado suave del avatar (~150 ms) |

Todas las animaciones deben respetar `prefers-reduced-motion` (reducir a crossfade instantáneo o sin animación).

---

## 6. Arquitectura Técnica

### 6.1 Stack

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend + rutas API | SvelteKit (Svelte 5) | Requisito del usuario; excelente soporte en Vercel |
| Base de datos | Neon (Postgres serverless) | Tier gratuito; integración nativa con Vercel; SQL estándar |
| ORM | Drizzle ORM | Ligero, tipado fuertemente, compatible con Neon + SvelteKit |
| Despliegue | Vercel | Tier gratuito; soporte zero-config para SvelteKit |
| Estilos | Tailwind CSS v4 + DaisyUI | Utilities + componentes temáticos; costo cero |
| Caché de tasa BCV | Tabla `bcv_tasa_cache` | Seguro para serverless; evita llamadas externas en cada carga de página |

### 6.2 Mapa de Rutas SvelteKit

```
/                      → Página de inicio (SSR + cliente)
/historial             → Página de historial (SSR + cliente)
/api/viajes            → GET (listar), POST (crear)
/api/viajes/[id]       → PUT (editar), PATCH (marcar pagado)
/api/ubicaciones       → GET (lista de comunes)
/api/tasa-bcv          → GET (devuelve tasa en caché, actualiza si vence)
```

### 6.3 Restricciones del Tier Gratuito

- Neon tier gratuito: 0.5 GB de almacenamiento, 190 horas de cómputo/mes. Más que suficiente para el POC.
- Vercel tier gratuito: 100 GB de ancho de banda, invocaciones de funciones serverless ilimitadas. Sin preocupaciones a esta escala.
- Sin APIs de terceros de pago en ninguna capa del stack.

---

## 7. Comportamiento Offline y Resiliencia

### 7.1 UI Optimista

- Cuando el usuario envía un nuevo viaje o marca uno como pagado, la UI se actualiza **inmediatamente** — se asume que la acción tendrá éxito.
- La llamada a la API se ejecuta en segundo plano.
- Si la llamada falla: el cambio optimista se revierte y se muestra un toast/banner ("No se pudo guardar — se reintentará").

### 7.2 Cola de Reintentos

- Las mutaciones fallidas se almacenan en una cola ligera en memoria (o en `localStorage` para persistencia entre recargas).
- Cuando se restaura la conectividad (detectado via `navigator.onLine` + listener de `visibilitychange`), la cola se vacía y las mutaciones se repiten en orden.
- Si una mutación en cola falla de nuevo, el usuario ve un error en línea en la tarjeta afectada con una acción manual de "Reintentar".

### 7.3 Indicador de Datos Desactualizados

- Si la app no puede conectarse al servidor al cargar, se muestra la última lista de viajes obtenida exitosamente desde un caché del lado del cliente (caché de `load` de SvelteKit o snapshot en `localStorage`).
- Un banner en la parte superior de la página indica "Mostrando datos en caché — reconectando…" hasta que se confirme la conectividad.

### 7.4 Fallback de Tasa BCV

- El servidor almacena la tasa en la base de datos con una marca de tiempo `obtenida_en`.
- Si la obtención en vivo falla pero existe un valor en caché, se devuelve el valor en caché.
- La respuesta de la API incluye `{ tasa, obtenida_en, esta_desactualizada: boolean }` para que la UI pueda mostrar el indicador de frescura.

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
- Deshacer "marcar como pagado"
- UI de administración para gestionar o eliminar ubicaciones (se añaden desde el flujo de carrera, no desde un panel)
- Notificaciones push o SMS
- Selector de modo claro / oscuro
- PWA offline-first con service worker completo (la resiliencia básica de la Sección 7 es suficiente)
- Exportación (CSV, PDF)
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
