"use server"

import { fechaColombiaHoy } from "@/lib/date-utils"
import { obtenerIndicadoresAves, obtenerVentasPuntoVenta, obtenerAverias } from "@/lib/indicadores-actions"
import { listarGalpones } from "@/lib/galpones-actions"
import { obtenerIndicadoresRecoleccion, obtenerIndicadorCartones } from "@/lib/indicadores-recoleccion-actions"
import { listarRecoleccionPorDia } from "@/lib/recoleccion-actions"
import { listarAveriasProduccion } from "@/lib/averias-produccion-actions"
import { obtenerTotalSinClasificar } from "@/lib/inventario-actions"
import { listarDashboardRecepciones, listarRecepcionesPendientesClasificar } from "@/lib/recepciones-actions"
import { listarLlegadasDisponibles } from "@/lib/vehiculos-actions"
import { listarAverias } from "@/lib/averias-actions"
import { listarInventarioCartones } from "@/lib/cartones-actions"
import { listarPedidos } from "@/lib/pedidos-actions"
import { listarClientes } from "@/lib/clientes-actions"
import type { InsightAlerta, InsightKpi, InsightsModulo } from "@/lib/insights-tipos"

const CARTONES_UMBRAL_BAJO = 50

const num = (n: number) => n.toLocaleString("es-CO")
const money = (n: number) => `$${n.toLocaleString("es-CO")}`

async function insightsAves(): Promise<InsightsModulo> {
  const [aves, galpones] = await Promise.all([obtenerIndicadoresAves(), listarGalpones()])
  const activos = galpones.filter((g) => g.activo).length
  const inactivos = galpones.length - activos

  const kpis: InsightKpi[] = [
    { iconoKey: "bird", label: "Aves activas", valor: num(aves.utilizadaTotal) },
    { iconoKey: "gauge", label: "Ocupación", valor: `${aves.porcentajeOcupacionTotal}%` },
    { iconoKey: "alerta", label: "Mortalidad", valor: `${aves.tasaMortalidadTotal}%` },
    { iconoKey: "edad", label: "Edad prom.", valor: `${aves.edadPromedioTotal} sem` },
  ]

  const alertas: InsightAlerta[] = [
    {
      iconoKey: "warehouse",
      texto: `${activos} galpones activos${inactivos ? ` · ${inactivos} inactivos` : ""}`,
      tono: "info",
      href: "/galpones",
    },
  ]
  const llenos = aves.porGalpon.filter((g) => g.porcentajeOcupacion > 95).length
  if (llenos > 0) {
    alertas.push({
      iconoKey: "alerta",
      texto: `${llenos} galpón(es) sobre 95% de ocupación`,
      tono: "advertencia",
      href: "/aves/indicadores",
    })
  }
  return { kpis, alertas }
}

async function insightsRecoleccion(): Promise<InsightsModulo> {
  const hoy = fechaColombiaHoy()
  const [rec, cartones, porDia, averiasProd] = await Promise.all([
    obtenerIndicadoresRecoleccion({}),
    obtenerIndicadorCartones({}),
    listarRecoleccionPorDia(),
    listarAveriasProduccion({}),
  ])

  const kpis: InsightKpi[] = [
    { iconoKey: "egg", label: "Recolectado", valor: num(rec.totalRecolectado) },
    { iconoKey: "ok", label: "Buenos", valor: num(rec.totalBuenos) },
    { iconoKey: "alerta", label: "% averías", valor: `${rec.porcentajeAveriasTotal}%` },
    { iconoKey: "cartones", label: "Cartones", valor: num(cartones.totalGeneral) },
  ]

  const alertas: InsightAlerta[] = []
  const bajoHoy = porDia.filter((r) => r.fecha_cosecha === hoy && r.cumple_minimo === false).length
  if (bajoHoy > 0) {
    alertas.push({
      iconoKey: "alerta",
      texto: `${bajoHoy} galpón(es) bajo el mínimo hoy`,
      tono: "advertencia",
      href: "/recoleccion/historial",
    })
  }
  const pendientes = averiasProd.filter((a) => a.estado === "pendiente").length
  if (pendientes > 0) {
    alertas.push({
      iconoKey: "alerta",
      texto: `${pendientes} avería(s) por aprobar`,
      tono: "info",
      href: "/recoleccion/averias",
    })
  }
  return { kpis, alertas }
}

