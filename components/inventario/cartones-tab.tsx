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
import { listarBodegasClasificadoras, type Bodega } from "@/lib/bodegas-actions"
import {
  listarInventarioCartones,
  registrarIngresoCarton,
  obtenerCostoCartonVigente,
  listarConsumoCartones,
  type InventarioCartonFila,
  type ConsumoCartonClasificacion,
} from "@/lib/cartones-actions"

function formatearMoneda(valor: number): string {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
}

export function CartonesTab() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [bodegaId, setBodegaId] = useState<string>("todas")
  const [inventario, setInventario] = useState<InventarioCartonFila[]>([])
  const [costoVigente, setCostoVigente] = useState<number | null>(null)
  const [consumo, setConsumo] = useState<ConsumoCartonClasificacion[]>([])

  const [bodegaIngresoId, setBodegaIngresoId] = useState("")
  const [cantidadIngreso, setCantidadIngreso] = useState("")
  const [costoIngreso, setCostoIngreso] = useState("")
  const [observacionIngreso, setObservacionIngreso] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDatos() {
    const idBodega = bodegaId === "todas" ? null : Number(bodegaId)
    const [b, inv, costo, cons] = await Promise.all([
      listarBodegasClasificadoras(),
      listarInventarioCartones(idBodega),
      obtenerCostoCartonVigente(),
      listarConsumoCartones(idBodega),
    ])
    setBodegas(b)
    setInventario(inv)
    setCostoVigente(costo?.valor ?? null)
    setConsumo(cons)
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
            <SelectItem value="todas">Todas las clasificadoras</SelectItem>
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
          Consumo por clasificación — calculado vs. usado
        </h2>
        {consumo.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState icono={Layers} titulo="Sin clasificaciones registradas todavía" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Bodega</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead className="text-right">Calculados</TableHead>
                  <TableHead>Extra</TableHead>
                  <TableHead className="text-right">Total usado</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consumo.map((c) => (
                  <TableRow key={c.codigo}>
                    <TableCell>{formatearFechaHoraColombia(c.fecha)}</TableCell>
                    <TableCell>{c.bodega_nombre}</TableCell>
                    <TableCell className="font-medium">{c.lote_huevo_codigo}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.cartones_calculados}</TableCell>
                    <TableCell>
                      {c.detalle_extra.length === 0
                        ? "—"
                        : c.detalle_extra.map((d, i) => (
                            <div key={i} className="text-xs text-muted-foreground">
                              {d.motivo}: {d.cantidad}
                              {d.observacion && ` — ${d.observacion}`}
                            </div>
                          ))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{c.total}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.costo_total_cartones != null ? formatearMoneda(c.costo_total_cartones) : "—"}
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
