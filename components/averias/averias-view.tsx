"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Droplet, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EstadoBadge } from "@/components/ui/estado-badge"
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import { listarBodegas, type Bodega } from "@/lib/bodegas-actions"
import { listarAverias, registrarProcesamientoYemas, type AveriaFila } from "@/lib/averias-actions"

const ETAPAS = [
  { value: "recoleccion", label: "Recolección" },
  { value: "clasificacion", label: "Clasificación" },
  { value: "transporte", label: "Transporte" },
  { value: "despacho", label: "Despacho" },
  { value: "recepcion", label: "Recepción" },
]

const TIPO_LABEL: Record<string, string> = { picado: "Picado", roto: "Roto", partido: "Partido" }
const ESTADO_AVERIA_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
}

export function AveriasView() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [averias, setAverias] = useState<AveriaFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [bodegaId, setBodegaId] = useState("todas")
  const [etapa, setEtapa] = useState("todas")
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set())

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [cantidadYemas, setCantidadYemas] = useState("")
  const [observacion, setObservacion] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDatos() {
    setCargando(true)
    const [b, a] = await Promise.all([
      listarBodegas(true),
      listarAverias({
        bodegaId: bodegaId === "todas" ? null : Number(bodegaId),
        etapa: etapa === "todas" ? null : etapa,
      }),
    ])
    setBodegas(b)
    setAverias(a)
    setSeleccionadas(new Set())
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId, etapa])

  const seleccionables = useMemo(
    () => averias.filter((a) => a.etapa === "recepcion" && !a.procesadaEnYemas),
    [averias],
  )

  const bodegaSeleccionUnica = useMemo(() => {
    const ids = new Set(Array.from(seleccionadas).map((id) => averias.find((a) => a.id === id)?.bodegaId))
    return ids.size === 1 ? Array.from(ids)[0] ?? null : null
  }, [seleccionadas, averias])

  function toggleSeleccion(fila: AveriaFila) {
    setSeleccionadas((prev) => {
      const next = new Set(prev)
      if (next.has(fila.id)) {
        next.delete(fila.id)
      } else {
        next.add(fila.id)
      }
      return next
    })
  }

  async function onRegistrarProcesamiento() {
    if (!bodegaSeleccionUnica) {
      setError("Selecciona averías de una sola bodega")
      return
    }
    const cantidad = Number(cantidadYemas)
    if (!cantidad || cantidad <= 0) {
      setError("Registra la cantidad de yemas obtenidas")
      return
    }
    setGuardando(true)
    setError(null)
    const resultado = await registrarProcesamientoYemas(
      bodegaSeleccionUnica,
      Array.from(seleccionadas),
      cantidad,
      observacion.trim() || null,
    )
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al registrar el procesamiento")
      toast.error(resultado.message ?? "Error al registrar el procesamiento")
      return
    }

    toast.success(`Procesamiento de ${cantidad} yemas registrado`)
    setDialogoAbierto(false)
    setCantidadYemas("")
    setObservacion("")
    cargarDatos()
  }

  return (
    <div>
      <PageHeader
        titulo="Averías"
        subtitulo="Picados, rotos y partidos de todas las etapas — recolección, clasificación, despacho y recepción"
      >
        <StatChip icono={AlertTriangle} label="Averías" valor={averias.length} />
        <StatChip icono={Droplet} label="Pendientes de procesar yema" valor={seleccionables.length} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        <Select value={etapa} onValueChange={setEtapa}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las etapas</SelectItem>
            {ETAPAS.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {seleccionadas.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-4 py-2.5">
          <p className="text-sm font-medium">{seleccionadas.size} avería(s) seleccionada(s)</p>
          <Button size="sm" onClick={() => setDialogoAbierto(true)}>
            Registrar procesamiento de yemas
          </Button>
        </div>
      )}

      {cargando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : averias.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState icono={AlertTriangle} titulo="Sin averías registradas" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Bodega</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Observación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {averias.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    {seleccionables.some((s) => s.id === a.id) && (
                      <Checkbox checked={seleccionadas.has(a.id)} onCheckedChange={() => toggleSeleccion(a)} />
                    )}
                  </TableCell>
                  <TableCell>{formatearFechaHoraColombia(a.fecha)}</TableCell>
                  <TableCell className="font-medium">{a.origenLabel}</TableCell>
                  <TableCell>{a.bodegaNombre ?? "—"}</TableCell>
                  <TableCell>{a.loteHuevoCodigo}</TableCell>
                  <TableCell>{a.referenciaNombre ?? "—"}</TableCell>
                  <TableCell>{TIPO_LABEL[a.tipoAveria] ?? a.tipoAveria}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {a.cantidad.toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell>
                    <EstadoBadge estado={a.estado} label={ESTADO_AVERIA_LABEL[a.estado] ?? a.estado} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.observaciones ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar procesamiento de yemas</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {seleccionadas.size} avería(s) de la bodega{" "}
              <span className="font-medium">
                {bodegas.find((b) => b.id === bodegaSeleccionUnica)?.nombre ?? "—"}
              </span>
            </p>
            <div className="flex flex-col gap-2">
              <Label>Cantidad de yemas obtenidas</Label>
              <Input
                type="number"
                value={cantidadYemas}
                onChange={(e) => setCantidadYemas(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Observación (opcional)</Label>
              <Input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Opcional" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={onRegistrarProcesamiento} disabled={guardando}>
              {guardando ? "Registrando..." : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
