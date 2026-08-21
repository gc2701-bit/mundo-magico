-- Catálogo 08 (familia) — columna `familia` en catalogo_productos, la
-- categorización que manda el worker de Búho (Sprint 1 de la migración a
-- Next.js). Correr DESPUÉS de catalogo_08_stock_privado.sql.
--
-- Aditiva a propósito: no borra `pagina`/`subcategoria_id` (ver el plan,
-- docs/superpowers/plans/2026-08-20-nextjs-migracion-familias-plan.md).
-- Contrato de estabilidad: una vez que un producto se publica, el worker
-- de Búho nunca vuelve a pisar esta columna por su cuenta — cambiarla es
-- siempre decisión humana desde el panel admin.
--
-- Nota histórica (Sprint 5.5): "familia" dejó de ser la categorización
-- PÚBLICA (eso volvió a ser "mundo", ver catalogo_09_mundos.sql) — sigue
-- existiendo tal cual, ahora como dato interno visible sólo en el panel
-- admin.

alter table public.catalogo_productos
  add column if not exists familia text;
