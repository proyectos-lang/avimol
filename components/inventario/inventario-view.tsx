"use client"

import { useEffect, useMemo, useState } from "react"
import { Boxes, Egg, History, Layers, PackageOpen, RefreshCw, Warehouse } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertaRebandejar } from "@/components/ui/alerta-rebandejar"
import { CartonesTab } from "@/components/inventario/cartones-tab"
import { formatearFechaColombia, formatearFechaHoraColombia } from "@/lib/date-utils"
import {
  listarInventario,
  listarKardexLote,
  obtenerTotalSinClasificar,
  type InventarioFila,
  type MovimientoInventario,
} from "@/lib/inventario-actions"
import { listarBodegas, type Bodega } from "@/lib/bodegas-actions"

const TIPO_MOVIMIENTO_LABEL: Record<string, string> = {
  entrada_cosecha: "Entrada por recolección",
  salida_cargue_traslado: "Salida por cargue de traslado",
  entrada_recepcion_traslado: "Entrada por recepción de traslado",
  salida_cargue_despacho: "Salida por despacho",
  salida_venta_directa: "Salida por venta directa",
  averia: "Avería",
  ajuste: "Ajuste",
}

export function InventarioView() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [filas, setFilas] = useState<InventarioFila[]>([])
  const [totalSinClasificar, setTotalSinClasificar] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [bodegaId, setBodegaId] = useState<string>("todas")
  const [busqueda, setBusqueda] = useState("")

  const [kardexDe, setKardexDe] = useState<InventarioFila | null>(null)
  const [kardex, setKardex] = useState<MovimientoInventario[]>([])
  const [cargandoKardex, setCargandoKardex] = useState(false)

  async function cargarDatos() {
    setCargando(true)
    const idBodega = bodegaId === "todas" ? null : Number(bodegaId)
    const [b, i, sinClasificar] = await Promise.all([
      listarBodegas(true),
      listarInventario(idBodega),
      obtenerTotalSinClasificar(idBodega),
    ])
    setBodegas(b)
    setFilas(i)
    setTotalSinClasificar(sinClasificar)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodegaId])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return filas
    return filas.filter((f) =>
      `${f.lote_codigo} ${f.galpon_codigo} ${f.referencia_nombre} ${f.tipo_nombre} ${f.color_nombre} ${f.anaquel_codigo ?? ""} ${f.bodega_nombre}`
        .toLowerCase()
        .includes(q),
    )
  }, [filas, busqueda])

  const totalHuevos = filtradas.reduce((acc, f) => acc + f.cantidad_disponible, 0)
  const lotesDistintos = new Set(filtradas.map((f) => f.lote_huevo_id)).size
  const referenciasDistintas = new Set(filtradas.map((f) => f.referencia_id)).size

  // Desglose de lo YA clasificado por referencia — agrupado por el
  // nombre completo (no por tipo+color reconstruido) porque desde que
  // el blanco tiene nombres propios (Revoltura Blanca...), un mismo
  // "tipo" ya no significa lo mismo para los dos colores.
  const desglosePorReferencia = useMemo(() => {
    const grupos = new Map<string, number>()
    for (const f of filtradas) {
      grupos.set(f.referencia_nombre, (grupos.get(f.referencia_nombre) ?? 0) + f.cantidad_disponible)
    }
    return Array.from(grupos.entries()).sort((a, b) => b[1] - a[1])
  }, [filtradas])

  async function abrirKardex(fila: InventarioFila) {
    setKardexDe(fila)
    setCargandoKardex(true)
    setKardex(await listarKardexLote(fila.lote_huevo_id, fila.referencia_id))
    setCargandoKardex(false)
  }

  return (
    <div>
      <PageHeader
        titulo="Inventario de huevo"
        subtitulo="Saldo disponible por bodega, lote y referencia — actualizado con cada recolección, traslado, despacho o venta"
      >
        <StatChip icono={Egg} label="Clasificado" valor={totalHuevos.toLocaleString("es-CO")} />
        <StatChip icono={PackageOpen} label="No clasificado" valor={totalSinClasificar.toLocaleString("es-CO")} />
        <StatChip icono={Layers} label="Lotes" valor={lotesDistintos} />
        <StatChip icono={Boxes} label="Referencias" valor={referenciasDistintas} />
      </PageHeader>

      <Tabs defaultValue="huevo">
        <TabsList>
          <TabsTrigger value="huevo">Huevo</TabsTrigger>
          <TabsTrigger value="cartones">Cartones</TabsTrigger>
        </TabsList>

        <TabsContent value="huevo">
      {desglosePorReferencia.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {desglosePorReferencia.map(([clave, cantidad]) => (
            <div key={clave} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">{clave}: </span>
              <span className="font-semibold tabular-nums">{cantidad.toLocaleString("es-CO")}</span>
            </div>
          ))}
        </div>
      )}

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
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por lote, galpón, referencia o estantería..."
          className="w-72"
        />
        <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {cargando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icono={Warehouse}
            titulo={busqueda ? "Sin resultados" : "No hay inventario disponible"}
            descripcion={
              busqueda
                ? "Ningún registro coincide con la búsqueda."
                : "El inventario se genera automáticamente al registrar recolecciones, recepciones de traslado o ajustes."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {bodegaId === "todas" && <TableHead>Bodega</TableHead>}
                <TableHead>Lote</TableHead>
                <TableHead>Galpón</TableHead>
                <TableHead>Recolectado</TableHead>
                <TableHead>Edad</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Estantería</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead className="text-right">Movimientos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((f) => (
                <TableRow key={f.id}>
                  {bodegaId === "todas" && <TableCell>{f.bodega_nombre}</TableCell>}
                  <TableCell className="font-medium">{f.lote_codigo}</TableCell>
                  <TableCell>{f.galpon_codigo}</TableCell>
                  <TableCell>{formatearFechaColombia(f.fecha_cosecha)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {f.edad_semanas_captura} sem
                      <AlertaRebandejar edadSemanas={f.edad_semanas_captura} />
                    </div>
                  </TableCell>
                  <TableCell>{f.referencia_nombre}</TableCell>
                  <TableCell>{f.anaquel_codigo ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {f.cantidad_disponible.toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="icon" onClick={() => abrirKardex(f)} title="Ver movimientos">
                      <History className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!kardexDe} onOpenChange={(v) => !v && setKardexDe(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Movimientos — lote {kardexDe?.lote_codigo} · {kardexDe?.referencia_nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
            {cargandoKardex ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : kardex.length === 0 ? (
              <EmptyState icono={History} titulo="Sin movimientos registrados" />
            ) : (
              kardex.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{TIPO_MOVIMIENTO_LABEL[m.tipo_movimiento] ?? m.tipo_movimiento}</p>
                    <p className="text-xs text-muted-foreground">{formatearFechaHoraColombia(m.creado_en)}</p>
                    {m.observaciones && <p className="text-xs text-muted-foreground">{m.observaciones}</p>}
                  </div>
                  <span className={`font-semibold tabular-nums ${m.cantidad > 0 ? "text-green-600" : "text-destructive"}`}>
                    {m.cantidad > 0 ? "+" : ""}
                    {m.cantidad.toLocaleString("es-CO")}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="cartones">
          <CartonesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
