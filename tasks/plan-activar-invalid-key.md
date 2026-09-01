# Plan — fix: no se puede activar un artículo "sin activar" (Invalid key al subir foto)

Plan separado de `tasks/plan.md` (fix de 404 en curso, con checkpoint pendiente
de confirmación de push) — tarea distinta, sin dependencia entre ambas.

## Contexto (ya diagnosticado en la conversación, no re-investigar)

**Síntoma:** al intentar activar cualquier artículo de la lista "Sin activar"
(los que trae el worker de Búho a `catalogo_buho_espejo`), subir la primera
foto falla con `Invalid key: luminosos/MOÑOLUZ-1788273245745-1.webp`. Pasa
con cualquier artículo cuyo código traiga un caracter no-ASCII (ñ, tilde),
no es un artículo puntual.

**Causa raíz confirmada:** `app/components/admin/EspejoTab.tsx`, función
`agregarFoto()` (línea ~196-209), llama:
```ts
const carpeta = fila.familia ? fila.familia.toLowerCase().replace(/\s+/g, '-') : 'productos';
const url = await subirFoto(supabaseBrowser(), blob, carpeta, fila.codigo, fotos.length + 1);
```
`lib/procesar-foto.ts:subirFoto()` arma la key de Supabase Storage como
`${carpeta}/${slugProducto}-${Date.now()}-${sufijo}.webp` sin sanitizar nada
— usa `fila.codigo` (código crudo del POS) tal cual, y `carpeta` sólo saca
espacios, no diacríticos. Supabase Storage rechaza keys con caracteres
no-ASCII → `Invalid key`.

**Por qué en otros lugares no pasa:** `ProductoEditModal.tsx` ya usa
`producto.slug` (generado con NFD + strip de diacríticos al crear el
producto) en vez de un código crudo — por eso ese flujo no dispara el bug
hoy. Pero la construcción de `carpeta` en ese mismo archivo (`agregarFoto`
línea 324, `subirImagenVariante` línea 216) usa la misma lógica naive que
`EspejoTab.tsx` (`familia.toLowerCase().replace(/\s+/g,'-')`, sin strip de
diacríticos) — mismo bug, latente, dispara en cuanto una familia tenga
tilde/ñ (ej. "Decoración").

Ya existen dos implementaciones de slugify con strip de diacríticos en el
repo: `lib/catalogo-mundo.ts:slugifyMundo()` (genérica pese al nombre) y una
inline duplicada dentro de `EspejoTab.tsx:activar()` (~línea 226-231, arma
`slugTitulo`). Triplicar sería un tercer copy-paste — se extrae una sola
función compartida.

## Dependencias entre componentes

```
lib/slug.ts (nuevo — slugify genérico, extraído del cuerpo ya probado
             de slugifyMundo)
    │
    ├─▶ lib/catalogo-mundo.ts
    │      slugifyMundo pasa a ser slugify re-exportado con ese nombre
    │      (no rompe los ~10 imports existentes que ya usan slugifyMundo)
    │
    ├─▶ app/components/admin/EspejoTab.tsx
    │      ├─ agregarFoto(): sanitiza `carpeta` y `fila.codigo` antes de
    │      │  subirFoto() — ESTE es el fix del bug reportado
    │      └─ activar(): `slugTitulo` pasa a usar slugify() en vez de la
    │         lógica inline duplicada
    │
    └─▶ app/components/admin/ProductoEditModal.tsx
           ├─ agregarFoto(): sanitiza `carpeta` (producto.familia) — mismo
           │  bug latente, misma causa raíz
           └─ subirImagenVariante(): sanitiza `carpeta` (producto.familia)
              — ídem
```

No toca nada de imágenes de variantes/carrusel en la ficha pública (auditoría
aparte, plan aparte).

## Sprints (cada uno: commit propio, suite completa en verde antes de
commitear, sin push sin pedido explícito, build/test siempre vía subagentes
de `agent-skills`)

