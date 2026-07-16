"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { fechaColombiaHoy, fechaHoraColombiaISO } from "@/lib/date-utils"

export interface CostoCarton {
  id: number
  valor: number
  vigente_desde: string
  vigente_hasta: string | null
  activo: boolean
}

export async function listarCostosCarton(): Promise<CostoCarton[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("costos_carton")
    .select("id, valor, vigente_desde, vigente_hasta, activo")
    .order("vigente_desde", { ascending: false })

  if (error) {
    console.error("[avimol] Error listando costos de cartón:", error)
    return []
  }
  return data ?? []
}

export async function crearCostoCarton(valor: number): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db.from("costos_carton").insert({
    valor,
    vigente_desde: fechaColombiaHoy(),
    activo: true,
  })

  if (error) {
    console.error("[avimol] Error creando costo de cartón:", error)
    return { success: false, message: "No se pudo registrar el costo: " + error.message }
  }
  return { success: true }
}

// Mismo criterio que obtenerTarifaVigente: el costo activo más reciente
// cuyo rango de vigencia cubre hoy.
export async function obtenerCostoCartonVigente(): Promise<CostoCarton | null> {
  const db = getAvimolDb()
  const hoy = fechaColombiaHoy()

  const { data, error } = await db
    .from("costos_carton")
    .select("id, valor, vigente_desde, vigente_hasta, activo")
    .eq("activo", true)
    .lte("vigente_desde", hoy)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[avimol] Error obteniendo costo de cartón vigente:", error)
    return null
  }
  return data
}

export interface InventarioCartonFila {
  bodega_id: number
  bodega_nombre: string
  cantidad_disponible: number
}

export async function listarInventarioCartones(bodegaId: number | null): Promise<InventarioCartonFila[]> {
  const db = getAvimolDb()
  let query = db.from("inventario_cartones").select("bodega_id, cantidad_disponible, bodegas(nombre)")
  if (bodegaId) query = query.eq("bodega_id", bodegaId)

  const { data, error } = await query
  if (error) {
    console.error("[avimol] Error listando inventario de cartones:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    bodega_id: fila.bodega_id,
    bodega_nombre: fila.bodegas?.nombre ?? "",
    cantidad_disponible: fila.cantidad_disponible,
  }))
}

export async function registrarIngresoCarton(
  bodegaId: number,
  cantidad: number,
  costoUnitarioNuevo: number | null,
  observaciones: string | null,
): Promise<{ success: boolean; message?: string }> {
  if (cantidad <= 0) return { success: false, message: "La cantidad debe ser mayor a cero" }

  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  if (costoUnitarioNuevo != null) {
    const resultadoCosto = await crearCostoCarton(costoUnitarioNuevo)
    if (!resultadoCosto.success) return resultadoCosto
  }

  const costoAplicado = costoUnitarioNuevo ?? (await obtenerCostoCartonVigente())?.valor ?? null

  const { data: existente } = await db
    .from("inventario_cartones")
    .select("id, cantidad_disponible")
    .eq("bodega_id", bodegaId)
    .maybeSingle()

  if (existente) {
    await db
      .from("inventario_cartones")
      .update({
        cantidad_disponible: existente.cantidad_disponible + cantidad,
        actualizado_en: fechaHoraColombiaISO(),
      })
      .eq("id", existente.id)
  } else {
    await db.from("inventario_cartones").insert({ bodega_id: bodegaId, cantidad_disponible: cantidad })
  }

  await db.from("movimientos_cartones").insert({
    bodega_id: bodegaId,
    tipo_movimiento: "entrada_manual",
    cantidad,
    costo_unitario: costoAplicado,
    observaciones,
    usuario_id: usuario?.id ?? null,
    creado_en: fechaHoraColombiaISO(),
  })

  return { success: true }
}

export interface ConsumoCartonClasificacion {
  codigo: string
  bodega_nombre: string
  lote_huevo_codigo: string
  fecha: string
  cartones_calculados: number
  cartones_extra: number
  total: number
  costo_unitario_aplicado: number | null
  costo_total_cartones: number | null
  detalle_extra: { motivo: string; cantidad: number; observacion: string | null }[]
}

const MOTIVO_LABEL: Record<string, string> = {
  refuerzo_buenos: "Refuerzo de cartones buenos",
  rotos: "Rotos",
  averiados: "Averiados",
}

export async function listarConsumoCartones(bodegaId: number | null): Promise<ConsumoCartonClasificacion[]> {
  const db = getAvimolDb()
  let query = db
    .from("clasificaciones")
    .select(
      `codigo, cartones_calculados, cartones_extra, costo_unitario_aplicado, costo_total_cartones, creado_en,
       bodegas(nombre), lotes_huevo(codigo),
       clasificaciones_cartones_extra(motivo, cantidad, observacion)`,
    )
    .order("creado_en", { ascending: false })

  if (bodegaId) query = query.eq("bodega_id", bodegaId)

  const { data, error } = await query
  if (error) {
    console.error("[avimol] Error listando consumo de cartones:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    codigo: fila.codigo,
    bodega_nombre: fila.bodegas?.nombre ?? "",
    lote_huevo_codigo: fila.lotes_huevo?.codigo ?? "",
    fecha: fila.creado_en,
    cartones_calculados: fila.cartones_calculados,
    cartones_extra: fila.cartones_extra,
    total: fila.cartones_calculados + fila.cartones_extra,
    costo_unitario_aplicado: fila.costo_unitario_aplicado,
    costo_total_cartones: fila.costo_total_cartones,
    detalle_extra: (fila.clasificaciones_cartones_extra ?? []).map((d: any) => ({
      motivo: MOTIVO_LABEL[d.motivo] ?? d.motivo,
      cantidad: d.cantidad,
      observacion: d.observacion,
    })),
  }))
}
