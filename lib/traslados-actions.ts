"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { fechaColombiaHoy, fechaHoraColombiaISO } from "@/lib/date-utils"
import { obtenerTarifaVigente } from "@/lib/tarifas-actions"
import type { TipoAveria } from "@/lib/recoleccion-actions"

const TABLA_POR_PREFIJO = {
  TRA: "solicitudes_traslado",
  PED: "pedidos",
  VEN: "ventas_directas",
  CAR: "ordenes_cargue",
  DES: "ordenes_cargue",
  CLA: "clasificaciones",
} as const

export async function generarCodigoOrden(prefijo: keyof typeof TABLA_POR_PREFIJO): Promise<string> {
  const db = getAvimolDb()
  const fecha = fechaColombiaHoy().replaceAll("-", "")
  const tabla = TABLA_POR_PREFIJO[prefijo]
  const { count } = await db
    .from(tabla)
    .select("id", { count: "exact", head: true })
    .like("codigo", `${prefijo}${fecha}-%`)
  const consecutivo = (count ?? 0) + 1
  return `${prefijo}${fecha}-${consecutivo.toString().padStart(3, "0")}`
}

export interface SolicitudTraslado {
  id: number
  codigo: string
  bodega_origen_nombre: string
  bodega_destino_nombre: string
  estado: string
  creado_en: string
}

export async function listarSolicitudesTraslado(): Promise<SolicitudTraslado[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("solicitudes_traslado")
    .select("id, codigo, estado, creado_en, origen:bodega_origen_id(nombre), destino:bodega_destino_id(nombre)")
    .order("id", { ascending: false })

  if (error) {
    console.error("[avimol] Error listando solicitudes de traslado:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    codigo: fila.codigo,
    bodega_origen_nombre: fila.origen?.nombre ?? "",
    bodega_destino_nombre: fila.destino?.nombre ?? "",
    estado: fila.estado,
    creado_en: fila.creado_en,
  }))
}

export interface DatosSolicitudTraslado {
  bodegaOrigenId: number
  bodegaDestinoId: number
  lineas: { referenciaId: number; cantidad: number; edadSemanasPreferida?: number | null }[]
}

export async function crearSolicitudTraslado(
  datos: DatosSolicitudTraslado,
): Promise<{ success: boolean; message?: string; codigo?: string; ordenCargueId?: number }> {
  const lineasValidas = datos.lineas.filter((l) => l.cantidad > 0)
  if (lineasValidas.length === 0) {
    return { success: false, message: "Registra al menos una cantidad mayor a cero" }
  }
  if (datos.bodegaOrigenId === datos.bodegaDestinoId) {
    return { success: false, message: "La bodega origen y destino deben ser distintas" }
  }

  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()
  const codigo = await generarCodigoOrden("TRA")

  const { data: solicitud, error: errorSolicitud } = await db
    .from("solicitudes_traslado")
    .insert({
      codigo,
      bodega_origen_id: datos.bodegaOrigenId,
      bodega_destino_id: datos.bodegaDestinoId,
      estado: "pendiente",
      usuario_id: usuario?.id ?? null,
    })
    .select("id")
    .single()

  if (errorSolicitud || !solicitud) {
    console.error("[avimol] Error creando solicitud de traslado:", errorSolicitud)
    return { success: false, message: "No se pudo crear la solicitud: " + errorSolicitud?.message }
  }

  const { error: errorDetalle } = await db.from("solicitudes_traslado_detalle").insert(
    lineasValidas.map((l) => ({
      solicitud_traslado_id: solicitud.id,
      referencia_huevo_id: l.referenciaId,
      cantidad_solicitada: l.cantidad,
      edad_semanas_preferida: l.edadSemanasPreferida ?? null,
    })),
  )
  if (errorDetalle) {
    console.error("[avimol] Error creando detalle de solicitud:", errorDetalle)
    return { success: false, message: "Error al registrar las referencias solicitadas: " + errorDetalle.message }
  }

  // La solicitud desencadena automáticamente la orden de cargue en la bodega origen.
  const codigoOrden = await generarCodigoOrden("CAR")
  const { data: orden, error: errorOrden } = await db
    .from("ordenes_cargue")
    .insert({
      tipo_operacion: "cargue_traslado",
      bodega_id: datos.bodegaOrigenId,
      solicitud_traslado_id: solicitud.id,
      codigo: codigoOrden,
      estado: "pendiente",
      usuario_id: usuario?.id ?? null,
    })
    .select("id")
    .single()

  if (errorOrden) {
    console.error("[avimol] Error creando orden de cargue:", errorOrden)
    return { success: false, message: "Error al generar la orden de cargue: " + errorOrden.message }
  }

  return { success: true, codigo, ordenCargueId: orden?.id }
}

