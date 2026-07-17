"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { fechaHoraColombiaISO } from "@/lib/date-utils"
import { obtenerUsuarioActual } from "@/lib/auth/actions"

export interface LoteAves {
  id: number
  codigo: string
  galpon_id: number
  galpon_codigo: string
  galpon_nombre: string
  cantidad_ingreso: number
  cantidad_actual: number
  fecha_ingreso: string
  edad_semanas_ingreso: number
  edad_actual_semanas: number
  estado: string
}

// Se lee de la VISTA v_lotes_aves_edad: la edad actual siempre se
// calcula en tiempo real en la base de datos, nunca se guarda estática.
export async function listarLotesAves(soloActivos = true): Promise<LoteAves[]> {
  const db = getAvimolDb()
  let query = db
    .from("v_lotes_aves_edad")
    .select(
      "id, codigo, galpon_id, cantidad_ingreso, cantidad_actual, fecha_ingreso, edad_semanas_ingreso, edad_actual_semanas, estado, galpones(codigo, nombre)",
    )
    .order("fecha_ingreso", { ascending: false })

  if (soloActivos) query = query.eq("estado", "activo")

  const { data, error } = await query

  if (error) {
    console.error("[avimol] Error listando lotes de aves:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    codigo: fila.codigo,
    galpon_id: fila.galpon_id,
    galpon_codigo: fila.galpones?.codigo ?? "",
    galpon_nombre: fila.galpones?.nombre ?? "",
    cantidad_ingreso: fila.cantidad_ingreso,
    cantidad_actual: fila.cantidad_actual,
    fecha_ingreso: fila.fecha_ingreso,
    edad_semanas_ingreso: fila.edad_semanas_ingreso,
    edad_actual_semanas: fila.edad_actual_semanas,
    estado: fila.estado,
  }))
}

export interface MovimientoAves {
  id: number
  tipo_movimiento: string
  galpon_origen_nombre: string | null
  galpon_destino_nombre: string | null
  cantidad: number
  fecha: string
  observaciones: string | null
}

export async function obtenerHistorialLote(loteAvesId: number): Promise<MovimientoAves[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("movimientos_aves")
    .select(
      "id, tipo_movimiento, cantidad, fecha, observaciones, origen:galpon_origen_id(nombre), destino:galpon_destino_id(nombre)",
    )
    .eq("lote_aves_id", loteAvesId)
    .order("fecha", { ascending: false })

  if (error) {
    console.error("[avimol] Error obteniendo historial de lote:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    tipo_movimiento: fila.tipo_movimiento,
    galpon_origen_nombre: fila.origen?.nombre ?? null,
    galpon_destino_nombre: fila.destino?.nombre ?? null,
    cantidad: fila.cantidad,
    fecha: fila.fecha,
    observaciones: fila.observaciones,
  }))
}

export interface DatosIngresoLote {
  codigo: string
  galponId: number
  cantidadIngreso: number
  fechaIngreso: string
  edadSemanasIngreso: number
}

export async function ingresarLoteAves(datos: DatosIngresoLote): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const { data: lote, error } = await db
    .from("lotes_aves")
    .insert({
      codigo: datos.codigo,
      galpon_id: datos.galponId,
      cantidad_ingreso: datos.cantidadIngreso,
      cantidad_actual: datos.cantidadIngreso,
      fecha_ingreso: datos.fechaIngreso,
      edad_semanas_ingreso: datos.edadSemanasIngreso,
      estado: "activo",
    })
    .select("id")
    .single()

  if (error || !lote) {
    console.error("[avimol] Error ingresando lote de aves:", error)
    return { success: false, message: "No se pudo registrar el ingreso: " + error?.message }
  }

  const { error: errorMov } = await db.from("movimientos_aves").insert({
    lote_aves_id: lote.id,
    tipo_movimiento: "ingreso",
    galpon_destino_id: datos.galponId,
    cantidad: datos.cantidadIngreso,
    fecha: fechaHoraColombiaISO(),
    usuario_id: usuario?.id ?? null,
  })

  if (errorMov) {
    console.error("[avimol] Error registrando movimiento de ingreso:", errorMov)
  }

  return { success: true }
}

