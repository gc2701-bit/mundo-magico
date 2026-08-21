/**
 * admin-pedidos.css sólo para /admin/pedidos — mismo criterio que
 * admin-catalogo.css en app/admin/layout.tsx (no mandárselo a cualquier
 * visitante). v2.css/carrito.css/cuenta.css ya están en el layout raíz
 * (Sprint 5, Tasks 5.1/5.2) — el sitio viejo los cargaba de nuevo acá
 * porque admin-pedidos.html era una página HTML suelta sin layout
 * compartido; en Next ya no hace falta repetirlos.
 */
export default function AdminPedidosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/assets/admin-pedidos.css" />
      {children}
    </>
  );
}