export interface OrdenCargueResumen {
  id: number
  codigo: string
  tipo_operacion: string
  bodega_nombre: string
  estado: string
  hora_llegada_vehiculo: string | null
  hora_inicio_cargue: string | null
  hora_fin_cargue: string | null
  hora_inicio_descargue: string | null
  hora_fin_descargue: string | null
  peso_total_kg: number | null
  solicitud_codigo: string | null
}

export async function listarOrdenesCargue(tipoOperacion: string): Promise<OrdenCargueResumen[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("ordenes_cargue")
    .select(
      "id, codigo, tipo_operacion, estado, hora_llegada_vehiculo, hora_inicio_cargue, hora_fin_cargue, hora_inicio_descargue, hora_fin_descargue, peso_total_kg, bodegas(nombre), solicitudes_traslado(codigo), pedidos(codigo)",
    )
    .eq("tipo_operacion", tipoOperacion)
    .order("id", { ascending: false })

  if (error) {
    console.error("[avimol] Error listando órdenes de cargue:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    codigo: fila.codigo,
    tipo_operacion: fila.tipo_operacion,
    bodega_nombre: fila.bodegas?.nombre ?? "",
    estado: fila.estado,
    hora_llegada_vehiculo: fila.hora_llegada_vehiculo,
    hora_inicio_cargue: fila.hora_inicio_cargue,
    hora_fin_cargue: fila.hora_fin_cargue,
    hora_inicio_descargue: fila.hora_inicio_descargue,
    hora_fin_descargue: fila.hora_fin_descargue,
    peso_total_kg: fila.peso_total_kg,
    solicitud_codigo: fila.solicitudes_traslado?.codigo ?? fila.pedidos?.codigo ?? null,
  }))
}

export interface OrdenCargueDetalleLinea {
  id: number
  lote_huevo_id: number
  lote_huevo_codigo: string
  edad_semanas_captura: number
  referencia_huevo_id: number
  referencia_nombre: string
  anaquel_id: number | null
  cantidad_cargada: number
  cantidad_recibida: number | null
  peso_unitario_gramos: number
}

export interface OrdenCargueCompleta {
  id: number
  codigo: string
  tipo_operacion: string
  estado: string
  bodega_id: number
  bodega_nombre: string
  bodega_tipo: string
  placa_vehiculo: string | null
  conductor: string | null
  hora_llegada_vehiculo: string | null
  hora_inicio_cargue: string | null
  hora_fin_cargue: string | null
  hora_inicio_descargue: string | null
  hora_fin_descargue: string | null
  peso_total_kg: number | null
  valor_tarifa_aplicado: number | null
  orden_cargue_origen_id: number | null
  solicitud: {
    id: number
    codigo: string
    lineas: {
      referenciaId: number
      referenciaNombre: string
      cantidadSolicitada: number
      edadSemanasPreferida: number | null
    }[]
  } | null
  pedido: {
    id: number
    codigo: string
    clienteNombre: string
    lineas: { referenciaId: number; referenciaNombre: string; cantidadSolicitada: number }[]
  } | null
  detalle: OrdenCargueDetalleLinea[]
}

