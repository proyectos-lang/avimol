"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { fechaHoraColombiaISO } from "@/lib/date-utils"

const ETAPA_LABEL: Record<string, string> = {
  recoleccion: "Recolección",
  clasificacion: "Clasificación",
  transporte: "Transporte",
  despacho: "Despacho",
  recepcion: "Recepción",
}

export interface AveriaFila {
  id: number
  etapa: string
  origenLabel: string
  tipoAveria: string
  cantidad: number
  loteHuevoCodigo: string
  referenciaNombre: string | null
  bodegaId: number | null
  bodegaNombre: string | null
  fecha: string
  observaciones: string | null
  procesadaEnYemas: boolean
  estado: string
}

export async function listarAverias(filtros: {
  bodegaId?: number | null
  etapa?: string | null
}): Promise<AveriaFila[]> {
  const db = getAvimolDb()

  let query = db
    .from("averias_huevo")
    .select(
      `id, etapa, tipo_averia, cantidad, fecha, observaciones, procesamiento_yema_id, estado,
       lotes_huevo(codigo, bodega_id),
       referencias_huevo(nombre),
       ordenes_cargue(bodega_id),
       clasificaciones(bodega_id)`,
    )
    .order("fecha", { ascending: false })

  if (filtros.etapa) query = query.eq("etapa", filtros.etapa)

  const { data, error } = await query
  if (error) {
    console.error("[avimol] Error listando averías:", error)
    return []
  }

  const bodegaIds = new Set<number>()
  for (const fila of (data ?? []) as any[]) {
    const bodegaId = fila.ordenes_cargue?.bodega_id ?? fila.clasificaciones?.bodega_id ?? fila.lotes_huevo?.bodega_id ?? null
    if (bodegaId) bodegaIds.add(bodegaId)
  }

  const { data: bodegas } = await db.from("bodegas").select("id, nombre").in("id", Array.from(bodegaIds))
  const nombrePorBodega = new Map((bodegas ?? []).map((b: any) => [b.id, b.nombre]))

  const filas: AveriaFila[] = (data ?? []).map((fila: any) => {
    const bodegaId = fila.ordenes_cargue?.bodega_id ?? fila.clasificaciones?.bodega_id ?? fila.lotes_huevo?.bodega_id ?? null
    return {
      id: fila.id,
      etapa: fila.etapa,
      origenLabel: ETAPA_LABEL[fila.etapa] ?? fila.etapa,
      tipoAveria: fila.tipo_averia,
      cantidad: fila.cantidad,
      loteHuevoCodigo: fila.lotes_huevo?.codigo ?? "",
      referenciaNombre: fila.referencias_huevo?.nombre ?? null,
      bodegaId,
      bodegaNombre: bodegaId ? nombrePorBodega.get(bodegaId) ?? null : null,
      fecha: fila.fecha,
      observaciones: fila.observaciones,
      procesadaEnYemas: fila.procesamiento_yema_id != null,
      estado: fila.estado,
    }
  })

  if (filtros.bodegaId) {
    return filas.filter((f) => f.bodegaId === filtros.bodegaId)
  }
  return filas
}

export async function registrarProcesamientoYemas(
  bodegaId: number,
  averiaIds: number[],
  cantidadYemas: number,
  observaciones: string | null,
): Promise<{ success: boolean; message?: string }> {
  if (averiaIds.length === 0) return { success: false, message: "Selecciona al menos una avería" }
  if (cantidadYemas <= 0) return { success: false, message: "La cantidad de yemas debe ser mayor a cero" }

  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const { data: averias, error: errorAverias } = await db
    .from("averias_huevo")
    .select("id, etapa, procesamiento_yema_id, estado, orden_cargue_id, ordenes_cargue(bodega_id)")
    .in("id", averiaIds)

  if (errorAverias || !averias) {
    return { success: false, message: "No se pudieron verificar las averías seleccionadas" }
  }

  for (const a of averias as any[]) {
    if (a.etapa !== "recepcion") {
      return { success: false, message: "Solo se pueden procesar averías de recepción" }
    }
    if (a.procesamiento_yema_id != null) {
      return { success: false, message: "Una o más averías ya fueron procesadas" }
    }
    if (a.estado === "rechazada") {
      return { success: false, message: "No se pueden procesar averías rechazadas" }
    }
    if (a.ordenes_cargue?.bodega_id !== bodegaId) {
      return { success: false, message: "Todas las averías deben pertenecer a la misma bodega" }
    }
  }

  const { data: procesamiento, error: errorProcesamiento } = await db
    .from("procesamientos_yema_averia")
    .insert({
      bodega_id: bodegaId,
      cantidad_yemas: cantidadYemas,
      observaciones,
      usuario_id: usuario?.id ?? null,
    })
    .select("id")
    .single()

  if (errorProcesamiento || !procesamiento) {
    console.error("[avimol] Error creando procesamiento de yemas:", errorProcesamiento)
    return { success: false, message: "No se pudo registrar el procesamiento: " + errorProcesamiento?.message }
  }

  await db.from("averias_huevo").update({ procesamiento_yema_id: procesamiento.id }).in("id", averiaIds)

  const { data: existente } = await db
    .from("inventario_yemas")
    .select("id, cantidad_disponible")
    .eq("bodega_id", bodegaId)
    .maybeSingle()

  if (existente) {
    await db
      .from("inventario_yemas")
      .update({
        cantidad_disponible: existente.cantidad_disponible + cantidadYemas,
        actualizado_en: fechaHoraColombiaISO(),
      })
      .eq("id", existente.id)
  } else {
    await db.from("inventario_yemas").insert({ bodega_id: bodegaId, cantidad_disponible: cantidadYemas })
  }

  await db.from("movimientos_yemas").insert({
    bodega_id: bodegaId,
    tipo_movimiento: "entrada_procesamiento",
    cantidad: cantidadYemas,
    procesamiento_yema_id: procesamiento.id,
    observaciones,
    usuario_id: usuario?.id ?? null,
    creado_en: fechaHoraColombiaISO(),
  })

  return { success: true }
}

export interface InventarioYemaFila {
  bodegaId: number
  bodegaNombre: string
  cantidadDisponible: number
}

export async function listarInventarioYemas(): Promise<InventarioYemaFila[]> {
  const db = getAvimolDb()
  const { data, error } = await db.from("inventario_yemas").select("bodega_id, cantidad_disponible, bodegas(nombre)")

  if (error) {
    console.error("[avimol] Error listando inventario de yemas:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    bodegaId: fila.bodega_id,
    bodegaNombre: fila.bodegas?.nombre ?? "",
    cantidadDisponible: fila.cantidad_disponible,
  }))
}

// Control de calidad del registro (aprobar/rechazar) — hoy expuesto
// desde Historial diario para averías de recolección. Una avería
// rechazada se excluye de los totales (Historial diario, /averias,
// Indicadores) porque se trata como error de registro, no como algo que
// realmente ocurrió.
export async function actualizarEstadoAveria(
  averiaId: number,
  estado: "pendiente" | "aprobada" | "rechazada",
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const { error } = await db
    .from("averias_huevo")
    .update({
      estado,
      procesada_por: estado === "pendiente" ? null : usuario?.id ?? null,
      procesada_en: estado === "pendiente" ? null : fechaHoraColombiaISO(),
    })
    .eq("id", averiaId)

  if (error) {
    console.error("[avimol] Error actualizando estado de avería:", error)
    return { success: false, message: "No se pudo actualizar el estado: " + error.message }
  }
  return { success: true }
}
