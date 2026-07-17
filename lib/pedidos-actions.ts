"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { fechaColombiaHoy, fechaHoraColombiaISO } from "@/lib/date-utils"
import {
  generarCodigoOrden,
  obtenerOrdenConDetalle,
  obtenerLotesDisponibles,
  obtenerDisponibilidadOtrasBodegas,
  evaluarCierreOrdenCargue,
  calcularProgresoCargue,
  type DisponibilidadBodega,
  type AccionCierreCargue,
  type LineaProgresoCargue,
  type OrdenCargueResumen,
} from "@/lib/traslados-actions"
import type { TipoAveria } from "@/lib/recoleccion-actions"

export interface Pedido {
  id: number
  codigo: string
  bodega_nombre: string
  cliente_nombre: string
  fecha_pedido: string
  estado: string
  total: number | null
}

export async function listarPedidos(): Promise<Pedido[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("pedidos")
    .select("id, codigo, fecha_pedido, estado, total, bodegas(nombre), clientes(nombre)")
    .order("id", { ascending: false })

  if (error) {
    console.error("[avimol] Error listando pedidos:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    codigo: fila.codigo,
    bodega_nombre: fila.bodegas?.nombre ?? "",
    cliente_nombre: fila.clientes?.nombre ?? "",
    fecha_pedido: fila.fecha_pedido,
    estado: fila.estado,
    total: fila.total,
  }))
}

export interface DatosPedido {
  bodegaId: number
  clienteId: number
  vendedorId: number | null
  fechaEntregaProgramada: string | null
  condicionPago: string
  numeroOrdenCompra: string | null
  aplicaIva: boolean
  ivaPorcentaje: number
  descuentoPorcentaje: number
  lineas: { referenciaId: number; cantidad: number; precioUnitario: number | null }[]
}

export async function crearPedido(
  datos: DatosPedido,
): Promise<{ success: boolean; message?: string; codigo?: string; ordenCargueId?: number }> {
  const lineasValidas = datos.lineas.filter((l) => l.cantidad > 0)
  if (lineasValidas.length === 0) {
    return { success: false, message: "Registra al menos una cantidad mayor a cero" }
  }

  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()
  const codigo = await generarCodigoOrden("PED")

  const subtotal = lineasValidas.reduce((acc, l) => acc + (l.precioUnitario ?? 0) * l.cantidad, 0)
  const valorDescuento = subtotal * (datos.descuentoPorcentaje / 100)
  const baseGravable = subtotal - valorDescuento
  const valorIva = datos.aplicaIva ? baseGravable * (datos.ivaPorcentaje / 100) : 0
  const total = baseGravable + valorIva

  const { data: pedido, error: errorPedido } = await db
    .from("pedidos")
    .insert({
      codigo,
      bodega_id: datos.bodegaId,
      cliente_id: datos.clienteId,
      vendedor_id: datos.vendedorId,
      fecha_pedido: fechaColombiaHoy(),
      fecha_entrega_programada: datos.fechaEntregaProgramada,
      condicion_pago: datos.condicionPago,
      numero_orden_compra: datos.numeroOrdenCompra,
      aplica_iva: datos.aplicaIva,
      iva_porcentaje: datos.ivaPorcentaje,
      descuento_porcentaje: datos.descuentoPorcentaje,
      subtotal,
      valor_descuento: valorDescuento,
      valor_iva: valorIva,
      total,
      estado: "pendiente",
      usuario_id: usuario?.id ?? null,
    })
    .select("id")
    .single()

  if (errorPedido || !pedido) {
    console.error("[avimol] Error creando pedido:", errorPedido)
    return { success: false, message: "No se pudo crear el pedido: " + errorPedido?.message }
  }

  const { error: errorDetalle } = await db.from("pedidos_detalle").insert(
    lineasValidas.map((l) => ({
      pedido_id: pedido.id,
      referencia_huevo_id: l.referenciaId,
      cantidad: l.cantidad,
      precio_unitario: l.precioUnitario,
      subtotal: l.precioUnitario != null ? l.precioUnitario * l.cantidad : null,
    })),
  )
  if (errorDetalle) {
    console.error("[avimol] Error creando detalle de pedido:", errorDetalle)
    return { success: false, message: "Error al registrar las referencias del pedido: " + errorDetalle.message }
  }

  // El pedido desencadena automáticamente la orden de cargue de despacho.
  const codigoOrden = await generarCodigoOrden("CAR")
  const { data: orden, error: errorOrden } = await db
    .from("ordenes_cargue")
    .insert({
      tipo_operacion: "cargue_despacho",
      bodega_id: datos.bodegaId,
      pedido_id: pedido.id,
      codigo: codigoOrden,
      estado: "pendiente",
      usuario_id: usuario?.id ?? null,
    })
    .select("id")
    .single()

  if (errorOrden) {
    console.error("[avimol] Error creando orden de despacho:", errorOrden)
    return { success: false, message: "Error al generar la orden de despacho: " + errorOrden.message }
  }

  return { success: true, codigo, ordenCargueId: orden?.id }
}

