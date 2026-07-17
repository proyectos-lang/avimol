"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Download } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  obtenerInventarioActual,
  obtenerVentasPuntoVenta,
  obtenerPedidosPeriodo,
  obtenerAverias,
  obtenerTiemposLogisticos,
  obtenerProduccionPorGalpon,
  obtenerIndicadoresAves,
  type InventarioActualFila,
  type VentasResumen,
  type AveriasPorEtapa,
  type AveriasPorTipo,
  type AveriasPorEtapaYTipo,
  type TiemposLogisticos,
  type ProduccionGalpon,
  type IndicadoresAves,
} from "@/lib/indicadores-actions"
import { exportarIndicadoresExcel } from "@/lib/export-excel"
import { VentasPorReferenciaChart, PedidosPorReferenciaChart, AveriasPorEtapaChart, ProduccionPorGalponChart } from "@/components/indicadores/charts"

const ETAPA_LABEL: Record<string, string> = {
  recoleccion: "Recolección",
  clasificacion: "Clasificación",
  transporte: "Transporte",
  despacho: "Despacho",
  recepcion: "Recepción",
}

const TIPO_OPERACION_LABEL: Record<string, string> = {
  cargue_traslado: "Cargue (traslado)",
  descargue_traslado: "Descargue (traslado)",
  cargue_despacho: "Cargue (despacho)",
}

// Rango del mismo tamaño inmediatamente anterior al seleccionado, para
// el comparativo "este periodo vs. el anterior".
function calcularPeriodoAnterior(fechaInicio: string, fechaFin: string): { inicio: string; fin: string } {
  const inicio = new Date(fechaInicio + "T00:00:00")
  const fin = new Date(fechaFin + "T00:00:00")
  const duracionMs = fin.getTime() - inicio.getTime()

  const finAnterior = new Date(inicio.getTime() - 24 * 60 * 60 * 1000)
  const inicioAnterior = new Date(finAnterior.getTime() - duracionMs)

  const aISO = (d: Date) => d.toISOString().slice(0, 10)
  return { inicio: aISO(inicioAnterior), fin: aISO(finAnterior) }
}

