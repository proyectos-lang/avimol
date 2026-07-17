"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PackagePlus, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EstadoBadge } from "@/components/ui/estado-badge"
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import {
  obtenerProgresoSolicitudTraslado,
  generarOrdenCargueAdicionalTraslado,
  type ProgresoSolicitudTraslado,
} from "@/lib/traslados-actions"
import { ESTADO_SOLICITUD_TRASLADO_LABEL, ESTADO_ORDEN_CARGUE_LABEL } from "@/lib/estado-labels"

export function SolicitudTrasladoDetalleView({ solicitudId }: { solicitudId: number }) {
  const router = useRouter()
  const [progreso, setProgreso] = useState<ProgresoSolicitudTraslado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)

  async function cargar() {
    setCargando(true)
    setProgreso(await obtenerProgresoSolicitudTraslado(solicitudId))
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [solicitudId])

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>
  if (!progreso) return <p className="text-destructive">Solicitud no encontrada</p>

  const { solicitud, lineas, ordenes } = progreso
  const hayOrdenAbierta = ordenes.some(
    (o) => o.tipo_operacion === "cargue_traslado" && !o.hora_fin_cargue,
  )
  const puedeGenerarOrden =
    !hayOrdenAbierta && ["pendiente", "en_picking", "cargado_parcial"].includes(solicitud.estado)

  async function onGenerarOrden() {
    setGenerando(true)
    const resultado = await generarOrdenCargueAdicionalTraslado(solicitudId)
    setGenerando(false)
    if (!resultado.success) {
      toast.error(resultado.message ?? "No se pudo generar la orden")
      return
    }
    toast.success("Nueva orden de cargue generada")
    router.push(`/cargue/${resultado.ordenCargueId}`)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-2xl font-bold">Solicitud {solicitud.codigo}</h1>
        <EstadoBadge estado={solicitud.estado} label={ESTADO_SOLICITUD_TRASLADO_LABEL[solicitud.estado] ?? solicitud.estado} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {solicitud.bodegaOrigenNombre} → {solicitud.bodegaDestinoNombre}
      </p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Solicitado / Cargado / Pendiente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Solicitado</TableHead>
                  <TableHead className="text-right">Cargado</TableHead>
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
          {generando ? "Generando..." : "Generar nueva orden de cargue"}
        </Button>
      )}

      <div>
        <p className="mb-2 font-semibold">Órdenes de este traslado ({ordenes.length})</p>
        {ordenes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no se ha generado ninguna orden.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenes.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.codigo}</TableCell>
                    <TableCell>{o.tipo_operacion === "cargue_traslado" ? "Cargue" : "Descargue"}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={o.estado} label={ESTADO_ORDEN_CARGUE_LABEL[o.estado] ?? o.estado} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.peso_total_kg ? `${o.peso_total_kg.toFixed(2)} kg` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`${o.tipo_operacion === "cargue_traslado" ? "/cargue" : "/descargue"}/${o.id}`}>
                          Abrir
                        </Link>
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
        <Link href="/traslados" className="inline-flex items-center gap-1 underline">
          <Truck className="h-3.5 w-3.5" />
          Volver a Traslados
        </Link>
      </p>
    </div>
  )
}
