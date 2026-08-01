# Plan de Implementación — PWA Instalable (iOS)

**Versión:** 1.0.0
**Fecha:** 2026-08-01
**Estado:** P1–P4 completos — P5 (deploy + UAT en dispositivo) es el siguiente paso
**Base:** [pwa-playbook.md](./pwa-playbook.md), adaptado a este repo

---

## Alcance

Hacer que Yummy Track se pueda **agregar a la pantalla de inicio del iPhone** y se comporte
como app nativa: sin barra de direcciones, con ícono propio, respetando el notch y el
indicador de home.

Este track es independiente de M9 (Tasa BCV) y M10 (Resiliencia) — se puede hacer antes,
después o en paralelo. **Solapa parcialmente con M10:** la parte de "ajustes finales de
táctiles y scroll en Safari mobile" de M10 queda cubierta por P4.

---

## Qué del playbook aplica y qué no

El playbook viene de memo-app, mismo stack (SvelteKit 2 + adapter-vercel + Tailwind 4 +
DaisyUI 5 en Vercel). La mecánica se transfiere; aproximadamente la mitad del contenido no
aplica.

| Fase del playbook | Aquí |
|---|---|
| Fase 0 — Preflight | ✅ Hecho (ver auditoría abajo) |
| Fase 1 — Íconos y manifest | ✅ Aplica, **más trabajo**: no existe `static/` ni `design/` |
| Fase 2 — Head HTML | ✅ Aplica **simplificado**: no hay toggle de tema |
| Fase 3 — Safe areas | ✅ Aplica, **obligatorio y más amplio**: 3 elementos anclados abajo |
| Fase 4 — Auth en standalone | ❌ No aplica — no hay auth. Ver nota sobre localStorage |
| Fase 5 — Logout compartido | ❌ No aplica — no hay sesiones |
| Fase 6 — Menú de cuenta | ❌ No aplica — ya existe y ya es alcanzable en móvil |
| Fase 7 — Deploy y verificación | ✅ Aplica tal cual |
| Fase 8 — Service worker | ⚠️ Opcional, pero **menos obvio aquí** (ver P6) |
| Apéndice — Google OAuth | ❌ No aplica |

### Auditoría preflight (Fase 0)

| Pregunta | Respuesta |
|---|---|
| ¿Manifest o apple-touch-icon existentes? | **No.** `src/app.html` solo tiene charset, viewport y description |
| ¿Dónde viven los assets estáticos? | **No existe `static/`.** Hay que crearlo — hoy ni siquiera hay favicon |
| ¿Toggle de tema claro/oscuro? | **No.** `app.html` fija `data-theme="dark"`. No hay store de tema |
| ¿Barra inferior fija? | **Sí, tres elementos** — ver P4 |
| ¿Chrome solo-desktop que esconda acciones? | **No.** El selector de usuario vive en `navbar-end`, siempre visible |
| ¿Mecanismo de auth? | **Ninguno.** El "usuario" es una lista fija de 3 en `user.svelte.ts` + localStorage |
| ¿Deploys? | CLI-push al proyecto `yummy-tracker`. Se despliega el working tree — **commitear antes** |

---

## Decisiones tomadas

1. **Nombre:** "Yummy Track". El typo "Yuumy" ya fue corregido en README, PRD, plan de
   implementación, `app.html` y `UserSelect.svelte`.
   - `name`: `Yummy Track`
   - `short_name` / `apple-mobile-web-app-title`: `Yummy` (el label de la pantalla de
     inicio; iOS trunca alrededor de 12 caracteres)
2. **Ícono:** morado y blanco, autoría propia en SVG. Sin gris oscuro en el arte.
3. **Tema:** solo oscuro. `theme-color` es **un hex estático**, sin JS que lo actualice.

### Paleta

Tokens reales de DaisyUI dark en este proyecto, convertidos a hex (`theme-color` no acepta
`oklch()` ni variables CSS):

