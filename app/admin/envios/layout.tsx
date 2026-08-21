/**
 * admin-envios.html cargaba admin-pedidos.css (no un archivo propio: las
 * clases .adm-cfg-* del editor de configuración viven ahí junto con las de
 * pedidos) — mismo criterio en Next, ver app/admin/pedidos/layout.tsx.
 */
export default function AdminEnviosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/assets/admin-pedidos.css" />
      {children}
    </>
  );
}