export async function obtenerOrdenConDetalle(ordenId: number): Promise<OrdenCargueCompleta | null> {
  const db = getAvimolDb()

  const { data: orden, error: errorOrden } = await db
    .from("ordenes_cargue")
    .select(
      "id, codigo, tipo_operacion, estado, bodega_id, placa_vehiculo, conductor, hora_llegada_vehiculo, hora_inicio_cargue, hora_fin_cargue, hora_inicio_descargue, hora_fin_descargue, peso_total_kg, valor_tarifa_aplicado, orden_cargue_origen_id, bodegas(nombre, tipo), solicitud_traslado_id, pedido_id",
    )
    .eq("id", ordenId)
    .single()

  if (errorOrden || !orden) {
    console.error("[avimol] Error obteniendo orden:", errorOrden)
    return null
  }

  let solicitud: OrdenCargueCompleta["solicitud"] = null
  if (orden.solicitud_traslado_id) {
    const { data: sol } = await db
      .from("solicitudes_traslado")
      .select("id, codigo")
      .eq("id", orden.solicitud_traslado_id)
      .single()

    const { data: lineas } = await db
      .from("solicitudes_traslado_detalle")
      .select("referencia_huevo_id, cantidad_solicitada, edad_semanas_preferida, referencias_huevo(nombre)")
      .eq("solicitud_traslado_id", orden.solicitud_traslado_id)

    if (sol) {
      solicitud = {
        id: sol.id,
        codigo: sol.codigo,
        lineas: (lineas ?? []).map((l: any) => ({
          referenciaId: l.referencia_huevo_id,
          referenciaNombre: l.referencias_huevo?.nombre ?? "",
          cantidadSolicitada: l.cantidad_solicitada,
          edadSemanasPreferida: l.edad_semanas_preferida ?? null,
        })),
      }
    }
  }

  let pedido: OrdenCargueCompleta["pedido"] = null
  if (orden.pedido_id) {
    const { data: ped } = await db
      .from("pedidos")
      .select("id, codigo, clientes(nombre)")
      .eq("id", orden.pedido_id)
      .single()

    const { data: lineas } = await db
      .from("pedidos_detalle")
      .select("referencia_huevo_id, cantidad, referencias_huevo(nombre)")
      .eq("pedido_id", orden.pedido_id)

    if (ped) {
      pedido = {
        id: ped.id,
        codigo: ped.codigo,
        clienteNombre: (ped as any).clientes?.nombre ?? "",
        lineas: (lineas ?? []).map((l: any) => ({
          referenciaId: l.referencia_huevo_id,
          referenciaNombre: l.referencias_huevo?.nombre ?? "",
          cantidadSolicitada: l.cantidad,
        })),
      }
    }
  }

  const { data: detalleData, error: errorDetalle } = await db
    .from("ordenes_cargue_detalle")
    .select(
      "id, cantidad_cargada, cantidad_recibida, peso_unitario_gramos, referencia_huevo_id, anaquel_id, referencias_huevo(nombre), lotes_huevo(id, codigo, edad_semanas_captura)",
    )
    .eq("orden_cargue_id", ordenId)

  if (errorDetalle) console.error("[avimol] Error obteniendo detalle de orden:", errorDetalle)

  return {
    id: orden.id,
    codigo: orden.codigo,
    tipo_operacion: orden.tipo_operacion,
    estado: orden.estado,
    bodega_id: orden.bodega_id,
    bodega_nombre: (orden as any).bodegas?.nombre ?? "",
    bodega_tipo: (orden as any).bodegas?.tipo ?? "",
    placa_vehiculo: orden.placa_vehiculo,
    conductor: orden.conductor,
    hora_llegada_vehiculo: orden.hora_llegada_vehiculo,
    hora_inicio_cargue: orden.hora_inicio_cargue,
    hora_fin_cargue: orden.hora_fin_cargue,
    hora_inicio_descargue: orden.hora_inicio_descargue,
    hora_fin_descargue: orden.hora_fin_descargue,
    peso_total_kg: orden.peso_total_kg,
    valor_tarifa_aplicado: orden.valor_tarifa_aplicado,
    orden_cargue_origen_id: orden.orden_cargue_origen_id,
    solicitud,
    pedido,
    detalle: (detalleData ?? []).map((fila: any) => ({
      id: fila.id,
      lote_huevo_id: fila.lotes_huevo?.id,
      lote_huevo_codigo: fila.lotes_huevo?.codigo ?? "",
      edad_semanas_captura: fila.lotes_huevo?.edad_semanas_captura ?? 0,
      referencia_huevo_id: fila.referencia_huevo_id,
      referencia_nombre: fila.referencias_huevo?.nombre ?? "",
      anaquel_id: fila.anaquel_id,
      cantidad_cargada: fila.cantidad_cargada,
      cantidad_recibida: fila.cantidad_recibida,
      peso_unitario_gramos: fila.peso_unitario_gramos,
    })),
  }
}

