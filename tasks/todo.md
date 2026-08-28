# Todo — fix 404 permanente en páginas de mundo/producto

Ver `tasks/plan.md` para el detalle completo, causa raíz y checkpoints.
Reglas fijas: commit por sprint, suite completa en verde antes de commitear,
sin push sin pedido explícito, build/test siempre con subagentes de
`agent-skills` (nunca `general-purpose` ni `superpowers` para código/tests
de este repo).

- [ ] **Sprint 0 — fix de raíz** (`app/api/revalidate/route.ts`)
  - [ ] Cambiar `revalidateTag(CATALOGO_TAG, { expire: 0 })` → `revalidateTag(CATALOGO_TAG, 'max')`
  - [ ] Reescribir el comentario del archivo (la justificación de `{expire:0}` queda desmentida por la doc de Next)
  - [ ] Test de regresión: afirma el segundo argumento exacto pasado a `revalidateTag` — correrlo en rojo contra el código viejo primero
  - [ ] Suite completa (tsc + unit + build) en verde
  - [ ] Commit local

- [ ] **Sprint 1 — error boundary** (`app/error.tsx`, evaluar `app/[mundo]/error.tsx`)
  - [ ] Crear `app/error.tsx` (Client Component, mensaje + botón reintentar vía `reset()`)
  - [ ] Decidir en el sprint si hace falta uno específico para `/[mundo]`
  - [ ] Test del componente (renderiza con error simulado, verifica mensaje + botón)
  - [ ] Suite completa en verde
  - [ ] Commit local

- [ ] **Sprint 2 — `dynamicParams` false→true** (`app/[mundo]/page.tsx`, `app/[mundo]/[slug]/page.tsx`)
  - [ ] Confirmar con el usuario el trade-off (URLs inventadas ya no son 404 instantáneo del router) ANTES de commitear
  - [ ] Sacar/cambiar `export const dynamicParams = false` en ambos archivos
  - [ ] Test de regresión: slug inexistente sigue dando `notFound()` real
  - [ ] Suite completa en verde
  - [ ] Commit local

- [ ] **Checkpoint pre-redeploy**
  - [ ] Suite completa en verde en el estado final (los 3 sprints juntos)
  - [ ] `npm run build` local limpio, confirmar que genera páginas de mundo/producto sin 404
  - [ ] Mostrar diff completo al usuario, esperar pedido explícito de push
  - [ ] Tras push real: verificar `commit_ref` del deploy contra `git log` (no confiar en "ready")
  - [ ] Repetir en vivo la prueba del Sprint 0 (una llamada limpia a `/api/revalidate`, confirmar 200 antes y después)

- [ ] **Sprint 3 — aparte, en Supabase, no bloquea lo de arriba**
  - [ ] Debounce en `catalogo_revalidar_home()` (no llamar si hubo una llamada hace <N segundos)
  - [ ] Confirmación explícita del usuario antes de `apply_migration`
