# Mundo Mágico — instrucciones del proyecto

## El catálogo se edita desde la propia web (precio, stock, subcategorías, productos)

Precio, stock, subcategorías y productos nuevos **ya no se editan en el
código ni en una Google Sheet** (ver `plantilla-precios/COMO-USAR.md` para el
porqué): se editan desde el sitio mismo, con una cuenta de admin y "Modo
edición" prendido (barra flotante abajo a la izquierda). Antes de tocar a
mano una tarjeta o un precio por este pedido del usuario, primero preguntar
si no es más simple indicarle que lo haga desde ese panel.

Lo que ese panel ya permite, todo sin volver a publicar el sitio:

- Precio y "sin stock" por código del POS (y sin stock de un color puntual,
  en una galería que comparte un solo código).
- Corregir un código mal cargado en el HTML sin tocar el HTML
  (`codigo_override`).
- Mover una tarjeta a otra subcategoría del mismo mundo, o crear una nueva.
- "Sacar de la web" (reversible — no borra la tarjeta del HTML, ver más abajo
  la diferencia con dar de baja de verdad).
- "Mover a otro mundo": convierte la tarjeta en un producto editable
  (`catalogo_productos`) en el mundo destino y oculta la original.
- "Convertir en producto editable": lo mismo, pero dejándola en su mundo y su
  subcategoría. Es la salida para lo único que el popover de una tarjeta del
  HTML no sabe hacer — **agregarle fotos** —, porque las fotos de una tarjeta
  escrita a mano viven en el HTML y no en la base. Se lleva todas las fotos
  de la galería con su color y su código.
- "+ Agregar producto": carga uno de cero con foto desde el celular o la
  compu (se ajusta sola a 1080×1080 con fondo blanco), título, precio,
  código, subcategoría y ficha técnica.

**Archivos clave:** `supabase/catalogo_*.sql` (esquema), `assets/catalogo.js`
(de dónde salen los datos), `assets/precios.js` (pinta el precio y resuelve
el código), `assets/admin-catalogo.js` (toda la edición y la subida de
fotos), `assets/catalogo-productos.js` (dibuja los productos de
`catalogo_productos` en la página). Explorar (`assets/explorar.js`) y el
buscador (`assets/search.js`) ya suman estos productos además de las
tarjetas del HTML.

**Qué admite un producto de `catalogo_productos`:** varias fotos con nombre,
código y precio por color (`galeria-multi`), galería de código compartido,
talles, o una sola foto. El mismo formulario de "+ Agregar producto" sirve
para editarlo después.

**Dónde sigue haciendo falta tocar el HTML:** para sumarle fotos a una
tarjeta que está escrita en el HTML hay que convertirla primero (ver arriba).
Si preferís que siga viviendo en el código —porque es una tarjeta que querés
versionada y no en la base— entonces sí, seguí el flujo manual de "Subir
fotos de productos nuevos" de abajo.

## Actualizar el SDK de Supabase (assets/supabase-js-*.min.js)

El sitio NO carga `@supabase/supabase-js` desde un CDN: se descargó una
versión exacta a `assets/supabase-js-<version>.min.js` y todas las páginas
apuntan a ese archivo local. Es a propósito — un CDN sin versión fija y sin
`integrity` es la puerta más fácil para inyectar código en una página donde
los clientes escriben su contraseña. El costo es que no se actualiza solo.

Para subir de versión:
1. Bajar el build UMD exacto:
   ```bash
   curl -s https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<version>/dist/umd/supabase.js -o assets/supabase-js-<version>.min.js
   ```
2. Borrar el archivo de la versión vieja.
3. Actualizar el `<script src="assets/supabase-js-...">` en las 14 páginas
   que lo cargan (todas las `-v2.html`, `index.html`, `explorar.html`,
   `admin-pedidos.html`, `admin-envios.html`, `ruta.html`).
4. Probar en `node .claude/static-server.js` que el login/registro sigan
   funcionando antes de dar por terminado.

## Subir fotos de productos nuevos

