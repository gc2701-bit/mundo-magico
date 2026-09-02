# Plan — Dashboard admin completo

Spec fuente: `/home/carlitos/proyectos/MundoMagicoWeb/SPEC-dashboard-admin.md`
(fuera de git, aprobada por el usuario el 2026-09-02). Repo `mundo-magico/`,
rama `master`.

## Overview

Construir un dashboard admin (`/admin`) que reemplaza el conjunto de
páginas sueltas de hoy por un shell único con gate de acceso centralizado
y 6 secciones: catálogo (ya existe), pedidos (ya existe, se extiende),
métricas de catálogo, usuarios, carritos abandonados/completados, y
analíticas de visitas/ranking de artículos. Ver la spec para el
diagnóstico completo (gates inconsistentes, carrito 100% client-side,
sin tracking propio, sin perfil de cliente, `PedidoCard` sin precio).

## Architecture Decisions

- **Gate único en `app/admin/layout.tsx`**, patrón `useCuenta()` (el que
  ya usan Pedidos/Envíos) — se retira el gate propio de Catálogo
  (Turnstile) por ser el único inconsistente con el resto. Reduce 3
  implementaciones de gate a 1, y las secciones nuevas lo heredan gratis.
- **Reuso, no reconstrucción, de `AdminPedidosPanel`/`PedidoCard`** — ya
  cubren el ciclo operativo completo; sólo se les suma precio en vivo.
- **Precio de pedidos: resuelto en vivo contra `catalogo_precios_admin()`
  en cada render**, nunca snapshot — el usuario confirmó que el precio
  real vive en `catalogo_precios` (actualizado por el worker cada ~15
  min) y no se negocia en otro lado.
- **Tracking de carritos: sólo usuarios logueados** (decisión explícita
  del usuario — anónimos generan demasiado ruido para ser señal útil de
  "abandono").
- **Tracking de analíticas: todos los visitantes**, vía cookie anónima +
  Route Handler propio con service role (no INSERT anónimo directo por
  RLS, para no abrir una tabla a abuso/spam).
- **UI: shadcn/ui (`base-nova`) + shadcn/ui charts (Recharts)** — cero
  librerías de diseño nuevas, mobile-first, PC como uso principal real.
- **Todas las funciones que cruzan `auth.users` o escriben
  `public.admins` son `security definer`, restringidas a `es_admin()`**
  — el cliente nunca lee `auth.users` directo.

## Dependency Graph

```
Sprint A (gate único + shell)
 │
 ├─> Sprint B (RPC métricas → página métricas)
 ├─> Sprint C (precio en vivo en PedidoCard)
 ├─> Sprint D1 (RPCs admins) ─> D2 (tab Administradores) ─> D3 (RPC+tab Clientes)
 ├─> Sprint E1 (tabla + tracking) ─> E2 (clasificación + página carritos)
 └─> Sprint F1 (tabla + Route Handler + instrumentación) ─> F2 (página analíticas)
```

A es la única dependencia dura de todo el resto. Dentro de D, E y F hay
una cadena corta (schema/RPC antes que UI); entre B, C, D, E, F no hay
dependencias cruzadas — se pueden paralelizar entre sesiones distintas
una vez que A está mergeado.

## Task List

### Phase 0: Fundación (Sprint A)

- [ ] **Task A1 — Gate único**
  **Descripción:** reemplazar `app/components/admin/AdminGate.tsx` por
  una versión basada en `useCuenta()` (mismo patrón que
  `AdminPedidosGate.tsx`/`AdminEnviosGate.tsx`), sin login propio ni
  Turnstile. Pantallas de "sin sesión"/"no admin" genéricas (no atadas a
  una sección).
  **Acceptance criteria:**
  - [ ] Sin sesión ve el gate con botón "Iniciar sesión" (abre el modal
        de cuenta del sitio, no un form propio).
  - [ ] Con sesión no-admin ve "sin permisos".
  - [ ] Con sesión admin, `{children}` se renderiza.
  **Verification:**
  - [ ] `npm run test:unit -- AdminGate` en verde.
  - [ ] Manual: login con cuenta admin real de prueba, confirmar acceso.
  **Dependencies:** None.
  **Files:** `app/components/admin/AdminGate.tsx`,
  `tests/unit/admin-gate.test.tsx` (nuevo).
  **Estimated scope:** S (1-2 files).

