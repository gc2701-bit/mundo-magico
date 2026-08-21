'use client';

import AdminEnviosGate from '@/app/components/admin-envios/AdminEnviosGate';
import AdminEnviosPanel from '@/app/components/admin-envios/AdminEnviosPanel';

export default function AdminEnviosPage() {
  return (
    <AdminEnviosGate>
      <AdminEnviosPanel />
    </AdminEnviosGate>
  );
}