async function insightsLogistica(): Promise<InsightsModulo> {
  const [sinClasif, recep, pendClasif, vehiculos, averiasBodega, cartones] = await Promise.all([
    obtenerTotalSinClasificar(null),
    listarDashboardRecepciones(),
    listarRecepcionesPendientesClasificar(),
    listarLlegadasDisponibles(),
    listarAverias({}),
    listarInventarioCartones(null),
  ])

  const kpis: InsightKpi[] = [
    { iconoKey: "sinClasificar", label: "Sin clasificar", valor: num(sinClasif) },
    { iconoKey: "recepcion", label: "Recepciones", valor: num(recep.totalRecepciones) },
    { iconoKey: "gota", label: "% rotura", valor: `${recep.porcentajeRoturaPromedio}%` },
    { iconoKey: "cartones", label: "Cartones", valor: num(cartones.reduce((a, c) => a + c.cantidad_disponible, 0)) },
  ]

  const alertas: InsightAlerta[] = []
  if (pendClasif.length > 0) {
    alertas.push({
      iconoKey: "recepcion",
      texto: `${pendClasif.length} recepción(es) sin clasificar`,
      tono: "advertencia",
      href: "/recepciones",
    })
  }
  if (vehiculos.length > 0) {
    alertas.push({
      iconoKey: "vehiculo",
      texto: `${vehiculos.length} vehículo(s) esperando`,
      tono: "info",
      href: "/vehiculos",
    })
  }
  const avPend = averiasBodega.filter((a) => a.estado === "pendiente").length
  if (avPend > 0) {
    alertas.push({ iconoKey: "alerta", texto: `${avPend} avería(s) por aprobar`, tono: "info", href: "/averias" })
  }
  const cartonesBajos = cartones.filter((c) => c.cantidad_disponible < CARTONES_UMBRAL_BAJO).length
  if (cartonesBajos > 0) {
    alertas.push({
      iconoKey: "cartones",
      texto: `Cartones bajos en ${cartonesBajos} bodega(s)`,
      tono: "advertencia",
      href: "/inventario",
    })
  }
  return { kpis, alertas }
}

async function insightsComercial(): Promise<InsightsModulo> {
  const hoy = fechaColombiaHoy()
  const [ventasHoy, pedidos, clientes] = await Promise.all([
    obtenerVentasPuntoVenta(hoy, hoy),
    listarPedidos(),
    listarClientes(true),
  ])

  const kpis: InsightKpi[] = [
    { iconoKey: "dinero", label: "Ventas hoy", valor: money(ventasHoy.totalIngresos) },
    { iconoKey: "tienda", label: "Unidades hoy", valor: num(ventasHoy.totalUnidades) },
    { iconoKey: "cliente", label: "Clientes", valor: num(clientes.length) },
    { iconoKey: "pedido", label: "Pedidos", valor: num(pedidos.length) },
  ]

  const alertas: InsightAlerta[] = []
  const porDespachar = pedidos.filter((p) => p.estado === "pendiente" || p.estado === "en_picking").length
  if (porDespachar > 0) {
    alertas.push({
      iconoKey: "pedido",
      texto: `${porDespachar} pedido(s) por despachar`,
      tono: "advertencia",
      href: "/despachos",
    })
  }
  return { kpis, alertas }
}

