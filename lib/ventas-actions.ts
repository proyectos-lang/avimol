"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { fechaHoraColombiaISO } from "@/lib/date-utils"
import { generarCodigoOrden } from "@/lib/traslados-actions"

export interface InventarioDisponibleReferencia {
  referenciaId: number
  referenciaNombre: string
  imagenUrl: string | null
  pesoGramos: number
  cantidadDisponible: number
}

// Saldo disponible de la bodega agrupado por referencia (suma de todos
// los lotes/anaqueles) — lo que el punto de venta necesita mostrar al
// cajero, sin que tenga que pensar en lotes.
export async function obtenerInventarioDisponiblePorBodega(bodegaId: number): Promise<InventarioDisponibleReferencia[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("inventario_huevo")
    .select("referencia_huevo_id, cantidad_disponible, referencias_huevo(nombre, imagen_url, peso_unitario_gramos)")
    .eq("bodega_id", bodegaId)
    .gt("cantidad_disponible", 0)

  if (error) {
    console.error("[avimol] Error obteniendo inventario disponible por bodega:", error)
    return []
  }

  const totales = new Map<number, InventarioDisponibleReferencia>()
  for (const fila of (data ?? []) as any[]) {
    const existente = totales.get(fila.referencia_huevo_id)
    if (existente) {
      existente.cantidadDisponible += fila.cantidad_disponible
    } else {
      totales.set(fila.referencia_huevo_id, {
        referenciaId: fila.referencia_huevo_id,
        referenciaNombre: fila.referencias_huevo?.nombre ?? "",
        imagenUrl: fila.referencias_huevo?.imagen_url ?? null,
        pesoGramos: fila.referencias_huevo?.peso_unitario_gramos ?? 0,
        cantidadDisponible: fila.cantidad_disponible,
      })
    }
  }
  return Array.from(totales.values())
}

export interface DatosVentaDirecta {
  bodegaId: number
  clienteId: number | null
  lineas: { referenciaId: number; cantidad: number; precioUnitario: number | null }[]
}

