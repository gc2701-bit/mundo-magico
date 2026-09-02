'use client';

import { useState } from 'react';
import TabAdministradores from '../../components/admin/TabAdministradores';
import TabClientes from '../../components/admin/TabClientes';

/**
 * Sprint D del dashboard admin — mismo patrón de tabs que
 * app/admin/catalogo/page.tsx (Publicado/Sin activar).
 */
export default function AdminUsuariosPage() {
  const [tab, setTab] = useState<'administradores' | 'clientes'>('administradores');

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <h1>Usuarios</h1>
      </div>
      <div className="adm-panel">
        <div className="adm-tabs" role="tablist">
          <button
            type="button"
            className={'adm-tab' + (tab === 'administradores' ? ' is-active' : '')}
            role="tab"
            aria-selected={tab === 'administradores'}
            onClick={() => setTab('administradores')}
          >
            Administradores
          </button>
          <button
            type="button"
            className={'adm-tab' + (tab === 'clientes' ? ' is-active' : '')}
            role="tab"
            aria-selected={tab === 'clientes'}
            onClick={() => setTab('clientes')}
          >
            Clientes
          </button>
        </div>
        <div className="adm-tab-panel" role="tabpanel" hidden={tab !== 'administradores'}>
          {tab === 'administradores' && <TabAdministradores />}
        </div>
        <div className="adm-tab-panel" role="tabpanel" hidden={tab !== 'clientes'}>
          {tab === 'clientes' && <TabClientes />}
        </div>
      </div>
    </div>
  );
}