export async function iniciarCargue(ordenId: number): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db
    .from("ordenes_cargue")
    .update({ hora_inicio_cargue: fechaHoraColombiaISO(), estado: "cargado" })
    .eq("id", ordenId)

  if (error) return { success: false, message: error.message }
  return { success: true }
}

export interface LoteDisponible {
  lote_huevo_id: number
  lote_huevo_codigo: string
  fecha_cosecha: string
  edad_semanas_captura: number
  galpon_codigo: string
  anaquel_id: number | null
  anaquel_codigo: string | null
  cantidad_disponible: number
}

// Lotes disponibles en la bodega origen para una referencia, ordenados
// FIFO (fecha de cosecha más antigua primero) — criterio razonable por
// defecto para un producto perecedero como el huevo.
export async function obtenerLotesDisponibles(bodegaId: number, referenciaId: number): Promise<LoteDisponible[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("inventario_huevo")
    .select(
      "cantidad_disponible, anaquel_id, anaqueles(codigo), lotes_huevo(id, codigo, fecha_cosecha, edad_semanas_captura, galpones(codigo))",
    )
    .eq("bodega_id", bodegaId)
    .eq("referencia_huevo_id", referenciaId)
    .gt("cantidad_disponible", 0)

  if (error) {
    console.error("[avimol] Error obteniendo lotes disponibles:", error)
    return []
  }

  const filas = (data ?? []).map((fila: any) => ({
    lote_huevo_id: fila.lotes_huevo?.id,
    lote_huevo_codigo: fila.lotes_huevo?.codigo ?? "",
    fecha_cosecha: fila.lotes_huevo?.fecha_cosecha ?? "",
    edad_semanas_captura: fila.lotes_huevo?.edad_semanas_captura ?? 0,
    galpon_codigo: fila.lotes_huevo?.galpones?.codigo ?? "",
    anaquel_id: fila.anaquel_id,
    anaquel_codigo: fila.anaqueles?.codigo ?? null,
    cantidad_disponible: fila.cantidad_disponible,
  }))

  return filas.sort((a, b) => a.fecha_cosecha.localeCompare(b.fecha_cosecha))
}

export interface DisponibilidadBodega {
  bodega_id: number
  bodega_nombre: string
  total_disponible: number
  lotes: LoteDisponible[]
}

// Igual que obtenerLotesDisponibles pero mirando TODAS las bodegas menos
// la excluida, agrupado por bodega — usado para sugerir de dónde
// trasladar cuando la bodega origen de un despacho no tiene suficiente.
export async function obtenerDisponibilidadOtrasBodegas(
  bodegaExcluirId: number,
  referenciaId: number,
): Promise<DisponibilidadBodega[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("inventario_huevo")
    .select(
      "bodega_id, bodegas(nombre), cantidad_disponible, anaquel_id, anaqueles(codigo), lotes_huevo(id, codigo, fecha_cosecha, edad_semanas_captura, galpones(codigo))",
    )
    .eq("referencia_huevo_id", referenciaId)
    .neq("bodega_id", bodegaExcluirId)
    .gt("cantidad_disponible", 0)

  if (error) {
    console.error("[avimol] Error obteniendo disponibilidad en otras bodegas:", error)
    return []
  }

  const porBodega = new Map<number, DisponibilidadBodega>()
  for (const fila of (data ?? []) as any[]) {
    const bodegaId = fila.bodega_id
    if (!porBodega.has(bodegaId)) {
      porBodega.set(bodegaId, {
        bodega_id: bodegaId,
        bodega_nombre: fila.bodegas?.nombre ?? "",
        total_disponible: 0,
        lotes: [],
      })
    }
    const entrada = porBodega.get(bodegaId)!
    entrada.total_disponible += fila.cantidad_disponible
    entrada.lotes.push({
      lote_huevo_id: fila.lotes_huevo?.id,
      lote_huevo_codigo: fila.lotes_huevo?.codigo ?? "",
      fecha_cosecha: fila.lotes_huevo?.fecha_cosecha ?? "",
      edad_semanas_captura: fila.lotes_huevo?.edad_semanas_captura ?? 0,
      galpon_codigo: fila.lotes_huevo?.galpones?.codigo ?? "",
      anaquel_id: fila.anaquel_id,
      anaquel_codigo: fila.anaqueles?.codigo ?? null,
      cantidad_disponible: fila.cantidad_disponible,
    })
  }

  return Array.from(porBodega.values()).sort((a, b) => b.total_disponible - a.total_disponible)
}