export async function trasladarLoteAves(
  loteAvesId: number,
  galponDestinoId: number,
  observaciones?: string,
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const { data: lote, error: errorLote } = await db
    .from("lotes_aves")
    .select("id, galpon_id, cantidad_actual")
    .eq("id", loteAvesId)
    .single()

  if (errorLote || !lote) {
    return { success: false, message: "No se encontró el lote de aves" }
  }

  if (lote.galpon_id === galponDestinoId) {
    return { success: false, message: "El galpón destino debe ser distinto al actual" }
  }

  const { error: errorUpdate } = await db
    .from("lotes_aves")
    .update({ galpon_id: galponDestinoId })
    .eq("id", loteAvesId)

  if (errorUpdate) {
    console.error("[avimol] Error trasladando lote de aves:", errorUpdate)
    return { success: false, message: "No se pudo trasladar el lote: " + errorUpdate.message }
  }

  const { error: errorMov } = await db.from("movimientos_aves").insert({
    lote_aves_id: loteAvesId,
    tipo_movimiento: "traslado",
    galpon_origen_id: lote.galpon_id,
    galpon_destino_id: galponDestinoId,
    cantidad: lote.cantidad_actual,
    fecha: fechaHoraColombiaISO(),
    observaciones: observaciones || null,
    usuario_id: usuario?.id ?? null,
  })

  if (errorMov) {
    console.error("[avimol] Error registrando movimiento de traslado:", errorMov)
  }

  return { success: true }
}

export type TipoSalidaAves = "mortalidad" | "sacrificio"

export async function registrarSalidaAves(
  loteAvesId: number,
  tipo: TipoSalidaAves,
  cantidad: number,
  observaciones?: string,
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const { data: lote, error: errorLote } = await db
    .from("lotes_aves")
    .select("id, galpon_id, cantidad_actual")
    .eq("id", loteAvesId)
    .single()

  if (errorLote || !lote) {
    return { success: false, message: "No se encontró el lote de aves" }
  }

  if (cantidad <= 0 || cantidad > lote.cantidad_actual) {
    return { success: false, message: `La cantidad debe estar entre 1 y ${lote.cantidad_actual}` }
  }

  const nuevaCantidad = lote.cantidad_actual - cantidad
  const nuevoEstado = nuevaCantidad === 0 ? (tipo === "sacrificio" ? "sacrificado" : "cerrado") : "activo"

  const { error: errorUpdate } = await db
    .from("lotes_aves")
    .update({ cantidad_actual: nuevaCantidad, estado: nuevoEstado })
    .eq("id", loteAvesId)

  if (errorUpdate) {
    console.error("[avimol] Error registrando salida de aves:", errorUpdate)
    return { success: false, message: "No se pudo registrar la salida: " + errorUpdate.message }
  }

  const { error: errorMov } = await db.from("movimientos_aves").insert({
    lote_aves_id: loteAvesId,
    tipo_movimiento: tipo,
    galpon_origen_id: lote.galpon_id,
    cantidad,
    fecha: fechaHoraColombiaISO(),
    observaciones: observaciones || null,
    usuario_id: usuario?.id ?? null,
  })

  if (errorMov) {
    console.error("[avimol] Error registrando movimiento de salida:", errorMov)
  }

  return { success: true }
}

// Aves activas HOY por galpón (suma de cantidad_actual de lotes con
// estado='activo') — mismo cálculo ya usado en
// indicadores-actions.ts::obtenerIndicadoresAves, extraído acá como
// helper reusable para no duplicarlo (p. ej. en el cálculo de eficiencia
// de Historial diario).
export async function obtenerAvesActivasPorGalpon(): Promise<Map<number, number>> {
  const db = getAvimolDb()
  const { data, error } = await db.from("v_lotes_aves_edad").select("galpon_id, cantidad_actual, estado")

  if (error) {
    console.error("[avimol] Error obteniendo aves activas por galpón:", error)
    return new Map()
  }

  const porGalpon = new Map<number, number>()
  for (const l of (data ?? []) as any[]) {
    if (l.estado !== "activo") continue
    porGalpon.set(l.galpon_id, (porGalpon.get(l.galpon_id) ?? 0) + l.cantidad_actual)
  }
  return porGalpon
}