- [ ] **Task A2 — Montar el gate en el layout y sacar los gates viejos**
  **Descripción:** `app/admin/layout.tsx` envuelve `{children}` con el
  `AdminGate` de A1. `catalogo/page.tsx`, `pedidos/page.tsx`,
  `envios/page.tsx` pierden su wrapper de gate propio y agregan su
  `<h1>` directo. Borrar `AdminPedidosGate.tsx`, `AdminEnviosGate.tsx`,
  y `useTurnstile.ts` si queda sin otro uso.
  **Acceptance criteria:**
  - [ ] Las 3 páginas existentes renderizan igual que antes (mismo
        título, mismo contenido) para un admin real.
  - [ ] No queda ninguna referencia a los 2 gates borrados.
  **Verification:**
  - [ ] `npm run test:e2e:next -- admin` en verde (specs existentes de
        catálogo/pedidos/envíos siguen pasando sin cambios).
  - [ ] `npm run build` sin errores de tipos por imports rotos.
  **Dependencies:** A1.
  **Files:** `app/admin/layout.tsx`, `app/admin/catalogo/page.tsx`,
  `app/admin/pedidos/page.tsx`, `app/admin/envios/page.tsx`, borrar
  `AdminPedidosGate.tsx`, `AdminEnviosGate.tsx`.
  **Estimated scope:** M (5 files, pero cada cambio es chico).

- [ ] **Task A3 — Home launcher + navegación**
  **Descripción:** `app/admin/page.tsx` + `AdminHomeLauncher.tsx`: grid
  de tiles mobile-first (Catálogo, Pedidos, Métricas de catálogo,
  Usuarios, Carritos, Analíticas — las 4 últimas apuntan a rutas que
  todavía no existen hasta que corran sus sprints, pero el tile ya
  puede crearse apuntando al href final). `CuentaNavButton.tsx`: cambiar
  el link de `/admin/catalogo` a `/admin`.
  **Acceptance criteria:**
  - [ ] Un admin ve los 6 tiles en `/admin`, con foco/hover visibles.
  - [ ] En viewport mobile (375px) los tiles se apilan en una columna sin
        overflow horizontal.
  - [ ] El link "Dashboard" del desplegable de cuenta lleva a `/admin`.
  **Verification:**
  - [ ] `npm run test:e2e:next -- admin-home` (nuevo spec) en verde,
        corrido en viewport desktop y mobile.
  - [ ] `npm run build`.
  **Dependencies:** A2.
  **Files:** `app/admin/page.tsx` (nuevo),
  `app/components/admin/AdminHomeLauncher.tsx` (nuevo),
  `app/components/cuenta/CuentaNavButton.tsx`,
  `tests/e2e-next/admin-home.spec.ts` (nuevo).
  **Estimated scope:** M (4 files).

### Checkpoint: Fundación (después de A1-A3)

- [ ] `npm test && npm run test:e2e && npm run build` completos en verde.
- [ ] Flujo real: login admin → `/admin` → click en Catálogo/Pedidos/
      Envíos → cada uno sigue funcionando igual que antes de este sprint.
- [ ] Commit de Sprint A. **Revisar con el usuario antes de seguir a B-F**
      (pueden hacerse en cualquier orden desde acá).

### Phase 1: Métricas de catálogo (Sprint B)

