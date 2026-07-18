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
import { formatearFechaColombia } from "@/lib/date-utils"
import {
  listarInventarioSinClasificar,
  registrarClasificacion,
  type ItemInventarioSinClasificar,
  type MotivoCartonExtra,
} from "@/lib/clasificacion-actions"
import { listarBodegasClasificadoras, type Bodega } from "@/lib/bodegas-actions"
import { listarAnaquelesPorBodega, type Anaquel } from "@/lib/anaqueles-actions"
import { listarInventarioCartones } from "@/lib/cartones-actions"
import { listarReferenciasHuevo, type ReferenciaHuevo, type TipoAveria } from "@/lib/recoleccion-actions"

const TIPOS_AVERIA: { value: TipoAveria; label: string }[] = [
  { value: "picado", label: "Picados" },
  { value: "roto_sin_recuperar", label: "Rotos sin recuperar" },
  { value: "roto_con_yema", label: "Rotos con yema" },
]

const HUEVOS_POR_CARTON = 30

const MOTIVOS_CARTON_EXTRA: { value: MotivoCartonExtra; label: string }[] = [
  { value: "refuerzo_buenos", label: "Refuerzo de cartones buenos" },
  { value: "rotos", label: "Rotos" },
  { value: "averiados", label: "Averiados" },
]

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

