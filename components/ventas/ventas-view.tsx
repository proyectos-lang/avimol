"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye, RefreshCw, Store } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { FormCard } from "@/components/ui/form-card"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CatalogoPicker } from "@/components/pedidos/catalogo-picker"
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import { listarBodegas, type Bodega } from "@/lib/bodegas-actions"
import { listarClientes, type Cliente } from "@/lib/clientes-actions"
import {
  obtenerInventarioDisponiblePorBodega,
  crearVentaDirecta,
  listarVentasDirectas,
  obtenerDetalleVenta,
  type InventarioDisponibleReferencia,
  type VentaDirecta,
  type LineaDetalleVenta,
} from "@/lib/ventas-actions"

function formatearMoneda(valor: number): string {
  return `$${valor.toLocaleString("es-CO")}`
}

export function VentasView() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [ventas, setVentas] = useState<VentaDirecta[]>([])
  const [inventario, setInventario] = useState<InventarioDisponibleReferencia[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  const [bodegaId, setBodegaId] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [precios, setPrecios] = useState<Record<number, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [ventaDetalleId, setVentaDetalleId] = useState<number | null>(null)
  const [detalleVenta, setDetalleVenta] = useState<LineaDetalleVenta[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  async function cargarDatosBase() {
    setCargando(true)
    const [b, c, v] = await Promise.all([listarBodegas(true), listarClientes(true), listarVentasDirectas()])
    setBodegas(b)
    setClientes(c)
    setVentas(v)
    setCargando(false)

    const consumidorFinal = c.find((cliente) => cliente.nombre === "Consumidor final")
    if (consumidorFinal) setClienteId((prev) => prev || consumidorFinal.id.toString())
  }

  useEffect(() => {
    cargarDatosBase()
  }, [])

  useEffect(() => {
    if (!bodegaId) {
      setInventario([])
      return
    }
    obtenerInventarioDisponiblePorBodega(Number(bodegaId)).then(setInventario)
    setCantidades({})
    setPrecios({})
  }, [bodegaId])

  const ventasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return ventas
    return ventas.filter((v) =>
      `${v.codigo} ${v.bodega_nombre} ${v.cliente_nombre ?? "Mostrador"}`.toLowerCase().includes(q),
    )
  }, [ventas, busqueda])

  const ingresosTotales = ventas.reduce((acc, v) => acc + (v.total ?? 0), 0)

  async function abrirDetalle(ventaId: number) {
    setVentaDetalleId(ventaId)
    setCargandoDetalle(true)
    setDetalleVenta(await obtenerDetalleVenta(ventaId))
    setCargandoDetalle(false)
  }

  async function onRegistrarVenta() {
    setError(null)

    if (!bodegaId) {
      setError("Selecciona la bodega")
      return
    }

    const lineas = Object.entries(cantidades)
      .map(([referenciaId, valor]) => ({
        referenciaId: Number(referenciaId),
        cantidad: Number(valor) || 0,
        precioUnitario: precios[Number(referenciaId)] ? Number(precios[Number(referenciaId)]) : null,
      }))
      .filter((l) => l.cantidad > 0)

    if (lineas.length === 0) {
      setError("Registra al menos una cantidad mayor a cero")
      return
    }

    setGuardando(true)
    const resultado = await crearVentaDirecta({
      bodegaId: Number(bodegaId),
      clienteId: clienteId ? Number(clienteId) : null,
      lineas,
    })
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al registrar la venta")
      toast.error(resultado.message ?? "Error al registrar la venta")
      return
    }

    toast.success(`Venta ${resultado.codigo} registrada`, {
      description:
        resultado.total != null ? `Total: $${resultado.total.toLocaleString("es-CO")}` : "Venta sin precio registrado.",
    })
    setCantidades({})
    setPrecios({})
    obtenerInventarioDisponiblePorBodega(Number(bodegaId)).then(setInventario)
    listarVentasDirectas().then(setVentas)
  }

  return (
    <div>
      <PageHeader titulo="Punto de venta" subtitulo="Venta directa de mostrador con asignación FIFO automática de lotes">
        <StatChip icono={Store} label="Ventas" valor={ventas.length} />
        <StatChip icono={Store} label="Ingresos" valor={`$${ingresosTotales.toLocaleString("es-CO")}`} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <FormCard
          titulo="Registrar venta"
          subtitulo="El sistema asigna los lotes más antiguos automáticamente"
          icono={Store}
          className="h-fit lg:sticky lg:top-6"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>
                Bodega <span className="text-destructive">*</span>
              </Label>
              <Select value={bodegaId} onValueChange={setBodegaId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecciona la bodega" />
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
              <Label>Cliente (Consumidor final por defecto)</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Cliente de mostrador" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bodegaId && (
              <div>
                <Label className="mb-2 block">Inventario disponible</Label>
                {inventario.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin inventario disponible en esta bodega.</p>
                ) : (
                  <CatalogoPicker
                    productos={inventario.map((r) => ({
                      id: r.referenciaId,
                      nombre: r.referenciaNombre,
                      imagenUrl: r.imagenUrl,
                      pesoGramos: r.pesoGramos,
                      disponible: r.cantidadDisponible,
                    }))}
                    cantidades={cantidades}
                    precios={precios}
                    onCantidadChange={(id, valor) => setCantidades((prev) => ({ ...prev, [id]: valor }))}
                    onPrecioChange={(id, valor) => setPrecios((prev) => ({ ...prev, [id]: valor }))}
                    mostrarPrecio
                    mostrarDisponible
                  />
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button size="lg" className="h-12" onClick={onRegistrarVenta} disabled={guardando || !bodegaId}>
              {guardando ? "Registrando..." : "Registrar venta"}
            </Button>
          </div>
        </FormCard>

        <div className="h-fit rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Historial de ventas ({ventasFiltradas.length})
            </h2>
            <div className="flex items-center gap-2">
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por código, bodega o cliente..." className="w-64" />
              <Button variant="outline" size="icon" onClick={cargarDatosBase} title="Actualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {cargando ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : ventasFiltradas.length === 0 ? (
            <EmptyState
              icono={Store}
              titulo={busqueda ? "Sin resultados" : "Todavía no hay ventas"}
              descripcion={
                busqueda ? "Ninguna venta coincide con la búsqueda." : "Registra la primera venta con el formulario."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Bodega</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventasFiltradas.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.codigo}</TableCell>
                    <TableCell>{v.bodega_nombre}</TableCell>
                    <TableCell>{v.cliente_nombre ?? "Mostrador"}</TableCell>
                    <TableCell>{formatearFechaHoraColombia(v.fecha)}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.unidades.toLocaleString("es-CO")}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {v.total != null ? formatearMoneda(v.total) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => abrirDetalle(v.id)} title="Ver detalle">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={ventaDetalleId != null} onOpenChange={(v) => !v && setVentaDetalleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de venta {ventasFiltradas.find((v) => v.id === ventaDetalleId)?.codigo}</DialogTitle>
          </DialogHeader>
          {cargandoDetalle ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalleVenta.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>{l.referenciaNombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.cantidad.toLocaleString("es-CO")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.precioUnitario != null ? formatearMoneda(l.precioUnitario) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.subtotal != null ? formatearMoneda(l.subtotal) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-bold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatearMoneda(detalleVenta.reduce((acc, l) => acc + (l.subtotal ?? 0), 0))}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
