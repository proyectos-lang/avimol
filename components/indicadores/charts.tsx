"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

// Gráficas de una sola serie (unidades por referencia, cantidad por
// galpón): UN color para todas las barras. Colorear cada barra distinto
// aquí sería un value-ramp sobre categorías sin orden natural — el
// propio dato (la altura de la barra) ya cuenta la historia; el color
// no debe cargar información que la posición ya muestra.
function BarraSimple({
  datos,
  claveX,
  claveY,
  color,
  etiquetaSerie,
}: {
  datos: Record<string, any>[]
  claveX: string
  claveY: string
  color: string
  etiquetaSerie: string
}) {
  const config: ChartConfig = { [claveY]: { label: etiquetaSerie, color } }

  if (datos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos para graficar.</p>
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey={claveX} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey={claveY} fill={`var(--color-${claveY})`} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ChartContainer>
  )
}

export function VentasPorReferenciaChart({ datos }: { datos: { referenciaNombre: string; unidades: number }[] }) {
  return <BarraSimple datos={datos} claveX="referenciaNombre" claveY="unidades" color="var(--viz-1)" etiquetaSerie="Unidades" />
}

export function PedidosPorReferenciaChart({ datos }: { datos: { referenciaNombre: string; unidades: number }[] }) {
  return <BarraSimple datos={datos} claveX="referenciaNombre" claveY="unidades" color="var(--viz-2)" etiquetaSerie="Unidades" />
}

export function RoturaPorRecepcionChart({ datos }: { datos: { codigo: string; porcentajeRotura: number }[] }) {
  return (
    <BarraSimple
      datos={datos}
      claveX="codigo"
      claveY="porcentajeRotura"
      color="var(--viz-6)"
      etiquetaSerie="% rotura"
    />
  )
}

export function ProduccionPorGalponChart({ datos }: { datos: { galponCodigo: string; cantidadTotal: number }[] }) {
  return (
    <BarraSimple
      datos={datos}
      claveX="galponCodigo"
      claveY="cantidadTotal"
      color="var(--viz-5)"
      etiquetaSerie="Cantidad recolectada"
    />
  )
}

// Aquí sí hay 3 series reales (picado/roto/partido) — color categórico
// legítimo, orden fijo, con leyenda (obligatoria desde 2 series).
export function AveriasPorEtapaChart({
  datos,
}: {
  datos: { etapa: string; picado: number; roto: number; partido: number }[]
}) {
  const config: ChartConfig = {
    picado: { label: "Picado", color: "var(--viz-1)" },
    roto: { label: "Roto", color: "var(--viz-2)" },
    partido: { label: "Partido", color: "var(--viz-3)" },
  }

  if (datos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos para graficar.</p>
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey="etapa" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Bar dataKey="picado" stackId="a" fill="var(--color-picado)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="roto" stackId="a" fill="var(--color-roto)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="partido" stackId="a" fill="var(--color-partido)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
