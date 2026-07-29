"use client"

import { useEffect, useMemo, useState } from "react"
import { Droplet, Info } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import { listarBodegas, type Bodega } from "@/lib/bodegas-actions"
import {
  listarInventarioYemas,
  listarMovimientosYemas,
  type InventarioYemaFila,
  type MovimientoYema,
} from "@/lib/averias-actions"

const TIPO_MOVIMIENTO_LABEL: Record<string, string> = {
  entrada_procesamiento: "Entrada por procesamiento",
  ajuste: "Ajuste",
}

export function YemasTab() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [bodegaId, setBodegaId] = useState<string>("todas")
  const [inventario, setInventario] = useState<InventarioYemaFila[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoYema[]>([])

  async function cargarDatos() {
    const idBodega = bodegaId === "todas" ? null : Number(bodegaId)
    const [b, inv, movs] = await Promise.all([
      listarBodegas(true),
      listarInventarioYemas(idBodega),
      listarMovimientosYemas(idBodega),
    ])
    setBodegas(b)
    setInventario(inv)
    setMovimientos(movs)
  }

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId])

  const totalDisponible = useMemo(() => inventario.reduce((acc, f) => acc + f.cantidadDisponible, 0), [inventario])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatChip icono={Droplet} label="Yemas disponibles" valor={totalDisponible.toLocaleString("es-CO")} />
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

      <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        Las yemas ingresan al procesar averías &quot;roto con yema&quot; desde Recolección → Averías y Bodegas → Averías.
      </p>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">Saldo por bodega</h2>
        {inventario.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState icono={Droplet} titulo="Todavía no hay yemas en inventario" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bodega</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventario.map((f) => (
                  <TableRow key={f.bodegaId}>
                    <TableCell className="font-medium">{f.bodegaNombre}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {f.cantidadDisponible.toLocaleString("es-CO")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Movimientos de yemas — entradas y salidas
        </h2>
        {movimientos.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState icono={Droplet} titulo="Sin movimientos de yemas todavía" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Bodega</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{formatearFechaHoraColombia(m.creadoEn)}</TableCell>
                    <TableCell>{m.bodegaNombre}</TableCell>
                    <TableCell>{TIPO_MOVIMIENTO_LABEL[m.tipoMovimiento] ?? m.tipoMovimiento}</TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${m.cantidad > 0 ? "text-green-600" : "text-destructive"}`}
                    >
                      {m.cantidad > 0 ? "+" : ""}
                      {m.cantidad.toLocaleString("es-CO")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.observaciones ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
