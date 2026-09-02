'use client';

import { useCuenta } from '../cuenta/CuentaProvider';

/**
 * Gate de UI único para todo /admin/* (NO es la barrera de seguridad real
 * — esa la ponen las políticas RLS + es_admin(), ver supabase/*.sql).
 *
 * Sprint A del dashboard admin (tasks/plan-dashboard-admin.md): reemplaza
 * a los 3 gates que había antes, uno por sección (éste traía su propio
 * mini-login con Turnstile; AdminPedidosGate/AdminEnviosGate ya habían
 * migrado a reusar el modal de cuenta del sitio). Se monta una sola vez
 * en app/admin/layout.tsx — cada página ya no necesita el suyo, ni pone
 * su propio botón de "Cerrar sesión" (el del Nav del sitio alcanza).
 */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { sesion, cargandoSesion, esAdmin, pedirSesion } = useCuenta();

  if (cargandoSesion) return null;

  if (!sesion) {
    return (
      <div className="adm-wrap">
        <div className="adm-gate">
          <p>Necesitás iniciar sesión con la cuenta del negocio para acceder al panel de administración.</p>
          <button type="button" className="btn btn-primary" onClick={() => pedirSesion(undefined, 'login')}>
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!esAdmin) {
    return (
      <div className="adm-wrap">
        <div className="adm-gate">
          <p>Esta cuenta no tiene permisos de administrador.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