export async function agregarLineaCargue(
  ordenId: number,
  bodegaId: number,
  loteHuevoId: number,
  referenciaId: number,
  cantidad: number,
  anaquelId: number | null = null,
): Promise<{ success: boolean; message?: string }> {
  if (cantidad <= 0) return { success: false, message: "La cantidad debe ser mayor a cero" }

  const db = getAvimolDb()

  let querySaldo = db
    .from("inventario_huevo")
    .select("cantidad_disponible")
    .eq("bodega_id", bodegaId)
    .eq("lote_huevo_id", loteHuevoId)
    .eq("referencia_huevo_id", referenciaId)
  querySaldo = anaquelId ? querySaldo.eq("anaquel_id", anaquelId) : querySaldo.is("anaquel_id", null)
  const { data: saldo, error: errorSaldo } = await querySaldo.maybeSingle()

  if (errorSaldo || !saldo || saldo.cantidad_disponible < cantidad) {
    return {
      success: false,
      message: `No hay suficiente inventario disponible (disponible: ${saldo?.cantidad_disponible ?? 0})`,
    }
  }

  const { data: referencia } = await db
    .from("referencias_huevo")
    .select("peso_unitario_gramos")
    .eq("id", referenciaId)
    .single()

  const pesoUnitario = referencia?.peso_unitario_gramos ?? 0

  const { error } = await db.from("ordenes_cargue_detalle").insert({
    orden_cargue_id: ordenId,
    lote_huevo_id: loteHuevoId,
    referencia_huevo_id: referenciaId,
    anaquel_id: anaquelId,
    cantidad_cargada: cantidad,
    peso_unitario_gramos: pesoUnitario,
  })

  if (error) {
    console.error("[avimol] Error agregando línea de cargue:", error)
    return { success: false, message: "No se pudo agregar la línea: " + error.message }
  }

  return { success: true }
}

export async function quitarLineaCargue(detalleId: number): Promise<{ success: boolean }> {
  const db = getAvimolDb()
  await db.from("ordenes_cargue_detalle").delete().eq("id", detalleId)
  return { success: true }
}