| Uso | Token | Hex |
|---|---|---|
| `theme-color` (tint de la status bar) | `--color-base-200` (fondo del navbar) | `#191e24` |
| `background_color` (splash) | `--color-base-100` | `#1d232a` |
| Morado del ícono | ver nota | `#7c5cff` |
| Blanco del ícono | — | `#ffffff` |

**Nota sobre el morado.** El `--color-primary` actual de DaisyUI dark es `#605dff`, que es
más índigo que morado. Para el ícono propongo `#7c5cff` — claramente morado, pero contiguo
al primary para que el ícono no se pelee con la UI. Si prefieres que coincidan exacto,
usamos `#605dff` y queda un poco más azul.

**`theme-color` usa base-200, no base-100.** Lo que queda pegado a la status bar en
standalone es el navbar, que es `bg-base-200`. Con base-100 se vería una franja de tono
distinto arriba.

---

## Milestones

### P1 — Diseño del ícono
**Qué se construye:** Tres SVG fuente en `design/icons/`, versionados junto con el comando
de regeneración:

- `icon.svg` — 1024×1024, **arte a sangre completa** (sin padding propio; iOS aplica su
  propia máscara de esquinas redondeadas). Campo morado sólido, glifo blanco.
- `icon-maskable.svg` — mismo arte, glifo escalado a ~74–80% del centro (el recorte
  maskable de Android es agresivo).
- `favicon.svg` — variante más gruesa y con menos elementos; el ícono de 1024 se convierte
  en papilla a 16–32px.

**Concepto propuesto:** campo morado a sangre + glifo blanco de ruta (punto de origen →
curva → pin de destino), que es literalmente lo que la app registra. Favicon: una "Y"
blanca gruesa. Te muestro los renders antes de seguir.

**UAT:** Ves los tres SVG renderizados. El de 1024 se lee bien y el favicon sigue siendo
legible a 32px.

**Estado:** ✅ Completo — `design/icons/{icon,icon-maskable,favicon}.svg` +
`design/icons/regenerate.sh`. En la primera pasada el remate redondo de la ruta asomaba
por debajo de la punta del pin; se corrigió metiendo el final de la curva dentro del cuerpo
del pin.

---

### P2 — Rasterizar y manifest
**Qué se construye:**

- `static/icons/`: `icon-1024/512/192/180.png`, `icon-maskable-512.png`,
  `favicon-32.png`, `favicon-48.png` — con el bloque `sips` del playbook (macOS, sin
  dependencias).
- `static/manifest.webmanifest`:

