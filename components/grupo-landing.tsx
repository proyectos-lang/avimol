"use client"

import { useEffect, useState } from "react"
import { groups } from "@/lib/dashboard-data"
import { obtenerInsightsModulo } from "@/lib/insights-actions"
import { ICONOS } from "@/components/insights-iconos"
import { usePermisos } from "@/components/permisos-provider"
import { ModuloHero, type HeroAlerta, type HeroKpi } from "@/components/ui/modulo-hero"
import { AppTile } from "@/components/ui/app-tile"
import type { InsightsModulo } from "@/lib/insights-tipos"

const SUBTITULO_GRUPO: Record<string, string> = {
  aves: "Plantel de aves y ocupación de galpones",
  cosecha: "Producción de huevo, clasificación y averías",
  logistica: "Inventario, traslados y recepciones",
  comercial: "Ventas, pedidos y clientes",
  indicadores: "Indicadores ejecutivos del negocio",
}

// Página de un grupo: hero con los insights del grupo + una tarjeta por
// módulo (con efecto botón al hover). Se llega desde el inicio o desde el
// nombre del grupo en el sidebar.
export function GrupoLanding({ grupoKey }: { grupoKey: string }) {
  const { permisos } = usePermisos()
  const grupo = groups.find((g) => g.key === grupoKey)
  const modulosVisibles =
    grupo && permisos !== "all"
      ? grupo.modules.filter((m) => (permisos as string[]).includes(m.href))
      : (grupo?.modules ?? [])
  const [datos, setDatos] = useState<InsightsModulo | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setDatos(null)
    obtenerInsightsModulo(grupoKey).then((d) => {
      if (cancelado) return
      setDatos(d)
      setCargando(false)
    })
    return () => {
      cancelado = true
    }
  }, [grupoKey])

  if (!grupo) return null

  const kpis: HeroKpi[] = (datos?.kpis ?? []).map((k) => ({
    icono: ICONOS[k.iconoKey],
    label: k.label,
    valor: k.valor,
  }))
  const alertas: HeroAlerta[] = (datos?.alertas ?? []).map((a) => ({
    icono: ICONOS[a.iconoKey],
    texto: a.texto,
    tono: a.tono,
    href: a.href,
  }))

  return (
    <div>
      <ModuloHero
        tint={grupo.tint}
        icono={grupo.icon}
        titulo={grupo.title}
        subtitulo={SUBTITULO_GRUPO[grupoKey]}
        kpis={kpis}
        alertas={alertas}
        cargando={cargando}
      />

      <div className="mb-3 flex items-baseline gap-2 sm:mb-5">
        <h2 className="text-sm font-extrabold tracking-tight text-foreground sm:text-lg">Módulos</h2>
        <span className="text-xs text-muted-foreground">· elige uno para entrar</span>
      </div>

      <div className="apps-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {modulosVisibles.map((m) => (
          <AppTile key={m.href} tint={grupo.tint} icono={m.icon} nombre={m.label} href={m.href} />
        ))}
      </div>
    </div>
  )
}
