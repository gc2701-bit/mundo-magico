'use client';

import { useState } from 'react';
import AdminGate from '../../components/admin/AdminGate';
import PublicadoTab from '../../components/admin/PublicadoTab';
import EspejoTab from '../../components/admin/EspejoTab';

export default function AdminCatalogoPage() {
  const [tab, setTab] = useState<'publicado' | 'espejo'>('publicado');

  return (
    <AdminGate>
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
    </AdminGate>
  );
}