- [ ] **Task B1 — RPC `catalogo_metricas_admin()`**
  **Descripción:** función SQL `security definer`, restringida a
  `es_admin()`, que devuelve en una sola fila: publicados, sin familia,
  sin stock, pocas unidades (definir umbral fijo, ej. stock ≤ 3, si no
  hay ya un criterio equivalente en el código del panel de catálogo —
  confirmar contra `lib/` antes de asumir), esperando activar.
  **Acceptance criteria:**
  - [ ] Los 5 conteos coinciden con consultas de control manuales contra
        datos de prueba conocidos.
  **Verification:**
  - [ ] Migración aplicada y verificada con `list_tables`/`list_migrations`
        del MCP de Supabase contra `kyuilrlewynqrzebouww`.
  - [ ] Unit test de la agregación (mock o contra datos de prueba).
  **Dependencies:** A2 (necesita `es_admin()`, ya existente desde antes
  de este proyecto — no es una dependencia nueva, se lista por orden de
  sprint).
  **Files:** `supabase/catalogo_2x_metricas_admin.sql` (nuevo).
  **Estimated scope:** S (1 file).

- [ ] **Task B2 — Página `/admin/metricas`**
  **Descripción:** tarjetas shadcn (`Card`) con los 5 números de B1,
  mismo estilo que las stat cards de `AdminPage` de `whatsapp-agent`
  (ícono + valor + label).
  **Acceptance criteria:**
  - [ ] Los 5 números en pantalla coinciden con lo que devuelve la RPC.
  - [ ] Mobile: tarjetas en 1-2 columnas sin overflow; desktop: grid de
        5.
  **Verification:**
  - [ ] `npm run test:e2e:next -- admin-metricas` en verde.
  - [ ] `npm run build`.
  **Dependencies:** B1.
  **Files:** `app/admin/metricas/page.tsx` (nuevo).
  **Estimated scope:** S (1-2 files).

### Checkpoint: Métricas

- [ ] `npm test && npm run test:e2e && npm run build` en verde.
- [ ] Commit de Sprint B.

### Phase 2: Pedidos con precio en vivo (Sprint C)

- [ ] **Task C1 — Resolver precio/stock en `PedidoCard`**
  **Descripción:** al montar `PedidoCard`, juntar los códigos de
  `p.items` (ignorando ítems sin `código`) y llamar
  `catalogo_precios_admin(codigos)`. Mostrar precio unitario × cantidad
  por ítem con código encontrado; ítems sin código o sin match quedan
  marcados "sin precio" y no entran al total. Mostrar
  "Subtotal"/"Total" con el mismo criterio que `resumen()` de
  `lib/carrito.ts` (subtotal + cuántos faltan si no está completo).
  **Acceptance criteria:**
  - [ ] Pedido con todos los ítems con precio → muestra "Total: $X".
  - [ ] Pedido con algún ítem sin precio → muestra "Subtotal: $X (N sin
        precio)", nunca un "Total" que sugiera estar completo.
  - [ ] Pedido sin ningún ítem con código → no rompe, muestra "sin
        precios disponibles".
  **Verification:**
  - [ ] Unit test con 3 casos (todos con precio / mixto / ninguno) contra
        un mock de `catalogo_precios_admin`.
  - [ ] `npm run test:e2e:next -- admin-pedidos` en verde contra datos de
        prueba con precio real en `catalogo_precios`.
  **Dependencies:** A2 (acceso a `/admin/pedidos` ya resuelto por el tile
  de A3, no bloquea esta task en sí — puede implementarse en paralelo a
  A3).
  **Files:** `app/components/admin-pedidos/PedidoCard.tsx`,
  `lib/pedidos-admin.ts` (helper de resolución de precio, si conviene
  separarlo para poder testearlo puro), `tests/unit/pedido-card-precio.test.ts`
  (nuevo).
  **Estimated scope:** M (3 files).

### Checkpoint: Pedidos

- [ ] `npm test && npm run test:e2e && npm run build` en verde.
- [ ] Commit de Sprint C.

### Phase 3: Usuarios (Sprint D)