```json
{
  "name": "Yummy Track",
  "short_name": "Yummy",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "lang": "es",
  "dir": "ltr",
  "theme_color": "#191e24",
  "background_color": "#1d232a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`start_url` es `/` porque no hay login. La pantalla de selección de usuario es un overlay
sobre `/`, no una ruta.

**UAT:** `sips -g pixelWidth -g pixelHeight` confirma las dimensiones reales de cada PNG
(un fallo silencioso produce un PNG de 0 bytes que igual responde 200 en producción). Abres
el de 512 y lo miras.

**Estado:** ✅ Completo — 6 PNG, todas las dimensiones verificadas, los tres renders
revisados a ojo. No se genera PNG de 1024: nada lo referencia y `sips` lo escribía en
~900KB. `design/icons/icon.svg` es el master.

---

### P3 — Head HTML
**Qué se construye:** Parche a `src/app.html`:

- `viewport-fit=cover` agregado al meta viewport existente
- `<link rel="manifest" href="/manifest.webmanifest">`
- `<link rel="apple-touch-icon" href="/icons/icon-180.png">`
- Favicons PNG reales por ruta (32 y 48) — **no un data: URI**; iOS no usa data: URIs para
  el ícono de pantalla de inicio, y los bundlers inlinean assets bajo ~4KB
- `apple-mobile-web-app-capable` y `mobile-web-app-capable` = `yes`
- `apple-mobile-web-app-title` = `Yummy`
- `apple-mobile-web-app-status-bar-style` = `default`
- `<meta name="theme-color" content="#191e24">` — un solo valor, sin media query y sin JS

**Sale junto con P4, no antes.** `viewport-fit=cover` sin insets mete la UI debajo del
indicador de home.

**UAT:** En Safari desktop, `view-source` muestra todos los tags. La pestaña ya no muestra
el ícono genérico.

**Estado:** ✅ Completo — los 10 tags verificados con el grep del playbook contra
`pnpm preview`. El manifest se sirve como `application/manifest+json` sin configuración
extra, y los 6 PNG responden 200 `image/png`.

---

### P4 — Safe areas y chrome standalone
**Qué se construye:** En `src/app.css`:

```css
:root {
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-top: env(safe-area-inset-top, 0px);
}
```

El fallback `, 0px` importa: en pestaña de navegador y en hardware sin indicador de home
estas variables resuelven a nada.

Además: `overscroll-behavior-y: none` en `html, body` (hoy es `contain` solo en `body` —
el rubber-band delata que es un sitio web), `-webkit-text-size-adjust: 100%` y
`-webkit-tap-highlight-color: transparent`.

Luego, tres elementos anclados abajo, cada uno con su clase nombrada (greppable después,
en vez de valores arbitrarios inline):

| Elemento | Archivo | Hoy | Queda |
|---|---|---|---|
| FAB "+" | `src/routes/+page.svelte:204` | `fixed bottom-6` | `calc(1.5rem + var(--safe-bottom))` |
| Banner offline | `src/routes/+layout.svelte:45` | `fixed bottom-0 py-2` | `padding-bottom: calc(0.5rem + var(--safe-bottom))` |
| Footer del bottom sheet | `src/lib/components/AddRideSheet.svelte` | `px-4 py-3` en `modal-bottom` | `padding-bottom: calc(0.75rem + var(--safe-bottom))` |

**El footer del sheet es el que el playbook no cubre.** El `modal-box` de un
`modal-bottom` de DaisyUI se pega al borde inferior del viewport, así que "Guardar Carrera"
y "Cancelar" caen justo debajo del indicador de home.

Y el que es fácil olvidar: **`<main>` no reserva espacio inferior hoy** (`p-4` a secas), así
que la última tarjeta ya queda parcialmente bajo el FAB. Crece a
`calc(1rem + 4rem + var(--safe-bottom))`.

**Estado:** ✅ Código completo — UAT pendiente, requiere P5 + dispositivo.

**Hallazgo durante la implementación:** la lista de carreras ya traía `pb-24` hardcodeado
para el FAB — exactamente la trampa del playbook. Sin el inset, la última tarjeta se corta
al crecer la zona segura. Reemplazado por `.pwa-list-inset`.

**UAT (en iPhone real, ya instalado — este UAT depende de P5):** no hay barra de
direcciones; el FAB, el banner de offline y los botones del sheet quedan por encima del
indicador de home; se puede tocar "Guardar Carrera" sin pelearse con el gesto de home; la
última tarjeta de la lista se ve completa al hacer scroll hasta abajo; no hay rebote de
rubber-band.

**Estado:** ⬜ Pendiente

---

### P5 — Deploy y verificación
**Qué se construye:** Nada nuevo — es la fase que hace que todo lo anterior exista.

**Nada está vivo hasta desplegarlo, y iOS reporta un manifest faltante como *no hay ícono*,
no como error.** Commitear primero (el deploy por CLI empuja el working tree), desplegar, y
correr contra el alias de producción:

```sh
B=https://<alias-de-produccion>
for p in /manifest.webmanifest /icons/icon-180.png /icons/icon-512.png \
         /icons/icon-maskable-512.png /icons/favicon-32.png; do
  printf "%-32s HTTP %s  %s\n" "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' $B$p)" \
    "$(curl -s -o /dev/null -w '%{content_type}' $B$p)"