export async function confirmarFinDespacho(
  ordenId: number,
  accion: AccionCierreCargue = "cerrar",
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const orden = await obtenerOrdenConDetalle(ordenId)
  if (!orden) return { success: false, message: "Orden no encontrada" }
  if (orden.detalle.length === 0) return { success: false, message: "Agrega al menos una línea de despacho" }

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
      return {
        success: false,
        message: `Inventario insuficiente para ${linea.referencia_nombre} (lote ${linea.lote_huevo_codigo})`,
      }
    }

    await db
      .from("inventario_huevo")
      .update({
        cantidad_disponible: saldo.cantidad_disponible - linea.cantidad_cargada,
        actualizado_en: fechaHoraColombiaISO(),
      })
      .eq("id", saldo.id)

    await db.from("movimientos_inventario_huevo").insert({
      bodega_id: orden.bodega_id,
      lote_huevo_id: linea.lote_huevo_id,
      referencia_huevo_id: linea.referencia_huevo_id,
      anaquel_id: linea.anaquel_id,
      tipo_movimiento: "salida_cargue_despacho",
      cantidad: -linea.cantidad_cargada,
      orden_cargue_id: ordenId,
      pedido_id: orden.pedido?.id ?? null,
      usuario_id: usuario?.id ?? null,
      creado_en: fechaHoraColombiaISO(),
    })
  }

  const pesoTotalKg = orden.detalle.reduce((acc, l) => acc + (l.cantidad_cargada * l.peso_unitario_gramos) / 1000, 0)

  await db
    .from("ordenes_cargue")
    .update({ hora_fin_cargue: fechaHoraColombiaISO(), peso_total_kg: pesoTotalKg, estado: "cerrado" })
    .eq("id", ordenId)

  if (orden.pedido) {
    const progreso = await evaluarCierreOrdenCargue(ordenId)
    const accionFinal = progreso?.completo ? "cerrar" : accion
    await db
      .from("pedidos")
      .update({ estado: accionFinal === "cerrar" ? "cerrado" : "despachado" })
      .eq("id", orden.pedido.id)
  }

  return { success: true }
}

// Genera una orden de cargue adicional (despacho) sobre un pedido que
// quedó con remanente (despacho parcial) — otro viaje para completar lo
// que faltó.
export async function generarOrdenCargueAdicionalDespacho(
  pedidoId: number,
): Promise<{ success: boolean; message?: string; ordenCargueId?: number }> {
  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const { data: pedido, error: errorPedido } = await db
    .from("pedidos")
    .select("id, estado, bodega_id")
    .eq("id", pedidoId)
    .maybeSingle()

  if (errorPedido || !pedido) return { success: false, message: "Pedido no encontrado" }
  if (!["pendiente", "en_picking", "despachado"].includes(pedido.estado)) {
    return { success: false, message: "Este pedido ya no admite más órdenes de despacho" }
  }

  const { data: ordenAbierta } = await db
    .from("ordenes_cargue")
    .select("id, codigo")
    .eq("pedido_id", pedidoId)
    .eq("tipo_operacion", "cargue_despacho")
    .is("hora_fin_cargue", null)
    .neq("estado", "anulado")
    .maybeSingle()

  if (ordenAbierta) {
    return { success: false, message: `Ya hay una orden abierta: ${ordenAbierta.codigo}. Complétala o anúlala antes de generar otra.` }
  }

  const codigoOrden = await generarCodigoOrden("CAR")
  const { data: orden, error: errorOrden } = await db
    .from("ordenes_cargue")
    .insert({
      tipo_operacion: "cargue_despacho",
      bodega_id: pedido.bodega_id,
      pedido_id: pedidoId,
      codigo: codigoOrden,
      estado: "pendiente",
      usuario_id: usuario?.id ?? null,
    })
    .select("id")
    .single()

  if (errorOrden || !orden) {
    console.error("[avimol] Error generando orden de despacho adicional:", errorOrden)
    return { success: false, message: "No se pudo generar la orden: " + errorOrden?.message }
  }

  return { success: true, ordenCargueId: orden.id }
}

export interface ProgresoPedido {
  pedido: { id: number; codigo: string; estado: string; bodegaNombre: string; clienteNombre: string }
  lineas: LineaProgresoCargue[]
  ordenes: OrdenCargueResumen[]
}