- [ ] **Task D1 — RPCs de administradores**
  **Descripción:** `admin_listar_admins()` (join `public.admins` +
  `auth.users` para traer email), `admin_buscar_usuario_por_email(email)`
  (devuelve `{id, email}` o nada), ambas `security definer` restringidas
  a `es_admin()`. Insert/delete de `public.admins` se hacen directo
  desde el cliente (ya tiene RLS propia, no hace falta RPC para eso) —
  salvo la regla de "no quitar al último admin", que sí necesita
  resolverse en una función (`admin_quitar(user_id)`) para no dejar una
  ventana de carrera entre "contar cuántos quedan" y el delete.
  **Acceptance criteria:**
  - [ ] `admin_listar_admins()` devuelve email para cada fila de
        `public.admins`.
  - [ ] `admin_buscar_usuario_por_email()` devuelve `null`/vacío si el
        email no tiene cuenta.
  - [ ] `admin_quitar(user_id)` rechaza si es el único admin restante.
  **Verification:**
  - [ ] Migración verificada contra la base real.
  - [ ] Unit test de `admin_quitar` con 1 y con 2+ admins de prueba.
  **Dependencies:** A2 (orden de sprint, no dependencia técnica dura).
  **Files:** `supabase/catalogo_2x_admin_usuarios.sql` (nuevo, o
  `envios_1x_admin_usuarios.sql` — decidir el prefijo con el resto del
  esquema al implementar).
  **Estimated scope:** S (1 file).

- [ ] **Task D2 — Tab Administradores**
  **Descripción:** `/admin/usuarios` con tab "Administradores": tabla
  con email + botón "Quitar" (llama `admin_quitar`), formulario "Agregar"
  (busca por email con D1, si existe hace insert en `public.admins`, si
  no muestra "no existe una cuenta con ese email").
  **Acceptance criteria:**
  - [ ] Agregar un email con cuenta real lo suma a la lista.
  - [ ] Buscar un email sin cuenta muestra el mensaje de "no existe".
  - [ ] Intentar quitar al último admin muestra el error de D1 sin
        romper la UI.
  **Verification:**
  - [ ] `npm run test:e2e:next -- admin-usuarios-admins` en verde.
  - [ ] `npm run build`.
  **Dependencies:** D1.
  **Files:** `app/admin/usuarios/page.tsx` (nuevo),
  `app/components/admin/TabAdministradores.tsx` (nuevo).
  **Estimated scope:** M (2 files).

- [ ] **Task D3 — RPC + tab Clientes**
  **Descripción:** `clientes_resumen()` (`security definer`,
  `es_admin()`): agrupa `pedidos` por `user_id`, trae email vía
  `auth.users`, último nombre/teléfono/dirección, cantidad de pedidos,
  fecha del último. Tab "Clientes" en `/admin/usuarios`: tabla con
  buscador (nombre/teléfono/email, filtrado en el cliente sobre el
  resultado de la RPC — sin paginar en esta primera versión salvo que el
  volumen real de clientes lo requiera, a confirmar al implementar).
  Click en una fila → ficha con el historial de pedidos de ese cliente
  (lista simple: fecha, ítems, estado — no reusa `PedidoCard` completo
  para evitar acoplar la ficha de sólo-lectura al flujo operativo).
  **Acceptance criteria:**
  - [ ] La tabla muestra todos los `user_id` distintos que tienen al
        menos un pedido.
  - [ ] Buscar por teléfono encuentra el cliente correcto.
  - [ ] Abrir la ficha de un cliente lista sus pedidos en orden
        cronológico.
  **Verification:**
  - [ ] Unit test de la agregación de `clientes_resumen()` contra datos
        de prueba (2+ pedidos del mismo `user_id` con datos de contacto
        distintos → se queda con el más reciente).
  - [ ] `npm run test:e2e:next -- admin-usuarios-clientes` en verde.
  **Dependencies:** D1 (comparte página/layout con D2, no lógica).
  **Files:** `supabase/catalogo_2x_clientes_resumen.sql` (nuevo),
  `app/components/admin/TabClientes.tsx` (nuevo),
  `app/components/admin/FichaCliente.tsx` (nuevo).
  **Estimated scope:** M (3 files).

