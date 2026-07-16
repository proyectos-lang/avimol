"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {
  listarGalponesConLoteActivo,
  listarColoresHuevo,
  registrarRecoleccion,
  type GalponConLoteActivo,
  type ColorHuevo,
  type TipoAveria,
} from "@/lib/recoleccion-actions"
import { listarBodegasClasificadoras, type Bodega } from "@/lib/bodegas-actions"
import { listarAnaquelesPorBodega, crearAnaquel, type Anaquel } from "@/lib/anaqueles-actions"

const TIPOS_AVERIA: { value: TipoAveria; label: string }[] = [
  { value: "picado", label: "Picados" },
  { value: "roto", label: "Rotos" },
  { value: "partido", label: "Partidos" },
]

// Indicador de paso numerado — guía al recolector en orden, con mínima
// lectura (público objetivo: operarios de campo desde el celular).
function Paso({ n, titulo, opcional = false }: { n: number; titulo: string; opcional?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {n}
      </span>
      <span className="text-sm font-semibold">{titulo}</span>
      {opcional && <span className="text-xs text-muted-foreground">(opcional)</span>}
    </div>
  )
}

export function RecoleccionView() {
  const [galpones, setGalpones] = useState<GalponConLoteActivo[]>([])
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [colores, setColores] = useState<ColorHuevo[]>([])
  const [anaqueles, setAnaqueles] = useState<Anaquel[]>([])
  const [cargando, setCargando] = useState(true)

  const [galponId, setGalponId] = useState("")
  const [bodegaId, setBodegaId] = useState("")
  const [anaquelId, setAnaquelId] = useState("")
  const [nuevoAnaquelCodigo, setNuevoAnaquelCodigo] = useState("")
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [averias, setAverias] = useState<Record<TipoAveria, string>>({ picado: "", roto: "", partido: "" })

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  async function cargarDatos() {
    setCargando(true)
    const [g, b, c] = await Promise.all([listarGalponesConLoteActivo(), listarBodegasClasificadoras(), listarColoresHuevo()])
    setGalpones(g)
    setBodegas(b)
    setColores(c)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (!bodegaId) {
      setAnaqueles([])
      setAnaquelId("")
      return
    }
    listarAnaquelesPorBodega(Number(bodegaId)).then(setAnaqueles)
    setAnaquelId("")
  }, [bodegaId])

  const galponSeleccionado = useMemo(
    () => galpones.find((g) => g.galpon_id.toString() === galponId) ?? null,
    [galpones, galponId],
  )

  async function onAgregarAnaquel() {
    if (!bodegaId || !nuevoAnaquelCodigo.trim()) return
    const resultado = await crearAnaquel(Number(bodegaId), nuevoAnaquelCodigo.trim(), null)
    if (resultado.success && resultado.anaquel) {
      setAnaqueles((prev) => [...prev, resultado.anaquel!])
      setAnaquelId(resultado.anaquel.id.toString())
      setNuevoAnaquelCodigo("")
    }
  }

  function limpiarFormulario() {
    setGalponId("")
    setBodegaId("")
    setAnaquelId("")
    setCantidades({})
    setAverias({ picado: "", roto: "", partido: "" })
  }

  async function onRegistrar() {
    setError(null)
    setExito(null)

    if (!galponSeleccionado) {
      setError("Selecciona el galpón de origen")
      return
    }
    if (!bodegaId) {
      setError("Selecciona la bodega destino")
      return
    }

    const cantidadesEnviar = Object.entries(cantidades)
      .map(([colorId, valor]) => ({ colorId: Number(colorId), cantidad: Number(valor) || 0 }))
      .filter((c) => c.cantidad > 0)

    if (cantidadesEnviar.length === 0) {
      setError("Registra al menos una cantidad mayor a cero")
      return
    }

    setGuardando(true)

    const resultado = await registrarRecoleccion({
      galponId: galponSeleccionado.galpon_id,
      loteAvesId: galponSeleccionado.lote_aves_id,
      edadSemanasCaptura: galponSeleccionado.edad_actual_semanas,
      bodegaId: Number(bodegaId),
      anaquelId: anaquelId ? Number(anaquelId) : null,
      origen: "app_movil",
      cantidades: cantidadesEnviar,
      averias: (Object.entries(averias) as [TipoAveria, string][])
        .map(([tipoAveria, valor]) => ({ tipoAveria, referenciaId: null, cantidad: Number(valor) || 0 }))
        .filter((a) => a.cantidad > 0),
    })

    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al registrar la recolección")
      return
    }

    setExito(resultado.codigo ?? null)
    toast.success(`Recolección registrada — lote ${resultado.codigo}`)
    limpiarFormulario()
  }

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        titulo="Recolección de huevos"
        subtitulo="Flujo guiado paso a paso — pensado para uso en campo desde el celular"
      />

      {exito && (
        <Card className="mb-4 border-green-600/30 bg-green-600/10">
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
            <div>
              <p className="font-semibold">Recolección registrada</p>
              <p className="text-sm text-muted-foreground">Lote generado: {exito}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Paso n={1} titulo="¿De qué galpón viene el huevo?" />
          <Select value={galponId} onValueChange={setGalponId}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Selecciona el galpón" />
            </SelectTrigger>
            <SelectContent>
              {galpones.map((g) => (
                <SelectItem key={g.galpon_id} value={g.galpon_id.toString()}>
                  {g.galpon_codigo} — {g.galpon_nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {galponSeleccionado && (
            <p className="text-sm text-muted-foreground">
              Lote de aves {galponSeleccionado.lote_aves_codigo} · Edad actual:{" "}
              <span className="font-semibold">{galponSeleccionado.edad_actual_semanas} semanas</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Paso n={2} titulo="¿A qué bodega llega?" />
          <Select value={bodegaId} onValueChange={setBodegaId}>
            <SelectTrigger className="h-12 text-base">
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

        {bodegaId && (
          <div className="flex flex-col gap-2">
            <Label>Estantería (opcional)</Label>
            <Select value={anaquelId} onValueChange={setAnaquelId}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Sin estantería específica" />
              </SelectTrigger>
              <SelectContent>
                {anaqueles.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.codigo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                value={nuevoAnaquelCodigo}
                onChange={(e) => setNuevoAnaquelCodigo(e.target.value)}
                placeholder="¿No existe? Escribe un código nuevo aquí..."
              />
              <Button type="button" variant="outline" onClick={onAgregarAnaquel}>
                Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              También puedes administrar las estanterías de cada bodega desde <span className="font-medium">Bodegas y logística → Bodegas</span>.
            </p>
          </div>
        )}

        <div>
          <div className="mb-2">
            <Paso n={3} titulo="Cantidades por color" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {colores.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                <Label htmlFor={`color-${c.id}`} className="text-sm font-semibold">
                  {c.nombre}
                </Label>
                <Input
                  id={`color-${c.id}`}
                  type="number"
                  inputMode="numeric"
                  className="h-12 text-base"
                  value={cantidades[c.id] ?? ""}
                  onChange={(e) => setCantidades((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Este huevo entra como inventario sin clasificar — la clasificación por tipo se hace después en el módulo
            de Clasificación.
          </p>
        </div>

        <div>
          <div className="mb-2">
            <Paso n={4} titulo="Averías" opcional />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {TIPOS_AVERIA.map((t) => (
              <div key={t.value} className="flex flex-col gap-1">
                <Label htmlFor={`averia-${t.value}`} className="text-xs text-muted-foreground">
                  {t.label}
                </Label>
                <Input
                  id={`averia-${t.value}`}
                  type="number"
                  inputMode="numeric"
                  className="h-12 text-base"
                  value={averias[t.value]}
                  onChange={(e) => setAverias((prev) => ({ ...prev, [t.value]: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button size="lg" className="h-14 text-base" onClick={onRegistrar} disabled={guardando}>
          {guardando ? "Registrando..." : "Registrar recolección"}
        </Button>
      </div>
    </div>
  )
}