export async function obtenerProgresoPedido(pedidoId: number): Promise<ProgresoPedido | null> {
  const db = getAvimolDb()

  const { data: pedido, error } = await db
    .from("pedidos")
    .select("id, codigo, estado, bodegas(nombre), clientes(nombre)")
    .eq("id", pedidoId)
    .maybeSingle()

  if (error || !pedido) return null

  const { data: detalleLineas } = await db
    .from("pedidos_detalle")
    .select("referencia_huevo_id, cantidad, referencias_huevo(nombre)")
    .eq("pedido_id", pedidoId)

  const origenLineas = (detalleLineas ?? []).map((l: any) => ({
    referenciaId: l.referencia_huevo_id,
    referenciaNombre: l.referencias_huevo?.nombre ?? "",
    cantidadSolicitada: l.cantidad,
  }))

  const lineas = await calcularProgresoCargue(origenLineas, "pedido_id", pedidoId)

  const { data: ordenesData } = await db
    .from("ordenes_cargue")
    .select(
      "id, codigo, tipo_operacion, bodega_id, estado, hora_llegada_vehiculo, hora_inicio_cargue, hora_fin_cargue, hora_inicio_descargue, hora_fin_descargue, peso_total_kg, bodegas(nombre)",
    )
    .eq("pedido_id", pedidoId)
    .order("id", { ascending: false })

  const ordenes: OrdenCargueResumen[] = (ordenesData ?? []).map((o: any) => ({
    id: o.id,
    codigo: o.codigo,
    tipo_operacion: o.tipo_operacion,
    bodega_id: o.bodega_id,
    bodega_nombre: o.bodegas?.nombre ?? "",
    estado: o.estado,
    hora_llegada_vehiculo: o.hora_llegada_vehiculo,
    hora_inicio_cargue: o.hora_inicio_cargue,
    hora_fin_cargue: o.hora_fin_cargue,
    hora_inicio_descargue: o.hora_inicio_descargue,
    hora_fin_descargue: o.hora_fin_descargue,
    peso_total_kg: o.peso_total_kg,
    solicitud_codigo: pedido.codigo,
  }))

  return {
    pedido: {
      id: pedido.id,
      codigo: pedido.codigo,
      estado: pedido.estado,
      bodegaNombre: (pedido as any).bodegas?.nombre ?? "",
      clienteNombre: (pedido as any).clientes?.nombre ?? "",
    },
    lineas,
    ordenes,
  }
}

export interface DisponibilidadLineaPedido {
  referenciaId: number
  referenciaNombre: string
  cantidadSolicitada: number
  cantidadDisponibleBodega: number
  suficiente: boolean
  otrasBodegas: DisponibilidadBodega[]
}

// Compara lo pedido contra el inventario real de la bodega que atenderá
// el despacho; si falta, trae dónde más hay stock (y qué lotes) para
// sugerir un traslado antes de hacer el picking.
export async function obtenerDisponibilidadPedido(ordenId: number): Promise<DisponibilidadLineaPedido[]> {
  const orden = await obtenerOrdenConDetalle(ordenId)
  if (!orden || !orden.pedido) return []

  const resultado: DisponibilidadLineaPedido[] = []
  for (const linea of orden.pedido.lineas) {
    const lotes = await obtenerLotesDisponibles(orden.bodega_id, linea.referenciaId)
    const cantidadDisponibleBodega = lotes.reduce((acc, l) => acc + l.cantidad_disponible, 0)
    const suficiente = cantidadDisponibleBodega >= linea.cantidadSolicitada
    const otrasBodegas = suficiente ? [] : await obtenerDisponibilidadOtrasBodegas(orden.bodega_id, linea.referenciaId)

    resultado.push({
      referenciaId: linea.referenciaId,
      referenciaNombre: linea.referenciaNombre,
      cantidadSolicitada: linea.cantidadSolicitada,
      cantidadDisponibleBodega,
      suficiente,
      otrasBodegas,
    })
  }
  return resultado
}

export async function registrarAveriaDespacho(
  ordenId: number,
  loteHuevoId: number,
  referenciaId: number,
  tipoAveria: TipoAveria,
  cantidad: number,
): Promise<{ success: boolean; message?: string }> {
  if (cantidad <= 0) return { success: false, message: "La cantidad debe ser mayor a cero" }

  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const { error } = await db.from("averias_huevo").insert({
    lote_huevo_id: loteHuevoId,
    referencia_huevo_id: referenciaId,
    etapa: "despacho",
    tipo_averia: tipoAveria,
    cantidad,
    orden_cargue_id: ordenId,
    usuario_id: usuario?.id ?? null,
  })

  if (error) {
    console.error("[avimol] Error registrando avería de despacho:", error)
    return { success: false, message: "No se pudo registrar la avería: " + error.message }
  }
  return { success: true }
}
