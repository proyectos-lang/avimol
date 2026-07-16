"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Send, ShoppingCart, Users, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/ui/page-header"
import { FormCard } from "@/components/ui/form-card"
import { StatChip } from "@/components/ui/stat-chip"
import { CatalogoPicker } from "@/components/pedidos/catalogo-picker"
import { formatearFechaColombia, fechaColombiaHoy } from "@/lib/date-utils"
import { listarPedidos, crearPedido, type Pedido } from "@/lib/pedidos-actions"
import { listarBodegas, type Bodega } from "@/lib/bodegas-actions"
import { listarClientes, type Cliente } from "@/lib/clientes-actions"
import { listarVendedores, type Vendedor } from "@/lib/usuarios-actions"
import { listarCatalogoReferencias, type ReferenciaCatalogo } from "@/lib/catalogo-actions"

function formatearMoneda(valor: number): string {
  return valor.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
}

const CONDICIONES_PAGO = [
  { value: "contado", label: "Contado" },
  { value: "credito_15", label: "Crédito 15 días" },
  { value: "credito_30", label: "Crédito 30 días" },
  { value: "credito_60", label: "Crédito 60 días" },
] as const

export function PedidosView() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [referencias, setReferencias] = useState<ReferenciaCatalogo[]>([])

  const [bodegaId, setBodegaId] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [vendedorId, setVendedorId] = useState("")
  const [fechaEntregaProgramada, setFechaEntregaProgramada] = useState("")
  const [condicionPago, setCondicionPago] = useState<string>("contado")
  const [numeroOrdenCompra, setNumeroOrdenCompra] = useState("")
  const [aplicaIva, setAplicaIva] = useState(true)
  const [ivaPorcentaje, setIvaPorcentaje] = useState("19")
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState("0")
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [precios, setPrecios] = useState<Record<number, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDatos() {
    const [p, b, c, v, r] = await Promise.all([
      listarPedidos(),
      listarBodegas(true),
      listarClientes(true),
      listarVendedores(),
      listarCatalogoReferencias(),
    ])
    setPedidos(p)
    setBodegas(b)
    setClientes(c)
    setVendedores(v)
    setReferencias(r)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const pendientes = pedidos.filter((p) => p.estado === "pendiente").length

  // Todo lo que se agregó al carrito desde el catálogo, aunque la
  // cantidad quede en 0 temporalmente mientras se edita — solo
  // desaparece cuando se quita explícitamente con el botón de la fila.
  const lineasCarrito = useMemo(() => {
    return Object.keys(cantidades).map((referenciaId) => {
      const cantidad = Number(cantidades[Number(referenciaId)]) || 0
      const precioUnitario = precios[Number(referenciaId)] ? Number(precios[Number(referenciaId)]) : 0
      const referencia = referencias.find((r) => r.id === Number(referenciaId))
      return {
        referenciaId: Number(referenciaId),
        nombre: referencia?.nombre ?? "",
        cantidad,
        precioUnitario,
        subtotal: cantidad * precioUnitario,
      }
    })
  }, [cantidades, precios, referencias])

  function onAgregarAlCarrito(id: number) {
    setCantidades((prev) => ({ ...prev, [id]: ((Number(prev[id]) || 0) + 1).toString() }))
  }

  function onQuitarDelCarrito(id: number) {
    setCantidades((prev) => {
      const siguiente = { ...prev }
      delete siguiente[id]
      return siguiente
    })
    setPrecios((prev) => {
      const siguiente = { ...prev }
      delete siguiente[id]
      return siguiente
    })
  }

  const totales = useMemo(() => {
    const subtotal = lineasCarrito.reduce((acc, l) => acc + l.subtotal, 0)
    const ivaPct = Number(ivaPorcentaje) || 0
    const descuentoPct = Number(descuentoPorcentaje) || 0
    const valorDescuento = subtotal * (descuentoPct / 100)
    const baseGravable = subtotal - valorDescuento
    const valorIva = aplicaIva ? baseGravable * (ivaPct / 100) : 0
    const total = baseGravable + valorIva
    return { subtotal, valorDescuento, valorIva, total }
  }, [lineasCarrito, aplicaIva, ivaPorcentaje, descuentoPorcentaje])

  function limpiarFormulario() {
    setBodegaId("")
    setClienteId("")
    setVendedorId("")
    setFechaEntregaProgramada("")
    setCondicionPago("contado")
    setNumeroOrdenCompra("")
    setAplicaIva(true)
    setIvaPorcentaje("19")
    setDescuentoPorcentaje("0")
    setCantidades({})
    setPrecios({})
    setError(null)
  }

  async function onGuardar() {
    if (!bodegaId || !clienteId) {
      setError("Selecciona bodega y cliente")
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
    setError(null)

    const resultado = await crearPedido({
      bodegaId: Number(bodegaId),
      clienteId: Number(clienteId),
      vendedorId: vendedorId ? Number(vendedorId) : null,
      fechaEntregaProgramada: fechaEntregaProgramada || null,
      condicionPago,
      numeroOrdenCompra: numeroOrdenCompra.trim() || null,
      aplicaIva,
      ivaPorcentaje: Number(ivaPorcentaje) || 0,
      descuentoPorcentaje: Number(descuentoPorcentaje) || 0,
      lineas,
    })
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al crear el pedido")
      toast.error(resultado.message ?? "Error al crear el pedido")
      return
    }

    toast.success(`Pedido ${resultado.codigo} creado`, {
      description: "Se generó automáticamente la orden de cargue de despacho.",
    })
    limpiarFormulario()
    cargarDatos()
  }

  return (
    <div>
      <PageHeader titulo="Pedidos" subtitulo="Cada pedido queda amarrado a la bodega que lo atenderá; el precio es opcional">
        <StatChip icono={ShoppingCart} label="Pedidos" valor={pedidos.length} />
        <StatChip icono={Users} label="Pendientes" valor={pendientes} />
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/despachos">
            <Send className="h-4 w-4" />
            Ver despachos
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          <Label className="mb-2 block">Catálogo — clic para agregar al carrito</Label>
          <CatalogoPicker
            productos={referencias.map((r) => ({
              id: r.id,
              nombre: r.nombre,
              imagenUrl: r.imagen_url,
              pesoGramos: r.peso_unitario_gramos,
            }))}
            cantidades={cantidades}
            onAgregarAlCarrito={onAgregarAlCarrito}
            modoCarrito
          />
        </div>

        <FormCard
          titulo="Nuevo pedido"
          subtitulo="El precio es opcional y no bloquea el flujo"
          icono={ShoppingCart}
          className="h-fit lg:sticky lg:top-6"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>
                Bodega que atiende <span className="text-destructive">*</span>
              </Label>
              <Select value={bodegaId} onValueChange={setBodegaId}>
                <SelectTrigger>
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
              <Label>
                Cliente <span className="text-destructive">*</span>
              </Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el cliente" />
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
            <div className="flex flex-col gap-2">
              <Label>Vendedor</Label>
              <Select value={vendedorId} onValueChange={setVendedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {vendedores.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay usuarios con rol "vendedor" activos todavía.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Fecha</Label>
                <Input value={formatearFechaColombia(fechaColombiaHoy())} disabled />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Fecha programada</Label>
                <Input
                  type="date"
                  value={fechaEntregaProgramada}
                  onChange={(e) => setFechaEntregaProgramada(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Condición de pago</Label>
              <Select value={condicionPago} onValueChange={setCondicionPago}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDICIONES_PAGO.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>N° orden de compra (opcional)</Label>
              <Input
                value={numeroOrdenCompra}
                onChange={(e) => setNumeroOrdenCompra(e.target.value)}
                placeholder="OC-1234"
              />
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-semibold">Carrito</p>
              {lineasCarrito.length === 0 ? (
                <p className="text-sm text-muted-foreground">Haz clic en un producto del catálogo para agregarlo aquí.</p>
              ) : (
                <div className="flex flex-col gap-2 text-sm">
                  {lineasCarrito.map((l) => (
                    <div key={l.referenciaId} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-muted-foreground">{l.nombre}</span>
                      <Input
                        type="number"
                        className="h-8 w-16"
                        value={cantidades[l.referenciaId] ?? ""}
                        onChange={(e) => setCantidades((prev) => ({ ...prev, [l.referenciaId]: e.target.value }))}
                      />
                      <Input
                        type="number"
                        placeholder="$ (opc.)"
                        className="h-8 w-24"
                        value={precios[l.referenciaId] ?? ""}
                        onChange={(e) => setPrecios((prev) => ({ ...prev, [l.referenciaId]: e.target.value }))}
                      />
                      <span className="w-20 shrink-0 text-right tabular-nums">{formatearMoneda(l.subtotal)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => onQuitarDelCarrito(l.referenciaId)}
                        title="Quitar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <Label htmlFor="aplica-iva" className="cursor-pointer">
                  Aplicar IVA ({ivaPorcentaje || 0}%)
                </Label>
                <div className="flex items-center gap-2">
                  {aplicaIva && (
                    <Input
                      type="number"
                      className="h-8 w-16"
                      value={ivaPorcentaje}
                      onChange={(e) => setIvaPorcentaje(e.target.value)}
                    />
                  )}
                  <Switch id="aplica-iva" checked={aplicaIva} onCheckedChange={setAplicaIva} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Label htmlFor="descuento">Descuento (%)</Label>
                <Input
                  id="descuento"
                  type="number"
                  className="h-8 w-16"
                  value={descuentoPorcentaje}
                  onChange={(e) => setDescuentoPorcentaje(e.target.value)}
                />
              </div>

              <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total orden</span>
                  <span className="tabular-nums">{formatearMoneda(totales.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descuento</span>
                  <span className="tabular-nums text-destructive">
                    {totales.valorDescuento > 0 ? `- ${formatearMoneda(totales.valorDescuento)}` : formatearMoneda(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="tabular-nums">{formatearMoneda(totales.valorIva)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total a pagar</span>
                  <span className="tabular-nums">{formatearMoneda(totales.total)}</span>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button size="lg" onClick={onGuardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Crear pedido"}
            </Button>
          </div>
        </FormCard>
      </div>
    </div>
  )
}