export function ClasificacionView() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [bodegaId, setBodegaId] = useState("")
  const [items, setItems] = useState<ItemInventarioSinClasificar[]>([])
  const [referencias, setReferencias] = useState<ReferenciaHuevo[]>([])
  const [anaqueles, setAnaqueles] = useState<Anaquel[]>([])
  const [cargando, setCargando] = useState(true)

  const [itemSeleccionado, setItemSeleccionado] = useState<ItemInventarioSinClasificar | null>(null)
  const [cantidadEntrada, setCantidadEntrada] = useState("")
  const [salidas, setSalidas] = useState<Record<number, { cantidad: string; anaquelId: string }>>({})
  const [averias, setAverias] = useState<Record<TipoAveria, string>>({ picado: "", roto_sin_recuperar: "", roto_con_yema: "" })
  const [cartonesDisponibles, setCartonesDisponibles] = useState(0)
  const [cartonesExtra, setCartonesExtra] = useState<Record<MotivoCartonExtra, string>>({
    refuerzo_buenos: "",
    rotos: "",
    averiados: "",
  })
  const [observacionCartones, setObservacionCartones] = useState("")

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  async function cargarBase() {
    setCargando(true)
    const [b, r] = await Promise.all([listarBodegasClasificadoras(), listarReferenciasHuevo()])
    setBodegas(b)
    setReferencias(r)
    setCargando(false)
  }

  useEffect(() => {
    cargarBase()
  }, [])

  useEffect(() => {
    if (!bodegaId) {
      setItems([])
      setAnaqueles([])
      return
    }
    listarInventarioSinClasificar(Number(bodegaId)).then(setItems)
    listarAnaquelesPorBodega(Number(bodegaId)).then(setAnaqueles)
    listarInventarioCartones(Number(bodegaId)).then((filas) => setCartonesDisponibles(filas[0]?.cantidad_disponible ?? 0))
    limpiarSeleccion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId])

  const referenciasDelColor = useMemo(() => {
    if (!itemSeleccionado) return []
    return referencias.filter((r) => r.color_nombre === itemSeleccionado.color_nombre)
  }, [referencias, itemSeleccionado])

  const totalSalidas = useMemo(
    () => Object.values(salidas).reduce((acc, s) => acc + (Number(s.cantidad) || 0), 0),
    [salidas],
  )
  const totalAverias = useMemo(
    () => Object.values(averias).reduce((acc, v) => acc + (Number(v) || 0), 0),
    [averias],
  )
  const cantidadEntradaNum = Number(cantidadEntrada) || 0
  const faltantePorAsignar = cantidadEntradaNum - totalSalidas - totalAverias

  const cartonesCalculados = Math.ceil(totalSalidas / HUEVOS_POR_CARTON)
  const totalCartonesExtra = useMemo(
    () => Object.values(cartonesExtra).reduce((acc, v) => acc + (Number(v) || 0), 0),
    [cartonesExtra],
  )
  const totalCartonesUsados = cartonesCalculados + totalCartonesExtra
  const cartonesInsuficientes = totalCartonesUsados > cartonesDisponibles

  function limpiarSeleccion() {
    setItemSeleccionado(null)
    setCantidadEntrada("")
    setSalidas({})
    setAverias({ picado: "", roto_sin_recuperar: "", roto_con_yema: "" })
    setCartonesExtra({ refuerzo_buenos: "", rotos: "", averiados: "" })
    setObservacionCartones("")
  }

  function seleccionarItem(item: ItemInventarioSinClasificar) {
    setItemSeleccionado(item)
    setCantidadEntrada(item.cantidad_disponible.toString())
    setSalidas({})
    setAverias({ picado: "", roto_sin_recuperar: "", roto_con_yema: "" })
    setCartonesExtra({ refuerzo_buenos: "", rotos: "", averiados: "" })
    setObservacionCartones("")
    setError(null)
    setExito(null)
  }

  async function onRegistrar() {
    setError(null)
    setExito(null)

    if (!itemSeleccionado) {
      setError("Selecciona qué inventario sin clasificar vas a procesar")
      return
    }
    if (faltantePorAsignar !== 0) {
      setError(
        faltantePorAsignar > 0
          ? `Todavía faltan ${faltantePorAsignar} por asignar entre salidas y averías`
          : `Te pasaste por ${-faltantePorAsignar} — ajusta las cantidades`,
      )
      return
    }
    if (cartonesInsuficientes) {
      setError(`No hay suficientes cartones en esta bodega (disponibles: ${cartonesDisponibles}, necesarios: ${totalCartonesUsados})`)
      return
    }

    setGuardando(true)

    const resultado = await registrarClasificacion({
      bodegaId: Number(bodegaId),
      loteHuevoId: itemSeleccionado.lote_huevo_id,
      colorId: itemSeleccionado.color_id,
      anaquelOrigenId: itemSeleccionado.anaquel_id,
      cantidadEntrada: cantidadEntradaNum,
      salidas: Object.entries(salidas)
        .map(([referenciaId, s]) => ({
          referenciaId: Number(referenciaId),
          anaquelDestinoId: s.anaquelId ? Number(s.anaquelId) : null,
          cantidad: Number(s.cantidad) || 0,
        }))
        .filter((s) => s.cantidad > 0),
      averias: (Object.entries(averias) as [TipoAveria, string][])
        .map(([tipoAveria, valor]) => ({ tipoAveria, cantidad: Number(valor) || 0 }))
        .filter((a) => a.cantidad > 0),
      cartonesExtra: (Object.entries(cartonesExtra) as [MotivoCartonExtra, string][])
        .map(([motivo, valor]) => ({ motivo, cantidad: Number(valor) || 0 }))
        .filter((c) => c.cantidad > 0),
      observacionCartones: observacionCartones.trim() || null,
    })

    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al registrar la clasificación")
      return
    }

    setExito(resultado.codigo ?? null)
    toast.success(`Clasificación registrada — ${resultado.codigo}`)
    listarInventarioSinClasificar(Number(bodegaId)).then(setItems)
    listarInventarioCartones(Number(bodegaId)).then((filas) => setCartonesDisponibles(filas[0]?.cantidad_disponible ?? 0))
    limpiarSeleccion()
  }

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        titulo="Clasificación de huevos"
        subtitulo="Toma inventario sin clasificar de una estantería y repártelo en tipo y color"
      />

      {exito && (
        <Card className="mb-4 border-green-600/30 bg-green-600/10">
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
            <div>
              <p className="font-semibold">Clasificación registrada</p>
              <p className="text-sm text-muted-foreground">Código: {exito}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label>Bodega clasificadora</Label>
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
            <Paso n={1} titulo="¿Qué inventario sin clasificar vas a procesar?" />
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin inventario sin clasificar en esta bodega.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => seleccionarItem(item)}
                    className={`rounded-md border p-3 text-left text-sm transition-colors ${
                      itemSeleccionado?.id === item.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        Lote {item.lote_huevo_codigo} · {item.color_nombre}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {item.cantidad_disponible.toLocaleString("es-CO")}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Recolección {formatearFechaColombia(item.fecha_cosecha)} · Galpón {item.galpon_codigo} · Edad{" "}
                      {item.edad_semanas_captura} sem
                      {item.anaquel_codigo && <> · Estantería {item.anaquel_codigo}</>}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {itemSeleccionado && (
          <>
            <div className="flex flex-col gap-2">
              <Label>Cantidad a clasificar (de {itemSeleccionado.cantidad_disponible.toLocaleString("es-CO")} disponibles)</Label>
              <Input
                type="number"
                className="h-12 text-base"
                value={cantidadEntrada}
                onChange={(e) => setCantidadEntrada(e.target.value)}
                max={itemSeleccionado.cantidad_disponible}
              />
            </div>

            <div>
              <div className="mb-2">
                <Paso n={2} titulo={`Salida — clasificación (${itemSeleccionado.color_nombre})`} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {referenciasDelColor.map((r) => (
                  <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <Label className="text-sm font-semibold">{r.nombre}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Cantidad"
                      value={salidas[r.id]?.cantidad ?? ""}
                      onChange={(e) =>
                        setSalidas((prev) => ({ ...prev, [r.id]: { ...prev[r.id], cantidad: e.target.value } }))
                      }
                    />
                    <Select
                      value={salidas[r.id]?.anaquelId ?? ""}
                      onValueChange={(v) => setSalidas((prev) => ({ ...prev, [r.id]: { ...prev[r.id], anaquelId: v } }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Estantería destino (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {anaqueles.map((a) => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            {a.codigo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2">
                <Paso n={3} titulo="Averías" opcional />
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
                      value={averias[t.value]}
                      onChange={(e) => setAverias((prev) => ({ ...prev, [t.value]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2">
                <Paso n={4} titulo="Consumo de cartones" />
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cartones que se deben usar (1 cada 30 huevos)</span>
                  <span className="font-semibold tabular-nums">{cartonesCalculados}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {MOTIVOS_CARTON_EXTRA.map((m) => (
                    <div key={m.value} className="flex flex-col gap-1">
                      <Label htmlFor={`carton-${m.value}`} className="text-xs text-muted-foreground">
                        {m.label}
                      </Label>
                      <Input
                        id={`carton-${m.value}`}
                        type="number"
                        inputMode="numeric"
                        value={cartonesExtra[m.value]}
                        onChange={(e) => setCartonesExtra((prev) => ({ ...prev, [m.value]: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
                {totalCartonesExtra > 0 && (
                  <div className="mt-3 flex flex-col gap-1">
                    <Label htmlFor="observacion-cartones" className="text-xs text-muted-foreground">
                      Observación (justifica el consumo extra)
                    </Label>
                    <Input
                      id="observacion-cartones"
                      value={observacionCartones}
                      onChange={(e) => setObservacionCartones(e.target.value)}
                      placeholder="Ej. cartones reforzados por mal estado del lote anterior"
                    />
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">
                    Total a consumir · Disponibles en esta bodega: {cartonesDisponibles.toLocaleString("es-CO")}
                  </span>
                  <span className={`font-bold tabular-nums ${cartonesInsuficientes ? "text-destructive" : ""}`}>
                    {totalCartonesUsados}
                  </span>
                </div>
                {cartonesInsuficientes && (
                  <p className="mt-1 text-xs text-destructive">
                    No hay suficientes cartones disponibles — registra un ingreso en Inventario → Cartones.
                  </p>
                )}
              </div>
            </div>

            <div
              className={`rounded-md border p-3 text-sm font-semibold ${
                faltantePorAsignar === 0
                  ? "border-green-600/30 bg-green-600/10 text-green-700"
                  : "border-amber-600/30 bg-amber-600/10 text-amber-700"
              }`}
            >
              {faltantePorAsignar === 0
                ? "Todo lo que entra quedó contabilizado."
                : `Faltan por asignar: ${faltantePorAsignar}`}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              size="lg"
              className="h-14 text-base"
              onClick={onRegistrar}
              disabled={guardando || faltantePorAsignar !== 0 || cartonesInsuficientes}
            >
              {guardando ? "Registrando..." : "Registrar clasificación"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
