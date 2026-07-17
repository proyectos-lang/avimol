"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { PackageMinus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { EstadoBadge } from "@/components/ui/estado-badge"
import { listarOrdenesCargue, type OrdenCargueResumen } from "@/lib/traslados-actions"
import { listarBodegas, type Bodega } from "@/lib/bodegas-actions"
import { ESTADO_ORDEN_CARGUE_LABEL as ESTADO_LABEL } from "@/lib/estado-labels"

const SUBTITULO: Record<string, string> = {
  cargue_traslado: "Llegada del vehículo, picking por lote (FIFO) y peso calculado automáticamente",
  descargue_traslado: "Recepción prellenada con lo cargado; las diferencias quedan registradas como averías",
  cargue_despacho: "Despachos de pedidos: picking por lote y confirmación de salida",
}

export function OrdenesCargueView({
  tipoOperacion,
  titulo,
  hrefBase,
}: {
  tipoOperacion: "cargue_traslado" | "descargue_traslado" | "cargue_despacho"
  titulo: string
  hrefBase: string
}) {
  const [ordenes, setOrdenes] = useState<OrdenCargueResumen[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [bodegaId, setBodegaId] = useState("todas")

  async function cargarDatos() {
    setCargando(true)
    const [o, b] = await Promise.all([listarOrdenesCargue(tipoOperacion), listarBodegas(true)])
    setOrdenes(o)
    setBodegas(b)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoOperacion])

  const filtradas = useMemo(() => {
    let filas = ordenes
    if (bodegaId !== "todas") filas = filas.filter((o) => o.bodega_id === Number(bodegaId))
    const q = busqueda.trim().toLowerCase()
    if (q) {
      filas = filas.filter((o) =>
        `${o.codigo} ${o.bodega_nombre} ${o.solicitud_codigo ?? ""}`.toLowerCase().includes(q),
      )
    }
    return filas
  }, [ordenes, busqueda, bodegaId])

  const abiertas = ordenes.filter((o) => o.estado !== "cerrado" && o.estado !== "anulado").length

  return (
    <div>
      <PageHeader titulo={titulo} subtitulo={SUBTITULO[tipoOperacion]}>
        <StatChip icono={PackageMinus} label="Órdenes" valor={ordenes.length} />
        <StatChip icono={PackageMinus} label="Abiertas" valor={abiertas} />
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
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por código o bodega..." className="w-64" />
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
            icono={PackageMinus}
            titulo={busqueda ? "Sin resultados" : "No hay órdenes registradas"}
            descripcion={
              busqueda
                ? "Ninguna orden coincide con la búsqueda."
                : "Las órdenes se generan automáticamente desde las solicitudes de traslado o los pedidos."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Bodega</TableHead>
                <TableHead>Solicitud / Pedido</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Peso total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.codigo}</TableCell>
                  <TableCell>{o.bodega_nombre}</TableCell>
                  <TableCell>{o.solicitud_codigo ?? "—"}</TableCell>
                  <TableCell>
                    <EstadoBadge estado={o.estado} label={ESTADO_LABEL[o.estado] ?? o.estado} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.peso_total_kg ? `${o.peso_total_kg.toFixed(2)} kg` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`${hrefBase}/${o.id}`}>Abrir</Link>
                    </Button>
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
