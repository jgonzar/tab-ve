# Plan de Implementación — Yummy Track App

**Versión:** 1.0.0  
**Fecha:** 2026-05-12  
**Estado:** Pendiente — M1 es el siguiente paso  

---

## Milestones

### M1 — Fundación del Proyecto
**Qué se construye:** SvelteKit + Tailwind + DaisyUI instalados, conexión a Neon configurada, esquema Drizzle con todas las tablas, migración ejecutada, seed de 3 usuarios y 25 ubicaciones cargado, deploy a Vercel.

**UAT:** La URL de Vercel carga sin errores. El esquema de la DB existe y el seed está cargado.

**Estado:** ✅ Completo

---

### M2 — Shell & Navegación
**Qué se construye:** Barra de navegación (nombre de app, avatar, hamburguesa), drawer lateral (Inicio / Historial), pantalla de selección de usuario (primer lanzamiento), popover de cambio de usuario, tema oscuro completo.

**UAT:** Puedes seleccionar tu usuario, ver tus iniciales en el avatar, navegar entre Inicio e Historial, y cambiar de usuario desde el avatar.

**Estado:** ✅ Completo

---

### M3 — Agregar Carrera

**Qué se construye:** Bottom sheet con el formulario completo (clientes, conductor, origen, paradas, destino, precio, espera, notas), desplegable de ubicaciones con búsqueda, creación de ubicaciones nuevas desde el formulario, endpoint `POST /api/viajes`.

**UAT:** Puedes abrir el "+", llenar todos los campos, buscar y seleccionar ubicaciones, crear una ubicación nueva que no existe en la lista, guardar y confirmar que existe en la DB.

**Estado:** ✅ Completo

---

### M4 — Lista de Carreras (Home)
**Qué se construye:** Endpoint `GET /api/viajes` (pendientes), componente ride card completo (ruta, precio USD + Bs, chips de clientes, conductor, espera, notas, fecha), página de Inicio con la lista.

**UAT:** Las carreras creadas en M3 aparecen como tarjetas con toda su información correcta.

**Estado:** ✅ Completo

---

### M5 — Resumen (Summary Bar)
**Qué se construye:** Barra sticky en el top de Inicio con "Carreras Pendientes" (conteo) y "Monto Pendiente" (total USD). El Bs se agrega en M9.

**UAT:** El conteo y total en USD se actualizan al agregar carreras. La barra se mantiene visible al hacer scroll.

**Estado:** ✅ Completo

---

### M6 — Marcar como Pagado
**Qué se construye:** Endpoint `PATCH /api/viajes/[id]`, acción en el botón de la tarjeta, UI optimista, animación slide-out al desaparecer de la lista.

**UAT:** Tocas "Marcar como Pagado", la tarjeta sale deslizándose, el resumen se actualiza. La carrera ya no está en Inicio.

**Estado:** ✅ Completo

---

### M7 — Historial
**Qué se construye:** Endpoint `GET /api/viajes` (pagados), página `/historial` con tarjetas en variante pagada (fecha de pago, sin botón, sin ···).

**UAT:** Las carreras pagadas aparecen en Historial con la fecha en que se marcaron.

**Estado:** ✅ Completo

---

### M8 — Editar y Eliminar
**Qué se construye:** Menú ··· en cada tarjeta, flujo de edición (pre-populate el form, `PUT /api/viajes/[id]`), flujo de eliminación con modal de confirmación (`DELETE /api/viajes/[id]`).

**UAT:** Puedes corregir cualquier campo de una carrera pendiente. Puedes eliminar con confirmación.

**Estado:** ⬜ Pendiente

---

### M9 — Tasa BCV y Bolívares
**Qué se construye:** Ruta `GET /api/tasa-bcv` (fetch de yadio.io + caché en DB con TTL 24h), montos en Bs en cada tarjeta, total en Bs en la barra de resumen, indicador de tasa desactualizada.

**UAT:** Cada tarjeta muestra el equivalente en bolívares. La barra de resumen muestra el total en Bs. Si la tasa es de ayer, lo indica.

**Estado:** ⬜ Pendiente

---

### M10 — Resiliencia y Polish
**Qué se construye:** UI optimista en todas las mutaciones, cola de reintentos para requests fallidos, banner de datos en caché cuando no hay conexión, animaciones completas (slide-in al crear, slide-out al pagar, drawer, bottom sheet), ajustes finales de táctiles y scroll en Safari/Chrome mobile.

**UAT:** Con modo avión: agrega una carrera, aparece optimistamente, recupera conexión, confirma que se guardó. Todo se siente fluido en iPhone y Android.

**Estado:** ⬜ Pendiente

---

## Orden de Dependencias

```
M1 → M2 → M3 → M4 → M5
                      ↓
                     M6 → M7
                      ↓
                     M8
                      ↓
                     M9 → M10
```

---

## Referencia Rápida de Stack

| Capa | Tecnología |
|---|---|
| Frontend + API | SvelteKit (Svelte 5) |
| Base de datos | Neon (Postgres serverless) |
| ORM | Drizzle ORM |
| Estilos | Tailwind CSS v4 + DaisyUI |
| Despliegue | Vercel (free tier) |
| Tasa BCV | ve.dolarapi.com (free, no API key) |