Si el producto es de una sola foto (sin galería de colores ni talles con
código propio), es más simple cargarlo con **"+ Agregar producto"** desde el
panel de admin del sitio (ver arriba) — no hace falta tocar el HTML ni
regenerar nada. Lo de abajo es el flujo manual, para todo lo demás.

Cuando el usuario suba fotos nuevas a `/productos` y pida publicarlas, además de
agregar la tarjeta (`pcard`) en la página correspondiente, **siempre** dejarla
vinculada a su código de producto (el mismo que usa el POS/local), así queda
buscable y trazable. Pasos:

1. **Identificar el código.** Casi todos los archivos traen el código al final
   del nombre (ej. `Anteojo blanco con strass 59521.jpeg` → código `59521`).
   Si varias fotos son variantes de color del mismo producto, suelen compartir
   el mismo código.
2. **Agregar el `<a class="pcard reveal ...">` a mano** en la página `-v2.html`
   que corresponda (ver "Dónde va cada categoría" abajo). Las páginas v2 NO se
   generan automáticamente desde la carpeta `/productos`; las tarjetas están
   escritas directamente en el HTML.
   - Poner el código en `data-pos="<codigo>"` en el `<a>` de la tarjeta.
   - Si el producto tiene varios colores con el mismo código, usar el patrón
     de galería (`has-gallery`, `gtrack`, `<img data-cap="color">`, botones
     `gnav gprev/gnext`, `gdots`) en vez de una tarjeta por color. Copiar la
     estructura de una tarjeta con galería ya existente en esa misma página.
   - Si son productos distintos con códigos distintos (aunque el nombre se
     parezca), van como tarjetas separadas, cada una con su propio `data-pos`.
   - Encodear la ruta de la imagen con `encodeURIComponent` por segmento
     (espacios → `%20`, ñ → `%C3%B1`, etc.), igual que las rutas ya existentes.
3. **Regenerar el snapshot de búsqueda** después de editar el HTML:
   ```bash
   node .claude/gen-explorar-data.js
   ```
   Esto reescribe `assets/explorar-data.js` leyendo las tarjetas `.pcard` de
   las páginas — es lo que usa "Explorar" y el buscador cuando el sitio se
   abre como archivo local.

   Si la tarjeta nueva se agregó a una subcategoría que ya existía (no una
   recién creada desde el panel), regenerar también el censo del mega-menú:
   ```bash
   node .claude/gen-subcategorias-html.js
   ```
   Reescribe `assets/subcategorias-html.js` — es lo que usa
   `assets/mundo-menu.js` para saber si una subcategoría migrada del HTML
   se quedó sin ningún producto visible y sacarla del desplegable
   "Nuestros mundos" del header. No hace falta correrlo por ocultar/mostrar/
   mover tarjetas desde el panel de admin (eso ya se lee en vivo) — sólo
   cuando se agrega o saca una tarjeta a mano del HTML.
4. **Verificar en el navegador** que la tarjeta nueva aparece, que las fotos
   cargan y que, si es galería, las flechas/puntos cambian de color bien.

## `data-talles` (tamaños) vs. galería de colores

No confundir las dos formas de "variantes" que usan las tarjetas — son cosas
distintas y no se combinan en la misma tarjeta:

- **Mismo producto, distintos tamaños** (ej. Florero Chico/Mediano/Grande, cada
  tamaño con su propio código) → una sola tarjeta simple (sin galería), con
  `data-talles="Chico:9283;Grande:4228"` (formato `Nombre:codigo;Nombre:codigo`).
  No lleva `data-pos` porque no hay un único código.
- **Mismo producto, mismo código, distintos colores** (ej. Anteojo estrella en
  5 colores) → tarjeta con galería (`has-gallery`/`gtrack`/`gdots`) y un solo
  `data-pos` compartido, como se explica arriba.

Si un producto tiene tamaños Y colores a la vez, preguntar antes de mezclar
los dos patrones — no hay un ejemplo existente para copiar a ciegas.

## Mejorar la calidad o el fondo de una foto ya publicada