### Sprint 0 — Extraer `slugify` compartido (refactor sin cambio de comportamiento)
**Cambio:** nuevo `lib/slug.ts` con `export function slugify(s: string): string`
— mismo cuerpo que ya tiene `slugifyMundo` hoy (NFD, strip diacríticos,
`[^a-z0-9]+` → `-`, trim de guiones). `lib/catalogo-mundo.ts` pasa a
re-exportar: `export { slugify as slugifyMundo } from './slug';` (o
`export const slugifyMundo = slugify`) — mantiene el nombre para no tocar
los imports existentes, sin lógica duplicada.

**Acceptance criteria:**
- `lib/slug.ts` existe, exporta `slugify`, mismo comportamiento carácter por
  carácter que el `slugifyMundo` viejo.
- `tests/unit/catalogo-mundo.test.js` sigue en verde sin modificar (prueba
  que el re-export preserva el comportamiento exacto).
- Nuevo `tests/unit/slug.test.ts` con los mismos casos (ej. `'Piñatas
  Grandes'` → `'pinatas-grandes'`, `'MOÑOLUZ'` → `'monoluz'`) más un caso
  con símbolos sueltos.
- Suite completa (tsc + unit + build) en verde.
- Commit local.

### Sprint 1 — Fix de raíz: EspejoTab.tsx sanitiza antes de subir la foto
**Cambio:** en `agregarFoto()`, sanitizar `carpeta` y reemplazar `fila.codigo`
por `slugify(fila.codigo)` en la llamada a `subirFoto()`. En `activar()`,
reemplazar la lógica inline de `slugTitulo` por `slugify(fila.nombre)`
(dedup, sin cambio de comportamiento ahí — ya usaba la misma lógica).

**Importante:** `fila.codigo` sanitizado se usa SÓLO para el nombre de
archivo en Storage — el `codigo` real que se guarda en
`catalogo_productos.codigo` (línea `insert(...)`) sigue siendo
`fila.codigo` tal cual, sin tocar (es el código real de Búho/POS, tiene que
matchear exacto).

**Acceptance criteria:**
- Subir una foto para un artículo con código/familia con ñ o tilde (ej.
  `MOÑOLUZ`) ya no dispara `Invalid key` — la key generada es ASCII-safe.
- Test de regresión en `tests/unit/espejo-tab.test.tsx`: simula subir un
  archivo para una fila con `codigo: 'MOÑOLUZ'` (mock de `subirFoto` como en
  `producto-edit-modal.test.tsx`), afirma que `subirFoto` se llamó con el
  código YA sanitizado (`'monoluz'`, sin ñ) — corrido en rojo contra el
  código actual primero, confirmar que efectivamente falla antes del fix.
- Test que confirma que `catalogo_productos.codigo` insertado en `activar()`
  sigue siendo el código crudo (`'MOÑOLUZ'`), no el sanitizado — no romper
  el matcheo real con Búho.
- Suite completa en verde.
- Commit local.

### Sprint 2 — Mismo bug latente en ProductoEditModal.tsx
**Cambio:** sanitizar `carpeta` (derivada de `producto.familia`) en
`agregarFoto()` y `subirImagenVariante()` usando `slugify()`.

**Acceptance criteria:**
- Test de regresión en `tests/unit/producto-edit-modal.test.tsx`: producto
  con `familia: 'Decoración'`, subir foto (general o de variante), afirma
  que `subirFoto` se llamó con una carpeta ASCII-safe (`'decoracion'`).
- Suite completa en verde.
- Commit local.

## Checkpoint final
1. Los 3 sprints completos, suite completa en verde en el estado final.
2. `npm run build` local limpio.
3. Mostrar el diff completo (los 3 sprints) al usuario.
4. Sin push — queda en local hasta pedido explícito, igual que el resto del
   repo hoy (`tasks/plan.md` ya tiene push pendiente de otro fix, no mezclar).
