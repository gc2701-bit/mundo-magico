import type { Metadata } from 'next';

// Página interna de trabajo: la abre el empleado desde el chat, no tiene
// que aparecer en Google ni competir con las páginas del catálogo — mismo
// <meta name="robots"> que tenía pedido.html.
export const metadata: Metadata = {
  title: 'Pedido · Mundo Mágico',
  robots: { index: false, follow: false },
};

export default function PedidoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
