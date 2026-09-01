# Plan — imágenes rotas en fichas con variantes + mostrar todas las fotos de variantes + quitar imagen de variante

Plan aparte de `tasks/plan.md` (404, ya cerrado en local) y
`tasks/plan-activar-invalid-key.md` (Invalid key, ya cerrado en local) — sin
dependencia entre ninguno.

## Contexto (ya diagnosticado en la conversación, no re-investigar)

Producto de ejemplo: `BOLSAX10` (variantes de color/diseño, un solo eje).

**Síntoma 1 — portada de la ficha = logo genérico, no elegido por el
usuario.** Causa: `AccionesProducto.tsx:176` sólo calcula
`varianteResuelta` (lo que dispara `onCambiarImagen`/`fotoDestacada`) cuando
`esMatrizDosEjes` — es decir, sólo si el producto tiene DOS ejes elegibles
(talle Y tipo/color) a la vez. El propio comentario del archivo dice que ese
es el caso raro; el caso real de hoy es un solo eje (colores/diseños), que
usa la lista plana (líneas 270-285) y nunca llama a `resolverVariante` — la
imagen destacada queda `null` siempre. Sumado a que `producto.fotos`
(galería general) suele estar vacía en productos que sólo cargaron fotos
por variante — nadie le pidió al admin una "foto de portada" aparte.

**Síntoma 2 — imagen rota + nombre de archivo visible, en otros artículos
con variantes.** Causa: `subirFoto()` devuelve una URL pública COMPLETA de
Supabase, pero 5 componentes públicos anteponen `/` a ciegas asumiendo que
`foto.src` es siempre una ruta relativa del sitio HTML viejo:
`ProductoGaleria.tsx` (líneas 56, 78), `ProductoCard.tsx` (84, 95),
`HeroCarrusel.tsx` (122), `AccionesProducto.tsx` (74, 161),
`BuscadorPredictivo.tsx` (98) → `src="/https://xxxx.supabase.co/...webp"`,
URL inválida. La ÚNICA parte del código que ya lo maneja bien es
`ProductoEditModal.tsx:473` (panel admin): `f.src.startsWith('http') ? f.src
: '/' + f.src` — nunca se portó a los componentes públicos.

**Feature pedida — mostrar TODAS las imágenes de las variantes en el
carrusel de la ficha.** Hoy no existe ningún camino de código que junte las
fotos de las variantes (`variante.imagen`, una por variante) con
`producto.fotos` (lo único que alimenta `ProductoGaleria`) — son dos cosas
que nunca se mezclan.

**Feature pedida — poder eliminar la imagen de una variante desde el
panel.** Hoy `ProductoEditModal.tsx` permite subir/reemplazar la imagen de
una variante (`subirImagenVariante`), pero no hay botón para sacarla una vez
puesta — a diferencia de las fotos generales, que sí tienen "Quitar" (línea
474).

**Fuera de alcance, anotado para después (no bloquea nada de lo de
arriba):** ni las fotos generales ni las de variante se borran del bucket de
Storage cuando se sacan desde el panel (sólo se destraban del producto) —
`rutasDeStorage()` (lib/admin-catalogo.ts) sólo cubre `fotos`, nunca
`variante.imagen`, ni siquiera al borrar el producto entero. Gap
preexistente, mismo criterio en toda la pantalla hoy (no se rompe nada
nuevo al agregar "Quitar imagen" de variante con el mismo comportamiento).

## Dependencias entre componentes

```
lib/catalogo-familia.ts (nuevo: urlFoto())
    │  arregla el símil "Invalid key" pero del lado de lectura — cualquier
    │  foto con URL completa de Supabase se ve rota en público
    │
    ├─▶ app/components/ProductoGaleria.tsx     (carrusel de la ficha)
    ├─▶ app/components/ProductoCard.tsx        (listados/explorar)
    ├─▶ app/components/HeroCarrusel.tsx        (home)
    ├─▶ app/components/carrito/AccionesProducto.tsx (favoritos + carrito)
    └─▶ app/components/BuscadorPredictivo.tsx  (buscador)

lib/variantes.ts (nuevo: fotosDeVariantes())
    │  independiente de urlFoto — arma la lista de fotos derivadas de
    │  variantes activas con imagen propia
    ▼
app/components/ProductoFicha.tsx
    combina producto.fotos + fotosDeVariantes(producto.variantes) y se lo
    pasa a ProductoGaleria — ahí es donde "aparecen todas las fotos de
    variantes" en el carrusel. Depende de que ProductoGaleria ya use
    urlFoto() (si no, las fotos de variante recién agregadas se ven rotas
    igual) — por eso este sprint va DESPUÉS del de arriba.

app/components/admin/ProductoEditModal.tsx (independiente de los dos de
arriba — botón "Quitar imagen" por variante, sólo toca estado local +
guardar)
```

## Sprints (cada uno: commit propio, suite completa en verde antes de
commitear, sin push sin pedido explícito, build/test siempre vía
subagentes de `agent-skills`)

