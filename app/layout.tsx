import type { Metadata } from "next";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import { obtenerCatalogoPublico } from "@/lib/catalogo-server";
import { familiasDisponibles } from "@/lib/catalogo-familia";
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
      </head>
      <body>
        <Nav familias={familias} />
        {children}
        <Footer familias={familias} />
      </body>
    </html>
  );
}
