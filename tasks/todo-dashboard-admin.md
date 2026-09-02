# Todo — Dashboard admin completo

Ver `tasks/plan-dashboard-admin.md` para el detalle completo, decisiones
de arquitectura, acceptance criteria y riesgos. Spec fuente:
`/home/carlitos/proyectos/MundoMagicoWeb/SPEC-dashboard-admin.md`.

Reglas fijas del proyecto: commit por sprint, suite completa
(`npm test && npm run test:e2e && npm run build`) en verde antes de cada
commit, sin push sin pedido explícito del usuario, build/test/frontend
siempre con subagentes de `agent-skills` (nunca `general-purpose` ni
`superpowers` para código/tests de este repo).

- [ ] **Sprint A — Gate único + shell del dashboard** (bloquea todo lo demás)
  - [ ] Task A1 — Gate único (`AdminGate.tsx` con `useCuenta()`)
  - [ ] Task A2 — Montar el gate en `app/admin/layout.tsx`, sacar los 2 gates viejos
  - [ ] Task A3 — `AdminHomeLauncher` + `/admin/page.tsx` + link "Dashboard" en `CuentaNavButton`
  - [ ] Checkpoint: suite completa en verde, flujo real probado, commit

- [ ] **Sprint B — Métricas de catálogo**
  - [ ] Task B1 — RPC `catalogo_metricas_admin()`
  - [ ] Task B2 — Página `/admin/metricas`
  - [ ] Checkpoint: suite completa en verde, commit

- [ ] **Sprint C — Pedidos con precio en vivo**
  - [ ] Task C1 — Resolver precio/stock en `PedidoCard` vía `catalogo_precios_admin()`
  - [ ] Checkpoint: suite completa en verde, commit

- [ ] **Sprint D — Usuarios (admins + clientes)**
  - [ ] Task D1 — RPCs `admin_listar_admins`/`admin_buscar_usuario_por_email`/`admin_quitar`
  - [ ] Task D2 — Tab Administradores en `/admin/usuarios`
  - [ ] Task D3 — RPC `clientes_resumen()` + tab Clientes + ficha de cliente
  - [ ] Checkpoint: suite completa en verde, commit

- [ ] **Sprint E — Carritos abandonados/completados** (sólo usuarios logueados)
  - [ ] Task E1 — Tabla `carrito_eventos` + `lib/carrito-tracking.ts`
  - [ ] Task E2 — Clasificación completado/abandonado + página `/admin/carritos`
  - [ ] Checkpoint: suite completa en verde, commit

- [ ] **Sprint F — Analíticas (visitas + ranking, todos los visitantes)**
  - [ ] Task F1 — Tabla `analytics_eventos` + Route Handler + instrumentación
  - [ ] Task F2 — Página `/admin/analiticas` (gráfico + ranking)
  - [ ] Checkpoint final: suite completa en verde, los 6 tiles activos, commit, revisión con el usuario

**Fuera de alcance (ver spec §5):** facturación/cobro real, trigger
on-demand al worker de Búho, corregir los 279 códigos "sin activar" ya
publicados, integración con Google Analytics/Clarity.