### Checkpoint: Usuarios

- [ ] `npm test && npm run test:e2e && npm run build` en verde.
- [ ] Commit de Sprint D.

### Phase 4: Carritos abandonados/completados (Sprint E)

- [ ] **Task E1 — Tabla `carrito_eventos` + instrumentación**
  **Descripción:** migración de la tabla (ver spec §3, Sprint E) con RLS
  (insert propio, select `es_admin()`). Nuevo `lib/carrito-tracking.ts`:
  función que, sólo si hay sesión (`useCuenta().sesion`), inserta un
  evento `'agregado'`/`'quitado'` en cada cambio de cantidad, y
  `'checkout_iniciado'` al abrir el link de WhatsApp — nunca bloquea el
  flujo si falla (`try/catch` silencioso, mismo criterio que
  `guardarPedido()`).
  **Acceptance criteria:**
  - [ ] Con sesión activa, agregar un ítem al carrito genera una fila
        `'agregado'`.
  - [ ] Sin sesión, no se genera ninguna fila (ni error visible).
  - [ ] Un fallo del insert no impide que el carrito siga funcionando.
  **Verification:**
  - [ ] Unit test de `carrito-tracking.ts` con un cliente Supabase mock
        que falla, confirmando que no se propaga el error.
  - [ ] Migración verificada contra la base real.
  **Dependencies:** A2 (orden de sprint).
  **Files:** `supabase/catalogo_2x_carrito_eventos.sql` (nuevo),
  `lib/carrito-tracking.ts` (nuevo), puntos de integración en
  `app/carrito/` donde ya se llama `ponerCantidad()`/se abre el link de
  WhatsApp.
  **Estimated scope:** M (3-4 files).

- [ ] **Task E2 — Clasificación + página `/admin/carritos`**
  **Descripción:** función pura (testeable) que, dado los eventos de un
  usuario y sus pedidos, clasifica su carrito más reciente como
  completado/abandonado/en curso (umbral 48hs desde el spec). Página con
  tarjetas resumen (completados vs abandonados en la ventana elegida) +
  lista de carritos abandonados (usuario, últimos ítems, hace cuánto).
  **Acceptance criteria:**
  - [ ] Carrito con un pedido posterior → "completado".
  - [ ] Carrito con eventos y sin pedido tras 48hs → "abandonado".
  - [ ] Carrito con eventos recientes (<48hs) sin pedido todavía → "en
        curso", no cuenta como abandonado.
  **Verification:**
  - [ ] Unit test de la función de clasificación con los 3 casos de
        arriba.
  - [ ] `npm run test:e2e:next -- admin-carritos` en verde.
  **Dependencies:** E1.
  **Files:** `lib/carritos-admin.ts` (nuevo, lógica pura),
  `app/admin/carritos/page.tsx` (nuevo).
  **Estimated scope:** M (2 files).

### Checkpoint: Carritos

- [ ] `npm test && npm run test:e2e && npm run build` en verde.
- [ ] Commit de Sprint E.

### Phase 5: Analíticas (Sprint F)

