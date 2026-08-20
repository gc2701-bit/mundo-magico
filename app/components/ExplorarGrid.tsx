'use client';

import { useMemo, useState } from 'react';
import type { ProductoPublico } from '@/lib/catalogo-familia';
import { buscarProductos } from '@/lib/catalogo-familia';
import ProductoCard from './ProductoCard';

/**
 * Explorar (Task 2.5) — versión de Sprint 2: buscador + grilla de todo el
 * catálogo publicado, sin la experiencia de carrusel a pantalla completa
 * del explorar.js viejo (queda fuera de alcance de esta tanda, es
 * presentación, no dato/ruteo). Todos los productos llegan ya resueltos
 * desde el servidor (Server Component padre) — el filtro es puramente
 * client-side, sin ida y vuelta al servidor.
 */
export default function ExplorarGrid({ productos }: { productos: ProductoPublico[] }) {
  const [busqueda, setBusqueda] = useState('');
  const resultados = useMemo(() => buscarProductos(productos, busqueda), [productos, busqueda]);

  return (
    <div className="wrap">
      <input
        type="search"
        placeholder="Buscar productos"
        aria-label="Buscar productos"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />
      <p aria-live="polite">
        {resultados.length} {resultados.length === 1 ? 'producto encontrado' : 'productos encontrados'}
      </p>
      <div className="pgrid">
        {resultados.map((producto) => (
          <ProductoCard key={producto.id} producto={producto} />
        ))}
      </div>
    </div>
  );
}
