# Plan — fix de fondo: 404 permanente en `/[mundo]` y `/[mundo]/[slug]` tras revalidación on-demand

## Contexto (ya diagnosticado, no re-investigar)

Sitio: `mundo-magico/` (Next.js 16.3.1 App Router, Netlify vía `@netlify/plugin-nextjs`,
producción `mundomagico.ar`). Auditoría completa vía `agent-skills:debugging-and-error-recovery`
el 2026-08-28, con evidencia real contra producción y Supabase (no supuestos).

**Síntoma:** `/[mundo]` y `/[mundo]/[slug]` devuelven 404 en producción, de forma
persistente (no se autocorrige, `revalidate = false` = sin revalidación por tiempo).

**Causa raíz confirmada — documentada por Next.js mismo:**
`app/api/revalidate/route.ts` llama `revalidateTag(CATALOGO_TAG, { expire: 0 })`.
Según `node_modules/next/dist/docs/.../revalidateTag.md`:

> Without the second argument / with `{ expire: 0 }`: the tag entry is expired
> immediately, and **the next request to that resource will be a blocking
> revalidate/cache miss**. [...] For all other cases, it's recommended to use
> `profile="max"` [...] which provides stale-while-revalidate semantics.

Es decir: `{ expire: 0 }` fuerza que el **próximo visitante real** dispare una
regeneración **bloqueante y sincrónica** de la página, sin red de contención — si
esa regeneración puntual tropieza con cualquier cosa (blip transitorio de red,
cold start, contención porque el trigger de Supabase dispara en ráfagas de
16-18 llamadas cada ~15 min mientras el worker de Búho escribe miles de filas),
el resultado (probado en vivo: cachea un `notFound()`) queda grabado **para
siempre** como el contenido "fresco" de una ruta `revalidate: false` — nada lo
revierte solo. Confirmado con una prueba controlada: **una sola llamada limpia**
a `/api/revalidate` (sin ráfaga) alcanza para reproducirlo — no hace falta
concurrencia, sólo alcanza con que la regeneración bloqueante tropiece una vez.

Este código lleva desde el 24-25/08 sin cambios, pero el webhook real que
ejercita `revalidateTag` recién se creó el 27/08 (antes "nunca se había creado" —
ver memoria del proyecto) — por eso nunca se había disparado hasta ahora.

**Rutas expuestas** (todas usan `obtenerCatalogoPublico()` / `CATALOGO_TAG`):
`app/[mundo]/page.tsx`, `app/[mundo]/[slug]/page.tsx`, `app/page.tsx` (home,
no roto hoy pero mismo riesgo), `app/explorar/page.tsx`, `app/layout.tsx`,
`lib/busqueda.ts`.

**Restauración de producción:** decisión explícita del usuario — esperar a que
este fix esté listo antes de redeployar (no redeploy vacío mientras tanto).

## Dependencias entre componentes

```
app/api/revalidate/route.ts (perfil de revalidateTag)
        │  fix acá es la causa raíz — bloquea todo lo demás semánticamente
        ▼
lib/catalogo-server.ts (CATALOGO_TAG, fetch tageado)
        │
        ├─▶ app/[mundo]/page.tsx        (roto hoy)
        ├─▶ app/[mundo]/[slug]/page.tsx (roto hoy)
        ├─▶ app/page.tsx                (mismo riesgo, no roto hoy)
        ├─▶ app/explorar/page.tsx       (mismo riesgo)
        └─▶ app/layout.tsx              (mismo riesgo — si rompe, rompe TODO el sitio)

app/error.tsx / app/[mundo]/error.tsx (no existen hoy — red de contención,
        independiente del fix de arriba, pero mitiga el mismo tipo de falla)

app/[mundo]/page.tsx dynamicParams (false→true) — segunda red de contención,
        independiente, sólo aplica a las 2 rutas dinámicas afectadas hoy

supabase/catalogo_19_webhook_revalidate.sql (trigger, DB aparte del repo Next)
        — dispara con mucha más frecuencia de lo asumido (16-18 llamadas en
        2-3s cada ~15 min); no es la causa raíz pero agravaba el impacto y
        vale la pena debounced por prolijidad operativa, aparte del fix
        principal
```

El Sprint 0 (cambiar el perfil de `revalidateTag`) es el único bloqueante real
de negocio — con eso solo, el sitio deja de romperse. Los sprints 1-2 son red
de contención (defense-in-depth) para que si esto vuelve a pasar por otra
causa, se autocorrija solo en vez de quedar caído hasta un redeploy. El
sprint 3 es aparte (Supabase, no este repo) y no bloquea el redeploy de
producción de los sprints 0-2.

## Sprints (cada uno: commit propio, suite completa en verde antes de
commitear, sin push hasta pedido explícito, build/test siempre vía
subagentes de `agent-skills`)

### Sprint 0 — Fix de raíz: perfil de `revalidateTag`
**Cambio:** `app/api/revalidate/route.ts` — `revalidateTag(CATALOGO_TAG, { expire: 0 })`
→ `revalidateTag(CATALOGO_TAG, 'max')`. Reescribir el comentario del archivo
(hoy justifica `{expire:0}` con una razón que la doc de Next contradice
explícitamente — dejar constancia de la razón real del cambio, no dejar el
comentario viejo).

**Por qué alcanza:** con `'max'` la entrada se marca stale pero el visitante
siguiente sigue viendo la última versión buena (stale-while-revalidate) mientras
se regenera en background — ningún visitante paga el costo de una regeneración
bloqueante, y si esa regeneración en background tropieza, el peor caso es
seguir sirviendo la versión anterior (buena) hasta el próximo intento, nunca
un 404 grabado.

