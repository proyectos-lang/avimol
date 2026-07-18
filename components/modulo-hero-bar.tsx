"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { resolverModuloPorRuta } from "@/lib/dashboard-data"
import { obtenerInsightsModulo } from "@/lib/insights-actions"
import { ICONOS } from "@/components/insights-iconos"
import { ModuloHero, type HeroAlerta, type HeroKpi } from "@/components/ui/modulo-hero"
import type { InsightsModulo } from "@/lib/insights-tipos"

const SUBTITULO_GRUPO: Record<string, string> = {
  aves: "Plantel de aves y ocupación de galpones",
  cosecha: "Producción de huevo, clasificación y averías",
  logistica: "Inventario, traslados y recepciones",
  comercial: "Ventas, pedidos y clientes",
  indicadores: "Indicadores ejecutivos del negocio",
}

// Banda de insights montada una sola vez en el layout. Se muestra solo en
// la página exacta de un módulo del nav (no en el inicio, ni en detalles
// con id), y recalcula sus datos al cambiar de ruta.
export function ModuloHeroBar() {
  const pathname = usePathname()
  const resuelto = resolverModuloPorRuta(pathname)
  const [datos, setDatos] = useState<InsightsModulo | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!resuelto) return
    let cancelado = false
    setCargando(true)
    setDatos(null)
    obtenerInsightsModulo(resuelto.grupoKey).then((d) => {
      if (cancelado) return
      setDatos(d)
      setCargando(false)
    })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!resuelto) return null

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
    <ModuloHero
      tint={resuelto.tint}
      icono={resuelto.modulo.icon}
      titulo={resuelto.modulo.label}
      subtitulo={SUBTITULO_GRUPO[resuelto.grupoKey]}
      kpis={kpis}
      alertas={alertas}
      cargando={cargando}
    />
  )
}
