"use client"

import { useEffect, useMemo, useState } from "react"
import { Boxes, DollarSign, Layers, PackagePlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { FormCard } from "@/components/ui/form-card"
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import { listarBodegas, type Bodega } from "@/lib/bodegas-actions"
import {
  listarInventarioCartones,
  registrarIngresoCarton,
  obtenerCostoCartonVigente,
  listarConsumoCartones,
  listarMovimientosCartones,
  type InventarioCartonFila,
  type ConsumoCartonClasificacion,
  type MovimientoCarton,
} from "@/lib/cartones-actions"

function formatearMoneda(valor: number): string {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
}

const TIPO_MOVIMIENTO_LABEL: Record<string, string> = {
  entrada_manual: "Entrada manual",
  salida_clasificacion: "Salida por clasificación",
  ajuste: "Ajuste",
  salida_venta: "Salida por venta",
  salida_traslado: "Salida por traslado",
  entrada_traslado: "Entrada por traslado",
}

export function CartonesTab() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [bodegaId, setBodegaId] = useState<string>("todas")
  const [inventario, setInventario] = useState<InventarioCartonFila[]>([])
  const [costoVigente, setCostoVigente] = useState<number | null>(null)
  const [consumo, setConsumo] = useState<ConsumoCartonClasificacion[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoCarton[]>([])

  const [bodegaIngresoId, setBodegaIngresoId] = useState("")
  const [cantidadIngreso, setCantidadIngreso] = useState("")
  const [costoIngreso, setCostoIngreso] = useState("")
  const [observacionIngreso, setObservacionIngreso] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDatos() {
    const idBodega = bodegaId === "todas" ? null : Number(bodegaId)
    const [b, inv, costo, cons, movs] = await Promise.all([
      listarBodegas(true),
      listarInventarioCartones(idBodega),
      obtenerCostoCartonVigente(),
      listarConsumoCartones(idBodega),
      listarMovimientosCartones(idBodega),
    ])
    setBodegas(b)
    setInventario(inv)
    setCostoVigente(costo?.valor ?? null)
    setConsumo(cons)
    setMovimientos(movs)
  }

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId])

  const totalDisponible = useMemo(() => inventario.reduce((acc, f) => acc + f.cantidad_disponible, 0), [inventario])
  const totalCalculado = useMemo(() => consumo.reduce((acc, c) => acc + c.cartones_calculados, 0), [consumo])
  const totalUsado = useMemo(() => consumo.reduce((acc, c) => acc + c.total, 0), [consumo])

  async function onRegistrarIngreso() {
    if (!bodegaIngresoId || !cantidadIngreso) {
      setError("Selecciona la bodega y la cantidad")
      return
    }
    setGuardando(true)
    setError(null)
    const resultado = await registrarIngresoCarton(
      Number(bodegaIngresoId),
      Number(cantidadIngreso),
      costoIngreso ? Number(costoIngreso) : null,
      observacionIngreso.trim() || null,
    )
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al registrar el ingreso")
      toast.error(resultado.message ?? "Error al registrar el ingreso")
      return
    }

    toast.success(`Ingreso de ${cantidadIngreso} cartones registrado`)
    setCantidadIngreso("")
    setCostoIngreso("")
    setObservacionIngreso("")
    cargarDatos()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatChip icono={Boxes} label="Cartones disponibles" valor={totalDisponible.toLocaleString("es-CO")} />
        <StatChip
          icono={DollarSign}
          label="Costo unitario vigente"
          valor={costoVigente != null ? formatearMoneda(costoVigente) : "—"}
        />
        <StatChip icono={Layers} label="Calculados" valor={totalCalculado.toLocaleString("es-CO")} />
        <StatChip icono={Layers} label="Usados (con extra)" valor={totalUsado.toLocaleString("es-CO")} />
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

      <FormCard titulo="Ingreso manual de cartones" icono={PackagePlus}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label>Bodega</Label>
            <Select value={bodegaIngresoId} onValueChange={setBodegaIngresoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {bodegas.map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {b.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Cantidad</Label>
            <Input type="number" value={cantidadIngreso} onChange={(e) => setCantidadIngreso(e.target.value)} placeholder="0" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Costo unitario (opcional)</Label>
            <Input type="number" value={costoIngreso} onChange={(e) => setCostoIngreso(e.target.value)} placeholder="$ (opc.)" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Observación</Label>
            <Input value={observacionIngreso} onChange={(e) => setObservacionIngreso(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <Button className="mt-3" onClick={onRegistrarIngreso} disabled={guardando}>
          {guardando ? "Registrando..." : "Registrar ingreso"}
        </Button>
      </FormCard>

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Movimientos de cartones — entradas y salidas
        </h2>
        {movimientos.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState icono={Layers} titulo="Sin movimientos de cartones todavía" />
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
                  <TableHead className="text-right">Costo unitario</TableHead>
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
                    <TableCell className="text-right tabular-nums">
                      {m.costoUnitario != null ? formatearMoneda(m.costoUnitario) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.clasificacionCodigo ? (
                        <>
                          {m.clasificacionCodigo} · Calculados {m.cartonesCalculados} · Extra {m.cartonesExtra}
                        </>
                      ) : m.ventaDirectaCodigo ? (
                        `Venta ${m.ventaDirectaCodigo}`
                      ) : m.ordenCargueCodigo ? (
                        `Traslado ${m.ordenCargueCodigo}`
                      ) : (
                        m.observaciones ?? "—"
                      )}
                    </TableCell>
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
