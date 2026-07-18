"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { fechaHoraColombiaISO } from "@/lib/date-utils"

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

export interface LineaRecepcionPendiente {
  detalleId: number
  loteHuevoCodigo: string
  referenciaId: number
  referenciaNombre: string
  cantidadRecibida: number
}

export interface RecepcionPendienteClasificar {
  ordenId: number
  codigo: string
  bodegaId: number
  bodegaNombre: string
  placaVehiculo: string | null
  horaFinDescargue: string
  lineas: LineaRecepcionPendiente[]
}

// Recepciones ya descargadas (cantidad_recibida confirmada) pero cuyo
// desglose bueno/roto/picado/partido todavía no se ha declarado — el
// inventario de esas líneas sigue sin acreditarse hasta que se procesen
// aquí (ver confirmarClasificacionRecepcion).
export async function listarRecepcionesPendientesClasificar(): Promise<RecepcionPendienteClasificar[]> {
  const db = getAvimolDb()

  const { data: ordenes, error } = await db
    .from("ordenes_cargue")
    .select("id, codigo, bodega_id, placa_vehiculo, hora_fin_descargue, bodegas(nombre)")
    .eq("tipo_operacion", "descargue_traslado")
    .not("hora_fin_descargue", "is", null)
    .is("hora_clasificacion_averia", null)
    .order("hora_fin_descargue", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando recepciones pendientes de clasificar:", error)
    return []
  }
  if (!ordenes || ordenes.length === 0) return []

  const ordenIds = ordenes.map((o) => o.id)
  const { data: detalle } = await db
    .from("ordenes_cargue_detalle")
    .select("id, orden_cargue_id, cantidad_recibida, referencia_huevo_id, referencias_huevo(nombre), lotes_huevo(codigo)")
    .in("orden_cargue_id", ordenIds)

  const porOrden = new Map<number, LineaRecepcionPendiente[]>()
  for (const d of (detalle ?? []) as any[]) {
    const lineas = porOrden.get(d.orden_cargue_id) ?? []
    lineas.push({
      detalleId: d.id,
      loteHuevoCodigo: d.lotes_huevo?.codigo ?? "",
      referenciaId: d.referencia_huevo_id,
      referenciaNombre: d.referencias_huevo?.nombre ?? "",
      cantidadRecibida: d.cantidad_recibida ?? 0,
    })
    porOrden.set(d.orden_cargue_id, lineas)
  }

  return ordenes.map((o: any) => ({
    ordenId: o.id,
    codigo: o.codigo,
    bodegaId: o.bodega_id,
    bodegaNombre: o.bodegas?.nombre ?? "",
    placaVehiculo: o.placa_vehiculo,
    horaFinDescargue: o.hora_fin_descargue,
    lineas: porOrden.get(o.id) ?? [],
  }))
}

export interface LineaClasificacionAveria {
  detalleId: number
  buenos: number
  rotosSinRecuperar: number
  picados: number
  rotosConYema: number
}

// Reparte lo recibido en cada línea entre bueno/roto/picado/partido: los
// buenos entran a inventario_huevo (misma lógica que antes vivía en
// confirmarFinDescargue), y el resto queda como averías etapa='recepcion'
// visibles en /averias. Marca la orden como clasificada al terminar.
export async function confirmarClasificacionRecepcion(
  ordenId: number,
  lineas: LineaClasificacionAveria[],
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const { data: orden, error: errorOrden } = await db
    .from("ordenes_cargue")
    .select("id, bodega_id, hora_fin_descargue, hora_clasificacion_averia")
    .eq("id", ordenId)
    .maybeSingle()

  if (errorOrden || !orden) return { success: false, message: "Orden no encontrada" }
  if (!orden.hora_fin_descargue) return { success: false, message: "Esta recepción todavía no ha sido descargada" }
  if (orden.hora_clasificacion_averia) return { success: false, message: "Esta recepción ya fue clasificada" }

  const { data: detalleData, error: errorDetalle } = await db
    .from("ordenes_cargue_detalle")
    .select("id, lote_huevo_id, referencia_huevo_id, cantidad_recibida")
    .eq("orden_cargue_id", ordenId)

  if (errorDetalle || !detalleData) return { success: false, message: "No se pudo leer el detalle de la orden" }

  const detallePorId = new Map(detalleData.map((d: any) => [d.id, d]))

  for (const l of lineas) {
    const d = detallePorId.get(l.detalleId)
    if (!d) return { success: false, message: "Línea de recepción no encontrada" }
    const suma = l.buenos + l.rotosSinRecuperar + l.picados + l.rotosConYema
    if (suma !== (d.cantidad_recibida ?? 0)) {
      return {
        success: false,
        message: `La clasificación de una línea (${suma}) no coincide con lo recibido (${d.cantidad_recibida ?? 0})`,
      }
    }
  }

  for (const l of lineas) {
    const d = detallePorId.get(l.detalleId)!

    if (l.buenos > 0) {
      const { data: existente } = await db
        .from("inventario_huevo")
        .select("id, cantidad_disponible")
        .eq("bodega_id", orden.bodega_id)
        .eq("lote_huevo_id", d.lote_huevo_id)
        .eq("referencia_huevo_id", d.referencia_huevo_id)
        .is("anaquel_id", null)
        .maybeSingle()

      if (existente) {
        await db
          .from("inventario_huevo")
          .update({
            cantidad_disponible: existente.cantidad_disponible + l.buenos,
            actualizado_en: fechaHoraColombiaISO(),
          })
          .eq("id", existente.id)
      } else {
        await db.from("inventario_huevo").insert({
          bodega_id: orden.bodega_id,
          lote_huevo_id: d.lote_huevo_id,
          referencia_huevo_id: d.referencia_huevo_id,
          anaquel_id: null,
          cantidad_disponible: l.buenos,
        })
      }

      await db.from("movimientos_inventario_huevo").insert({
        bodega_id: orden.bodega_id,
        lote_huevo_id: d.lote_huevo_id,
        referencia_huevo_id: d.referencia_huevo_id,
        anaquel_id: null,
        tipo_movimiento: "entrada_recepcion_traslado",
        cantidad: l.buenos,
        orden_cargue_id: ordenId,
        usuario_id: usuario?.id ?? null,
        creado_en: fechaHoraColombiaISO(),
      })
    }

    const averiasLinea: { tipo_averia: string; cantidad: number }[] = []
    if (l.rotosSinRecuperar > 0) averiasLinea.push({ tipo_averia: "roto_sin_recuperar", cantidad: l.rotosSinRecuperar })
    if (l.picados > 0) averiasLinea.push({ tipo_averia: "picado", cantidad: l.picados })
    if (l.rotosConYema > 0) averiasLinea.push({ tipo_averia: "roto_con_yema", cantidad: l.rotosConYema })

    if (averiasLinea.length > 0) {
      await db.from("averias_huevo").insert(
        averiasLinea.map((a) => ({
          lote_huevo_id: d.lote_huevo_id,
          referencia_huevo_id: d.referencia_huevo_id,
          etapa: "recepcion",
          tipo_averia: a.tipo_averia,
          cantidad: a.cantidad,
          orden_cargue_id: ordenId,
          usuario_id: usuario?.id ?? null,
        })),
      )
    }
  }

  await db.from("ordenes_cargue").update({ hora_clasificacion_averia: fechaHoraColombiaISO() }).eq("id", ordenId)

  return { success: true }
}