export async function confirmarFinCargue(ordenId: number): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const orden = await obtenerOrdenConDetalle(ordenId)
  if (!orden) return { success: false, message: "Orden no encontrada" }
  if (orden.detalle.length === 0) return { success: false, message: "Agrega al menos una línea de cargue" }

  // Descontar inventario de la bodega origen y dejar rastro en el kardex.
  for (const linea of orden.detalle) {
    let querySaldo = db
      .from("inventario_huevo")
      .select("id, cantidad_disponible")
      .eq("bodega_id", orden.bodega_id)
      .eq("lote_huevo_id", linea.lote_huevo_id)
      .eq("referencia_huevo_id", linea.referencia_huevo_id)
    querySaldo = linea.anaquel_id ? querySaldo.eq("anaquel_id", linea.anaquel_id) : querySaldo.is("anaquel_id", null)
    const { data: saldo } = await querySaldo.maybeSingle()

    if (!saldo || saldo.cantidad_disponible < linea.cantidad_cargada) {
      return { success: false, message: `Inventario insuficiente para ${linea.referencia_nombre} (lote ${linea.lote_huevo_codigo})` }
    }

    await db
      .from("inventario_huevo")
      .update({ cantidad_disponible: saldo.cantidad_disponible - linea.cantidad_cargada, actualizado_en: fechaHoraColombiaISO() })
      .eq("id", saldo.id)

    await db.from("movimientos_inventario_huevo").insert({
      bodega_id: orden.bodega_id,
      lote_huevo_id: linea.lote_huevo_id,
      referencia_huevo_id: linea.referencia_huevo_id,
      anaquel_id: linea.anaquel_id,
      tipo_movimiento: "salida_cargue_traslado",
      cantidad: -linea.cantidad_cargada,
      orden_cargue_id: ordenId,
      usuario_id: usuario?.id ?? null,
      creado_en: fechaHoraColombiaISO(),
    })
  }

  const pesoTotalKg = orden.detalle.reduce((acc, l) => acc + (l.cantidad_cargada * l.peso_unitario_gramos) / 1000, 0)

  await db
    .from("ordenes_cargue")
    .update({ hora_fin_cargue: fechaHoraColombiaISO(), peso_total_kg: pesoTotalKg, estado: "en_transito" })
    .eq("id", ordenId)

  // Genera automáticamente la orden de descargue en la bodega destino,
  // prellenada EXACTAMENTE con lo que se cargó.
  const { data: solicitud } = orden.solicitud
    ? await db.from("solicitudes_traslado").select("bodega_destino_id").eq("id", orden.solicitud.id).single()
    : { data: null }

  if (solicitud) {
    const codigoDescargue = await generarCodigoOrden("DES")
    const { data: ordenDescargue, error: errorDescargue } = await db
      .from("ordenes_cargue")
      .insert({
        tipo_operacion: "descargue_traslado",
        bodega_id: solicitud.bodega_destino_id,
        solicitud_traslado_id: orden.solicitud!.id,
        orden_cargue_origen_id: ordenId,
        codigo: codigoDescargue,
        estado: "pendiente",
      })
      .select("id")
      .single()

    if (!errorDescargue && ordenDescargue) {
      await db.from("ordenes_cargue_detalle").insert(
        orden.detalle.map((l) => ({
          orden_cargue_id: ordenDescargue.id,
          lote_huevo_id: l.lote_huevo_id,
          referencia_huevo_id: l.referencia_huevo_id,
          cantidad_cargada: l.cantidad_cargada,
          peso_unitario_gramos: l.peso_unitario_gramos,
        })),
      )
    }

    await db.from("solicitudes_traslado").update({ estado: "cargado" }).eq("id", orden.solicitud!.id)
  }

  return { success: true }
}

export async function iniciarDescargue(ordenId: number): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db
    .from("ordenes_cargue")
    .update({ hora_inicio_descargue: fechaHoraColombiaISO() })
    .eq("id", ordenId)

  if (error) return { success: false, message: error.message }
  return { success: true }
}

export interface LineaRecepcion {
  detalleId: number
  cantidadRecibida: number
  anaquelDestinoId?: number | null
  tipoAveria?: TipoAveria
  averias?: {
    tipoAveria: "roto" | "picado"
    cantidad: number
    cantidadYemas: number | null
    cantidadBolsasYema: number | null
    observaciones: string | null
  }[]
}

