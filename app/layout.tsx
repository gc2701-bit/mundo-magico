import type { Metadata } from "next";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mundo Mágico",
  description: "Cotillón, disfraces y fiestas en Tucumán desde 1994.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