async function insightsIndicadores(): Promise<InsightsModulo> {
  const hoy = fechaColombiaHoy()
  const [ventasHoy, averias, sinClasif, aves] = await Promise.all([
    obtenerVentasPuntoVenta(hoy, hoy),
    obtenerAverias(),
    obtenerTotalSinClasificar(null),
    obtenerIndicadoresAves(),
  ])

  const kpis: InsightKpi[] = [
    { iconoKey: "dinero", label: "Ventas hoy", valor: money(ventasHoy.totalIngresos) },
    { iconoKey: "bird", label: "Aves activas", valor: num(aves.utilizadaTotal) },
    { iconoKey: "sinClasificar", label: "Sin clasificar", valor: num(sinClasif) },
    { iconoKey: "alerta", label: "Averías", valor: num(averias.total) },
  ]
  return { kpis, alertas: [] }
}

// Dispatcher: la banda de cada módulo se arma según el grupo del nav al que
// pertenece la ruta activa (ver resolverModuloPorRuta en lib/dashboard-data.ts).
export async function obtenerInsightsModulo(grupoKey: string): Promise<InsightsModulo> {
  switch (grupoKey) {
    case "aves":
      return insightsAves()
    case "cosecha":
      return insightsRecoleccion()
    case "logistica":
      return insightsLogistica()
    case "comercial":
      return insightsComercial()
    case "indicadores":
      return insightsIndicadores()
    default:
      return { kpis: [], alertas: [] }
  }
}

// Tablero de mando del inicio: KPIs vivos de todo el negocio + alertas
// cruzadas de los módulos operativos.
export async function obtenerInsightsInicio(): Promise<InsightsModulo> {
  const hoy = fechaColombiaHoy()
  const [aves, recHoy, ventasHoy, pendClasif, pedidos, averiasProd, averiasBodega, porDia] = await Promise.all([
    obtenerIndicadoresAves(),
    obtenerIndicadoresRecoleccion({ fechaInicio: hoy, fechaFin: hoy }),
    obtenerVentasPuntoVenta(hoy, hoy),
    listarRecepcionesPendientesClasificar(),
    listarPedidos(),
    listarAveriasProduccion({}),
    listarAverias({}),
    listarRecoleccionPorDia(),
  ])

  const kpis: InsightKpi[] = [
    { iconoKey: "bird", label: "Aves activas", valor: num(aves.utilizadaTotal) },
    { iconoKey: "egg", label: "Recolección hoy", valor: num(recHoy.totalRecolectado) },
    { iconoKey: "dinero", label: "Ventas hoy", valor: money(ventasHoy.totalIngresos) },
    { iconoKey: "gauge", label: "Ocupación", valor: `${aves.porcentajeOcupacionTotal}%` },
  ]

  const alertas: InsightAlerta[] = []
  if (pendClasif.length > 0) {
    alertas.push({
      iconoKey: "recepcion",
      texto: `${pendClasif.length} recepción(es) sin clasificar`,
      tono: "advertencia",
      href: "/recepciones",
    })
  }
  const porDespachar = pedidos.filter((p) => p.estado === "pendiente" || p.estado === "en_picking").length
  if (porDespachar > 0) {
    alertas.push({
      iconoKey: "pedido",
      texto: `${porDespachar} pedido(s) por despachar`,
      tono: "advertencia",
      href: "/despachos",
    })
  }
  const avPend =
    averiasProd.filter((a) => a.estado === "pendiente").length +
    averiasBodega.filter((a) => a.estado === "pendiente").length
  if (avPend > 0) {
    alertas.push({ iconoKey: "alerta", texto: `${avPend} avería(s) por aprobar`, tono: "info", href: "/recoleccion/averias" })
  }
  const bajoHoy = porDia.filter((r) => r.fecha_cosecha === hoy && r.cumple_minimo === false).length
  if (bajoHoy > 0) {
    alertas.push({
      iconoKey: "alerta",
      texto: `${bajoHoy} galpón(es) bajo el mínimo hoy`,
      tono: "advertencia",
      href: "/recoleccion/historial",
    })
  }
  if (alertas.length === 0) {
    alertas.push({ iconoKey: "ok", texto: "Todo en orden — sin alertas pendientes", tono: "ok" })
  }
  return { kpis, alertas }
}
