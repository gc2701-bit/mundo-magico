# Todo — fix: no se puede activar un artículo "sin activar" (Invalid key)

Ver `tasks/plan-activar-invalid-key.md` para el detalle completo, causa raíz
y checkpoints. Plan aparte de `tasks/plan.md` (404 en curso, no mezclar).
Reglas fijas: commit por sprint, suite completa en verde antes de commitear,
sin push sin pedido explícito, build/test siempre con subagentes de
`agent-skills`.

- [x] **Sprint 0 — extraer `slugify` compartido** (`lib/slug.ts`) — commit `6bf5e96`
  - [x] `lib/slug.ts` con `slugify()`, mismo comportamiento que `slugifyMundo` actual
  - [x] `lib/catalogo-mundo.ts`: `slugifyMundo` pasa a re-exportar `slugify`
  - [x] `tests/unit/catalogo-mundo.test.js` sigue en verde sin tocar
  - [x] Nuevo `tests/unit/slug.test.js`
  - [x] Bloqueante encontrado y resuelto: el runner de tests no arrancaba
        (vitest 4.1.10/std-env 4.x/jsdom 30 son ESM-only, Node local era
        20.17 y varias deps ya piden ≥22) — `vitest.config.js` → `.mts`,
        Node 24 instalado vía nvm (con permiso explícito del usuario),
        `.nvmrc` agregado
  - [x] Suite completa en verde
  - [x] Commit local

- [x] **Sprint 1 — fix de raíz en `EspejoTab.tsx`** — commit `a7ff9e1`
  - [x] `agregarFoto()`: sanitizar `carpeta` y `fila.codigo` con `slugify()` antes de `subirFoto()`
  - [x] `activar()`: `slugTitulo` usa `slugify(fila.nombre)` (dedup de la lógica inline)
  - [x] Confirmado que `catalogo_productos.codigo` insertado sigue siendo `fila.codigo` crudo (no se tocó el matcheo con Búho)
  - [x] Test de regresión: código con ñ (`MOÑOLUZ`) → `subirFoto` llamado con `'monoluz'` — corrido en rojo primero, confirmado
  - [x] Test: `codigo` insertado en `catalogo_productos` sigue siendo el crudo
  - [x] Suite completa en verde
  - [x] Commit local

- [x] **Sprint 2 — mismo bug latente en `ProductoEditModal.tsx`** — commit `5932327`
  - [x] Sanitizar `carpeta` (de `producto.familia`) en `agregarFoto()` y `subirImagenVariante()`
  - [x] Test de regresión: familia con tilde (`'Decoración'`) → carpeta ASCII-safe — corrido en rojo primero, confirmado
  - [x] Suite completa en verde
  - [x] Commit local

- [ ] **Checkpoint final**
  - [x] Suite completa en verde en el estado final (3 sprints juntos, 553 tests)
  - [x] `npm run build` local limpio
  - [ ] Mostrar diff completo al usuario (pendiente, ver resumen en el chat)
  - [ ] Sin push (esperar pedido explícito) — nada se pusheó
