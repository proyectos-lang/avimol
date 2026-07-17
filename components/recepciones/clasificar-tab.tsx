"use client"

import { useEffect, useState } from "react"
import { ClipboardCheck, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import {
  listarRecepcionesPendientesClasificar,
  confirmarClasificacionRecepcion,
  type RecepcionPendienteClasificar,
} from "@/lib/recepciones-actions"

interface FormLinea {
  buenos: string
  rotos: string
  picados: string
  partidos: string
}

function sumaLinea(f: FormLinea): number {
  return (Number(f.buenos) || 0) + (Number(f.rotos) || 0) + (Number(f.picados) || 0) + (Number(f.partidos) || 0)
}

export function ClasificarTab() {
  const [pendientes, setPendientes] = useState<RecepcionPendienteClasificar[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoOrden, setGuardandoOrden] = useState<number | null>(null)
  const [formularios, setFormularios] = useState<Record<number, Record<number, FormLinea>>>({})

  async function cargarDatos() {
    setCargando(true)
    const filas = await listarRecepcionesPendientesClasificar()
    setPendientes(filas)
    setFormularios((prev) => {
      const siguiente: Record<number, Record<number, FormLinea>> = {}
      for (const r of filas) {
        siguiente[r.ordenId] = prev[r.ordenId] ?? {}
        for (const l of r.lineas) {
          siguiente[r.ordenId][l.detalleId] = prev[r.ordenId]?.[l.detalleId] ?? {
            buenos: "",
            rotos: "",
            picados: "",
            partidos: "",
          }
        }
      }
      return siguiente
    })
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  function actualizarLinea(ordenId: number, detalleId: number, campo: keyof FormLinea, valor: string) {
    setFormularios((prev) => ({
      ...prev,
      [ordenId]: {
        ...prev[ordenId],
        [detalleId]: { ...prev[ordenId]?.[detalleId], [campo]: valor } as FormLinea,
      },
    }))
  }

  async function onConfirmar(recepcion: RecepcionPendienteClasificar) {
    const formOrden = formularios[recepcion.ordenId] ?? {}

    for (const l of recepcion.lineas) {
      const f = formOrden[l.detalleId] ?? { buenos: "", rotos: "", picados: "", partidos: "" }
      if (sumaLinea(f) !== l.cantidadRecibida) {
        toast.error(`"${l.referenciaNombre}": la clasificación debe sumar exactamente lo recibido (${l.cantidadRecibida})`)
        return
      }
    }

    setGuardandoOrden(recepcion.ordenId)
    const resultado = await confirmarClasificacionRecepcion(
      recepcion.ordenId,
      recepcion.lineas.map((l) => {
        const f = formOrden[l.detalleId] ?? { buenos: "", rotos: "", picados: "", partidos: "" }
        return {
          detalleId: l.detalleId,
          buenos: Number(f.buenos) || 0,
          rotos: Number(f.rotos) || 0,
          picados: Number(f.picados) || 0,
          partidos: Number(f.partidos) || 0,
        }
      }),
    )
    setGuardandoOrden(null)

    if (!resultado.success) {
      toast.error(resultado.message ?? "Error al confirmar la clasificación")
      return
    }

    toast.success(`Recepción ${recepcion.codigo} clasificada`)
    cargarDatos()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Recepciones ya descargadas, pendientes de repartir en bueno/roto/picado/partido. Los buenos entran a
          inventario; el resto queda como avería.
        </p>
        <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {cargando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : pendientes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState icono={ClipboardCheck} titulo="No hay recepciones pendientes de clasificar" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pendientes.map((r) => {
            const formOrden = formularios[r.ordenId] ?? {}
            return (
              <Card key={r.ordenId}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {r.codigo} — {r.bodegaNombre}
                    {r.placaVehiculo && ` · ${r.placaVehiculo}`}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Descargado: {formatearFechaHoraColombia(r.horaFinDescargue)}</p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lote</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead className="text-right">Recibido</TableHead>
                          <TableHead>Buenos</TableHead>
                          <TableHead>Rotos</TableHead>
                          <TableHead>Picados</TableHead>
                          <TableHead>Partidos</TableHead>
                          <TableHead className="text-right">Suma</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {r.lineas.map((l) => {
                          const f = formOrden[l.detalleId] ?? { buenos: "", rotos: "", picados: "", partidos: "" }
                          const suma = sumaLinea(f)
                          const cuadra = suma === l.cantidadRecibida
                          return (
                            <TableRow key={l.detalleId}>
                              <TableCell>{l.loteHuevoCodigo}</TableCell>
                              <TableCell>{l.referenciaNombre}</TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">
                                {l.cantidadRecibida.toLocaleString("es-CO")}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  className="w-20"
                                  value={f.buenos}
                                  onChange={(e) => actualizarLinea(r.ordenId, l.detalleId, "buenos", e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  className="w-20"
                                  value={f.rotos}
                                  onChange={(e) => actualizarLinea(r.ordenId, l.detalleId, "rotos", e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  className="w-20"
                                  value={f.picados}
                                  onChange={(e) => actualizarLinea(r.ordenId, l.detalleId, "picados", e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  className="w-20"
                                  value={f.partidos}
                                  onChange={(e) => actualizarLinea(r.ordenId, l.detalleId, "partidos", e.target.value)}
                                />
                              </TableCell>
                              <TableCell
                                className={`text-right font-semibold tabular-nums ${cuadra ? "text-green-600" : "text-destructive"}`}
                              >
                                {suma.toLocaleString("es-CO")}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <Button
                    className="mt-3 w-full"
                    onClick={() => onConfirmar(r)}
                    disabled={guardandoOrden === r.ordenId}
                  >
                    {guardandoOrden === r.ordenId ? "Confirmando..." : "Confirmar clasificación"}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
