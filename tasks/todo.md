# Todo — fix 404 permanente en páginas de mundo/producto

Ver `tasks/plan.md` para el detalle completo, causa raíz y checkpoints.
Reglas fijas: commit por sprint, suite completa en verde antes de commitear,
sin push sin pedido explícito, build/test siempre con subagentes de
`agent-skills` (nunca `general-purpose` ni `superpowers` para código/tests
de este repo).

- [x] **Sprint 0 — fix de raíz** (`app/api/revalidate/route.ts`) — commit `ff58f1d`
  - [x] Cambiar `revalidateTag(CATALOGO_TAG, { expire: 0 })` → `revalidateTag(CATALOGO_TAG, 'max')`
  - [x] Reescribir el comentario del archivo (la justificación de `{expire:0}` queda desmentida por la doc de Next)
  - [x] Test de regresión: afirma el segundo argumento exacto pasado a `revalidateTag` — corrido en rojo contra el código viejo primero
  - [x] Suite completa (tsc + unit + build) en verde
  - [x] Commit local

- [x] **Sprint 1 — error boundary** (`app/error.tsx`) — commit `9367025`
  - [x] Crear `app/error.tsx` (Client Component, mensaje + botón reintentar vía `reset()`)
  - [x] `app/[mundo]/error.tsx` específico evaluado y descartado — el boundary raíz alcanza, no hay mensaje diferenciado que agregue valor real hoy
  - [x] Test del componente (renderiza con error simulado, verifica mensaje + botón)
  - [x] Suite completa en verde
  - [x] Commit local

- [x] **Sprint 2 — `dynamicParams` false→true** (`app/[mundo]/page.tsx`, `app/[mundo]/[slug]/page.tsx`) — commit `96e17ce`
  - [x] Confirmado con el usuario el trade-off (URLs inventadas ya no son 404 instantáneo del router) ANTES de commitear
  - [x] Sacado `export const dynamicParams = false` en ambos archivos
  - [x] Test de regresión: slug inexistente sigue dando `notFound()` real
  - [x] Suite completa en verde
  - [x] Commit local

- [ ] **Checkpoint pre-redeploy**
  - [ ] Suite completa en verde en el estado final (los 3 sprints juntos)
  - [ ] `npm run build` local limpio, confirmar que genera páginas de mundo/producto sin 404
  - [ ] Mostrar diff completo al usuario, esperar pedido explícito de push
  - [ ] Tras push real: verificar `commit_ref` del deploy contra `git log` (no confiar en "ready")
  - [ ] Repetir en vivo la prueba del Sprint 0 (una llamada limpia a `/api/revalidate`, confirmar 200 antes y después)

- [ ] **Sprint 3 — aparte, en Supabase, no bloquea lo de arriba**
  - [ ] Debounce en `catalogo_revalidar_home()` (no llamar si hubo una llamada hace <N segundos)
  - [ ] Confirmación explícita del usuario antes de `apply_migration`
