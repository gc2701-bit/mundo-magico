/**
 * Puerto de recuperar.html (sitio Eleventy viejo) — página a la que
 * Supabase manda al usuario por mail al pedir "olvidé mi contraseña"
 * (ver `redirectTo` en app/components/cuenta/CuentaModal.tsx). No estaba
 * migrada — encontrada en el inventario de páginas del sitio viejo tras
 * el incidente de producción del home (2026-08-21, ver "Corte a
 * producción" en el plan). Sólo se llega acá desde ese link de correo,
 * nunca desde la navegación del sitio — noindex a propósito, igual que
 * el original.
 */
import type { Metadata } from 'next';
import RecuperarForm from '../components/RecuperarForm';

export const metadata: Metadata = {
  title: 'Elegir contraseña nueva · Mundo Mágico',
  robots: { index: false, follow: false },
};

export default function RecuperarPage() {
  return (
    <>
      <link rel="stylesheet" href="/assets/recuperar.css" />
      <RecuperarForm />
    </>
  );
}
