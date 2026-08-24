'use client';

import { useCuenta } from '../cuenta/CuentaProvider';

/**
 * Gate de UI (NO es la barrera de seguridad real — esa la ponen las
 * políticas RLS sobre `pedidos`/`admins`, ver supabase/pedidos_envio.sql)
 * para /admin/pedidos — puerto de la sección `#adm-gate` de
 * admin-pedidos.html (Sprint 5, Task 5.3).
 *
 * A diferencia de AdminGate.tsx (Sprint 4, catálogo), que trae su propio
 * mini-formulario de login: acá ya existe el modal de cuenta completo
 * (CuentaProvider, Task 5.1), así que este gate lo reusa en vez de duplicar
 * un formulario — mismo patrón que ya usa el resto del sitio para pedir
 * sesión (pedirSesion()).
 */
export default function AdminPedidosGate({ children }: { children: React.ReactNode }) {
  const { sesion, cargandoSesion, esAdmin, pedirSesion, cerrarSesion } = useCuenta();

  if (cargandoSesion) return null;

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <h1>Pedidos</h1>
        {sesion && (
          <>
            <p className="adm-sesion-info">Conectado</p>
            <button type="button" className="adm-logout-btn" onClick={() => cerrarSesion()}>Cerrar sesión</button>
          </>
        )}
        <p className="adm-head-links"><a href="/ruta.html">Ver pantalla del repartidor</a></p>
      </div>

      {!sesion ? (
        <div className="adm-gate">
          <p>Necesitás iniciar sesión con la cuenta del negocio para ver y organizar los pedidos.</p>
          <button type="button" className="btn btn-primary" onClick={() => pedirSesion(undefined, 'login')}>Iniciar sesión</button>
        </div>
      ) : !esAdmin ? (
        <div className="adm-gate">
          <p>Esta cuenta no tiene permisos de administrador.</p>
        </div>
      ) : (
        <div className="adm-panel">{children}</div>
      )}
    </div>
  );
}
