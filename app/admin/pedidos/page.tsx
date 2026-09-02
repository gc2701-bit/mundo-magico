'use client';

import AdminPedidosPanel from '@/app/components/admin-pedidos/AdminPedidosPanel';

/**
 * El gate de acceso (antes AdminPedidosGate.tsx, propio de esta sección)
 * ahora se monta una sola vez en app/admin/layout.tsx para todo /admin/*
 * (Sprint A del dashboard admin) — esta página pasa a poner su propio
 * <h1> y el link al panel del repartidor que antes traía el gate.
 */
export default function AdminPedidosPage() {
  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <h1>Pedidos</h1>
        <p className="adm-head-links"><a href="/ruta.html">Ver pantalla del repartidor</a></p>
      </div>
      <div className="adm-panel">
        <AdminPedidosPanel />
      </div>
    </div>
  );
}
