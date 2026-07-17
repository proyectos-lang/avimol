"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertaRebandejar } from "@/components/ui/alerta-rebandejar"
import { formatearFechaColombia, formatearFechaHoraColombia } from "@/lib/date-utils"
import {
  obtenerOrdenConDetalle,
  obtenerLotesDisponibles,
  agregarLineaCargue,
  quitarLineaCargue,
  confirmarFinCargue,
  evaluarCierreOrdenCargue,
  anularOrdenCargue,
  type OrdenCargueCompleta,
  type LoteDisponible,
  type AccionCierreCargue,
  type LineaProgresoCargue,
} from "@/lib/traslados-actions"
import { confirmarFinDespacho, registrarAveriaDespacho, obtenerDisponibilidadPedido, type DisponibilidadLineaPedido } from "@/lib/pedidos-actions"
import { listarLlegadasDisponibles, asignarVehiculoAOrden, liberarVehiculoDeOrden, type LlegadaVehiculo } from "@/lib/vehiculos-actions"
import type { TipoAveria } from "@/lib/recoleccion-actions"

export function CargueDetalleView({ ordenId }: { ordenId: number }) {
  const router = useRouter()
  const [orden, setOrden] = useState<OrdenCargueCompleta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  const [llegadaId, setLlegadaId] = useState("")
  const [llegadasDisponibles, setLlegadasDisponibles] = useState<LlegadaVehiculo[]>([])

  const [referenciaSeleccionada, setReferenciaSeleccionada] = useState("")
  const [lotesDisponibles, setLotesDisponibles] = useState<LoteDisponible[]>([])
  const [cantidadesPorLote, setCantidadesPorLote] = useState<Record<number, string>>({})

  const [disponibilidadPedido, setDisponibilidadPedido] = useState<DisponibilidadLineaPedido[]>([])

  const [detalleAveriaId, setDetalleAveriaId] = useState("")
  const [tipoAveriaDespacho, setTipoAveriaDespacho] = useState<TipoAveria>("roto")
  const [cantidadAveriaDespacho, setCantidadAveriaDespacho] = useState("")
  const [averiaGuardada, setAveriaGuardada] = useState(false)

  const [dialogoCierreAbierto, setDialogoCierreAbierto] = useState(false)
  const [progresoCierre, setProgresoCierre] = useState<{ completo: boolean; lineas: LineaProgresoCargue[] } | null>(null)
  const [dialogoAnularAbierto, setDialogoAnularAbierto] = useState(false)

  async function cargar() {
    setCargando(true)
    const o = await obtenerOrdenConDetalle(ordenId)
    setOrden(o)
    if (!o?.hora_llegada_vehiculo) {
      setLlegadasDisponibles(await listarLlegadasDisponibles())
    }
    if (o?.tipo_operacion === "cargue_despacho" && o.pedido) {
      obtenerDisponibilidadPedido(ordenId).then(setDisponibilidadPedido)
    }
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [ordenId])

  useEffect(() => {
    if (!referenciaSeleccionada || !orden) {
      setLotesDisponibles([])
      return
    }
    obtenerLotesDisponibles(orden.bodega_id, Number(referenciaSeleccionada)).then(setLotesDisponibles)
  }, [referenciaSeleccionada, orden])

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>
  if (!orden) return <p className="text-destructive">Orden no encontrada</p>

  async function onRegistrarLlegada() {
    if (!llegadaId) {
      setError("Selecciona el vehículo que llegó")
      return
    }
    setError(null)
    setProcesando(true)
    const resultado = await asignarVehiculoAOrden(ordenId, Number(llegadaId))
    setProcesando(false)
    if (!resultado.success) {
      setError(resultado.message ?? "Error al asignar el vehículo")
      return
    }
    cargar()
  }

  async function onLiberarVehiculo() {
    setError(null)
    setProcesando(true)
    const resultado = await liberarVehiculoDeOrden(ordenId)
    setProcesando(false)
    if (!resultado.success) {
      setError(resultado.message ?? "Error al liberar el vehículo")
      return
    }
    setLlegadaId("")
    cargar()
  }

  async function onAgregarLinea(lote: LoteDisponible) {
    const cantidad = Number(cantidadesPorLote[lote.lote_huevo_id] ?? 0)
    if (!cantidad || cantidad <= 0) return

    setError(null)
    const resultado = await agregarLineaCargue(
      ordenId,
      orden!.bodega_id,
      lote.lote_huevo_id,
      Number(referenciaSeleccionada),
      cantidad,
      lote.anaquel_id,
    )
    if (!resultado.success) {
      setError(resultado.message ?? "Error al agregar la línea")
      return
    }
    setCantidadesPorLote((prev) => ({ ...prev, [lote.lote_huevo_id]: "" }))
    cargar()
    obtenerLotesDisponibles(orden!.bodega_id, Number(referenciaSeleccionada)).then(setLotesDisponibles)
  }

  async function onQuitarLinea(detalleId: number) {
    await quitarLineaCargue(detalleId)
    cargar()
  }

  const esDespacho = orden.tipo_operacion === "cargue_despacho"
  const origenLineas: {
    referenciaId: number
    referenciaNombre: string
    cantidadSolicitada: number
    edadSemanasPreferida: number | null
  }[] = orden.solicitud
    ? orden.solicitud.lineas
    : orden.pedido
      ? orden.pedido.lineas.map((l) => ({ ...l, edadSemanasPreferida: null }))
      : []

  const lineaActual = origenLineas.find((l) => l.referenciaId.toString() === referenciaSeleccionada)
  const edadPreferidaLinea: number | null = lineaActual?.edadSemanasPreferida ?? null
  const lotesOrdenados = (() => {
    if (edadPreferidaLinea == null) return lotesDisponibles
    const objetivo = edadPreferidaLinea
    return [...lotesDisponibles].sort(
      (a, b) => Math.abs(a.edad_semanas_captura - objetivo) - Math.abs(b.edad_semanas_captura - objetivo),
    )
  })()

  async function onConfirmarConAccion(accion: AccionCierreCargue) {
    setProcesando(true)
    setError(null)
    const resultado = esDespacho ? await confirmarFinDespacho(ordenId, accion) : await confirmarFinCargue(ordenId, accion)
    setProcesando(false)
    setDialogoCierreAbierto(false)
    if (!resultado.success) {
      setError(resultado.message ?? "Error al finalizar")
      return
    }
    router.push(esDespacho ? "/despachos" : "/cargue")
  }

  async function onFinalizarClick() {
    setError(null)
    const progreso = await evaluarCierreOrdenCargue(ordenId)
    if (!progreso || progreso.completo) {
      await onConfirmarConAccion("cerrar")
      return
    }
    setProgresoCierre(progreso)
    setDialogoCierreAbierto(true)
  }

  async function onAnular() {
    setProcesando(true)
    setError(null)
    const resultado = await anularOrdenCargue(ordenId)
    setProcesando(false)
    setDialogoAnularAbierto(false)
    if (!resultado.success) {
      setError(resultado.message ?? "Error al anular la orden")
      return
    }
    if (orden!.solicitud) router.push(`/traslados/${orden!.solicitud.id}`)
    else if (orden!.pedido) router.push(`/pedidos/${orden!.pedido.id}`)
    else router.push(esDespacho ? "/despachos" : "/cargue")
  }

  async function onRegistrarAveria() {
    const linea = orden!.detalle.find((d) => d.id.toString() === detalleAveriaId)
    const cantidad = Number(cantidadAveriaDespacho)
    if (!linea || !cantidad || cantidad <= 0) {
      setError("Selecciona el lote y una cantidad válida para la avería")
      return
    }
    setError(null)
    const resultado = await registrarAveriaDespacho(
      ordenId,
      linea.lote_huevo_id,
      linea.referencia_huevo_id,
      tipoAveriaDespacho,
      cantidad,
    )
    if (!resultado.success) {
      setError(resultado.message ?? "Error al registrar la avería")
      return
    }
    setCantidadAveriaDespacho("")
    setAveriaGuardada(true)
  }

  const tieneVehiculo = !!orden.hora_llegada_vehiculo
  const yaFinalizado = !!orden.hora_fin_cargue
  const puedeEditarPicking = !yaFinalizado
  const puedeFinalizar = orden.detalle.length > 0 && tieneVehiculo && !yaFinalizado

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">
        {esDespacho ? "Orden de despacho" : "Orden de cargue"} {orden.codigo}
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">Bodega: {orden.bodega_nombre}</p>

      {orden.solicitud && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Solicitud {orden.solicitud.codigo}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {orden.solicitud.lineas.map((l, i) => (
              <div key={i} className="flex justify-between">
                <span>{l.referenciaNombre}</span>
                <span className="font-semibold">{l.cantidadSolicitada.toLocaleString("es-CO")} solicitados</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {orden.pedido && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">
              Pedido {orden.pedido.codigo} — {orden.pedido.clienteNombre}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {orden.pedido.lineas.map((l, i) => {
              const disp = disponibilidadPedido.find((d) => d.referenciaId === l.referenciaId)
              return (
                <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-2">
                  <div className="flex items-center justify-between">
                    <span>{l.referenciaNombre}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{l.cantidadSolicitada.toLocaleString("es-CO")} pedidos</span>
                      {disp && (
                        <Badge
                          className={
                            disp.suficiente
                              ? "border-transparent bg-green-600 text-white hover:bg-green-600"
                              : "border-transparent bg-destructive text-white hover:bg-destructive"
                          }
                        >
                          {disp.suficiente
                            ? "Disponible"
                            : `Faltan ${(l.cantidadSolicitada - disp.cantidadDisponibleBodega).toLocaleString("es-CO")}`}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {disp && !disp.suficiente && (
                    <div className="rounded-md bg-muted/50 p-2 text-xs">
                      <p className="mb-1 font-semibold text-muted-foreground">
                        Disponible en {orden.bodega_nombre}: {disp.cantidadDisponibleBodega.toLocaleString("es-CO")}
                      </p>
                      {disp.otrasBodegas.length === 0 ? (
                        <p className="text-muted-foreground">Tampoco hay stock de esta referencia en otras bodegas.</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <p className="font-semibold text-muted-foreground">
                            Sugerencia: trasladar desde{" "}
                            <Link href="/traslados" className="text-primary underline">
                              Traslados
                            </Link>
                          </p>
                          {disp.otrasBodegas.map((b) => (
                            <div key={b.bodega_id} className="rounded border border-border/60 bg-background p-1.5">
                              <p className="font-medium">
                                {b.bodega_nombre} — {b.total_disponible.toLocaleString("es-CO")} disponibles
                              </p>
                              <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
                                {b.lotes.map((lote) => (
                                  <li key={lote.lote_huevo_id}>
                                    Lote {lote.lote_huevo_codigo} · Recolección {formatearFechaColombia(lote.fecha_cosecha)} ·{" "}
                                    {lote.cantidad_disponible.toLocaleString("es-CO")}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {!tieneVehiculo && !yaFinalizado && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Vehículo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {llegadasDisponibles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay vehículos disponibles.{" "}
                <Link href="/vehiculos" className="font-medium text-primary underline">
                  Registra una llegada
                </Link>{" "}
                primero en Gestión de vehículos.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <Label>Vehículo</Label>
                <Select value={llegadaId} onValueChange={setLlegadaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el vehículo que llegó" />
                  </SelectTrigger>
                  <SelectContent>
                    {llegadasDisponibles.map((l) => (
                      <SelectItem key={l.id} value={l.id.toString()}>
                        {l.placa} — {l.conductor} (llegó {formatearFechaHoraColombia(l.hora_llegada)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button size="lg" onClick={onRegistrarLlegada} disabled={procesando || llegadasDisponibles.length === 0}>
              Registrar llegada
            </Button>
          </CardContent>
        </Card>
      )}

      {tieneVehiculo && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
          <p className="text-sm text-muted-foreground">
            Vehículo {orden.placa_vehiculo} ({orden.conductor}) llegó a las{" "}
            {formatearFechaHoraColombia(orden.hora_llegada_vehiculo!)}
          </p>
          {!yaFinalizado && (
            <Button variant="outline" size="sm" onClick={onLiberarVehiculo} disabled={procesando}>
              Liberar vehículo
            </Button>
          )}
        </div>
      )}

      {puedeEditarPicking && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Agregar lote al cargue</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select value={referenciaSeleccionada} onValueChange={setReferenciaSeleccionada}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona la referencia" />
              </SelectTrigger>
              <SelectContent>
                {origenLineas.map((l) => (
                  <SelectItem key={l.referenciaId} value={l.referenciaId.toString()}>
                    {l.referenciaNombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {referenciaSeleccionada && (
              <div className="flex flex-col gap-2">
                {edadPreferidaLinea != null && lotesDisponibles.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Ordenado por cercanía a la edad preferida ({edadPreferidaLinea} semanas).
                  </p>
                )}
                {lotesOrdenados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin inventario disponible para esta referencia.</p>
                ) : (
                  lotesOrdenados.map((lote) => (
                    <div key={`${lote.lote_huevo_id}-${lote.anaquel_id ?? "sin-anaquel"}`} className="flex items-center gap-2 rounded-md border border-border p-2">
                      <div className="flex-1 text-sm">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium">{lote.lote_huevo_codigo}</p>
                          <AlertaRebandejar edadSemanas={lote.edad_semanas_captura} />
                        </div>
                        <p className="text-muted-foreground">
                          Recolección {formatearFechaColombia(lote.fecha_cosecha)} · Galpón {lote.galpon_codigo} · Edad{" "}
                          {lote.edad_semanas_captura} sem
                          {lote.anaquel_codigo && <> · Estantería {lote.anaquel_codigo}</>} · Disponible:{" "}
                          {lote.cantidad_disponible.toLocaleString("es-CO")}
                        </p>
                      </div>
                      <Input
                        type="number"
                        className="w-24"
                        placeholder="0"
                        value={cantidadesPorLote[lote.lote_huevo_id] ?? ""}
                        onChange={(e) =>
                          setCantidadesPorLote((prev) => ({ ...prev, [lote.lote_huevo_id]: e.target.value }))
                        }
                      />
                      <Button variant="outline" onClick={() => onAgregarLinea(lote)}>
                        Agregar
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-4">
        <p className="mb-2 font-semibold">Líneas cargadas</p>
        {orden.detalle.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no se ha agregado ninguna línea.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Edad</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Cantidad</TableHead>
                  {puedeEditarPicking && <TableHead className="text-right">Quitar</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {orden.detalle.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.lote_huevo_codigo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {d.edad_semanas_captura} sem
                        <AlertaRebandejar edadSemanas={d.edad_semanas_captura} />
                      </div>
                    </TableCell>
                    <TableCell>{d.referencia_nombre}</TableCell>
                    <TableCell>{d.cantidad_cargada.toLocaleString("es-CO")}</TableCell>
                    {puedeEditarPicking && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => onQuitarLinea(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {esDespacho && orden.detalle.length > 0 && !yaFinalizado && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Registrar avería en despacho (opcional)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select value={detalleAveriaId} onValueChange={setDetalleAveriaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el lote/referencia" />
              </SelectTrigger>
              <SelectContent>
                {orden.detalle.map((d) => (
                  <SelectItem key={d.id} value={d.id.toString()}>
                    {d.lote_huevo_codigo} · {d.referencia_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Select value={tipoAveriaDespacho} onValueChange={(v) => setTipoAveriaDespacho(v as TipoAveria)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="picado">Picado</SelectItem>
                  <SelectItem value="roto">Roto</SelectItem>
                  <SelectItem value="partido">Partido</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Cantidad"
                value={cantidadAveriaDespacho}
                onChange={(e) => setCantidadAveriaDespacho(e.target.value)}
              />
              <Button variant="outline" onClick={onRegistrarAveria}>
                Registrar
              </Button>
            </div>
            {averiaGuardada && <p className="text-sm text-muted-foreground">Avería registrada.</p>}
          </CardContent>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {!yaFinalizado && (
        <>
          <Button
            variant="outline"
            className="mb-2 w-full text-destructive hover:text-destructive"
            onClick={() => setDialogoAnularAbierto(true)}
            disabled={procesando}
          >
            Anular orden
          </Button>
          <Button size="lg" className="h-14 w-full text-base" onClick={onFinalizarClick} disabled={procesando || !puedeFinalizar}>
            {esDespacho ? "Finalizar despacho" : "Finalizar cargue"}
          </Button>
          {!puedeFinalizar && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {orden.detalle.length === 0
                ? "Agrega al menos una línea para poder finalizar."
                : "Asigna un vehículo para poder finalizar."}
            </p>
          )}
        </>
      )}

      {yaFinalizado && (
        <p className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm">
          {esDespacho ? (
            <>
              Despacho finalizado. Peso total: <strong>{orden.peso_total_kg?.toFixed(2)} kg</strong>. El pedido quedó
              cerrado.
            </>
          ) : (
            <>
              Cargue finalizado. Peso total: <strong>{orden.peso_total_kg?.toFixed(2)} kg</strong>. Se generó la orden
              de descargue en la bodega destino.
            </>
          )}
        </p>
      )}

      <Dialog open={dialogoCierreAbierto} onOpenChange={setDialogoCierreAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Este {esDespacho ? "despacho" : "cargue"} no cubre todo lo solicitado</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 text-sm">
              {progresoCierre?.lineas
                .filter((l) => l.cantidadPendiente > 0)
                .map((l) => (
                  <div key={l.referenciaId} className="flex items-center justify-between rounded-md border border-border p-2">
                    <span>{l.referenciaNombre}</span>
                    <span className="text-muted-foreground">
                      {l.cantidadCargadaTotal.toLocaleString("es-CO")} de {l.cantidadSolicitada.toLocaleString("es-CO")} —
                      faltan {l.cantidadPendiente.toLocaleString("es-CO")}
                    </span>
                  </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Puedes cerrar definitivamente con lo cargado, o dejarlo pendiente para generar otra orden de cargue por
              el remanente (posiblemente con otro vehículo) desde el detalle de la {esDespacho ? "pedido" : "solicitud"}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={() => onConfirmarConAccion("cerrar")} disabled={procesando}>
                Cerrar con lo cargado
              </Button>
              <Button className="flex-1" onClick={() => onConfirmarConAccion("mantener_pendiente")} disabled={procesando}>
                Mantener pendiente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialogoAnularAbierto} onOpenChange={setDialogoAnularAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular esta orden?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán las líneas cargadas y se liberará el vehículo asignado, si tiene. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onAnular} disabled={procesando}>
              Anular orden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
