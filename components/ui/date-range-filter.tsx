"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { fechaColombiaHoy } from "@/lib/date-utils"

// Filtro de rango de fechas con presets día/mes/año, compartido entre los
// dashboards de indicadores por módulo. "Este mes"/"Este año" son
// mes-a-la-fecha / año-a-la-fecha (nunca una fecha fin futura).
export function DateRangeFilter({
  fechaInicio,
  fechaFin,
  onCambiar,
}: {
  fechaInicio: string
  fechaFin: string
  onCambiar: (fechaInicio: string, fechaFin: string) => void
}) {
  const hoy = fechaColombiaHoy()

  function aplicarHoy() {
    onCambiar(hoy, hoy)
  }

  function aplicarEsteMes() {
    onCambiar(`${hoy.slice(0, 7)}-01`, hoy)
  }

  function aplicarEsteAnio() {
    onCambiar(`${hoy.slice(0, 4)}-01-01`, hoy)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Desde</Label>
        <Input type="date" value={fechaInicio} onChange={(e) => onCambiar(e.target.value, fechaFin)} className="w-40" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Hasta</Label>
        <Input type="date" value={fechaFin} onChange={(e) => onCambiar(fechaInicio, e.target.value)} className="w-40" />
      </div>
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" onClick={aplicarHoy}>
          Hoy
        </Button>
        <Button variant="outline" size="sm" onClick={aplicarEsteMes}>
          Este mes
        </Button>
        <Button variant="outline" size="sm" onClick={aplicarEsteAnio}>
          Este año
        </Button>
      </div>
    </div>
  )
}
