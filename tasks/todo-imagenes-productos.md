# Todo — imágenes rotas en variantes + mostrar todas las fotos de variantes + quitar imagen de variante

Ver `tasks/plan-imagenes-productos.md` para el detalle completo, causa raíz
y checkpoints. Reglas fijas: commit por sprint, suite completa en verde
antes de commitear, sin push sin pedido explícito, build/test siempre con
subagentes de `agent-skills`.

- [x] **Sprint 0 — normalizar URL de foto en todos los componentes públicos** (`lib/catalogo-familia.ts: urlFoto()`) — commit `3ce2d23`
  - [x] `urlFoto()` en `lib/catalogo-familia.ts`
  - [x] Aplicar en `ProductoGaleria.tsx`, `ProductoCard.tsx`, `HeroCarrusel.tsx`, `AccionesProducto.tsx` (2 usos), `BuscadorPredictivo.tsx`
  - [x] Simplificar `ProductoEditModal.tsx:473` para reusar `urlFoto()`
  - [x] Tests de `urlFoto()` en `tests/unit/catalogo-familia.test.js`
  - [x] Test de regresión: URL completa de Supabase no se rompe con `/` antepuesto — corrido en rojo primero, confirmado
  - [x] Tests existentes siguen en verde sin tocar
  - [x] Suite completa en verde
  - [x] Commit local

- [x] **Sprint 1 — mostrar todas las imágenes de variantes en el carrusel** (`lib/variantes.ts: fotosDeVariantes()`) — commit `a2b204e`
  - [x] `fotosDeVariantes()` en `lib/variantes.ts`
  - [x] `ProductoFicha.tsx`: combina `producto.fotos` + `fotosDeVariantes(...)` antes de pasarlo a `ProductoGaleria`
  - [x] Test de `fotosDeVariantes()` en `tests/unit/variantes.test.js`
  - [x] Test de regresión: producto de un solo eje, todas las variantes con imagen, sin fotos generales → ya no cae al logo genérico — confirmado
  - [x] Suite completa en verde
  - [x] Commit local

- [x] **Sprint 2 — quitar la imagen de una variante (panel admin)** — commit `79ffd57`
  - [x] `quitarImagenVariante(i)` en `ProductoEditModal.tsx`
  - [x] Botón "Quitar imagen" por variante, sólo visible con `v.imagen` seteado
  - [x] Test: aparece/desaparece según haya imagen
  - [x] Test: click quita la miniatura y, al guardar, persiste sin esa imagen — corrido en rojo primero, confirmado
  - [x] Suite completa en verde
  - [x] Commit local

- [ ] **Checkpoint final**
  - [x] Suite completa en verde en el estado final (3 sprints juntos, 570 tests)
  - [x] `npm run build` local limpio
  - [ ] Mostrar diff completo al usuario (pendiente, ver resumen en el chat)
  - [ ] Sin push — nada se pusheó, esperando pedido explícito