function variacionPct(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null
  return Math.round(((actual - anterior) / anterior) * 1000) / 10
}

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">vs. periodo anterior: n/d</span>
  const subio = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${subio ? "text-green-700" : "text-destructive"}`}>
      {subio ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(pct)}% vs. periodo anterior
    </span>
  )
}

function StatCard({ titulo, valor, deltaPct }: { titulo: string; valor: string; deltaPct?: number | null }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{titulo}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-3xl">{valor}</p>
      {deltaPct !== undefined && <div className="mt-1">
        <Delta pct={deltaPct} />
      </div>}
    </div>
  )
}

function TablaDesglose({
  filas,
  columnaNombre,
  claveNombre,
}: {
  filas: { unidades: number; ingresos: number; [k: string]: any }[]
  columnaNombre: string
  claveNombre: string
}) {
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">Sin datos.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{columnaNombre}</TableHead>
            <TableHead>Unidades</TableHead>
            <TableHead>Ingresos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f, i) => (
            <TableRow key={i}>
              <TableCell>{f[claveNombre] || "—"}</TableCell>
              <TableCell>{f.unidades.toLocaleString("es-CO")}</TableCell>
              <TableCell>{f.ingresos > 0 ? `$${f.ingresos.toLocaleString("es-CO")}` : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function IndicadoresView() {
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")

  const [inventario, setInventario] = useState<InventarioActualFila[]>([])
  const [ventasPdv, setVentasPdv] = useState<VentasResumen | null>(null)
  const [ventasPdvAnterior, setVentasPdvAnterior] = useState<VentasResumen | null>(null)
  const [pedidos, setPedidos] = useState<VentasResumen | null>(null)
  const [pedidosAnterior, setPedidosAnterior] = useState<VentasResumen | null>(null)
  const [averias, setAverias] = useState<{
    porEtapa: AveriasPorEtapa[]
    porTipo: AveriasPorTipo[]
    porEtapaYTipo: AveriasPorEtapaYTipo[]
    total: number
  } | null>(null)
  const [tiempos, setTiempos] = useState<TiemposLogisticos[]>([])
  const [produccion, setProduccion] = useState<ProduccionGalpon[]>([])
  const [aves, setAves] = useState<IndicadoresAves | null>(null)
  const [cargando, setCargando] = useState(true)

  async function cargarTodo() {
    setCargando(true)

    const tienePeriodo = !!fechaInicio && !!fechaFin
    const periodoAnterior = tienePeriodo ? calcularPeriodoAnterior(fechaInicio, fechaFin) : null

    const [inv, vpd, ped, ave, tie, prod, avesData, vpdAnt, pedAnt] = await Promise.all([
      obtenerInventarioActual(),
      obtenerVentasPuntoVenta(fechaInicio || undefined, fechaFin || undefined),
      obtenerPedidosPeriodo(fechaInicio || undefined, fechaFin || undefined),
      obtenerAverias(),
      obtenerTiemposLogisticos(),
      obtenerProduccionPorGalpon(),
      obtenerIndicadoresAves(fechaInicio || undefined, fechaFin || undefined),
      periodoAnterior ? obtenerVentasPuntoVenta(periodoAnterior.inicio, periodoAnterior.fin) : Promise.resolve(null),
      periodoAnterior ? obtenerPedidosPeriodo(periodoAnterior.inicio, periodoAnterior.fin) : Promise.resolve(null),
    ])
    setInventario(inv)
    setVentasPdv(vpd)
    setPedidos(ped)
    setAverias(ave)
    setTiempos(tie)
    setProduccion(prod)
    setAves(avesData)
    setVentasPdvAnterior(vpdAnt)
    setPedidosAnterior(pedAnt)
    setCargando(false)
  }

  useEffect(() => {
    cargarTodo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onExportar() {
    exportarIndicadoresExcel(
      [
        {
          nombre: "Inventario actual",
          filas: inventario.map((i) => ({
            Bodega: i.bodegaNombre,
            Referencia: i.referenciaNombre,
            Cantidad: i.cantidad,
            "Edad promedio (semanas)": i.edadPromedioSemanas,
          })),
        },
        {
          nombre: "Ventas PDV por referencia",
          filas: (ventasPdv?.porReferencia ?? []).map((r) => ({
            Referencia: r.referenciaNombre,
            Unidades: r.unidades,
            Ingresos: r.ingresos,
          })),
        },
        {
          nombre: "Pedidos por referencia",
          filas: (pedidos?.porReferencia ?? []).map((r) => ({
            Referencia: r.referenciaNombre,
            Unidades: r.unidades,
            Ingresos: r.ingresos,
          })),
        },
        {
          nombre: "Averías por etapa",
          filas: (averias?.porEtapa ?? []).map((a) => ({
            Etapa: ETAPA_LABEL[a.etapa] ?? a.etapa,
            Cantidad: a.cantidad,
          })),
        },
        {
          nombre: "Tiempos logísticos",
          filas: tiempos.map((t) => ({
            Operación: TIPO_OPERACION_LABEL[t.tipoOperacion] ?? t.tipoOperacion,
            Órdenes: t.cantidadOrdenes,
            "Espera vehículo (min)": t.esperaVehiculoPromedioMin ?? "",
            "Duración cargue (min)": t.duracionCarguePromedioMin ?? "",
            "Duración descargue (min)": t.duracionDescarguePromedioMin ?? "",
          })),
        },
        {
          nombre: "Producción por galpón",
          filas: produccion.map((p) => ({
            Galpón: `${p.galponCodigo} — ${p.galponNombre}`,
            "Cantidad recolectada": p.cantidadTotal,
            "Edad promedio (semanas)": p.edadPromedioSemanas,
          })),
        },
        {
          nombre: "Aves por galpón",
          filas: (aves?.porGalpon ?? []).map((g) => ({
            Galpón: `${g.galponCodigo} — ${g.galponNombre}`,
            Capacidad: g.capacidad ?? 0,
            Utilizada: g.utilizada,
            "% ocupación": g.porcentajeOcupacion,
            Mortalidad: g.mortalidad,
            "Tasa mortalidad (%)": g.tasaMortalidad,
            Sacrificio: g.sacrificio,
            "Tasa sacrificio (%)": g.tasaSacrificio,
            "Edad promedio (semanas)": g.edadPromedioSemanas,
          })),
        },
      ],
      `avimol-indicadores-${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  }

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>

  const tieneComparativo = !!fechaInicio && !!fechaFin

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Indicadores</h1>
        <Button variant="outline" className="gap-2" onClick={onExportar}>
          <Download className="h-4 w-4" />
          Exportar a Excel
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>
          <Button onClick={cargarTodo}>Aplicar</Button>
          <p className="text-xs text-muted-foreground">
            El rango de fechas aplica a Ventas y Pedidos, y habilita el comparativo contra el periodo anterior de
            igual duración. El resto de indicadores son acumulados históricos.
          </p>
        </CardContent>
      </Card>

      <h2 className="mb-2 text-lg font-semibold">Ventas — Punto de venta</h2>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          titulo="Unidades vendidas"
          valor={(ventasPdv?.totalUnidades ?? 0).toLocaleString("es-CO")}
          deltaPct={tieneComparativo ? variacionPct(ventasPdv?.totalUnidades ?? 0, ventasPdvAnterior?.totalUnidades ?? 0) : undefined}
        />
        <StatCard
          titulo="Ingresos"
          valor={`$${(ventasPdv?.totalIngresos ?? 0).toLocaleString("es-CO")}`}
          deltaPct={tieneComparativo ? variacionPct(ventasPdv?.totalIngresos ?? 0, ventasPdvAnterior?.totalIngresos ?? 0) : undefined}
        />
        <StatCard
          titulo="Precio promedio"
          valor={ventasPdv?.precioPromedio != null ? `$${ventasPdv.precioPromedio.toLocaleString("es-CO")}` : "—"}
        />
      </div>
      <div className="mb-4">
        <VentasPorReferenciaChart datos={ventasPdv?.porReferencia ?? []} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="mb-1 text-sm font-medium">Por color</p>
          <TablaDesglose filas={ventasPdv?.porColor ?? []} columnaNombre="Color" claveNombre="color" />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Top clientes</p>
          <TablaDesglose filas={ventasPdv?.porCliente ?? []} columnaNombre="Cliente" claveNombre="clienteNombre" />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Por bodega</p>
          <TablaDesglose filas={ventasPdv?.porBodega ?? []} columnaNombre="Bodega" claveNombre="bodegaNombre" />
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Pedidos de clientes</h2>
      <p className="mb-2 text-xs text-muted-foreground">Refleja lo pedido, no necesariamente lo ya despachado.</p>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          titulo="Unidades pedidas"
          valor={(pedidos?.totalUnidades ?? 0).toLocaleString("es-CO")}
          deltaPct={tieneComparativo ? variacionPct(pedidos?.totalUnidades ?? 0, pedidosAnterior?.totalUnidades ?? 0) : undefined}
        />
        <StatCard
          titulo="Valor pedido"
          valor={`$${(pedidos?.totalIngresos ?? 0).toLocaleString("es-CO")}`}
          deltaPct={tieneComparativo ? variacionPct(pedidos?.totalIngresos ?? 0, pedidosAnterior?.totalIngresos ?? 0) : undefined}
        />
        <StatCard
          titulo="Precio promedio"
          valor={pedidos?.precioPromedio != null ? `$${pedidos.precioPromedio.toLocaleString("es-CO")}` : "—"}
        />
      </div>
      <div className="mb-4">
        <PedidosPorReferenciaChart datos={pedidos?.porReferencia ?? []} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="mb-1 text-sm font-medium">Por color</p>
          <TablaDesglose filas={pedidos?.porColor ?? []} columnaNombre="Color" claveNombre="color" />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Top clientes</p>
          <TablaDesglose filas={pedidos?.porCliente ?? []} columnaNombre="Cliente" claveNombre="clienteNombre" />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Por bodega</p>
          <TablaDesglose filas={pedidos?.porBodega ?? []} columnaNombre="Bodega" claveNombre="bodegaNombre" />
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Averías ({averias?.total.toLocaleString("es-CO") ?? 0} en total)</h2>
      <div className="mb-6">
        <AveriasPorEtapaChart
          datos={(averias?.porEtapaYTipo ?? []).map((a) => ({ ...a, etapa: ETAPA_LABEL[a.etapa] ?? a.etapa }))}
        />
      </div>

      <h2 className="mb-2 text-lg font-semibold">Tiempos logísticos</h2>
      <div className="mb-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operación</TableHead>
              <TableHead>Órdenes</TableHead>
              <TableHead>Espera vehículo (min)</TableHead>
              <TableHead>Duración cargue (min)</TableHead>
              <TableHead>Duración descargue (min)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiempos.map((t) => (
              <TableRow key={t.tipoOperacion}>
                <TableCell>{TIPO_OPERACION_LABEL[t.tipoOperacion] ?? t.tipoOperacion}</TableCell>
                <TableCell>{t.cantidadOrdenes}</TableCell>
                <TableCell>{t.esperaVehiculoPromedioMin ?? "—"}</TableCell>
                <TableCell>{t.duracionCarguePromedioMin ?? "—"}</TableCell>
                <TableCell>{t.duracionDescarguePromedioMin ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Producción por galpón</h2>
      <div className="mb-6">
        <ProduccionPorGalponChart datos={produccion} />
      </div>
      <div className="mb-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Galpón</TableHead>
              <TableHead>Cantidad recolectada</TableHead>
              <TableHead>Edad promedio (semanas)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produccion.map((p) => (
              <TableRow key={p.galponCodigo}>
                <TableCell>
                  {p.galponCodigo} — {p.galponNombre}
                </TableCell>
                <TableCell>{p.cantidadTotal.toLocaleString("es-CO")}</TableCell>
                <TableCell>{p.edadPromedioSemanas}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Aves</h2>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          titulo="Capacidad vs. utilizada"
          valor={`${(aves?.utilizadaTotal ?? 0).toLocaleString("es-CO")} / ${(aves?.capacidadTotal ?? 0).toLocaleString("es-CO")}`}
        />
        <StatCard titulo="% ocupación total" valor={`${aves?.porcentajeOcupacionTotal ?? 0}%`} />
        <StatCard titulo="Edad promedio total" valor={`${aves?.edadPromedioTotal ?? 0} sem`} />
        <StatCard
          titulo="Mortalidad total"
          valor={`${(aves?.mortalidadTotal ?? 0).toLocaleString("es-CO")} (${aves?.tasaMortalidadTotal ?? 0}%)`}
        />
        <StatCard
          titulo="Sacrificio total"
          valor={`${(aves?.sacrificioTotal ?? 0).toLocaleString("es-CO")} (${aves?.tasaSacrificioTotal ?? 0}%)`}
        />
      </div>
      <div className="mb-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Galpón</TableHead>
              <TableHead className="text-right">Capacidad</TableHead>
              <TableHead className="text-right">Utilizada</TableHead>
              <TableHead className="text-right">% ocupación</TableHead>
              <TableHead className="text-right">Mortalidad</TableHead>
              <TableHead className="text-right">Sacrificio</TableHead>
              <TableHead className="text-right">Edad promedio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(aves?.porGalpon ?? []).map((g) => (
              <TableRow key={g.galponId}>
                <TableCell>
                  {g.galponCodigo} — {g.galponNombre}
                </TableCell>
                <TableCell className="text-right tabular-nums">{(g.capacidad ?? 0).toLocaleString("es-CO")}</TableCell>
                <TableCell className="text-right tabular-nums">{g.utilizada.toLocaleString("es-CO")}</TableCell>
                <TableCell className="text-right tabular-nums">{g.porcentajeOcupacion}%</TableCell>
                <TableCell className="text-right tabular-nums">
                  {g.mortalidad.toLocaleString("es-CO")} ({g.tasaMortalidad}%)
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {g.sacrificio.toLocaleString("es-CO")} ({g.tasaSacrificio}%)
                </TableCell>
                <TableCell className="text-right tabular-nums">{g.edadPromedioSemanas} sem</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Inventario actual</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bodega</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Edad promedio (semanas)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventario.map((i, idx) => (
              <TableRow key={idx}>
                <TableCell>{i.bodegaNombre}</TableCell>
                <TableCell>{i.referenciaNombre}</TableCell>
                <TableCell>{i.cantidad.toLocaleString("es-CO")}</TableCell>
                <TableCell>{i.edadPromedioSemanas}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
