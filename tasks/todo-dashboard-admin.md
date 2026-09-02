# Todo — Dashboard admin completo

Ver `tasks/plan-dashboard-admin.md` para el detalle completo, decisiones
de arquitectura, acceptance criteria y riesgos. Spec fuente:
`/home/carlitos/proyectos/MundoMagicoWeb/SPEC-dashboard-admin.md`.

Reglas fijas del proyecto: commit por sprint, suite completa
(`npm test && npm run test:e2e && npm run build`) en verde antes de cada
commit, sin push sin pedido explícito del usuario, build/test/frontend
siempre con subagentes de `agent-skills` (nunca `general-purpose` ni
`superpowers` para código/tests de este repo).

- [x] **Sprint A — Gate único + shell del dashboard** (bloquea todo lo demás) — commit `b463042`
  - [x] Task A1 — Gate único (`AdminGate.tsx` con `useCuenta()`)
  - [x] Task A2 — Montar el gate en `app/admin/layout.tsx`, sacar los 2 gates viejos
  - [x] Task A3 — `AdminHomeLauncher` + `/admin/page.tsx` + link "Dashboard" en `CuentaNavButton`
  - [x] Checkpoint: suite completa en verde (579 unit tests, build, e2e — 2 fallos preexistentes en
        `producto.spec.js` no relacionados, ya fallaban en `master` antes de este sprint), commit

- [x] **Sprint B — Métricas de catálogo** — commit `c7705be`
  - [x] Task B1 — RPC `catalogo_metricas_admin()` (verificada contra la base real)
  - [x] Task B2 — Página `/admin/metricas`
  - [x] Checkpoint: suite completa en verde, commit

- [x] **Sprint C — Pedidos con precio en vivo**
  - [x] Task C1 — Resolver precio/stock en `PedidoCard` vía `catalogo_precios_admin()`
  - [x] Checkpoint: suite completa en verde, commit

- [x] **Sprint D — Usuarios (admins + clientes)**
  - [x] Task D1 — RPCs `admin_listar_admins`/`admin_buscar_usuario_por_email`/`admin_agregar`/`admin_quitar` (sin RLS de insert/delete en `admins`, todo por función)
  - [x] Task D2 — Tab Administradores en `/admin/usuarios`
  - [x] Task D3 — RPC `clientes_resumen()` + tab Clientes + ficha de cliente (sin "total histórico": el precio actual contra pedidos viejos sería un número falso)
  - [x] Checkpoint: suite completa en verde, commit

- [x] **Sprint E — Carritos abandonados/completados** (sólo usuarios logueados)
  - [x] Task E1 — Tabla `carrito_eventos` + `lib/carrito-tracking.ts` (RLS de insert propia, sin RPC — no es acción privilegiada)
  - [x] Task E2 — RPC `carritos_admin()` + clasificación (`lib/carritos-admin.ts`, umbral 48hs) + página `/admin/carritos`
  - [x] Checkpoint: suite completa en verde (build + e2e de carrito real sin regresión), commit

- [x] **Sprint F — Analíticas (visitas + ranking, todos los visitantes)**
  - [x] Task F1 — Tabla `analytics_eventos` + instrumentación (sin Route Handler/service role: RLS de insert abierta, ver el comentario de desviación en supabase/analytics_00_eventos.sql) + `AnalyticsTracker` (detecta ficha de producto por forma de ruta, sin tocar `app/[mundo]/[slug]/page.tsx`)
  - [x] Task F2 — Página `/admin/analiticas` (shadcn/ui charts + ranking), RPCs `analytics_visitas_por_dia`/`analytics_ranking_productos` agrupando por `ruta` (no por `codigo`, que queda null en productos con variantes)
  - [x] Checkpoint final: suite completa en verde, los 6 tiles activos, commit

**Fuera de alcance (ver spec §5):** facturación/cobro real, trigger
on-demand al worker de Búho, corregir los 279 códigos "sin activar" ya
publicados, integración con Google Analytics/Clarity.