### Sprint 0 — Fix de raíz: normalizar URL de foto en todos los componentes públicos
**Cambio:** `lib/catalogo-familia.ts` — nueva `export function urlFoto(src:
string): string { return src.startsWith('http') ? src : '/' + src; }`
(mismo criterio que ya tiene `ProductoEditModal.tsx:473`, ahora reusable).
Reemplazar los 6 usos de `'/' + f.src` (o equivalentes) por `urlFoto(f.src)`
en: `ProductoGaleria.tsx` (imagen principal y miniaturas),
`ProductoCard.tsx` (galería y foto simple), `HeroCarrusel.tsx`,
`AccionesProducto.tsx` (`img` de favoritos y `foto` del carrito),
`BuscadorPredictivo.tsx`. De paso, simplificar
`ProductoEditModal.tsx:473` para usar la misma función (dedup, sin cambio
de comportamiento ahí).

**Acceptance criteria:**
- Nuevo `tests/unit/catalogo-familia.test.js` (o agregado al que ya
  exista para ese archivo si lo hay — confirmar) cubre `urlFoto()`: ruta
  relativa → `/ruta`, URL completa (`http://`/`https://`) → tal cual.
- Test de regresión por componente (o uno solo bien elegido si alcanza):
  una foto con `src` de URL completa de Supabase renderiza con ese `src`
  exacto, no con `/https://...` — al menos en `ProductoGaleria.tsx` y
  `ProductoCard.tsx` (los dos con test existente hoy), corridos en rojo
  contra el código actual primero.
- Tests existentes (`producto-card.test.tsx`, etc.) siguen en verde sin
  modificar — las fotos con ruta relativa no cambian de comportamiento.
- Suite completa en verde.
- Commit local.

### Sprint 1 — Feature: mostrar todas las imágenes de variantes en el carrusel
**Cambio:** `lib/variantes.ts` — nueva `export function
fotosDeVariantes(variantes: Variante[] | null): Foto[]`, devuelve `{ src:
v.imagen, cap: etiquetaVariante(v) }` para cada variante `activo && imagen`
(mismo criterio de "activa" que el resto del selector — una variante sacada
de la venta no aporta foto). `ProductoFicha.tsx` arma `const fotos =
[...producto.fotos, ...fotosDeVariantes(producto.variantes)]` y se lo pasa
a `ProductoGaleria` en vez de `producto.fotos` directo. No se toca
`fotoDestacada`/`onCambiarImagen` (sigue igual para el caso de dos ejes,
sin regresión) — es puramente aditivo.

**Deliberadamente NO incluido (fuera de alcance, confirmar si hace falta
después):** al elegir una variante en la lista plana de un solo eje, el
carrusel no hace scroll/foco automático a SU foto — sólo queda visible
entre las miniaturas, el visitante la busca a mano. Auto-foco sería un
cambio de UX en `ProductoGaleria`/`AccionesProducto` no pedido
explícitamente; se puede sumar después si se quiere.

**Acceptance criteria:**
- Nuevo caso en `tests/unit/variantes.test.js` para `fotosDeVariantes()`:
  ignora variantes inactivas, ignora variantes sin `imagen`, cap =
  `etiquetaVariante(v)`.
- Test de regresión: `ProductoFicha` con un producto de variantes de un
  solo eje, todas con imagen propia y `fotos` general vacía → el carrusel
  ya NO muestra el logo genérico, muestra las fotos de las variantes
  (verificar contra `ProductoGaleria` montado con las props que arma
  `ProductoFicha`, no hace falta e2e).
- Suite completa en verde.
- Commit local.

### Sprint 2 — Feature: quitar la imagen de una variante (panel admin)
**Cambio:** `ProductoEditModal.tsx` — nueva función `quitarImagenVariante(i:
number)`: `setVariantes((prev) => prev.map((v, idx) => idx === i ? { ...v,
imagen: undefined } : v))`. Botón "Quitar imagen" (nombre accesible
distinto del "Quitar" que ya existe y borra la fila entera de variante),
visible sólo cuando `v.imagen` está seteado, al lado de la miniatura de esa
variante (línea ~421).

**Acceptance criteria:**
- Con una variante que ya tiene `imagen`, aparece el botón "Quitar
  imagen"; sin imagen, no aparece.
- Click en "Quitar imagen": la miniatura desaparece, el botón desaparece,
  el input de archivo sigue disponible para subir una nueva.
- Guardar después de quitar: `catalogo_productos.variantes[i].imagen`
  quedar sin ese valor (mismo criterio que ya prueba el test existente
  "subir una imagen a una variante..." pero a la inversa) — test corrido
  en rojo primero.
- Suite completa en verde.
- Commit local.

## Checkpoint final
1. Los 3 sprints completos, suite completa en verde en el estado final.
2. `npm run build` local limpio.
3. Mostrar diff completo al usuario.
4. Sin push (esperar pedido explícito).
