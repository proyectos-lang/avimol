import type { ComponentType, CSSProperties } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { TonoAlerta } from "@/lib/insights-tipos"

export interface HeroKpi {
  icono: ComponentType<{ className?: string }>
  label: string
  valor: string | number
}

export interface HeroAlerta {
  icono: ComponentType<{ className?: string }>
  texto: string
  tono: TonoAlerta
  href?: string
}

const ALERTA_ESTILO: Record<TonoAlerta, string> = {
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  advertencia: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  critico: "border-destructive/40 bg-destructive/10 text-destructive",
  ok: "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400",
}

// Banda de insights de alto impacto en la parte superior de cada módulo.
// El color viene del `tint` del grupo (--chart-*), con degradado y glow
// del mismo lenguaje visual de components/module-cards.tsx. Presentacional:
// los datos los calcula lib/insights-actions.ts y los monta modulo-hero-bar.
export function ModuloHero({
  tint,
  icono: Icono,
  titulo,
  subtitulo,
  kpis,
  alertas = [],
  cargando = false,
  className,
}: {
  tint: string
  icono: ComponentType<{ className?: string }>
  titulo: string
  subtitulo?: string
  kpis: HeroKpi[]
  alertas?: HeroAlerta[]
  cargando?: boolean
  className?: string
}) {
  return (
    <div
      className={cn("relative mb-6 overflow-hidden rounded-2xl border p-5 shadow-sm", className)}
      style={
        {
          "--tint": tint,
          borderColor: "color-mix(in srgb, var(--tint) 28%, var(--border))",
          background: "linear-gradient(135deg, color-mix(in srgb, var(--tint) 12%, var(--card)), var(--card) 72%)",
        } as CSSProperties
      }
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-60 w-60 rounded-full motion-reduce:hidden"
        style={{
          background: "radial-gradient(closest-side, color-mix(in srgb, var(--tint) 42%, transparent), transparent)",
          opacity: 0.5,
        }}
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: "color-mix(in srgb, var(--tint) 22%, var(--card))",
              color: "var(--tint)",
              boxShadow: "0 0 24px color-mix(in srgb, var(--tint) 38%, transparent)",
            }}
          >
            <Icono className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-sm text-muted-foreground">{subtitulo}</p>}
          </div>
        </div>

        {cargando ? (
          <div className="flex flex-wrap gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[52px] w-40 animate-pulse rounded-xl border border-border/60 bg-muted/60" />
            ))}
          </div>
        ) : (
          <>
            {kpis.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {kpis.map((kpi, i) => {
                  const KpiIcono = kpi.icono
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/70 px-3.5 py-2 backdrop-blur"
                    >
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: "color-mix(in srgb, var(--tint) 15%, var(--card))",
                          color: "var(--tint)",
                        }}
                      >
                        <KpiIcono className="h-5 w-5" />
                      </span>
                      <div className="leading-tight">
                        <p className="whitespace-nowrap text-[11px] uppercase tracking-wide text-muted-foreground">
                          {kpi.label}
                        </p>
                        <p className="text-lg font-extrabold tabular-nums text-foreground">{kpi.valor}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {alertas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {alertas.map((alerta, i) => {
                  const AlertaIcono = alerta.icono
                  const contenido = (
                    <>
                      <AlertaIcono className="h-3.5 w-3.5 flex-shrink-0" />
                      {alerta.texto}
                    </>
                  )
                  const clases = cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                    ALERTA_ESTILO[alerta.tono],
                  )
                  return alerta.href ? (
                    <Link key={i} href={alerta.href} className={cn(clases, "transition-opacity hover:opacity-80")}>
                      {contenido}
                    </Link>
                  ) : (
                    <span key={i} className={clases}>
                      {contenido}
                    </span>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
