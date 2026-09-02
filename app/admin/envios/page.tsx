'use client';

import AdminEnviosPanel from '@/app/components/admin-envios/AdminEnviosPanel';

/**
 * El gate de acceso (antes AdminEnviosGate.tsx, propio de esta sección)
 * ahora se monta una sola vez en app/admin/layout.tsx para todo /admin/*
 * (Sprint A del dashboard admin) — esta página pasa a poner su propio
 * <h1>.
 */
export default function AdminEnviosPage() {
  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <h1>Configuración de envíos</h1>
      </div>
      <div className="adm-panel">
        <AdminEnviosPanel />
      </div>
    </div>
  );
}
