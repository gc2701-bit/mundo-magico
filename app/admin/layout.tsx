import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * admin-catalogo.css sólo para /admin/* — no tiene sentido mandárselo a
 * cualquier visitante (mismo hallazgo que ya tenía la auditoría de
 * performance vieja sobre el bundle admin viejo, ver
 * mundomagicoweb_audit_2026-08 en memoria de proyecto). El script de
 * Cloudflare Turnstile (captcha del login, ver AdminGate.tsx) tampoco
 * hace falta en ninguna otra página.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/assets/admin-catalogo.css" />
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      {children}
    </>
  );
}
