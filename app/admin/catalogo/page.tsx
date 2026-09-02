'use client';

import { useState } from 'react';
import PublicadoTab from '../../components/admin/PublicadoTab';
import EspejoTab from '../../components/admin/EspejoTab';

/**
 * El gate de acceso (antes propio, AdminGate.tsx con su mini-login) ahora
 * se monta una sola vez en app/admin/layout.tsx para todo /admin/* — esta
 * página ya no lo envuelve, y pasa a poner su propio <h1> (Sprint A del
 * dashboard admin).
 */
export default function AdminCatalogoPage() {
  const [tab, setTab] = useState<'publicado' | 'espejo'>('publicado');

  return (
    <div className="adm-wrap adm-wrap-catalogo">
      <div className="adm-head">
        <h1>Catálogo</h1>
      </div>
      <div className="adm-panel">
        <div className="adm-tabs" role="tablist">
          <button
            type="button"
            className={'adm-tab' + (tab === 'publicado' ? ' is-active' : '')}
            role="tab"
            aria-selected={tab === 'publicado'}
            onClick={() => setTab('publicado')}
          >
            Publicado
          </button>
          <button
            type="button"
            className={'adm-tab' + (tab === 'espejo' ? ' is-active' : '')}
            role="tab"
            aria-selected={tab === 'espejo'}
            onClick={() => setTab('espejo')}
          >
            Sin activar
          </button>
        </div>
        <div className="adm-tab-panel" role="tabpanel" hidden={tab !== 'publicado'}>
          {tab === 'publicado' && <PublicadoTab />}
        </div>
        <div className="adm-tab-panel" role="tabpanel" hidden={tab !== 'espejo'}>
          {tab === 'espejo' && <EspejoTab />}
        </div>
      </div>
    </div>
  );
}
