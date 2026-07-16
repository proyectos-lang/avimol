"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Egg, RefreshCw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { formatearFechaColombia } from "@/lib/date-utils"
import { listarRecoleccionPorDia, type RecoleccionDia } from "@/lib/recoleccion-actions"

export function HistorialDiarioView() {
  const [filas, setFilas] = useState<RecoleccionDia[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  async function cargarDatos() {
    setCargando(true)
    setFilas(await listarRecoleccionPorDia())
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return filas
    return filas.filter((f) => `${f.galpon_codigo} ${f.galpon_nombre}`.toLowerCase().includes(q))
  }, [filas, busqueda])

  const totalRecolectado = filtradas.reduce((acc, f) => acc + f.total_recolectado, 0)
  const totalAverias = filtradas.reduce((acc, f) => acc + f.total_averias, 0)
  const diasDistintos = new Set(filtradas.map((f) => f.fecha_cosecha)).size

  return (
    <div>
      <PageHeader
        titulo="Historial diario de recolección"
        subtitulo="Total recolectado por día y galpón — cifra histórica del kardex, no cambia aunque el huevo ya esté clasificado"
      >
        <StatChip icono={Egg} label="Total recolectado" valor={totalRecolectado.toLocaleString("es-CO")} />
        <StatChip icono={TriangleAlert} label="Total averías" valor={totalAverias.toLocaleString("es-CO")} />
        <StatChip icono={CalendarDays} label="Días" valor={diasDistintos} />
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por galpón..." className="w-64" />
        <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </PageHeader>

      {cargando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icono={CalendarDays}
            titulo={busqueda ? "Sin resultados" : "Todavía no hay recolecciones registradas"}
            descripcion={
              busqueda ? "Ningún galpón coincide con la búsqueda." : "El historial se genera automáticamente con cada recolección."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Galpón</TableHead>
                <TableHead className="text-right">Total recolectado</TableHead>
                <TableHead className="text-right">Picados</TableHead>
                <TableHead className="text-right">Rotos</TableHead>
                <TableHead className="text-right">Partidos</TableHead>
                <TableHead className="text-right">Total averías</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((f) => (
                <TableRow key={`${f.fecha_cosecha}-${f.galpon_id}`}>
                  <TableCell>{formatearFechaColombia(f.fecha_cosecha)}</TableCell>
                  <TableCell className="font-medium">
                    {f.galpon_codigo} — {f.galpon_nombre}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {f.total_recolectado.toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {f.averia_picado > 0 ? f.averia_picado.toLocaleString("es-CO") : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {f.averia_roto > 0 ? f.averia_roto.toLocaleString("es-CO") : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {f.averia_partido > 0 ? f.averia_partido.toLocaleString("es-CO") : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {f.total_averias > 0 ? f.total_averias.toLocaleString("es-CO") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