- [ ] **Task F1 — Tabla + Route Handler + instrumentación**
  **Descripción:** migración de `analytics_eventos` (spec §3, Sprint F),
  sin RLS de insert para el cliente. `app/api/analytics/track/route.ts`
  (usa service role) recibe `{tipo, ruta, codigo?}`, lee/genera la
  cookie `sesion_anonima` (UUID, `httpOnly`, sin PII), agrega `user_id`
  si hay sesión, inserta. Componente cliente liviano en el layout raíz
  que llama al endpoint en cada cambio de ruta; `app/[mundo]/[slug]/page.tsx`
  pasa su código para el evento `vista_producto`.
  **Acceptance criteria:**
  - [ ] Navegar cualquier página genera un `pageview` con la cookie
        correcta (se mantiene igual entre navegaciones de la misma
        sesión de browser).
  - [ ] Abrir una ficha de producto genera además `vista_producto` con
        el código correcto.
  - [ ] Un usuario logueado que navega genera eventos con su `user_id`
        además de la cookie.
  **Verification:**
  - [ ] Unit test del Route Handler (inserta con los campos esperados,
        no rompe si falta `codigo`).
  - [ ] `npm run test:e2e:next -- analytics-tracking` en verde.
  **Dependencies:** A2 (orden de sprint; técnicamente no depende del
  gate admin, es tracking público — puede implementarse en paralelo).
  **Files:** `supabase/catalogo_2x_analytics_eventos.sql` (nuevo),
  `app/api/analytics/track/route.ts` (nuevo),
  `app/components/AnalyticsTracker.tsx` (nuevo, montado en
  `app/layout.tsx`), `app/[mundo]/[slug]/page.tsx`.
  **Estimated scope:** M (4 files).

- [ ] **Task F2 — Página `/admin/analiticas`**
  **Descripción:** gráfico de visitas por día (shadcn/ui chart,
  últimos 30 días por defecto, selector de rango) + tabla de ranking de
  artículos más consultados (join `codigo` → catálogo para nombre/foto).
  **Acceptance criteria:**
  - [ ] El gráfico refleja el conteo real de `pageview` por día de los
        eventos de prueba.
  - [ ] El ranking ordena por cantidad de `vista_producto` descendente y
        muestra el nombre real del producto, no sólo el código.
  - [ ] Mobile: el gráfico no genera scroll horizontal de la página
        (contenedor propio con overflow si hace falta).
  **Verification:**
  - [ ] `npm run test:e2e:next -- admin-analiticas` en verde, viewport
        desktop y mobile.
  - [ ] `npm run build`.
  **Dependencies:** F1.
  **Files:** `app/admin/analiticas/page.tsx` (nuevo).
  **Estimated scope:** M (1-2 files, pero con lógica de agregación no
  trivial).

### Checkpoint: Analíticas — y checkpoint final

- [ ] `npm test && npm run test:e2e && npm run build` en verde.
- [ ] Commit de Sprint F.
- [ ] Los 6 tiles de `/admin` están todos activos y funcionando.
- [ ] Revisión final con el usuario.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Migrar el gate de catálogo rompe algo que dependía de su comportamiento específico (Turnstile, mensajes propios) | Medium | Task A2 corre la suite e2e existente de catálogo sin cambios antes de dar por buena la migración; si algo depende de Turnstile en ese flujo puntual, aparece ahí. |
| `clientes_resumen()` sobre una tabla `pedidos` grande sin índice por `user_id` puede ser lenta | Low-Medium | Confirmar índice en `pedidos(user_id)` al implementar D3; si no existe, agregarlo en la misma migración. |
| Tabla `analytics_eventos` sin RLS de insert abierta, pero el Route Handler sí queda público — riesgo de spam de inserts | Medium | Rate-limiting básico por cookie/IP en el Route Handler (a definir el mecanismo exacto al implementar F1 — puede reusar el criterio de `envios_12_limites_abuso.sql` si aplica). |
| "Pocas unidades" (Task B1) no tiene un umbral ya establecido en el código existente | Low | Confirmar contra `lib/` del panel de catálogo antes de hardcodear un número nuevo; si no existe, usar un umbral fijo documentado en el commit. |

## Open Questions

- Ninguna bloqueante — las decisiones abiertas menores (umbral de "pocas
  unidades", si `FichaCliente` pagina, mecanismo exacto de rate-limit del
  Route Handler de analíticas) quedan resueltas por quien implemente cada
  task, documentando la elección en el commit, sin volver a bloquear en
  brainstorming.
