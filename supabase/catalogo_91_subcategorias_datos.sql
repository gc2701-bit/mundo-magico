-- Catálogo 91 — Subcategorías migradas desde las <section> ya escritas a
-- mano en las 7 páginas -v2.html (generado por .claude/gen-subcategorias-sql.js).
-- Correr una sola vez en el SQL Editor, DESPUÉS de catalogo_03_subcategorias.sql.
--
-- El slug de cada fila es el id que YA TIENE la <section> en el HTML, no uno
-- recalculado del título — así assets/precios.js (pgridDe) encuentra la
-- sección existente y la reusa en vez de crear una duplicada.
--
-- on conflict do nothing: si esto se vuelve a correr después de que un admin
-- ya haya creado a mano una subcategoría con el mismo (pagina, slug), no la pisa.

insert into public.catalogo_subcategorias (pagina, nombre, slug, orden) values
  ('globos-fiesta-v2.html', 'Luces y efectos', 'efectos', 0),
  ('globos-fiesta-v2.html', 'Sombreros y gorros', 'sombreros-gorros', 1),
  ('globos-fiesta-v2.html', 'Anteojos', 'anteojos', 2),
  ('globos-fiesta-v2.html', 'Antifaces y máscaras', 'antifaces', 3),
  ('globos-fiesta-v2.html', 'Mis 15', 'mis15', 4),
  ('globos-fiesta-v2.html', 'Novias', 'novias', 5),
  ('cumpleanos-v2.html', 'Globos', 'globos', 0),
  ('cumpleanos-v2.html', 'Cortinas', 'cortinas', 1),
  ('cumpleanos-v2.html', 'Guirnaldas y banderines', 'guirnaldas', 2),
  ('cumpleanos-v2.html', 'Toppers', 'toppers', 3),
  ('cumpleanos-v2.html', 'Velas', 'velas', 4),
  ('cumpleanos-v2.html', 'Líneas infantiles', 'licencias', 5),
  ('decoracion-v2.html', 'Mesa y descartables', 'descartables', 0),
  ('decoracion-v2.html', 'Puesta de mesa', 'puesta-de-mesa', 1),
  ('decoracion-v2.html', 'Platos', 'platos', 2),
  ('decoracion-v2.html', 'Servilletas de papel', 'servilletas', 3),
  ('decoracion-v2.html', 'Repasadores y caminos', 'repasadores', 4),
  ('decoracion-v2.html', 'Floreros', 'floreros', 5),
  ('decoracion-v2.html', 'Rincones con vida', 'los-rincones', 6),
  ('decoracion-v2.html', 'Las paredes que abrazan', 'las-paredes', 7),
  ('decoracion-v2.html', 'Suave y cálido', 'textiles', 8),
  ('disfraces-v2.html', 'Accesorios', 'accesorios', 0),
  ('disfraces-v2.html', 'Los disfraces', 'disfraces', 1),
  ('disfraces-v2.html', 'Para el acto patrio', 'acto-patrio', 2),
  ('reposteria-v2.html', 'Para hornear', 'para-hornear', 0),
  ('reposteria-v2.html', 'Moldes', 'moldes', 1),
  ('reposteria-v2.html', 'Cortantes', 'cortantes', 2),
  ('reposteria-v2.html', 'Manga y picos', 'manga-y-picos', 3),
  ('reposteria-v2.html', 'La mesa dulce', 'la-mesa-dulce', 4),
  ('reposteria-v2.html', 'Para regalar', 'para-regalar', 5),
  ('combos-v2.html', 'Elegí tu combo', 'combos', 0)
on conflict (pagina, slug) do nothing;
