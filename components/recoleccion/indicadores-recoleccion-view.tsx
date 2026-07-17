"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import { listarGalpones, type Galpon } from "@/lib/galpones-actions"
import { listarBodegas, type Bodega } from "@/lib/bodegas-actions"
import type { FiltrosIndicadores } from "@/lib/indicadores-recoleccion-actions"
import { IndicadoresRecoleccionTab } from "@/components/recoleccion/indicadores-recoleccion-tab"
import { IndicadoresClasificacionTab } from "@/components/recoleccion/indicadores-clasificacion-tab"
import { IndicadoresCartonesTab } from "@/components/recoleccion/indicadores-cartones-tab"

export function IndicadoresRecoleccionView() {
  const [galpones, setGalpones] = useState<Galpon[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])

  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  const [galponId, setGalponId] = useState("todos")
  const [bodegaId, setBodegaId] = useState("todas")

  useEffect(() => {
    listarGalpones().then(setGalpones)
    listarBodegas().then(setBodegas)
  }, [])

  const filtros: FiltrosIndicadores = {
    fechaInicio: fechaInicio || undefined,
    fechaFin: fechaFin || undefined,
    galponId: galponId !== "todos" ? Number(galponId) : null,
    bodegaId: bodegaId !== "todas" ? Number(bodegaId) : null,
  }

  return (
    <div>
      <PageHeader
        titulo="Indicadores de Recolección"
        subtitulo="Cantidades recolectadas, clasificadas y consumo de cartones, filtrables por fecha, galpón y bodega"
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <DateRangeFilter fechaInicio={fechaInicio} fechaFin={fechaFin} onCambiar={(i, f) => { setFechaInicio(i); setFechaFin(f) }} />
        <Select value={galponId} onValueChange={setGalponId}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los galpones</SelectItem>
            {galpones.map((g) => (
              <SelectItem key={g.id} value={g.id.toString()}>
                {g.codigo} — {g.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bodegaId} onValueChange={setBodegaId}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las bodegas</SelectItem>
            {bodegas.map((b) => (
              <SelectItem key={b.id} value={b.id.toString()}>
                {b.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="recoleccion">
        <TabsList>
          <TabsTrigger value="recoleccion">Indicadores Recolección</TabsTrigger>
          <TabsTrigger value="clasificacion">Indicadores Clasificación</TabsTrigger>
          <TabsTrigger value="cartones">Indicador de Cartones</TabsTrigger>
        </TabsList>
        <TabsContent value="recoleccion">
          <IndicadoresRecoleccionTab filtros={filtros} />
        </TabsContent>
        <TabsContent value="clasificacion">
          <IndicadoresClasificacionTab filtros={filtros} />
        </TabsContent>
        <TabsContent value="cartones">
          <IndicadoresCartonesTab filtros={filtros} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