done
curl -s $B/ | grep -oE 'rel="(manifest|apple-touch-icon|icon)"[^>]*|name="(apple-mobile-web-app-[a-z-]*|theme-color)" content="[^"]*"|viewport-fit=cover'
```

Confirmar que el manifest sirve como `application/manifest+json`.

En el dispositivo: **borrar cualquier ícono previo de la pantalla de inicio** (es un
snapshot viejo y no toma el manifest nuevo), refrescar duro en Safari cerrando y reabriendo
la pestaña, y volver a agregar.

**UAT:** Todos los assets responden 200. En el iPhone: el ícono correcto con el label
"Yummy", sin barra de direcciones al abrir, la status bar tintada de `#191e24` sin franja
de color distinto, y todo el UAT de P4.

**Estado:** ⬜ Pendiente

---

### P6 — Service worker (opcional, decidir después)
**Qué se construye:** Nada por ahora.

El playbook dice saltárselo para apps de datos en vivo, y para iOS **no hace falta** para
"Agregar a pantalla de inicio". Pero esta app es un caso limítrofe: ya cortejaba el uso
offline con `networkState` y la cola de `pendingStore`. Sin service worker, **abrir la app
instalada sin señal muestra la página de error de Safari en vez de la app** — la cola
offline solo sirve si la página ya estaba cargada.

Propongo enviar P1–P5 primero y tratar esto como su propio milestone si el escenario
"abrir sin señal" resulta molesto en uso real.

**Estado:** ⬜ Diferido

---

## Nota: localStorage en el contenedor standalone

Análogo directo a la Fase 4 del playbook (que ahí era sobre cookies). **Una PWA instalada
tiene su propio localStorage, separado de Safari.** Dos consecuencias aquí:

1. **El usuario activo se resetea.** Al primer lanzamiento de la app instalada aparece la
   pantalla de selección de usuario. Es lo esperado, no un bug — pero se va a reportar como
   bug si no se avisa.
2. **Las carreras encoladas en Safari son invisibles para la app instalada** y nunca se van
   a sincronizar desde ahí. Antes de instalar, conviene abrir la app en Safari con
   conexión y confirmar que la cola de pendientes está vacía.

---

## Orden de dependencias

```
P1 → P2 → P3 ─┐
              ├→ P5 → (P6)
         P4 ──┘
```

P3 y P4 deben desplegarse juntos: `viewport-fit=cover` sin los insets empuja la UI debajo
del indicador de home. El UAT real de P4 solo se puede hacer después de P5.

---

## Bloqueador resuelto en el camino: runtime de Node

`pnpm build` fallaba en el paso del adaptador, **antes de tocar nada de PWA**:

```
Building locally with unsupported Node.js version: v24.15.0.
Please use Node 18, 20 or 22, or explicitly specify a runtime.
```

`adapter-vercel` infiere el runtime de la versión de Node de **la máquina que compila** y
solo reconoce 18/20/22. Node 24 ya es el default de Vercel, así que esto no era solo un
problema local — el deploy de P5 habría fallado igual. Corregido fijándolo explícito en
`svelte.config.js`:

```js
adapter: adapter({ runtime: 'nodejs22.x' })
```

Si en algún momento quieres mover el runtime a `nodejs24.x`, es un cambio de una línea ahí.

---

## Trampas conocidas (del playbook, filtradas a las que aplican aquí)

| Trampa | Consecuencia | Mitigación |
|---|---|---|
| Favicon SVG inlineado como `data:` URI | iOS no muestra ícono, sin error | PNGs reales referenciados por ruta |
| `viewport-fit=cover` sin insets | FAB y botones del sheet bajo el indicador de home | P3 y P4 salen juntos |
| Padding inferior hardcodeado | Última tarjeta cortada | `calc(<original> + var(--safe-bottom))` |
| Glifo a sangre en el ícono maskable | Android recorta el arte | Variante aparte al ~74–80% |
| Asumir que el deploy ocurrió | El teléfono no muestra ícono y no hay error que lo explique | Curl al alias antes de tocar el teléfono |
| Ícono viejo en la pantalla de inicio | No toma el manifest nuevo | Borrarlo antes de re-agregar |
