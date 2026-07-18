"use client"

import { useEffect, useState } from "react"
import { Egg } from "lucide-react"
import { obtenerInsightsInicio } from "@/lib/insights-actions"
import { ICONOS } from "@/components/insights-iconos"
import { ModuloHero, type HeroAlerta, type HeroKpi } from "@/components/ui/modulo-hero"
import type { InsightsModulo } from "@/lib/insights-tipos"

// Tablero de mando del inicio: la primera pantalla que ve el cliente, con
// KPIs vivos de todo el negocio y alertas cruzadas. Usa el color de marca
// (cian) del sidebar para máxima identidad.
export function InicioHero() {
  const [datos, setDatos] = useState<InsightsModulo | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    obtenerInsightsInicio().then((d) => {
      if (cancelado) return
      setDatos(d)
      setCargando(false)
    })
    return () => {
      cancelado = true
    }
  }, [])

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
      tint="#00c2dc"
      icono={Egg}
      titulo="Centro de control"
      subtitulo="Resumen del negocio en tiempo real · Avimol"
      kpis={kpis}
      alertas={alertas}
      cargando={cargando}
    />
  )
}
