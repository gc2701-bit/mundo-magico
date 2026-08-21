import type { Metadata } from "next";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import { obtenerCatalogoPublico } from "@/lib/catalogo-server";
import { familiasDisponibles } from "@/lib/catalogo-familia";
import { CuentaProvider } from "./components/cuenta/CuentaProvider";
import CuentaOverlays from "./components/cuenta/CuentaOverlays";
import { CarritoProvider } from "./components/carrito/CarritoProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mundo Mágico",
  description: "Cotillón, disfraces y fiestas en Tucumán desde 1994.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Un solo fetch de catalogo_publico() para todo el layout — Next dedupea
  // automáticamente el mismo fetch (misma URL/opciones) si una página hija
  // (ej. app/[familia]/page.tsx) lo vuelve a pedir en el mismo render.
  const catalogo = await obtenerCatalogoPublico();
  const familias = familiasDisponibles(catalogo.productos);

  return (
    <html lang="es">
      <head>
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
            <Nav familias={familias} />
            {children}
            <Footer familias={familias} />
            <CuentaOverlays />
          </CarritoProvider>
        </CuentaProvider>
      </body>
    </html>
  );
}
