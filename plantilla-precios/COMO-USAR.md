# Precios de la web — ya NO es una planilla

Este documento describía cómo armar una Google Sheet para editar precios.
Ese circuito se dio de baja: **los precios, el stock, las subcategorías y los
productos nuevos se editan directamente en la web**, con una cuenta de admin.
No hace falta abrir ninguna planilla ni tocar código para un cambio del día a
día.

## Cómo se edita ahora

1. Iniciar sesión con una cuenta de admin en el sitio.
2. En cualquiera de las 7 páginas de categoría (`*-v2.html`), prender
   **"Modo edición"** en la barra que aparece abajo a la izquierda.
3. Aparece un lápiz sobre cada tarjeta. Tocarlo abre un panel para:
   - cambiar el **precio** y marcarla **sin stock** (o sin stock de un color
     puntual, en una galería que comparte un código),
   - **corregir el código del POS** si quedó mal cargado, sin tocar el HTML,
   - moverla a otra **subcategoría** del mismo mundo, o crear una nueva,
   - **"Sacar de la web"** (reversible — no es borrar la tarjeta),
   - **"Mover a otro mundo"** (la convierte en un producto editable en el
     mundo destino).
4. El botón **"+ Agregar producto"** de esa misma barra carga uno nuevo de
   cero: foto desde el celular o la compu, título, precio, código,
   subcategoría y ficha técnica. La foto se ajusta sola a 1080×1080 con fondo
   blanco y se sube al Storage de Supabase.

Todo se ve al instante, sin recargar la página ni volver a publicar el sitio
en Netlify.

## Dónde vive cada cosa (para quien toque código)

| Tabla / archivo | Qué guarda |
|---|---|
| `catalogo_precios` (Supabase) | Precio y sin-stock por código del POS. Reemplaza la pestaña *Precios*. |
| `catalogo_fotos` (Supabase) | Foto → código, para tarjetas que no traían `data-pos`. Reemplaza la pestaña *Codigos*. |
| `catalogo_tarjetas` (Supabase) | Lo que un admin decidió sobre una tarjeta del HTML: ocultarla, su subcategoría, un código corregido a mano, colores sin stock. |
| `catalogo_subcategorias` (Supabase) | Las secciones dentro de cada mundo (migradas desde las `<section>` del HTML + las que se creen desde el navegador). |
| `catalogo_productos` (Supabase) | Productos que no nacieron en el HTML: cargados desde cero o movidos de mundo. |
| `assets/catalogo.js` | De dónde sale el dato (Supabase → caché → respaldo local `precios-datos.js`). |
| `assets/precios.js` | Pinta el precio en cada tarjeta y resuelve qué código le corresponde. |
| `assets/admin-catalogo.js` | Toda la edición desde el navegador (el lápiz, "Agregar producto", subir la foto). |
| `assets/catalogo-productos.js` | Dibuja en la página los productos de `catalogo_productos`. |
| `supabase/catalogo_*.sql` | El esquema. `catalogo_90_datos.sql` fue la migración inicial (ya corrida); no se vuelve a correr. |

## Si `precios-datos.js` (el respaldo local) queda viejo

Es el único caso en que todavía importa un archivo estático: si Supabase no
contesta, un visitante nuevo (sin caché en el navegador) ve estos precios
congelados en vez de nada. Como ahora se edita todo desde la web, este
archivo deja de actualizarse solo. No hay un botón para regenerarlo — si hace
falta, es tan simple como pedirle a Claude Code que exporte `catalogo_precios`
a ese formato antes de publicar una versión nueva del sitio.

## Qué queda de la carpeta vieja

`precios.XLS`, `.claude/gen-precios.py` y los `.csv` de acá siguen sirviendo
únicamente como una foto histórica del último export del POS antes de la
migración — no alimentan la web. `assets/precios-demo.js` (precios inventados
de una etapa anterior) no se usa ni se carga en ninguna página.
