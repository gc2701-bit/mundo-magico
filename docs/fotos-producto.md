# Cómo subir y normalizar fotos de producto

Para que todas las fotos del catálogo se vean **parejas** (mismo tamaño, centradas en la
misma posición), seguí esta receta cada vez que agregues fotos nuevas.

---

## 1. Cómo sacar / preparar la foto

- **Fondo blanco liso** (una cartulina o pared blanca). Es lo más importante:
  el script detecta el producto separándolo del blanco.
- El producto **completo y centrado**, sin que se corte en los bordes.
- Evitá sombras fuertes. Una sombra suave está bien (el script la tolera).
- No importa si una foto sale más de cerca o más de lejos, ni un poco torcida:
  el script lo empareja. Lo único que **no** puede arreglar es un fondo que no sea blanco.
- Formato: cualquiera (jpg/png/webp). El script entrega `.webp`.

## 2. Dónde guardar los archivos

- Una **carpeta por producto** dentro de `productos/<categoría>/`.
  Ej: `productos/1. Cotillon y fiestas/Anteojo estrella/`.
- Un archivo por color, con nombre claro:
  `Anteojo estrella azul.webp`, `Anteojo estrella rojo.webp`, etc.
- El **primer** archivo (orden alfabético) es el que se muestra primero en la galería.
  Si querés una foto "todos los colores" al frente, nombrala para que quede primera
  (ej. empezando con `Anteojo ... todos.webp`).

## 3. Normalizar (el paso que las empareja)

Desde la raíz del proyecto, corré:

```bash
node .claude/normalize-products.js "productos/1. Cotillon y fiestas/Anteojo estrella"
```

Qué hace:
- **Respalda** las originales en una subcarpeta `_orig/` (solo la primera vez). Nunca se pierden.
- **Escala por área**: todos los productos terminan ocupando lo mismo (no importa si las
  patillas/brazos están más abiertos o cerrados).
- **Centra por el centro de masa** del producto → todos quedan en la misma posición.
- Deja todo en un **lienzo cuadrado blanco 1080×1080** `.webp` (calidad 84).

Como las fotos quedan cuadradas y las tarjetas del sitio son cuadradas, se ven completas,
sin recortes raros.

### Reprocesar
Si volvés a correr el script, toma siempre las originales desde `_orig/`, así podés
reprocesar las veces que quieras sin degradar la imagen.

### Volver atrás
Para recuperar una original: copiá el archivo desde `_orig/` de vuelta a la carpeta.

## 4. Ajustes finos (opcional)

En `.claude/normalize-products.js`, arriba de todo:
- `TARGET_AREA_FRAC` (def. `0.26`): cuánto del cuadro ocupa el producto. Subilo para que
  se vea más grande, bajalo para más margen.
- `MAX_EXTENT` (def. `0.94`): tope para que un producto muy ancho no toque los bordes.
- `CANVAS` (def. `1080`): tamaño del lienzo final.
- `LUMA_BG` (def. `242`): qué tan blanco se considera "fondo". Si el fondo sale grisáceo
  y queda recortado de más, subilo un poco.

## 5. Sumar el producto al HTML

En el `.html` de la categoría, dentro de la grilla `.pgrid`, agregá una tarjeta.
Para galería de varios colores usá `pcard has-gallery` (mirá un ejemplo existente como
"Anteojo estrella" en `cotillon.html`). El `assets/site.js` arma solo las flechas y los puntitos.

---

## Importante
- Esto sirve **solo para fotos con fondo blanco**. Para fotos de grupo, ambiente o con
  fondo de color, el script no las toca (las deja casi igual) y no conviene usarlo.
- Mantené el mismo criterio de fondo blanco para todo el catálogo y todo va a verse parejo.
