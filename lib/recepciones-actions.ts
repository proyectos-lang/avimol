"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface RecepcionResumen {
  id: number
  codigo: string
  bodegaId: number
  bodegaNombre: string
  placaVehiculo: string | null
  fecha: string
  totalCargado: number
  totalRecibido: number
  totalRoto: number
  porcentajeRotura: number
  totalYemas: number
  totalBolsas: number
}

export interface DashboardRecepciones {
  recepciones: RecepcionResumen[]
  totalRecepciones: number
  porcentajeRoturaPromedio: number
  totalYemas: number
  totalBolsas: number
}

const VACIO: DashboardRecepciones = {
  recepciones: [],
  totalRecepciones: 0,
  porcentajeRoturaPromedio: 0,
  totalYemas: 0,
  totalBolsas: 0,
}

// Procesa cada recepción de traslado (orden de descargue ya cerrada) y
// calcula el % de rotura = averías (etapa recepción) / cargado. Cuenta
// tanto las averías de una sola línea (bodegas no-venta, heredadas del
// faltante) como las multi-línea con yema/bolsa (bodegas de venta) —
// ambas quedan en la misma tabla averias_huevo con etapa='recepcion'.
export async function listarDashboardRecepciones(): Promise<DashboardRecepciones> {
  const db = getAvimolDb()

  const { data: ordenes, error: errorOrdenes } = await db
    .from("ordenes_cargue")
    .select("id, codigo, bodega_id, placa_vehiculo, hora_fin_descargue, bodegas(nombre)")
    .eq("tipo_operacion", "descargue_traslado")
    .not("hora_fin_descargue", "is", null)
    .order("hora_fin_descargue", { ascending: false })

  if (errorOrdenes) {
    console.error("[avimol] Error obteniendo recepciones:", errorOrdenes)
    return VACIO
  }
  if (!ordenes || ordenes.length === 0) return VACIO

  const ordenIds = ordenes.map((o) => o.id)

  const { data: detalle } = await db
    .from("ordenes_cargue_detalle")
    .select("orden_cargue_id, cantidad_cargada, cantidad_recibida")
    .in("orden_cargue_id", ordenIds)

  const { data: averias } = await db
    .from("averias_huevo")
    .select("orden_cargue_id, cantidad, cantidad_yemas, cantidad_bolsas_yema")
    .eq("etapa", "recepcion")
    .in("orden_cargue_id", ordenIds)

  const cargadoPorOrden = new Map<number, number>()
  const recibidoPorOrden = new Map<number, number>()
  for (const d of (detalle ?? []) as any[]) {
    cargadoPorOrden.set(d.orden_cargue_id, (cargadoPorOrden.get(d.orden_cargue_id) ?? 0) + d.cantidad_cargada)
    recibidoPorOrden.set(d.orden_cargue_id, (recibidoPorOrden.get(d.orden_cargue_id) ?? 0) + (d.cantidad_recibida ?? 0))
  }

  const rotoPorOrden = new Map<number, number>()
  const yemasPorOrden = new Map<number, number>()
  const bolsasPorOrden = new Map<number, number>()
  for (const a of (averias ?? []) as any[]) {
    if (!a.orden_cargue_id) continue
    rotoPorOrden.set(a.orden_cargue_id, (rotoPorOrden.get(a.orden_cargue_id) ?? 0) + a.cantidad)
    yemasPorOrden.set(a.orden_cargue_id, (yemasPorOrden.get(a.orden_cargue_id) ?? 0) + (a.cantidad_yemas ?? 0))
    bolsasPorOrden.set(a.orden_cargue_id, (bolsasPorOrden.get(a.orden_cargue_id) ?? 0) + (a.cantidad_bolsas_yema ?? 0))
  }

  const recepciones: RecepcionResumen[] = ordenes.map((o: any) => {
    const totalCargado = cargadoPorOrden.get(o.id) ?? 0
    const totalRecibido = recibidoPorOrden.get(o.id) ?? 0
    const totalRoto = rotoPorOrden.get(o.id) ?? 0
    return {
      id: o.id,
      codigo: o.codigo,
      bodegaId: o.bodega_id,
      bodegaNombre: o.bodegas?.nombre ?? "",
      placaVehiculo: o.placa_vehiculo,
      fecha: o.hora_fin_descargue,
      totalCargado,
      totalRecibido,
      totalRoto,
      porcentajeRotura: totalCargado > 0 ? Math.round((totalRoto / totalCargado) * 1000) / 10 : 0,
      totalYemas: yemasPorOrden.get(o.id) ?? 0,
      totalBolsas: bolsasPorOrden.get(o.id) ?? 0,
    }
  })

  const totalCargadoGlobal = recepciones.reduce((acc, r) => acc + r.totalCargado, 0)
  const totalRotoGlobal = recepciones.reduce((acc, r) => acc + r.totalRoto, 0)

  return {
    recepciones,
    totalRecepciones: recepciones.length,
    porcentajeRoturaPromedio: totalCargadoGlobal > 0 ? Math.round((totalRotoGlobal / totalCargadoGlobal) * 1000) / 10 : 0,
    totalYemas: recepciones.reduce((acc, r) => acc + r.totalYemas, 0),
    totalBolsas: recepciones.reduce((acc, r) => acc + r.totalBolsas, 0),
  }
}
