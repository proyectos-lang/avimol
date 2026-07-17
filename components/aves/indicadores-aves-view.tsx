"use client"

import { useEffect, useState } from "react"
import { Bird, CircleCheck, CircleX } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { StatChip } from "@/components/ui/stat-chip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import { listarGalpones, type Galpon } from "@/lib/galpones-actions"
import { obtenerIndicadoresAves, type IndicadoresAves } from "@/lib/indicadores-actions"

function StatCard({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{titulo}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-3xl">{valor}</p>
    </div>
  )
}

export function IndicadoresAvesView() {
  const [galpones, setGalpones] = useState<Galpon[]>([])
  const [aves, setAves] = useState<IndicadoresAves | null>(null)
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  const [cargando, setCargando] = useState(true)

  async function cargarDatos() {
    setCargando(true)
    const [g, a] = await Promise.all([listarGalpones(), obtenerIndicadoresAves(fechaInicio || undefined, fechaFin || undefined)])
    setGalpones(g)
    setAves(a)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin])

  const activos = galpones.filter((g) => g.activo).length
  const inactivos = galpones.filter((g) => !g.activo).length

  return (
    <div>
      <PageHeader
        titulo="Indicadores de Aves"
        subtitulo="Capacidad, ocupación, mortalidad, sacrificio y edad por galpón"
      >
        <StatChip icono={CircleCheck} label="Activos" valor={activos} />
        <StatChip icono={CircleX} label="Inactivos" valor={inactivos} />
        <StatChip icono={Bird} label="Totales" valor={galpones.length} />
      </PageHeader>

      <div className="mb-6">
        <DateRangeFilter fechaInicio={fechaInicio} fechaFin={fechaFin} onCambiar={(i, f) => { setFechaInicio(i); setFechaFin(f) }} />
        <p className="mt-2 text-xs text-muted-foreground">
          El rango de fechas filtra mortalidad y sacrificio. Capacidad, ocupación y edad son una foto del momento
          actual.
        </p>
      </div>

      {cargando ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              titulo="Capacidad vs. utilizada"
              valor={`${(aves?.utilizadaTotal ?? 0).toLocaleString("es-CO")} / ${(aves?.capacidadTotal ?? 0).toLocaleString("es-CO")}`}
            />
            <StatCard titulo="% ocupación total" valor={`${aves?.porcentajeOcupacionTotal ?? 0}%`} />
            <StatCard titulo="Edad promedio total" valor={`${aves?.edadPromedioTotal ?? 0} sem`} />
            <StatCard
              titulo="Mortalidad total"
              valor={`${(aves?.mortalidadTotal ?? 0).toLocaleString("es-CO")} (${aves?.tasaMortalidadTotal ?? 0}%)`}
            />
            <StatCard
              titulo="Sacrificio total"
              valor={`${(aves?.sacrificioTotal ?? 0).toLocaleString("es-CO")} (${aves?.tasaSacrificioTotal ?? 0}%)`}
            />
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Galpón</TableHead>
                  <TableHead className="text-right">Capacidad</TableHead>
                  <TableHead className="text-right">Utilizada</TableHead>
                  <TableHead className="text-right">% ocupación</TableHead>
                  <TableHead className="text-right">Mortalidad</TableHead>
                  <TableHead className="text-right">Sacrificio</TableHead>
                  <TableHead className="text-right">Edad promedio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(aves?.porGalpon ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Sin datos.
                    </TableCell>
                  </TableRow>
                ) : (
                  (aves?.porGalpon ?? []).map((g) => (
                    <TableRow key={g.galponId}>
                      <TableCell>
                        {g.galponCodigo} — {g.galponNombre}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{(g.capacidad ?? 0).toLocaleString("es-CO")}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.utilizada.toLocaleString("es-CO")}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.porcentajeOcupacion}%</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.mortalidad.toLocaleString("es-CO")} ({g.tasaMortalidad}%)
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {g.sacrificio.toLocaleString("es-CO")} ({g.tasaSacrificio}%)
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{g.edadPromedioSemanas} sem</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
