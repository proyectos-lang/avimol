"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRightLeft, Bird, CalendarClock, Egg, History, MinusCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { FormCard } from "@/components/ui/form-card"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { EstadoBadge } from "@/components/ui/estado-badge"
import { fechaColombiaHoy, formatearFechaColombia, formatearFechaHoraColombia } from "@/lib/date-utils"
import { listarGalpones, type Galpon } from "@/lib/galpones-actions"
import {
  listarLotesAves,
  ingresarLoteAves,
  trasladarLoteAves,
  registrarSalidaAves,
  obtenerHistorialLote,
  type LoteAves,
  type MovimientoAves,
  type TipoSalidaAves,
} from "@/lib/lotes-aves-actions"

const ESTADO_LOTE_LABEL: Record<string, string> = {
  activo: "Activo",
  sacrificado: "Sacrificado",
  cerrado: "Cerrado",
}

export function AvesView() {
  const [lotes, setLotes] = useState<LoteAves[]>([])
  const [galpones, setGalpones] = useState<Galpon[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [incluirCerrados, setIncluirCerrados] = useState(false)

  const [dialogoTraslado, setDialogoTraslado] = useState<LoteAves | null>(null)
  const [dialogoSalida, setDialogoSalida] = useState<LoteAves | null>(null)
  const [dialogoHistorial, setDialogoHistorial] = useState<LoteAves | null>(null)
  const [historial, setHistorial] = useState<MovimientoAves[]>([])

  // Formulario de ingreso (panel izquierdo, siempre visible)
  const [codigo, setCodigo] = useState("")
  const [galponId, setGalponId] = useState("")
  const [cantidad, setCantidad] = useState("")
  const [fecha, setFecha] = useState(fechaColombiaHoy())
  const [edadSemanas, setEdadSemanas] = useState("20")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDatos(mostrarCerrados = incluirCerrados) {
    setCargando(true)
    const [l, g] = await Promise.all([listarLotesAves(!mostrarCerrados), listarGalpones()])
    setLotes(l)
    setGalpones(g.filter((x) => x.activo))
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos(incluirCerrados)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incluirCerrados])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return lotes
    return lotes.filter((l) => `${l.codigo} ${l.galpon_codigo} ${l.galpon_nombre}`.toLowerCase().includes(q))
  }, [lotes, busqueda])

  const lotesActivos = lotes.filter((l) => l.estado === "activo")
  const avesTotales = lotesActivos.reduce((acc, l) => acc + l.cantidad_actual, 0)
  const edadPromedio =
    lotesActivos.length > 0
      ? Math.round((lotesActivos.reduce((acc, l) => acc + l.edad_actual_semanas, 0) / lotesActivos.length) * 10) / 10
      : 0

  function limpiarFormulario() {
    setCodigo("")
    setGalponId("")
    setCantidad("")
    setFecha(fechaColombiaHoy())
    setEdadSemanas("20")
    setError(null)
  }

  async function onIngresar() {
    if (!codigo.trim() || !galponId || !cantidad || !edadSemanas) {
      setError("Completa todos los campos obligatorios")
      return
    }
    setGuardando(true)
    setError(null)

    const resultado = await ingresarLoteAves({
      codigo: codigo.trim(),
      galponId: Number(galponId),
      cantidadIngreso: Number(cantidad),
      fechaIngreso: fecha,
      edadSemanasIngreso: Number(edadSemanas),
    })
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al guardar")
      toast.error(resultado.message ?? "Error al registrar el ingreso")
      return
    }

    toast.success(`Lote ${codigo.trim()} ingresado`, {
      description: "La edad en semanas se calculará automáticamente desde la fecha de ingreso.",
    })
    limpiarFormulario()
    cargarDatos()
  }

  async function abrirHistorial(lote: LoteAves) {
    setDialogoHistorial(lote)
    setHistorial(await obtenerHistorialLote(lote.id))
  }

  return (
    <div>
      <PageHeader titulo="Lotes de aves" subtitulo="Ingresos, traslados, salidas y edad en tiempo real">
        <StatChip icono={Bird} label="Aves activas" valor={avesTotales.toLocaleString("es-CO")} />
        <StatChip icono={Egg} label="Lotes activos" valor={lotesActivos.length} />
        <StatChip icono={CalendarClock} label="Edad promedio" valor={`${edadPromedio} sem`} />
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/recoleccion">
            <Egg className="h-4 w-4" />
            Registrar recolección
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <FormCard
          titulo="Ingresar lote de aves"
          subtitulo="El lote conserva su identidad y edad aunque cambie de galpón"
          icono={Bird}
          className="h-fit lg:sticky lg:top-6"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>
                Código del lote <span className="text-destructive">*</span>
              </Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="LA-2026-001" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>
                Galpón <span className="text-destructive">*</span>
              </Label>
              <Select value={galponId} onValueChange={setGalponId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el galpón" />
                </SelectTrigger>
                <SelectContent>
                  {galpones.map((g) => (
                    <SelectItem key={g.id} value={g.id.toString()}>
                      {g.codigo} — {g.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>
                  Cantidad <span className="text-destructive">*</span>
                </Label>
                <Input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="10000" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>
                  Edad (sem) <span className="text-destructive">*</span>
                </Label>
                <Input type="number" value={edadSemanas} onChange={(e) => setEdadSemanas(e.target.value)} placeholder="20" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Fecha de ingreso</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button size="lg" onClick={onIngresar} disabled={guardando}>
              {guardando ? "Guardando..." : "Ingresar lote"}
            </Button>
          </div>
        </FormCard>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Lotes ({filtrados.length})
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={incluirCerrados} onCheckedChange={setIncluirCerrados} />
                Incluir cerrados
              </label>
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por lote o galpón..." className="w-56" />
              <Button variant="outline" size="icon" onClick={() => cargarDatos()} title="Actualizar">
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
          ) : filtrados.length === 0 ? (
            <EmptyState
              icono={Bird}
              titulo={busqueda ? "Sin resultados" : "No hay lotes de aves"}
              descripcion={
                busqueda
                  ? "Ningún lote coincide con la búsqueda."
                  : "Ingresa el primer lote con el formulario de la izquierda."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Galpón</TableHead>
                  <TableHead className="text-right">Cantidad actual</TableHead>
                  <TableHead className="text-right">Edad actual</TableHead>
                  <TableHead>Fecha ingreso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.codigo}</TableCell>
                    <TableCell>
                      {l.galpon_codigo} — {l.galpon_nombre}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.cantidad_actual.toLocaleString("es-CO")}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.edad_actual_semanas} sem</TableCell>
                    <TableCell>{formatearFechaColombia(l.fecha_ingreso)}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={l.estado} label={ESTADO_LOTE_LABEL[l.estado] ?? l.estado} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDialogoTraslado(l)}
                          title="Trasladar a otro galpón"
                          disabled={l.estado !== "activo"}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setDialogoSalida(l)}
                          title="Registrar salida (mortalidad/sacrificio)"
                          disabled={l.estado !== "activo"}
                        >
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => abrirHistorial(l)} title="Ver historial">
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {dialogoTraslado && (
        <DialogoTraslado
          lote={dialogoTraslado}
          galpones={galpones}
          onCerrar={() => setDialogoTraslado(null)}
          onGuardado={() => cargarDatos()}
        />
      )}

      {dialogoSalida && (
        <DialogoSalida lote={dialogoSalida} onCerrar={() => setDialogoSalida(null)} onGuardado={() => cargarDatos()} />
      )}

      <Dialog open={!!dialogoHistorial} onOpenChange={(abierto) => !abierto && setDialogoHistorial(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial — {dialogoHistorial?.codigo}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
            {historial.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
            ) : (
              historial.map((m) => (
                <div key={m.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex justify-between font-semibold capitalize">
                    <span>{m.tipo_movimiento}</span>
                    <span className="text-muted-foreground">{formatearFechaHoraColombia(m.fecha)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {m.galpon_origen_nombre && <span>Desde: {m.galpon_origen_nombre} </span>}
                    {m.galpon_destino_nombre && <span>Hacia: {m.galpon_destino_nombre} </span>}
                    · Cantidad: {m.cantidad.toLocaleString("es-CO")}
                  </div>
                  {m.observaciones && <div className="mt-1">{m.observaciones}</div>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DialogoTraslado({
  lote,
  galpones,
  onCerrar,
  onGuardado,
}: {
  lote: LoteAves
  galpones: Galpon[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [galponDestinoId, setGalponDestinoId] = useState("")
  const [cantidad, setCantidad] = useState(lote.cantidad_actual.toString())
  const [codigoNuevo, setCodigoNuevo] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cantidadNum = Number(cantidad)
  const esParcial = cantidadNum > 0 && cantidadNum < lote.cantidad_actual

  async function onGuardar() {
    if (!galponDestinoId) {
      setError("Selecciona el galpón destino")
      return
    }
    if (!cantidadNum || cantidadNum <= 0 || cantidadNum > lote.cantidad_actual) {
      setError(`La cantidad debe estar entre 1 y ${lote.cantidad_actual}`)
      return
    }
    if (esParcial && !codigoNuevo.trim()) {
      setError("El código del nuevo lote es obligatorio para un traslado parcial")
      return
    }
    setGuardando(true)
    setError(null)

    const resultado = await trasladarLoteAves(
      lote.id,
      Number(galponDestinoId),
      cantidadNum,
      esParcial ? codigoNuevo.trim() : undefined,
      observaciones,
    )
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al trasladar")
      return
    }

    toast.success(esParcial ? `${cantidadNum.toLocaleString("es-CO")} aves trasladadas a un lote nuevo` : `Lote ${lote.codigo} trasladado`)
    onCerrar()
    onGuardado()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trasladar lote {lote.codigo}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Galpón actual: {lote.galpon_codigo} — {lote.galpon_nombre}.{" "}
            {esParcial
              ? "Se crea un lote nuevo en el galpón destino con la misma edad; el lote original se queda con el resto."
              : "El lote conserva su historial y edad."}
          </p>
          <div className="flex flex-col gap-2">
            <Label>Galpón destino</Label>
            <Select value={galponDestinoId} onValueChange={setGalponDestinoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el galpón destino" />
              </SelectTrigger>
              <SelectContent>
                {galpones
                  .filter((g) => g.id !== lote.galpon_id)
                  .map((g) => (
                    <SelectItem key={g.id} value={g.id.toString()}>
                      {g.codigo} — {g.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Cantidad a trasladar</Label>
            <Input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            <p className="text-xs text-muted-foreground">Máximo: {lote.cantidad_actual.toLocaleString("es-CO")}</p>
          </div>
          {esParcial && (
            <div className="flex flex-col gap-2">
              <Label>
                Código del nuevo lote <span className="text-destructive">*</span>
              </Label>
              <Input value={codigoNuevo} onChange={(e) => setCodigoNuevo(e.target.value)} placeholder="LA-2026-001-B" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label>Observaciones (opcional)</Label>
            <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Trasladar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DialogoSalida({
  lote,
  onCerrar,
  onGuardado,
}: {
  lote: LoteAves
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [tipo, setTipo] = useState<TipoSalidaAves>("mortalidad")
  const [cantidad, setCantidad] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onGuardar() {
    const cant = Number(cantidad)
    if (!cant || cant <= 0) {
      setError("Ingresa una cantidad válida")
      return
    }
    setGuardando(true)
    setError(null)

    const resultado = await registrarSalidaAves(lote.id, tipo, cant, observaciones)
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al registrar la salida")
      return
    }

    toast.success(`Salida de ${cant.toLocaleString("es-CO")} aves registrada (${tipo})`)
    onCerrar()
    onGuardado()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar salida — {lote.codigo}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Cantidad actual: {lote.cantidad_actual.toLocaleString("es-CO")} aves
          </p>
          <div className="flex flex-col gap-2">
            <Label>Tipo de salida</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoSalidaAves)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mortalidad">Mortalidad</SelectItem>
                <SelectItem value="sacrificio">Sacrificio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Cantidad</Label>
            <Input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Observaciones (opcional)</Label>
            <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
