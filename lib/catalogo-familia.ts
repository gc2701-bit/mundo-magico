/**
 * Tipos compartidos del catálogo público + buscador de Explorar. Hasta
 * Sprint 5 esto vivía acá porque "familia" era la categorización pública;
 * desde Sprint 5.5 la categorización pública es "mundo" (ver
 * lib/catalogo-mundo.ts) y familia pasó a ser dato interno (Búho, sólo
 * panel admin) — este archivo se queda con lo que sigue siendo genérico
 * (tipos, búsqueda por texto), sin renombrarlo para no tocar los ~10
 * imports que ya apuntan acá.
 */

export type Foto = { src: string; cap: string; codigo?: string };
export type Variante = { talle?: string; tipo?: string; codigo: string; imagen?: string; activo: boolean };

// subirFoto() (lib/procesar-foto.ts) guarda `Foto.src` como URL pública
// COMPLETA de Supabase Storage (https://...) desde que el catálogo se
// edita desde la web (ver CLAUDE.md) — las fotos viejas del sitio HTML
// siguen siendo rutas relativas (`productos/...`). Un componente que
// antepone '/' a ciegas rompe las primeras (`/https://...`, URL
// inválida) — este helper es el único punto de esa decisión (antes
// duplicada sólo en ProductoEditModal.tsx, ver
// tasks/plan-imagenes-productos.md).
export function urlFoto(src: string): string {
  return src.startsWith('http') ? src : '/' + src;
}

export type ProductoPublico = {
  id: string;
  mundo: string;
  subcategoriaId: string | null;
  titulo: string;
  slug: string;
  codigo: string | null;
  specs: string[] | null;
  descripcion: string | null;
  tags: string[] | null;
  variantes: Variante[] | null;
  fotos: Foto[];
  orden: number;
  familia: string | null;
  // Sumados en Sprint 4 del rediseño de frontend (catalogo_13_publico_destacados.sql)
  // — curación del hero del home desde el panel admin (UI de esa
  // curación fuera de alcance de este proyecto, ver la spec).
  destacadoHome?: boolean;
  precioOferta?: number | null;
};

// Buscador de Explorar (Task 2.5) — sin acentos ni mayúsculas de por
// medio, sobre título y specs (no busca por código: eso es un dato de
// admin/pedido, no algo que un cliente tipee).
function normalizarTexto(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function buscarProductos(productos: ProductoPublico[], texto: string): ProductoPublico[] {
  const q = normalizarTexto(texto).trim();
  if (!q) return productos;
  return productos.filter((p) => {
    const titulo = normalizarTexto(p.titulo);
    const specs = (p.specs || []).map(normalizarTexto).join(' ');
    return titulo.includes(q) || specs.includes(q);
  });
}
