"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, Egg, Eye, RefreshCw, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatearFechaColombia, formatearFechaHoraColombia } from "@/lib/date-utils"
import { listarRecoleccionPorDia, type RecoleccionDia } from "@/lib/recoleccion-actions"
import { listarLotesHuevoPorGalponYFecha, type LoteDelDia } from "@/lib/lotes-huevo-actions"
import { actualizarEstadoAveria } from "@/lib/averias-actions"

const TIPO_AVERIA_LABEL: Record<string, string> = { picado: "Picado", roto: "Roto", partido: "Partido" }

export function HistorialDiarioView() {
  const [filas, setFilas] = useState<RecoleccionDia[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  const [filaDetalle, setFilaDetalle] = useState<RecoleccionDia | null>(null)
  const [lotesDelDia, setLotesDelDia] = useState<LoteDelDia[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

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
  const bajoElMinimo = filtradas.filter((f) => f.cumple_minimo === false).length

  async function abrirDetalle(fila: RecoleccionDia) {
    setFilaDetalle(fila)
    setCargandoDetalle(true)
    setLotesDelDia(await listarLotesHuevoPorGalponYFecha(fila.galpon_id, fila.fecha_cosecha))
    setCargandoDetalle(false)
  }

  async function onCambiarEstadoAveria(averiaId: number, estado: "pendiente" | "aprobada" | "rechazada") {
    const resultado = await actualizarEstadoAveria(averiaId, estado)
    if (!resultado.success) {
      toast.error(resultado.message ?? "No se pudo actualizar el estado")
      return
    }
    if (filaDetalle) {
      setLotesDelDia(await listarLotesHuevoPorGalponYFecha(filaDetalle.galpon_id, filaDetalle.fecha_cosecha))
    }
    cargarDatos()
  }

  return (
    <div>
      <PageHeader
        titulo="Historial diario de recolección"
        subtitulo="Total recolectado por día y galpón — cifra histórica del kardex, no cambia aunque el huevo ya esté clasificado"
      >
        <StatChip icono={Egg} label="Total recolectado" valor={totalRecolectado.toLocaleString("es-CO")} />
        <StatChip icono={TriangleAlert} label="Total averías" valor={totalAverias.toLocaleString("es-CO")} />
        <StatChip icono={TriangleAlert} label="Bajo el mínimo" valor={bajoElMinimo} />
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
                <TableHead className="text-right">Aves activas</TableHead>
                <TableHead className="text-right">Esperado (mín.)</TableHead>
                <TableHead className="text-right">Total recolectado</TableHead>
                <TableHead className="text-right">Picados</TableHead>
                <TableHead className="text-right">Rotos</TableHead>
                <TableHead className="text-right">Partidos</TableHead>
                <TableHead className="text-right">Total averías</TableHead>
                <TableHead className="text-right">Ver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((f) => (
                <TableRow key={`${f.fecha_cosecha}-${f.galpon_id}`}>
                  <TableCell>{formatearFechaColombia(f.fecha_cosecha)}</TableCell>
                  <TableCell className="font-medium">
                    {f.galpon_codigo} — {f.galpon_nombre}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {f.aves_activas.toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {f.minimo_esperado != null ? f.minimo_esperado.toLocaleString("es-CO") : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    <span className="inline-flex items-center gap-1.5 justify-end">
                      {f.cumple_minimo === true && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                      {f.cumple_minimo === false && <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />}
                      {f.total_recolectado.toLocaleString("es-CO")}
                    </span>
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
                  <TableCell className="text-right">
                    <Button variant="outline" size="icon" onClick={() => abrirDetalle(f)} title="Ver detalle">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!filaDetalle} onOpenChange={(v) => !v && setFilaDetalle(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {filaDetalle && (
                <>
                  {filaDetalle.galpon_codigo} — {filaDetalle.galpon_nombre} ·{" "}
                  {formatearFechaColombia(filaDetalle.fecha_cosecha)}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {cargandoDetalle ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : lotesDelDia.length === 0 ? (
            <EmptyState icono={Egg} titulo="Sin lotes registrados ese día" />
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <p className="mb-2 text-sm font-semibold">Lotes de ese día</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lotesDelDia.map((l) => (
                        <TableRow key={l.loteHuevoId}>
                          <TableCell className="font-medium">{l.codigo}</TableCell>
                          <TableCell>{formatearFechaHoraColombia(l.creadoEn)}</TableCell>
                          <TableCell>{l.origen === "app_movil" ? "Campo" : "Clasificadora"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {l.cantidadRecolectada.toLocaleString("es-CO")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Averías — aprobar o rechazar</p>
                {lotesDelDia.every((l) => l.averias.length === 0) ? (
                  <p className="text-sm text-muted-foreground">Sin averías registradas ese día.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lote</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lotesDelDia.flatMap((l) =>
                          l.averias.map((a) => (
                            <TableRow key={a.id}>
                              <TableCell>{l.codigo}</TableCell>
                              <TableCell>{TIPO_AVERIA_LABEL[a.tipoAveria] ?? a.tipoAveria}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {a.cantidad.toLocaleString("es-CO")}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={a.estado}
                                  onValueChange={(v) => onCambiarEstadoAveria(a.id, v as "pendiente" | "aprobada" | "rechazada")}
                                >
                                  <SelectTrigger className="w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pendiente">Pendiente</SelectItem>
                                    <SelectItem value="aprobada">Aprobada</SelectItem>
                                    <SelectItem value="rechazada">Rechazada</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          )),
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
