'use client';

import AdminPedidosGate from '@/app/components/admin-pedidos/AdminPedidosGate';
import AdminPedidosPanel from '@/app/components/admin-pedidos/AdminPedidosPanel';

export default function AdminPedidosPage() {
  return (
    <AdminPedidosGate>
      <AdminPedidosPanel />
    </AdminPedidosGate>
  );
}
