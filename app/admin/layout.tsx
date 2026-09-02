import type { Metadata } from 'next';
import AdminGate from '../components/admin/AdminGate';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * admin-catalogo.css sólo para /admin/* — no tiene sentido mandárselo a
 * cualquier visitante (mismo hallazgo que ya tenía la auditoría de
 * performance vieja sobre el bundle admin viejo, ver
 * mundomagicoweb_audit_2026-08 en memoria de proyecto).
 *
 * El script de Cloudflare Turnstile (captcha del login) vive en el layout
 * raíz (app/layout.tsx) — se necesita site-wide, para CuentaModal,
 * montado en todo el sitio. AdminGate ya no trae su propio login (Sprint
 * A del dashboard admin), así que /admin/* no depende de Turnstile
 * directamente, sólo hereda el modal de cuenta del sitio.
 *
 * AdminGate se monta acá una sola vez, para todas las secciones de
 * /admin/* (antes cada página traía la suya) — ver
 * tasks/plan-dashboard-admin.md.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/assets/admin-catalogo.css" />
      <AdminGate>{children}</AdminGate>
    </>
  );
}
