# Todo — imágenes rotas en variantes + mostrar todas las fotos de variantes + quitar imagen de variante

Ver `tasks/plan-imagenes-productos.md` para el detalle completo, causa raíz
y checkpoints. Reglas fijas: commit por sprint, suite completa en verde
antes de commitear, sin push sin pedido explícito, build/test siempre con
subagentes de `agent-skills`.

- [ ] **Sprint 0 — normalizar URL de foto en todos los componentes públicos** (`lib/catalogo-familia.ts: urlFoto()`)
  - [ ] `urlFoto()` en `lib/catalogo-familia.ts`
  - [ ] Aplicar en `ProductoGaleria.tsx`, `ProductoCard.tsx`, `HeroCarrusel.tsx`, `AccionesProducto.tsx` (2 usos), `BuscadorPredictivo.tsx`
  - [ ] Simplificar `ProductoEditModal.tsx:473` para reusar `urlFoto()`
  - [ ] Tests de `urlFoto()` en `tests/unit/catalogo-familia.test.js`
  - [ ] Test de regresión: URL completa de Supabase no se rompe con `/` antepuesto — corrido en rojo primero
  - [ ] Tests existentes siguen en verde sin tocar
  - [ ] Suite completa en verde
  - [ ] Commit local

- [ ] **Sprint 1 — mostrar todas las imágenes de variantes en el carrusel** (`lib/variantes.ts: fotosDeVariantes()`)
  - [ ] `fotosDeVariantes()` en `lib/variantes.ts`
  - [ ] `ProductoFicha.tsx`: combina `producto.fotos` + `fotosDeVariantes(...)` antes de pasarlo a `ProductoGaleria`
  - [ ] Test de `fotosDeVariantes()` en `tests/unit/variantes.test.js`
  - [ ] Test de regresión: producto de un solo eje, todas las variantes con imagen, sin fotos generales → ya no cae al logo genérico
  - [ ] Suite completa en verde
  - [ ] Commit local

- [ ] **Sprint 2 — quitar la imagen de una variante (panel admin)**
  - [ ] `quitarImagenVariante(i)` en `ProductoEditModal.tsx`
  - [ ] Botón "Quitar imagen" por variante, sólo visible con `v.imagen` seteado
  - [ ] Test: aparece/desaparece según haya imagen
  - [ ] Test: click quita la miniatura y, al guardar, persiste sin esa imagen — corrido en rojo primero
  - [ ] Suite completa en verde
  - [ ] Commit local

- [ ] **Checkpoint final**
  - [ ] Suite completa en verde en el estado final (3 sprints juntos)
  - [ ] `npm run build` local limpio
  - [ ] Mostrar diff completo al usuario
  - [ ] Sin push (esperar pedido explícito)
