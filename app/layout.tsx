import type { Metadata } from "next";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import { obtenerCatalogoPublico } from "@/lib/catalogo-server";
import { mundosDisponibles } from "@/lib/catalogo-mundo";
import { CuentaProvider } from "./components/cuenta/CuentaProvider";
import CuentaOverlays from "./components/cuenta/CuentaOverlays";
import { CarritoProvider } from "./components/carrito/CarritoProvider";
import "./globals.css";
import { nunitoSans } from "./fonts";
import { cn } from "@/lib/utils";

// shadcn init agrega Geist (Google Fonts) acá por default — lo
// reemplazamos por Nunito Sans autoalojada (app/fonts.ts), la misma
// familia que ya usa v2.css, para no sumar una fuente ajena a la marca ni
// una dependencia de Google Fonts que este proyecto evita a propósito
// (mismo criterio que supabase-js vendorizado local, ver CLAUDE.md).

export const metadata: Metadata = {
  title: "Mundo Mágico",
  description: "Cotillón, disfraces y fiestas en Tucumán desde 1994.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Un solo fetch de catalogo_publico() para todo el layout — Next dedupea
  // automáticamente el mismo fetch (misma URL/opciones) si una página hija
  // (ej. app/[mundo]/page.tsx) lo vuelve a pedir en el mismo render.
  const catalogo = await obtenerCatalogoPublico();
  const slugsConProductos = new Set(mundosDisponibles(catalogo.productos));
  const mundos = catalogo.mundos
    .filter((m) => slugsConProductos.has(m.slug))
    .sort((a, b) => a.orden - b.orden);

  return (
    <html lang="es" className={cn("font-sans", nunitoSans.variable)}>
      <head>
        {/* Preload de las fuentes autoalojadas (Fraunces/Nunito Sans) — cada
            página del sitio viejo lo tenía en el <head>. v2.css las carga
            con font-display:optional (corta al fallback si no llegan a
            tiempo, sin reintentar más tarde) — sin este preload el
            navegador las descubre recién al parsear el CSS, mucho más
            tarde, y el texto puede quedar en la fuente de reemplazo
            (Georgia/system-ui) para toda la carga. Encontrado en
            producción real, 2026-08-21. */}
        <link rel="preload" href="/assets/fonts/Fraunces-500.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/assets/fonts/NunitoSans-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* v2.css vive ahora en public/assets (Sprint 2, ver plan) — mismo
            hoja de estilos que ya usa el sitio viejo, servida en la misma
            URL. No se reescribe el diseño de cero para esta migración. */}
        <link rel="stylesheet" href="/assets/v2.css" />
        {/* carrito.css/cuenta.css viven en public/assets desde el Sprint 2
            (mover assets/ a public/) — cuenta.css reusa las clases
            genéricas de modal (.cart-field, .cart-send, .cart-x, .cart-head,
            .cart-scrim) que define carrito.css, así que las dos hojas se
            cargan juntas aunque el panel del carrito en sí llegue recién en
            la Task 5.2 de este mismo sprint. */}
        <link rel="stylesheet" href="/assets/carrito.css" />
        <link rel="stylesheet" href="/assets/cuenta.css" />
      </head>
      <body>
        <CuentaProvider>
          <CarritoProvider>
            <Nav mundos={mundos} />
            {children}
            <Footer mundos={mundos} />
            <CuentaOverlays />
          </CarritoProvider>
        </CuentaProvider>
      </body>
    </html>
  );
}
