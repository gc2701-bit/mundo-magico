import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fraunces } from "../fonts";
import Breadcrumbs from "../components/Breadcrumbs";
import { GrillaSkeleton } from "../components/ProductoCardSkeleton";
import EmptyState from "../components/EmptyState";

/**
 * Página interna de verificación de los tokens de diseño (Sprint 0 del
 * rediseño de frontend, ver docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md).
 * No está linkeada desde el nav — sirve para confirmar visualmente que la
 * paleta/tipografía/espaciado de assets/v2.css llegaron bien a Tailwind y
 * shadcn, y para futuras regresiones de tokens. No usa Caveat — el bloque
 * de "detalle" usa Fraunces itálica, como decidió el usuario.
 */
export default function DesignPreviewPage() {
  return (
    <main className={`${fraunces.variable} mx-auto max-w-3xl px-s3 py-s6`}>
      <h1 className="font-display text-fs5 text-ink">Tokens de diseño</h1>
      <p className="font-body text-fs0 text-muted">
        Verificación visual — paleta, tipografía, espaciado y componentes
        shadcn con el tema de marca aplicado.
      </p>

      <section className="mt-s5">
        <h2 className="font-display text-fs2 text-ink">Paleta</h2>
        <div className="mt-s2 flex flex-wrap gap-s2">
          {[
            ["background", "bg-background border border-line"],
            ["ink", "bg-ink"],
            ["green", "bg-green"],
            ["green-ink", "bg-green-ink"],
            ["blue", "bg-blue"],
            ["red", "bg-red"],
            ["orange", "bg-orange"],
            ["yellow", "bg-yellow"],
          ].map(([name, cls]) => (
            <div key={name} className="text-center">
              <div className={`h-14 w-14 rounded-brand ${cls}`} />
              <span className="font-body text-fs-1 text-muted">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-s5">
        <h2 className="font-display text-fs2 text-ink">Tipografía</h2>
        <p className="font-display text-fs3 text-ink">Fraunces — títulos</p>
        <p className="font-body text-fs0 text-ink">
          Nunito Sans — texto de cuerpo, el que se usa en párrafos largos.
        </p>
        <p className="font-display italic text-fs1 text-ink">
          Fraunces itálica — detalle de ficha técnica (reemplaza a Caveat)
        </p>
      </section>

      <section className="mt-s5 flex flex-wrap gap-s2">
        <Button>Agregar al carrito</Button>
        <Button variant="secondary">Ver más</Button>
        <Button variant="destructive">Eliminar</Button>
      </section>

      <section className="mt-s5">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Anteojo estrella</CardTitle>
            <CardDescription className="font-body">
              Cotillón · $3.900
            </CardDescription>
          </CardHeader>
          <CardContent className="font-body text-fs-1 text-muted">
            Ficha técnica de ejemplo, en Fraunces itálica cuando corresponda.
          </CardContent>
        </Card>
      </section>

      <section className="mt-s5">
        <h2 className="font-display text-fs2 text-ink">Breadcrumbs (Sprint 3)</h2>
        <div className="mt-s2">
          <Breadcrumbs
            items={[
              { label: "Inicio", href: "/" },
              { label: "Cotillón", href: "/globos-fiesta" },
              { label: "Anteojos" },
            ]}
          />
        </div>
      </section>

      <section className="mt-s5">
        <h2 className="font-display text-fs2 text-ink">Skeleton de carga (Sprint 3)</h2>
        <div className="mt-s2">
          <GrillaSkeleton n={4} />
        </div>
      </section>

      <section className="mt-s5">
        <h2 className="font-display text-fs2 text-ink">Estados vacíos (Sprint 3)</h2>
        <div className="mt-s2 grid gap-s3 md:grid-cols-3">
          <EmptyState
            icono="🔍"
            titulo='No encontramos nada para "sombrero rosa xl"'
            descripcion="Probá con otra palabra"
          />
          <EmptyState
            icono="🎃"
            titulo="Halloween está por venir"
            descripcion="Todavía no cargamos productos acá"
            accion={{ label: "Ver otros mundos", href: "/explorar" }}
          />
          <EmptyState
            icono="🛒"
            titulo="Tu carrito está vacío"
            accion={{ label: "Ver los mundos", href: "/explorar" }}
          />
        </div>
      </section>
    </main>
  );
}
