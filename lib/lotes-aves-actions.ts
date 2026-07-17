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
  cantidad: number,
  codigoNuevo?: string,
  observaciones?: string,
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const { data: lote, error: errorLote } = await db
    .from("lotes_aves")
    .select("id, galpon_id, cantidad_actual, fecha_ingreso, edad_semanas_ingreso")
    .eq("id", loteAvesId)
    .single()

  if (errorLote || !lote) {
    return { success: false, message: "No se encontró el lote de aves" }
  }

  if (lote.galpon_id === galponDestinoId) {
    return { success: false, message: "El galpón destino debe ser distinto al actual" }
  }

  if (cantidad <= 0 || cantidad > lote.cantidad_actual) {
    return { success: false, message: `La cantidad debe estar entre 1 y ${lote.cantidad_actual}` }
  }

  const fecha = fechaHoraColombiaISO()

  if (cantidad === lote.cantidad_actual) {
    // Traslado completo: se mueve el lote entero, comportamiento igual al de siempre.
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
      cantidad,
      fecha,
      observaciones: observaciones || null,
      usuario_id: usuario?.id ?? null,
    })

    if (errorMov) {
      console.error("[avimol] Error registrando movimiento de traslado:", errorMov)
    }

    return { success: true }
  }

  // Traslado parcial: la porción movida se convierte en un lote nuevo en
  // el galpón destino (un lote_aves solo puede estar en un galpón a la
  // vez), conservando la fecha/edad de ingreso original — no reinicia el
  // reloj de edad de esas aves. El lote original se queda con el resto.
  if (!codigoNuevo?.trim()) {
    return { success: false, message: "El código del nuevo lote es obligatorio para un traslado parcial" }
  }

  const { error: errorUpdateOrigen } = await db
    .from("lotes_aves")
    .update({ cantidad_actual: lote.cantidad_actual - cantidad })
    .eq("id", loteAvesId)

  if (errorUpdateOrigen) {
    console.error("[avimol] Error descontando el lote de aves origen:", errorUpdateOrigen)
    return { success: false, message: "No se pudo trasladar: " + errorUpdateOrigen.message }
  }

  const { data: loteNuevo, error: errorLoteNuevo } = await db
    .from("lotes_aves")
    .insert({
      codigo: codigoNuevo.trim(),
      galpon_id: galponDestinoId,
      cantidad_ingreso: cantidad,
      cantidad_actual: cantidad,
      fecha_ingreso: lote.fecha_ingreso,
      edad_semanas_ingreso: lote.edad_semanas_ingreso,
      estado: "activo",
    })
    .select("id")
    .single()

  if (errorLoteNuevo || !loteNuevo) {
    console.error("[avimol] Error creando lote de aves destino del traslado parcial:", errorLoteNuevo)
    return { success: false, message: "No se pudo crear el lote destino: " + errorLoteNuevo?.message }
  }

  // Se registra el mismo movimiento en ambos lotes (movimientos_aves.lote_aves_id
  // es una FK a un solo lote, no hay forma de que una fila represente el
  // evento en los dos a la vez) para que el historial de cada uno sea coherente.
  const { error: errorMov } = await db.from("movimientos_aves").insert([
    {
      lote_aves_id: loteAvesId,
      tipo_movimiento: "traslado",
      galpon_origen_id: lote.galpon_id,
      galpon_destino_id: galponDestinoId,
      cantidad,
      fecha,
      observaciones: observaciones || null,
      usuario_id: usuario?.id ?? null,
    },
    {
      lote_aves_id: loteNuevo.id,
      tipo_movimiento: "traslado",
      galpon_origen_id: lote.galpon_id,
      galpon_destino_id: galponDestinoId,
      cantidad,
      fecha,
      observaciones: observaciones || null,
      usuario_id: usuario?.id ?? null,
    },
  ])

  if (errorMov) {
    console.error("[avimol] Error registrando movimiento de traslado parcial:", errorMov)
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