export async function crearVentaDirecta(
  datos: DatosVentaDirecta,
): Promise<{ success: boolean; message?: string; codigo?: string; total?: number }> {
  const lineasValidas = datos.lineas.filter((l) => l.cantidad > 0)
  if (lineasValidas.length === 0) {
    return { success: false, message: "Registra al menos una cantidad mayor a cero" }
  }

  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  // FIFO automático: para cada referencia, toma primero los lotes con
  // fecha de cosecha más antigua hasta cubrir la cantidad vendida. El
  // punto de venta es una transacción rápida de mostrador — no tiene
  // sentido pedirle al cajero que elija el lote a mano como sí ocurre
  // en el picking de despacho.
  const asignaciones: { loteHuevoId: number; referenciaId: number; cantidad: number }[] = []

  for (const linea of lineasValidas) {
    const { data: saldos, error: errorSaldos } = await db
      .from("inventario_huevo")
      .select("id, lote_huevo_id, cantidad_disponible, lotes_huevo(fecha_cosecha)")
      .eq("bodega_id", datos.bodegaId)
      .eq("referencia_huevo_id", linea.referenciaId)
      .gt("cantidad_disponible", 0)

    if (errorSaldos) {
      return { success: false, message: "Error consultando inventario: " + errorSaldos.message }
    }

    const disponibles = (saldos ?? []).sort((a: any, b: any) =>
      (a.lotes_huevo?.fecha_cosecha ?? "").localeCompare(b.lotes_huevo?.fecha_cosecha ?? ""),
    )

    const totalDisponible = disponibles.reduce((acc: number, s: any) => acc + s.cantidad_disponible, 0)
    if (totalDisponible < linea.cantidad) {
      return {
        success: false,
        message: `Inventario insuficiente para esta referencia (disponible: ${totalDisponible})`,
      }
    }

    let restante = linea.cantidad
    for (const saldo of disponibles as any[]) {
      if (restante <= 0) break
      const tomar = Math.min(restante, saldo.cantidad_disponible)
      asignaciones.push({ loteHuevoId: saldo.lote_huevo_id, referenciaId: linea.referenciaId, cantidad: tomar })
      restante -= tomar
    }
  }

  const codigo = await generarCodigoOrden("VEN")
  const total = lineasValidas.reduce(
    (acc, l) => acc + (l.precioUnitario != null ? l.precioUnitario * l.cantidad : 0),
    0,
  )
  const totalConPrecio = lineasValidas.some((l) => l.precioUnitario != null) ? total : null

  const { data: venta, error: errorVenta } = await db
    .from("ventas_directas")
    .insert({
      codigo,
      bodega_id: datos.bodegaId,
      cliente_id: datos.clienteId,
      fecha: fechaHoraColombiaISO(),
      usuario_id: usuario?.id ?? null,
      total: totalConPrecio,
    })
    .select("id")
    .single()

  if (errorVenta || !venta) {
    console.error("[avimol] Error creando venta directa:", errorVenta)
    return { success: false, message: "No se pudo crear la venta: " + errorVenta?.message }
  }

  const precioPorReferencia = new Map(lineasValidas.map((l) => [l.referenciaId, l.precioUnitario]))

  for (const asignacion of asignaciones) {
    const precioUnitario = precioPorReferencia.get(asignacion.referenciaId) ?? null

    const { error: errorDetalle } = await db.from("ventas_directas_detalle").insert({
      venta_directa_id: venta.id,
      lote_huevo_id: asignacion.loteHuevoId,
      referencia_huevo_id: asignacion.referenciaId,
      cantidad: asignacion.cantidad,
      precio_unitario: precioUnitario,
      subtotal: precioUnitario != null ? precioUnitario * asignacion.cantidad : null,
    })
    if (errorDetalle) {
      console.error("[avimol] Error insertando detalle de venta:", errorDetalle)
      return { success: false, message: "Error al registrar el detalle de venta: " + errorDetalle.message }
    }

    const { data: saldo } = await db
      .from("inventario_huevo")
      .select("id, cantidad_disponible")
      .eq("bodega_id", datos.bodegaId)
      .eq("lote_huevo_id", asignacion.loteHuevoId)
      .eq("referencia_huevo_id", asignacion.referenciaId)
      .maybeSingle()

    if (saldo) {
      await db
        .from("inventario_huevo")
        .update({
          cantidad_disponible: saldo.cantidad_disponible - asignacion.cantidad,
          actualizado_en: fechaHoraColombiaISO(),
        })
        .eq("id", saldo.id)
    }

    await db.from("movimientos_inventario_huevo").insert({
      bodega_id: datos.bodegaId,
      lote_huevo_id: asignacion.loteHuevoId,
      referencia_huevo_id: asignacion.referenciaId,
      tipo_movimiento: "salida_venta_directa",
      cantidad: -asignacion.cantidad,
      venta_directa_id: venta.id,
      usuario_id: usuario?.id ?? null,
      creado_en: fechaHoraColombiaISO(),
    })
  }

  return { success: true, codigo, total: totalConPrecio ?? undefined }
}

export interface VentaDirecta {
  id: number
  codigo: string
  bodega_nombre: string
  cliente_nombre: string | null
  fecha: string
  total: number | null
  unidades: number
}

export async function listarVentasDirectas(): Promise<VentaDirecta[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("ventas_directas")
    .select("id, codigo, fecha, total, bodegas(nombre), clientes(nombre), ventas_directas_detalle(cantidad)")
    .order("id", { ascending: false })

  if (error) {
    console.error("[avimol] Error listando ventas directas:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    codigo: fila.codigo,
    bodega_nombre: fila.bodegas?.nombre ?? "",
    cliente_nombre: fila.clientes?.nombre ?? null,
    fecha: fila.fecha,
    total: fila.total,
    unidades: (fila.ventas_directas_detalle ?? []).reduce((acc: number, d: any) => acc + d.cantidad, 0),
  }))
}

export interface LineaDetalleVenta {
  referenciaNombre: string
  cantidad: number
  precioUnitario: number | null
  subtotal: number | null
}

export async function obtenerDetalleVenta(ventaId: number): Promise<LineaDetalleVenta[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("ventas_directas_detalle")
    .select("cantidad, precio_unitario, subtotal, referencias_huevo(nombre)")
    .eq("venta_directa_id", ventaId)

  if (error) {
    console.error("[avimol] Error obteniendo detalle de venta:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    referenciaNombre: fila.referencias_huevo?.nombre ?? "",
    cantidad: fila.cantidad,
    precioUnitario: fila.precio_unitario,
    subtotal: fila.subtotal,
  }))
}