**Acceptance criteria:**
- `route.ts` llama `revalidateTag(CATALOGO_TAG, 'max')`, no `{ expire: 0 }`.
- Test de regresión nuevo (`tests/unit/revalidate-route.test.ts` o similar):
  mockea `next/cache`, hace `POST` a la route con el secret correcto, y
  **afirma el segundo argumento exacto** pasado a `revalidateTag` (`'max'`).
  Debe fallar contra el código actual (`{expire:0}`) y pasar con el fix —
  verificar esto de verdad (correrlo en rojo antes del fix, ver que efectivamente
  falla, no asumir).
- Suite completa (tsc + unit + build) en verde.

**Verificación (no alcanza con tests unitarios — el bug real es de runtime/infra):**
tras el redeploy final (fin de todos los sprints, con confirmación del usuario),
repetir en vivo la misma prueba que reprodujo el bug: una sola llamada limpia a
`/api/revalidate` seguida de requests reales a `/cumpleanos` y una ficha de
producto, confirmando 200 antes y después de la llamada (no sólo una vez).

### Sprint 1 — Red de contención: error boundary para fallas de datos
**Cambio:** agregar `app/error.tsx` (boundary raíz, no existe ninguno hoy en
el repo) para que una excepción no capturada durante un render/regeneración
(p. ej. si `obtenerCatalogoPublico()` tira porque Supabase no respondió) caiga
en una página de error real (reintentable por el usuario) en vez de arriesgarse
a ser tratada como ruta inexistente. Evaluar si además hace falta un
`app/[mundo]/error.tsx` más específico (con mensaje acorde a esa sección) —
decidir en el sprint, no de antemano.

**Acceptance criteria:**
- `app/error.tsx` existe, es Client Component (requisito de Next para
  `error.tsx`), muestra un mensaje genérico + botón de reintentar
  (`reset()` de la prop que Next inyecta).
- Test que renderiza el boundary con un error simulado y verifica que
  aparece el mensaje y el botón (no verifica el comportamiento real de
  Next ISR, eso es infra — sólo el componente en sí).
- Suite completa en verde.

### Sprint 2 — Red de contención: `dynamicParams` de `false` a `true`
**Cambio:** `app/[mundo]/page.tsx` y `app/[mundo]/[slug]/page.tsx` —
sacar (o poner en `true`) `export const dynamicParams = false`. Con esto, si
alguna vez se cachea un estado roto para una de estas rutas (por esta causa
ya resuelta en Sprint 0, o por cualquier otra en el futuro), el próximo
visitante dispara un render on-the-fly normal (SSR) para ese path conocido
en vez de quedar atado a lo que se congeló en el build/última regeneración —
se autocorrige solo, sin esperar un redeploy.

**Trade-off a documentar (no a resolver en este sprint):** con `dynamicParams:
true`, una URL con un `mundo`/`slug` inventado ya no da un 404 "gratis" desde
el router — dispara un render real que después llama `notFound()` igual (el
código ya tiene ese chequeo, `if (!mundo) notFound()`), sólo que ahora ese
render cuesta un poco más que un 404 instantáneo. Dado que `generateStaticParams`
sigue existiendo y sigue pre-generando las rutas reales en el build, el costo
extra sólo lo paga tráfico inválido/bots — aceptable, pero **confirmar con el
usuario antes de commitear este sprint específico** (es un trade-off de
arquitectura, no sólo un bugfix).

**Acceptance criteria:**
- `dynamicParams` ya no bloquea rutas nuevas en ninguna de las 2 páginas.
- Test de regresión: un slug de mundo inexistente (`/mundo-que-no-existe`)
  sigue devolviendo 404 real (vía `notFound()`), verificado con un test que
  llame al componente de página directo con un param inventado.
- Suite completa en verde.
- Confirmación explícita del usuario antes de commitear este sprint puntual.

### Sprint 3 — Aparte del repo Next: debounce del trigger de Supabase
**No bloquea los sprints 0-2 ni el redeploy de producción.** Ítem operativo
separado, en la base de datos (`kyuilrlewynqrzebouww`), no en este repo.

**Cambio propuesto (a confirmar con el usuario antes de aplicar, vía
`apply_migration`, vía trackeada):** en `catalogo_revalidar_home()`, chequear
si ya se llamó a `/api/revalidate` hace menos de N segundos (ej. 10s) antes de
volver a llamar — evita las ráfagas de 16-18 llamadas por ciclo del worker de
Búho sin perder el propósito del webhook (los cambios igual llegan, sólo se
coalescen). Requiere una tabla/columna chica de estado (`last_revalidated_at`)
o un `pg_advisory_lock` con timeout corto.

**Este sprint queda fuera del alcance de `agent-skills:build` sobre el repo
Next** — se planifica acá para no perderlo, pero se ejecuta aparte (SQL +
`apply_migration`, con confirmación explícita del usuario, igual que el
GRANT de columna y el webhook original).

## Checkpoint final (antes de redeploy de producción)

1. Sprints 0-2 completos, cada uno confirmado por el usuario, suite completa
   en verde en el estado final (no sólo sprint por sprint).
2. `npm run build` local limpio (mismo chequeo que se hizo ayer antes del
   forced-rebuild) — confirmar que genera las páginas de mundo/producto sin
   404 en el output.
3. Presentar el diff completo (los 3 sprints juntos) para revisión antes de
   pedir el push — el usuario decide cuándo pushear, no asumir.
4. Tras el push y el deploy real (verificar `commit_ref` contra `git log`,
   nunca confiar en "deploy ready" solo): repetir la prueba en vivo del
   Sprint 0 contra producción.
5. Sprint 3 (Supabase) se coordina aparte, puede ir antes o después del
   redeploy de este repo — no tiene dependencia dura.
