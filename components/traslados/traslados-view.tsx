"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Eye, PackageMinus, RefreshCw, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { FormCard } from "@/components/ui/form-card"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { EstadoBadge } from "@/components/ui/estado-badge"
import { AlertaRebandejar } from "@/components/ui/alerta-rebandejar"
import { formatearFechaColombia, formatearFechaHoraColombia } from "@/lib/date-utils"
import {
  listarSolicitudesTraslado,
  crearSolicitudTraslado,
  obtenerLotesDisponibles,
  type SolicitudTraslado,
  type LoteDisponible,
} from "@/lib/traslados-actions"
import { listarBodegas, type Bodega } from "@/lib/bodegas-actions"
import { listarReferenciasHuevo, type ReferenciaHuevo } from "@/lib/recoleccion-actions"
import { ESTADO_SOLICITUD_TRASLADO_LABEL as ESTADO_LABEL } from "@/lib/estado-labels"

export function TrasladosView() {
  const [solicitudes, setSolicitudes] = useState<SolicitudTraslado[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [referencias, setReferencias] = useState<ReferenciaHuevo[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  const [bodegaOrigenId, setBodegaOrigenId] = useState("")
  const [bodegaDestinoId, setBodegaDestinoId] = useState("")
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [edadesPreferidas, setEdadesPreferidas] = useState<Record<number, string>>({})
  const [lotesPreview, setLotesPreview] = useState<Record<number, LoteDisponible[]>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDatos() {
    setCargando(true)
    const [s, b, r] = await Promise.all([listarSolicitudesTraslado(), listarBodegas(true), listarReferenciasHuevo()])
    setSolicitudes(s)
    setBodegas(b)
    setReferencias(r)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (!bodegaOrigenId) {
      setLotesPreview({})
      return
    }
    const referenciasConCantidad = Object.entries(cantidades)
      .filter(([, valor]) => (Number(valor) || 0) > 0)
      .map(([referenciaId]) => Number(referenciaId))

    if (referenciasConCantidad.length === 0) {
      setLotesPreview({})
      return
    }

    let cancelado = false
    Promise.all(
      referenciasConCantidad.map((referenciaId) =>
        obtenerLotesDisponibles(Number(bodegaOrigenId), referenciaId).then((lotes) => [referenciaId, lotes] as const),
      ),
    ).then((resultados) => {
      if (cancelado) return
      setLotesPreview(Object.fromEntries(resultados))
    })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaOrigenId, cantidades])

  // Agrupado por color (no por tipo): desde que el blanco tiene nombres
  // propios por talla (Revoltura Blanca...), un mismo "tipo" ya no
  // representa lo mismo para los dos colores, así que cada tarjeta
  // muestra su nombre completo en vez de compartir un header de tipo.
  const referenciasPorColor = useMemo(() => {
    const grupos = new Map<string, ReferenciaHuevo[]>()
    for (const r of referencias) {
      if (!grupos.has(r.color_nombre)) grupos.set(r.color_nombre, [])
      grupos.get(r.color_nombre)!.push(r)
    }
    return grupos
  }, [referencias])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return solicitudes
    return solicitudes.filter((s) =>
      `${s.codigo} ${s.bodega_origen_nombre} ${s.bodega_destino_nombre}`.toLowerCase().includes(q),
    )
  }, [solicitudes, busqueda])

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length

  function limpiarFormulario() {
    setBodegaOrigenId("")
    setBodegaDestinoId("")
    setCantidades({})
    setEdadesPreferidas({})
    setError(null)
  }

  async function onGuardar() {
    if (!bodegaOrigenId || !bodegaDestinoId) {
      setError("Selecciona bodega origen y destino")
      return
    }

    const lineas = Object.entries(cantidades)
      .map(([referenciaId, valor]) => ({
        referenciaId: Number(referenciaId),
        cantidad: Number(valor) || 0,
        edadSemanasPreferida: edadesPreferidas[Number(referenciaId)] ? Number(edadesPreferidas[Number(referenciaId)]) : null,
      }))
      .filter((l) => l.cantidad > 0)

    if (lineas.length === 0) {
      setError("Registra al menos una cantidad mayor a cero")
      return
    }

    setGuardando(true)
    setError(null)

    const resultado = await crearSolicitudTraslado({
      bodegaOrigenId: Number(bodegaOrigenId),
      bodegaDestinoId: Number(bodegaDestinoId),
      lineas,
    })
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al crear la solicitud")
      toast.error(resultado.message ?? "Error al crear la solicitud")
      return
    }

    toast.success(`Solicitud ${resultado.codigo} creada`, {
      description: "Se generó automáticamente la orden de cargue en la bodega origen.",
    })
    limpiarFormulario()
    cargarDatos()
  }

  return (
    <div>
      <PageHeader titulo="Traslados entre bodegas" subtitulo="La solicitud genera automáticamente la orden de cargue en la bodega origen">
        <StatChip icono={Truck} label="Solicitudes" valor={solicitudes.length} />
        <StatChip icono={PackageMinus} label="Pendientes" valor={pendientes} />
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/cargue">
            <PackageMinus className="h-4 w-4" />
            Ir a órdenes de cargue
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <FormCard
          titulo="Nueva solicitud de traslado"
          subtitulo="Indica qué referencias necesita la bodega destino"
          icono={Truck}
          className="h-fit"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>
                Bodega origen <span className="text-destructive">*</span>
              </Label>
              <Select value={bodegaOrigenId} onValueChange={setBodegaOrigenId}>
                <SelectTrigger>
                  <SelectValue placeholder="¿Desde dónde sale?" />
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
                Bodega destino <span className="text-destructive">*</span>
              </Label>
              <Select value={bodegaDestinoId} onValueChange={setBodegaDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="¿A dónde llega?" />
                </SelectTrigger>
                <SelectContent>
                  {bodegas
                    .filter((b) => b.id.toString() !== bodegaOrigenId)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>
                        {b.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Cantidades solicitadas por referencia</Label>
              <div className="flex flex-col gap-3">
                {Array.from(referenciasPorColor.entries()).map(([colorNombre, refs]) => (
                  <div key={colorNombre} className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-sm font-semibold">{colorNombre}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {refs.map((r) => {
                        const tieneCantidad = (Number(cantidades[r.id]) || 0) > 0
                        const lotes = lotesPreview[r.id] ?? []
                        return (
                          <div key={r.id} className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">{r.nombre}</Label>
                            <Input
                              type="number"
                              value={cantidades[r.id] ?? ""}
                              onChange={(e) => setCantidades((prev) => ({ ...prev, [r.id]: e.target.value }))}
                              placeholder="0"
                            />
                            {tieneCantidad && (
                              <>
                                <Input
                                  type="number"
                                  className="h-8 text-xs"
                                  placeholder="Edad preferida (sem., opcional)"
                                  value={edadesPreferidas[r.id] ?? ""}
                                  onChange={(e) => setEdadesPreferidas((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                />
                                {bodegaOrigenId && (
                                  <div className="flex flex-col gap-0.5 rounded-md bg-muted/50 p-1.5 text-[11px] text-muted-foreground">
                                    {lotes.length === 0 ? (
                                      <span>Sin inventario disponible en la bodega origen.</span>
                                    ) : (
                                      lotes.map((lote) => (
                                        <div key={lote.lote_huevo_id} className="flex items-center justify-between gap-1">
                                          <span>
                                            {lote.lote_huevo_codigo} · {formatearFechaColombia(lote.fecha_cosecha)} ·{" "}
                                            {lote.edad_semanas_captura} sem
                                            {lote.anaquel_codigo && <> · {lote.anaquel_codigo}</>}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            {lote.cantidad_disponible.toLocaleString("es-CO")}
                                            <AlertaRebandejar edadSemanas={lote.edad_semanas_captura} />
                                          </span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button size="lg" onClick={onGuardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Crear solicitud"}
            </Button>
          </div>
        </FormCard>

        <div className="h-fit rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Historial de solicitudes ({filtradas.length})
            </h2>
            <div className="flex items-center gap-2">
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por código o bodega..." className="w-64" />
              <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {cargando ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtradas.length === 0 ? (
            <EmptyState
              icono={Truck}
              titulo={busqueda ? "Sin resultados" : "Todavía no hay solicitudes"}
              descripcion={
                busqueda
                  ? "Ninguna solicitud coincide con la búsqueda."
                  : "Crea la primera solicitud con el formulario de la izquierda."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="text-right">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.codigo}</TableCell>
                    <TableCell>{s.bodega_origen_nombre}</TableCell>
                    <TableCell>{s.bodega_destino_nombre}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={s.estado} label={ESTADO_LABEL[s.estado] ?? s.estado} />
                    </TableCell>
                    <TableCell>{formatearFechaHoraColombia(s.creado_en)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild title="Ver detalle">
                        <Link href={`/traslados/${s.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