export async function confirmarFinDescargue(
  ordenId: number,
  lineas: LineaRecepcion[],
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const orden = await obtenerOrdenConDetalle(ordenId)
  if (!orden) return { success: false, message: "Orden no encontrada" }

  for (const recibida of lineas) {
    const linea = orden.detalle.find((d) => d.id === recibida.detalleId)
    if (!linea) continue

    await db
      .from("ordenes_cargue_detalle")
      .update({ cantidad_recibida: recibida.cantidadRecibida })
      .eq("id", linea.id)

    const anaquelDestinoId = recibida.anaquelDestinoId ?? null

    // Ingresa a inventario de la bodega destino conservando lote, galpón, edad y clasificación.
    let queryExistente = db
      .from("inventario_huevo")
      .select("id, cantidad_disponible")
      .eq("bodega_id", orden.bodega_id)
      .eq("lote_huevo_id", linea.lote_huevo_id)
      .eq("referencia_huevo_id", linea.referencia_huevo_id)
    queryExistente = anaquelDestinoId
      ? queryExistente.eq("anaquel_id", anaquelDestinoId)
      : queryExistente.is("anaquel_id", null)
    const { data: existente } = await queryExistente.maybeSingle()

    if (existente) {
      await db
        .from("inventario_huevo")
        .update({
          cantidad_disponible: existente.cantidad_disponible + recibida.cantidadRecibida,
          actualizado_en: fechaHoraColombiaISO(),
        })
        .eq("id", existente.id)
    } else {
      await db.from("inventario_huevo").insert({
        bodega_id: orden.bodega_id,
        lote_huevo_id: linea.lote_huevo_id,
        referencia_huevo_id: linea.referencia_huevo_id,
        anaquel_id: anaquelDestinoId,
        cantidad_disponible: recibida.cantidadRecibida,
      })
    }

    await db.from("movimientos_inventario_huevo").insert({
      bodega_id: orden.bodega_id,
      lote_huevo_id: linea.lote_huevo_id,
      referencia_huevo_id: linea.referencia_huevo_id,
      anaquel_id: anaquelDestinoId,
      tipo_movimiento: "entrada_recepcion_traslado",
      cantidad: recibida.cantidadRecibida,
      orden_cargue_id: ordenId,
      usuario_id: usuario?.id ?? null,
      creado_en: fechaHoraColombiaISO(),
    })

    const faltante = linea.cantidad_cargada - recibida.cantidadRecibida
    if (recibida.averias && recibida.averias.length > 0) {
      await db.from("averias_huevo").insert(
        recibida.averias.map((a) => ({
          lote_huevo_id: linea.lote_huevo_id,
          referencia_huevo_id: linea.referencia_huevo_id,
          etapa: "recepcion",
          tipo_averia: a.tipoAveria,
          cantidad: a.cantidad,
          cantidad_yemas: a.cantidadYemas,
          cantidad_bolsas_yema: a.cantidadBolsasYema,
          observaciones: a.observaciones,
          orden_cargue_id: ordenId,
          usuario_id: usuario?.id ?? null,
        })),
      )
    } else if (faltante > 0) {
      await db.from("averias_huevo").insert({
        lote_huevo_id: linea.lote_huevo_id,
        referencia_huevo_id: linea.referencia_huevo_id,
        etapa: "recepcion",
        tipo_averia: recibida.tipoAveria ?? "roto",
        cantidad: faltante,
        orden_cargue_id: ordenId,
        usuario_id: usuario?.id ?? null,
      })
    }
  }

  const tarifa = await obtenerTarifaVigente()
  let valorTarifaAplicado: number | null = null
  if (tarifa) {
    valorTarifaAplicado = tarifa.tipo_valor === "fijo" ? tarifa.valor : tarifa.valor * (orden.peso_total_kg ?? 0)
  }

  await db
    .from("ordenes_cargue")
    .update({
      hora_fin_descargue: fechaHoraColombiaISO(),
      tarifa_servicio_descargue_id: tarifa?.id ?? null,
      valor_tarifa_aplicado: valorTarifaAplicado,
      estado: "cerrado",
    })
    .eq("id", ordenId)

  if (orden.solicitud) {
    await db.from("solicitudes_traslado").update({ estado: "recibido" }).eq("id", orden.solicitud.id)
  }

  // La orden de cargue en la bodega origen queda "en_transito" desde que
  // salió; al confirmar que la de descargue llegó a destino, pasa a
  // "recibido" (mostrado como "Entregado" — ver ESTADO_LABEL en
  // ordenes-cargue-view.tsx). Solo aplica a traslados: los despachos a
  // cliente no generan una orden de descargue propia.
  if (orden.orden_cargue_origen_id) {
    await db.from("ordenes_cargue").update({ estado: "recibido" }).eq("id", orden.orden_cargue_origen_id)
  }

  return { success: true }
}
