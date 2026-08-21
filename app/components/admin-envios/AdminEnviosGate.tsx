'use client';

import { useCuenta } from '../cuenta/CuentaProvider';

/**
 * Gate de UI para /admin/envios — puerto de `#adm-gate`/`#adm-noadmin` de
 * admin-envios.html (Sprint 5, Task 5.4). Mismo patrón que
 * AdminPedidosGate.tsx (Task 5.3): reusa el modal de cuenta real en vez de
 * un formulario de login aparte.
 */
export default function AdminEnviosGate({ children }: { children: React.ReactNode }) {
  const { sesion, cargandoSesion, esAdmin, pedirSesion, cerrarSesion } = useCuenta();

  if (cargandoSesion) return null;

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <h1>Configuración de envíos</h1>
        {sesion && (
          <>
            <p className="adm-sesion-info">Conectado</p>
            <button type="button" className="adm-logout-btn" onClick={() => cerrarSesion()}>Cerrar sesión</button>
          </>
        )}
      </div>

      {!sesion ? (
        <div className="adm-gate">
          <p>Necesitás iniciar sesión con la cuenta del negocio para editar la configuración de envíos.</p>
          <button type="button" className="btn btn-primary" onClick={() => pedirSesion(undefined, 'login')}>Iniciar sesión</button>
        </div>
      ) : !esAdmin ? (
        <div className="adm-gate">
          <p>
            Esta cuenta no es admin, así que no puede editar esta configuración
            (las políticas de la base la rechazarían igual: esto es sólo para no
            mostrar un editor que no vas a poder usar).
          </p>
        </div>
      ) : (
        <div className="adm-panel">{children}</div>
      )}
    </div>
  );
}
