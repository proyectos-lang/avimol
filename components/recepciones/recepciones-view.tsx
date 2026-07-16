"use client"

import { useEffect, useMemo, useState } from "react"
import { PackageCheck, PercentCircle, Droplet, ShoppingBag, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import { listarBodegas, type Bodega } from "@/lib/bodegas-actions"
import { listarDashboardRecepciones, type RecepcionResumen } from "@/lib/recepciones-actions"
import { RoturaPorRecepcionChart } from "@/components/indicadores/charts"

export function RecepcionesView() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [recepciones, setRecepciones] = useState<RecepcionResumen[]>([])
  const [totalRecepciones, setTotalRecepciones] = useState(0)
  const [porcentajeRoturaPromedio, setPorcentajeRoturaPromedio] = useState(0)
  const [totalYemas, setTotalYemas] = useState(0)
  const [totalBolsas, setTotalBolsas] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [bodegaId, setBodegaId] = useState("todas")
  const [busqueda, setBusqueda] = useState("")

  async function cargarDatos() {
    setCargando(true)
    const [b, dashboard] = await Promise.all([listarBodegas(true), listarDashboardRecepciones()])
    setBodegas(b)
    setRecepciones(dashboard.recepciones)
    setTotalRecepciones(dashboard.totalRecepciones)
    setPorcentajeRoturaPromedio(dashboard.porcentajeRoturaPromedio)
    setTotalYemas(dashboard.totalYemas)
    setTotalBolsas(dashboard.totalBolsas)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const filtradas = useMemo(() => {
    let filas = recepciones
    if (bodegaId !== "todas") filas = filas.filter((r) => r.bodegaId === Number(bodegaId))
    const q = busqueda.trim().toLowerCase()
    if (q) {
      filas = filas.filter((r) =>
        `${r.codigo} ${r.bodegaNombre} ${r.placaVehiculo ?? ""}`.toLowerCase().includes(q),
      )
    }
    return filas
  }, [recepciones, bodegaId, busqueda])

  const datosChart = useMemo(
    () => [...filtradas].reverse().map((r) => ({ codigo: r.codigo, porcentajeRotura: r.porcentajeRotura })),
    [filtradas],
  )

  return (
    <div>
      <PageHeader
        titulo="Recepciones de traslado"
        subtitulo="Rotura y generación de yema por cada viaje recibido — un registro por recepción de traslado cerrada"
      >
        <StatChip icono={PackageCheck} label="Recepciones" valor={totalRecepciones} />
        <StatChip icono={PercentCircle} label="% rotura promedio" valor={`${porcentajeRoturaPromedio}%`} />
        <StatChip icono={Droplet} label="Yemas generadas" valor={totalYemas.toLocaleString("es-CO")} />
        <StatChip icono={ShoppingBag} label="Bolsas de yema" valor={totalBolsas.toLocaleString("es-CO")} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por código, bodega o placa..."
          className="w-72"
        />
        <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">% de rotura por recepción</CardTitle>
        </CardHeader>
        <CardContent>
          {cargando ? <Skeleton className="h-64 w-full" /> : <RoturaPorRecepcionChart datos={datosChart} />}
        </CardContent>
      </Card>

      {cargando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icono={PackageCheck}
            titulo={busqueda ? "Sin resultados" : "No hay recepciones registradas"}
            descripcion={
              busqueda
                ? "Ninguna recepción coincide con la búsqueda."
                : "Este dashboard se completa automáticamente al cerrar recepciones de traslado en Descargue."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Bodega</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead className="text-right">Cargado</TableHead>
                <TableHead className="text-right">Recibido</TableHead>
                <TableHead className="text-right">Roto</TableHead>
                <TableHead className="text-right">% rotura</TableHead>
                <TableHead className="text-right">Yemas</TableHead>
                <TableHead className="text-right">Bolsas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatearFechaHoraColombia(r.fecha)}</TableCell>
                  <TableCell className="font-medium">{r.codigo}</TableCell>
                  <TableCell>{r.bodegaNombre}</TableCell>
                  <TableCell>{r.placaVehiculo ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.totalCargado.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.totalRecibido.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.totalRoto.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{r.porcentajeRotura}%</TableCell>
                  <TableCell className="text-right tabular-nums">{r.totalYemas.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.totalBolsas.toLocaleString("es-CO")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
