"use client"

import { Fragment, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertaRebandejar } from "@/components/ui/alerta-rebandejar"
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import {
  obtenerOrdenConDetalle,
  iniciarDescargue,
  confirmarFinDescargue,
  type OrdenCargueCompleta,
} from "@/lib/traslados-actions"
import { listarAnaquelesPorBodega, type Anaquel } from "@/lib/anaqueles-actions"
import type { TipoAveria } from "@/lib/recoleccion-actions"

interface AveriaLineaForm {
  tipoAveria: "roto" | "picado"
  cantidad: string
  cantidadYemas: string
  cantidadBolsasYema: string
  observaciones: string
}

export function DescargueDetalleView({ ordenId }: { ordenId: number }) {
  const router = useRouter()
  const [orden, setOrden] = useState<OrdenCargueCompleta | null>(null)
  const [anaqueles, setAnaqueles] = useState<Anaquel[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cantidadesRecibidas, setCantidadesRecibidas] = useState<Record<number, string>>({})
  const [anaquelesDestino, setAnaquelesDestino] = useState<Record<number, string>>({})
  const [tiposAveria, setTiposAveria] = useState<Record<number, TipoAveria>>({})
  const [averiasPorLinea, setAveriasPorLinea] = useState<Record<number, AveriaLineaForm[]>>({})

  async function cargar() {
    setCargando(true)
    const o = await obtenerOrdenConDetalle(ordenId)
    setOrden(o)
    if (o) {
      const iniciales: Record<number, string> = {}
      for (const linea of o.detalle) {
        iniciales[linea.id] = (linea.cantidad_recibida ?? linea.cantidad_cargada).toString()
      }
      setCantidadesRecibidas(iniciales)
      setAnaqueles(await listarAnaquelesPorBodega(o.bodega_id))
    }
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [ordenId])

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>
  if (!orden) return <p className="text-destructive">Orden no encontrada</p>

  const puedeIniciar = !orden.hora_inicio_descargue
  const puedeConfirmar = !!orden.hora_inicio_descargue && !orden.hora_fin_descargue
  const yaFinalizado = !!orden.hora_fin_descargue
  const esVenta = orden.bodega_tipo === "venta"

  function agregarLineaAveria(detalleId: number) {
    setAveriasPorLinea((prev) => ({
      ...prev,
      [detalleId]: [
        ...(prev[detalleId] ?? []),
        { tipoAveria: "roto", cantidad: "", cantidadYemas: "", cantidadBolsasYema: "", observaciones: "" },
      ],
    }))
  }

  function quitarLineaAveria(detalleId: number, indice: number) {
    setAveriasPorLinea((prev) => ({
      ...prev,
      [detalleId]: (prev[detalleId] ?? []).filter((_, i) => i !== indice),
    }))
  }

  function actualizarLineaAveria(detalleId: number, indice: number, campo: keyof AveriaLineaForm, valor: string) {
    setAveriasPorLinea((prev) => ({
      ...prev,
      [detalleId]: (prev[detalleId] ?? []).map((a, i) => (i === indice ? { ...a, [campo]: valor } : a)),
    }))
  }

  async function onIniciar() {
    setProcesando(true)
    await iniciarDescargue(ordenId)
    setProcesando(false)
    cargar()
  }

  async function onConfirmar() {
    setError(null)

    if (esVenta) {
      for (const d of orden!.detalle) {
        const falta = d.cantidad_cargada - Number(cantidadesRecibidas[d.id] ?? 0)
        if (falta <= 0) continue
        const suma = (averiasPorLinea[d.id] ?? []).reduce((acc, a) => acc + (Number(a.cantidad) || 0), 0)
        if (suma !== falta) {
          setError(
            `Las averías de "${d.referencia_nombre}" (${suma}) deben sumar exactamente el faltante (${falta})`,
          )
          return
        }
      }
    }

    setProcesando(true)

    const lineas = orden!.detalle.map((d) => ({
      detalleId: d.id,
      cantidadRecibida: Number(cantidadesRecibidas[d.id] ?? 0),
      anaquelDestinoId: anaquelesDestino[d.id] ? Number(anaquelesDestino[d.id]) : null,
      tipoAveria: tiposAveria[d.id],
      averias: esVenta
        ? (averiasPorLinea[d.id] ?? [])
            .filter((a) => Number(a.cantidad) > 0)
            .map((a) => ({
              tipoAveria: a.tipoAveria,
              cantidad: Number(a.cantidad),
              cantidadYemas: a.cantidadYemas ? Number(a.cantidadYemas) : null,
              cantidadBolsasYema: a.cantidadBolsasYema ? Number(a.cantidadBolsasYema) : null,
              observaciones: a.observaciones.trim() || null,
            }))
        : undefined,
    }))

    const resultado = await confirmarFinDescargue(ordenId, lineas)
    setProcesando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al confirmar la recepción")
      return
    }

    router.push("/descargue")
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Orden de descargue {orden.codigo}</h1>
      <p className="mb-4 text-sm text-muted-foreground">Bodega destino: {orden.bodega_nombre}</p>

      {orden.peso_total_kg && (
        <p className="mb-4 text-sm text-muted-foreground">
          Peso cargado en origen: <strong>{orden.peso_total_kg.toFixed(2)} kg</strong>
        </p>
      )}

      {puedeIniciar && (
        <Button size="lg" className="mb-4 w-full" onClick={onIniciar} disabled={procesando}>
          Iniciar descargue
        </Button>
      )}

      {orden.hora_inicio_descargue && (
        <p className="mb-4 text-sm text-muted-foreground">
          Descargue iniciado: {formatearFechaHoraColombia(orden.hora_inicio_descargue)}
          {orden.hora_fin_descargue && <> · Finalizado: {formatearFechaHoraColombia(orden.hora_fin_descargue)}</>}
        </p>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Recepción (prellenada con lo cargado en origen)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Edad</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Cargado</TableHead>
                  <TableHead>Recibido</TableHead>
                  <TableHead>Estantería destino</TableHead>
                  {puedeConfirmar && !esVenta && <TableHead>Si falta, tipo</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {orden.detalle.map((d) => {
                  const recibida = Number(cantidadesRecibidas[d.id] ?? 0)
                  const falta = d.cantidad_cargada - recibida
                  const averiasLinea = averiasPorLinea[d.id] ?? []
                  const sumaAverias = averiasLinea.reduce((acc, a) => acc + (Number(a.cantidad) || 0), 0)
                  return (
                    <Fragment key={d.id}>
                    <TableRow>
                      <TableCell>{d.lote_huevo_codigo}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {d.edad_semanas_captura} sem
                          <AlertaRebandejar edadSemanas={d.edad_semanas_captura} />
                        </div>
                      </TableCell>
                      <TableCell>{d.referencia_nombre}</TableCell>
                      <TableCell>{d.cantidad_cargada.toLocaleString("es-CO")}</TableCell>
                      <TableCell>
                        {puedeConfirmar ? (
                          <Input
                            type="number"
                            className="w-24"
                            value={cantidadesRecibidas[d.id] ?? ""}
                            onChange={(e) =>
                              setCantidadesRecibidas((prev) => ({ ...prev, [d.id]: e.target.value }))
                            }
                          />
                        ) : (
                          (d.cantidad_recibida ?? "—").toString()
                        )}
                      </TableCell>
                      <TableCell>
                        {puedeConfirmar ? (
                          <Select
                            value={anaquelesDestino[d.id] ?? ""}
                            onValueChange={(v) => setAnaquelesDestino((prev) => ({ ...prev, [d.id]: v }))}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Sin estantería" />
                            </SelectTrigger>
                            <SelectContent>
                              {anaqueles.map((a) => (
                                <SelectItem key={a.id} value={a.id.toString()}>
                                  {a.codigo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      {puedeConfirmar && !esVenta && (
                        <TableCell>
                          {falta > 0 && (
                            <Select
                              value={tiposAveria[d.id] ?? "roto"}
                              onValueChange={(v) => setTiposAveria((prev) => ({ ...prev, [d.id]: v as TipoAveria }))}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="picado">Picado</SelectItem>
                                <SelectItem value="roto">Roto</SelectItem>
                                <SelectItem value="partido">Partido</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    {puedeConfirmar && esVenta && falta > 0 && (
                      <TableRow key={`${d.id}-averias`}>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <div className="flex flex-col gap-2 py-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">
                                Averías de "{d.referencia_nombre}" — deben sumar el faltante ({falta})
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => agregarLineaAveria(d.id)}
                              >
                                <Plus className="mr-1 h-3.5 w-3.5" /> Agregar avería
                              </Button>
                            </div>
                            {averiasLinea.map((a, i) => (
                              <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-2">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-muted-foreground">Tipo</span>
                                  <Select
                                    value={a.tipoAveria}
                                    onValueChange={(v) => actualizarLineaAveria(d.id, i, "tipoAveria", v)}
                                  >
                                    <SelectTrigger className="w-28">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="roto">Roto</SelectItem>
                                      <SelectItem value="picado">Picado</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-muted-foreground">Cantidad</span>
                                  <Input
                                    type="number"
                                    className="w-24"
                                    value={a.cantidad}
                                    onChange={(e) => actualizarLineaAveria(d.id, i, "cantidad", e.target.value)}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-muted-foreground">Yemas generadas</span>
                                  <Input
                                    type="number"
                                    className="w-28"
                                    value={a.cantidadYemas}
                                    onChange={(e) => actualizarLineaAveria(d.id, i, "cantidadYemas", e.target.value)}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-muted-foreground">Bolsas de yema</span>
                                  <Input
                                    type="number"
                                    className="w-28"
                                    value={a.cantidadBolsasYema}
                                    onChange={(e) =>
                                      actualizarLineaAveria(d.id, i, "cantidadBolsasYema", e.target.value)
                                    }
                                  />
                                </div>
                                <div className="flex flex-1 flex-col gap-1">
                                  <span className="text-xs text-muted-foreground">Observación</span>
                                  <Input
                                    value={a.observaciones}
                                    onChange={(e) => actualizarLineaAveria(d.id, i, "observaciones", e.target.value)}
                                    placeholder="Opcional"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => quitarLineaAveria(d.id, i)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <p className={`text-xs font-medium ${sumaAverias === falta ? "text-green-600" : "text-destructive"}`}>
                              Suma de averías: {sumaAverias} / faltante: {falta}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {puedeConfirmar && (
        <Button size="lg" className="h-14 w-full text-base" onClick={onConfirmar} disabled={procesando}>
          Finalizar descargue
        </Button>
      )}

      {yaFinalizado && (
        <p className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm">
          Descargue finalizado. El inventario ya quedó disponible en {orden.bodega_nombre}.
          {orden.valor_tarifa_aplicado != null && (
            <> Tarifa de descargue aplicada: ${orden.valor_tarifa_aplicado.toLocaleString("es-CO")}.</>
          )}
        </p>
      )}
    </div>
  )
}
