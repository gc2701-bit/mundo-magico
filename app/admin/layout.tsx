import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * admin-catalogo.css sólo para /admin/* — no tiene sentido mandárselo a
 * cualquier visitante (mismo hallazgo que ya tenía la auditoría de
 * performance vieja sobre el bundle admin viejo, ver
 * mundomagicoweb_audit_2026-08 en memoria de proyecto).
 *
 * El script de Cloudflare Turnstile (captcha del login, ver
 * AdminGate.tsx/useTurnstile.ts) vive en el layout raíz (app/layout.tsx)
 * — se necesita site-wide, no sólo acá (CuentaModal, montado en todo el
 * sitio, también lo usa). Las páginas /admin/* lo heredan de ahí, no
 * hace falta repetirlo.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/assets/admin-catalogo.css" />
      {children}
    </>
  );
}