No editar la imagen a mano (photoshop/recorte manual). Este proyecto tiene
scripts con `sharp` para eso, que además hacen backup del original:

- **Normalizar fondo/encuadre de una carpeta entera** (fondo blanco, mismo
  tamaño relativo del producto, centrado):
  ```bash
  node .claude/normalize-products.js "productos/<carpeta>"
  ```
  Solo procesa `.webp` de esa carpeta y guarda el original sin tocar en una
  subcarpeta `_orig/` (si ya existe un backup ahí, no lo pisa). Las fotos que
  tengan "todos" en el nombre (vista de todos los colores juntos) se dejan
  sin normalizar.
- **Reemplazar una foto puntual por una versión de mejor resolución**: no hay
  un comando genérico — `.claude/replace-quality.js` es un script de un solo
  uso con una lista `PAIRS` hardcodeada de `[origen en "productos/Mejor
  calidad/", destino a reemplazar]`. Para reutilizarlo: poner el archivo nuevo
  en `productos/Mejor calidad/`, agregar el par al array `PAIRS`, y correr
  `node .claude/replace-quality.js`. También hace backup en `_orig/` antes de
  pisar el destino.

## Dónde va cada categoría (páginas reales del sitio)

La navegación usa las páginas `*-v2.html`, no las viejas sin `-v2`:

- `globos-fiesta-v2.html` → Cotillón (sombreros/gorros, anteojos, antifaces y
  máscaras, luces y efectos, mis 15, novias)
- `cumpleanos-v2.html` → Cumpleaños (incluye Globos sueltos y en set, cortinas,
  guirnaldas, decoración de cumple, tortas/velas, licencias)
- `disfraces-v2.html`, `reposteria-v2.html`, `decoracion-v2.html`,
  `combos-v2.html`, `especiales-v2.html`

`.claude/gen-products.js` es un script viejo que apunta a páginas y a una
numeración de carpetas de `/productos` que ya no coinciden con la estructura
actual — no usarlo para publicar en las páginas v2.

`assets/pos-codes.js` es un mapeo aparte (generado desde planillas/Word) que
no hace falta tocar a mano al subir fotos nuevas; alcanza con el `data-pos`
puesto directamente en la tarjeta.

## Dar de baja un producto

Si lo que hace falta es algo reversible y ya (una promo que se acabó, un
producto que quizás vuelva), es más simple usar **"Sacar de la web"** desde
el panel de admin del sitio (ver arriba) — no toca el HTML, se puede volver a
mostrar con un clic. Lo de abajo es para una baja DE VERDAD (el HTML sigue
sirviéndose igual, así que "Sacar de la web" no alcanza si el producto no
puede seguir existiendo ni en el código fuente):

Cuando pidan sacar/discontinuar un producto de la web, no basta con borrar la
tarjeta del HTML:

1. Borrar el `<a class="pcard ...">` completo de la página `-v2.html`
   correspondiente.
2. Mover sus fotos de `/productos/...` a `_archive/` (no borrarlas del disco),
   conservando el nombre de archivo, por si hay que restaurarlo después.
3. Regenerar el snapshot de búsqueda y el censo del mega-menú:
   ```bash
   node .claude/gen-explorar-data.js
   node .claude/gen-subcategorias-html.js
   ```
4. Si el producto tenía `data-pos`, revisar `assets/pos-codes.js` por si ese
   código quedó referenciado ahí también (no es automático, es un mapeo
   aparte — ver arriba).

## Verificar en servidor local, no abriendo el HTML directo

El sitio usa `fetch()` (buscador, Explorar) que el navegador bloquea bajo
`file://`. Antes de dar por terminado un cambio, levantar el servidor local
en vez de abrir el archivo a doble clic:

```bash
node .claude/static-server.js
```

(esto es lo mismo que hace `iniciar.bat`, que además abre
`http://localhost:8000/index.html` solo). Verificar ahí — no en el archivo
abierto directo — sobre todo para cualquier cosa que dependa del buscador,
Explorar, o de que varias páginas se lean entre sí.
