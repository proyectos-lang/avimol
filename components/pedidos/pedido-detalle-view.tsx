"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PackagePlus, ShoppingCart } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EstadoBadge } from "@/components/ui/estado-badge"
import {
  obtenerProgresoPedido,
  generarOrdenCargueAdicionalDespacho,
  type ProgresoPedido,
} from "@/lib/pedidos-actions"
import { ESTADO_PEDIDO_LABEL, ESTADO_ORDEN_CARGUE_LABEL } from "@/lib/estado-labels"

export function PedidoDetalleView({ pedidoId }: { pedidoId: number }) {
  const router = useRouter()
  const [progreso, setProgreso] = useState<ProgresoPedido | null>(null)
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)

  async function cargar() {
    setCargando(true)
    setProgreso(await obtenerProgresoPedido(pedidoId))
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [pedidoId])

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>
  if (!progreso) return <p className="text-destructive">Pedido no encontrado</p>

  const { pedido, lineas, ordenes } = progreso
  const hayOrdenAbierta = ordenes.some((o) => o.tipo_operacion === "cargue_despacho" && !o.hora_fin_cargue)
  const puedeGenerarOrden = !hayOrdenAbierta && ["pendiente", "en_picking", "despachado"].includes(pedido.estado)

  async function onGenerarOrden() {
    setGenerando(true)
    const resultado = await generarOrdenCargueAdicionalDespacho(pedidoId)
    setGenerando(false)
    if (!resultado.success) {
      toast.error(resultado.message ?? "No se pudo generar la orden")
      return
    }
    toast.success("Nueva orden de despacho generada")
    router.push(`/despachos/${resultado.ordenCargueId}`)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-2xl font-bold">Pedido {pedido.codigo}</h1>
        <EstadoBadge estado={pedido.estado} label={ESTADO_PEDIDO_LABEL[pedido.estado] ?? pedido.estado} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {pedido.clienteNombre} · {pedido.bodegaNombre}
      </p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Solicitado / Despachado / Pendiente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Pedido</TableHead>
                  <TableHead className="text-right">Despachado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l) => (
                  <TableRow key={l.referenciaId}>
                    <TableCell>{l.referenciaNombre}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.cantidadSolicitada.toLocaleString("es-CO")}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.cantidadCargadaTotal.toLocaleString("es-CO")}</TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${l.cantidadPendiente > 0 ? "text-amber-700" : "text-green-700"}`}
                    >
                      {l.cantidadPendiente.toLocaleString("es-CO")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {puedeGenerarOrden && (
        <Button className="mb-4 w-full gap-2" onClick={onGenerarOrden} disabled={generando}>
          <PackagePlus className="h-4 w-4" />
          {generando ? "Generando..." : "Generar nueva orden de despacho"}
        </Button>
      )}

      <div>
        <p className="mb-2 font-semibold">Órdenes de despacho de este pedido ({ordenes.length})</p>
        {ordenes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no se ha generado ninguna orden.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenes.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.codigo}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={o.estado} label={ESTADO_ORDEN_CARGUE_LABEL[o.estado] ?? o.estado} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.peso_total_kg ? `${o.peso_total_kg.toFixed(2)} kg` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/despachos/${o.id}`}>Abrir</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/pedidos" className="inline-flex items-center gap-1 underline">
          <ShoppingCart className="h-3.5 w-3.5" />
          Volver a Pedidos
        </Link>
      </p>
    </div>
  )
}
