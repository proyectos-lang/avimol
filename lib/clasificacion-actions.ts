"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { fechaHoraColombiaISO } from "@/lib/date-utils"
import { generarCodigoOrden } from "@/lib/traslados-actions"
import { obtenerCostoCartonVigente } from "@/lib/cartones-actions"
import type { TipoAveria } from "@/lib/recoleccion-actions"

const HUEVOS_POR_CARTON = 30
export type MotivoCartonExtra = "refuerzo_buenos" | "rotos" | "averiados"

export interface ItemInventarioSinClasificar {
  id: number
  bodega_id: number
  lote_huevo_id: number
  lote_huevo_codigo: string
  fecha_cosecha: string
  edad_semanas_captura: number
  galpon_codigo: string
  color_id: number
  color_nombre: string
  anaquel_id: number | null
  anaquel_codigo: string | null
  cantidad_disponible: number
}

export async function listarInventarioSinClasificar(bodegaId: number): Promise<ItemInventarioSinClasificar[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("inventario_huevo_sin_clasificar")
    .select(
      `id, bodega_id, color_id, anaquel_id, cantidad_disponible,
       colores_huevo(nombre),
       anaqueles(codigo),
       lotes_huevo(id, codigo, fecha_cosecha, edad_semanas_captura, galpones(codigo))`,
    )
    .eq("bodega_id", bodegaId)
    .gt("cantidad_disponible", 0)
    .order("id", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando inventario sin clasificar:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    bodega_id: fila.bodega_id,
    lote_huevo_id: fila.lotes_huevo?.id,
    lote_huevo_codigo: fila.lotes_huevo?.codigo ?? "",
    fecha_cosecha: fila.lotes_huevo?.fecha_cosecha ?? "",
    edad_semanas_captura: fila.lotes_huevo?.edad_semanas_captura ?? 0,
    galpon_codigo: fila.lotes_huevo?.galpones?.codigo ?? "",
    color_id: fila.color_id,
    color_nombre: fila.colores_huevo?.nombre ?? "",
    anaquel_id: fila.anaquel_id,
    anaquel_codigo: fila.anaqueles?.codigo ?? null,
    cantidad_disponible: fila.cantidad_disponible,
  }))
}

export interface DatosClasificacion {
  bodegaId: number
  loteHuevoId: number
  colorId: number
  anaquelOrigenId: number | null
  cantidadEntrada: number
  salidas: { referenciaId: number; anaquelDestinoId: number | null; cantidad: number }[]
  averias: { tipoAveria: TipoAveria; cantidad: number }[]
  cartonesExtra: { motivo: MotivoCartonExtra; cantidad: number }[]
  observacionCartones: string | null
}

export async function registrarClasificacion(
  datos: DatosClasificacion,
): Promise<{ success: boolean; message?: string; codigo?: string }> {
  const salidasValidas = datos.salidas.filter((s) => s.cantidad > 0)
  const averiasValidas = datos.averias.filter((a) => a.cantidad > 0)

  if (datos.cantidadEntrada <= 0) {
    return { success: false, message: "La cantidad a clasificar debe ser mayor a cero" }
  }
  if (salidasValidas.length === 0 && averiasValidas.length === 0) {
    return { success: false, message: "Registra al menos una salida clasificada o una avería" }
  }

  const totalSalidas = salidasValidas.reduce((acc, s) => acc + s.cantidad, 0)
  const totalAverias = averiasValidas.reduce((acc, a) => acc + a.cantidad, 0)
  if (totalSalidas + totalAverias !== datos.cantidadEntrada) {
    return {
      success: false,
      message: `Lo que sale (${totalSalidas + totalAverias}) debe ser igual a lo que entra (${datos.cantidadEntrada})`,
    }
  }

  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  // Descontar el saldo sin clasificar tomado como entrada.
  let queryOrigen = db
    .from("inventario_huevo_sin_clasificar")
    .select("id, cantidad_disponible")
    .eq("bodega_id", datos.bodegaId)
    .eq("lote_huevo_id", datos.loteHuevoId)
    .eq("color_id", datos.colorId)
  queryOrigen = datos.anaquelOrigenId
    ? queryOrigen.eq("anaquel_id", datos.anaquelOrigenId)
    : queryOrigen.is("anaquel_id", null)
  const { data: saldoOrigen, error: errorSaldoOrigen } = await queryOrigen.maybeSingle()

  if (errorSaldoOrigen || !saldoOrigen || saldoOrigen.cantidad_disponible < datos.cantidadEntrada) {
    return {
      success: false,
      message: `Inventario sin clasificar insuficiente (disponible: ${saldoOrigen?.cantidad_disponible ?? 0})`,
    }
  }

  await db
    .from("inventario_huevo_sin_clasificar")
    .update({
      cantidad_disponible: saldoOrigen.cantidad_disponible - datos.cantidadEntrada,
      actualizado_en: fechaHoraColombiaISO(),
    })
    .eq("id", saldoOrigen.id)

  await db.from("movimientos_huevo_sin_clasificar").insert({
    bodega_id: datos.bodegaId,
    lote_huevo_id: datos.loteHuevoId,
    color_id: datos.colorId,
    anaquel_id: datos.anaquelOrigenId,
    tipo_movimiento: "salida_clasificacion",
    cantidad: -datos.cantidadEntrada,
    usuario_id: usuario?.id ?? null,
    creado_en: fechaHoraColombiaISO(),
  })

  const codigo = await generarCodigoOrden("CLA")

  const { data: clasificacion, error: errorClasificacion } = await db
    .from("clasificaciones")
    .insert({
      codigo,
      bodega_id: datos.bodegaId,
      lote_huevo_id: datos.loteHuevoId,
      color_id: datos.colorId,
      anaquel_origen_id: datos.anaquelOrigenId,
      cantidad_entrada: datos.cantidadEntrada,
      usuario_id: usuario?.id ?? null,
    })
    .select("id")
    .single()

  if (errorClasificacion || !clasificacion) {
    console.error("[avimol] Error creando clasificación:", errorClasificacion)
    return { success: false, message: "No se pudo registrar la clasificación: " + errorClasificacion?.message }
  }

  // Consumo de cartones: 1 cartón cada 30 huevos que salen ya
  // clasificados, redondeando hacia arriba (no se puede usar un cartón
  // fraccionado), más los cartones extra que el usuario justifique.
  const cartonesExtraValidos = datos.cartonesExtra.filter((c) => c.cantidad > 0)
  const cartonesCalculados = Math.ceil(totalSalidas / HUEVOS_POR_CARTON)
  const totalCartonesExtra = cartonesExtraValidos.reduce((acc, c) => acc + c.cantidad, 0)
  const totalCartonesUsados = cartonesCalculados + totalCartonesExtra

  if (totalCartonesUsados > 0) {
    const { data: saldoCarton, error: errorSaldoCarton } = await db
      .from("inventario_cartones")
      .select("id, cantidad_disponible")
      .eq("bodega_id", datos.bodegaId)
      .maybeSingle()

    if (errorSaldoCarton || !saldoCarton || saldoCarton.cantidad_disponible < totalCartonesUsados) {
      return {
        success: false,
        message: `No hay suficientes cartones en esta bodega (disponibles: ${saldoCarton?.cantidad_disponible ?? 0}, necesarios: ${totalCartonesUsados})`,
      }
    }

    const costoVigente = await obtenerCostoCartonVigente()
    const costoUnitarioAplicado = costoVigente?.valor ?? null
    const costoTotalCartones = costoUnitarioAplicado != null ? costoUnitarioAplicado * totalCartonesUsados : null

    await db
      .from("inventario_cartones")
      .update({
        cantidad_disponible: saldoCarton.cantidad_disponible - totalCartonesUsados,
        actualizado_en: fechaHoraColombiaISO(),
      })
      .eq("id", saldoCarton.id)

    await db.from("movimientos_cartones").insert({
      bodega_id: datos.bodegaId,
      tipo_movimiento: "salida_clasificacion",
      cantidad: -totalCartonesUsados,
      costo_unitario: costoUnitarioAplicado,
      clasificacion_id: clasificacion.id,
      observaciones: datos.observacionCartones,
      usuario_id: usuario?.id ?? null,
      creado_en: fechaHoraColombiaISO(),
    })

    await db
      .from("clasificaciones")
      .update({
        cartones_calculados: cartonesCalculados,
        cartones_extra: totalCartonesExtra,
        costo_carton_id: costoVigente?.id ?? null,
        costo_unitario_aplicado: costoUnitarioAplicado,
        costo_total_cartones: costoTotalCartones,
      })
      .eq("id", clasificacion.id)

    if (cartonesExtraValidos.length > 0) {
      await db.from("clasificaciones_cartones_extra").insert(
        cartonesExtraValidos.map((c) => ({
          clasificacion_id: clasificacion.id,
          motivo: c.motivo,
          cantidad: c.cantidad,
          observacion: datos.observacionCartones,
        })),
      )
    }
  }

  if (salidasValidas.length > 0) {
    await db.from("clasificaciones_detalle").insert(
      salidasValidas.map((s) => ({
        clasificacion_id: clasificacion.id,
        referencia_huevo_id: s.referenciaId,
        anaquel_destino_id: s.anaquelDestinoId,
        cantidad: s.cantidad,
      })),
    )
  }

  for (const salida of salidasValidas) {
    let queryDestino = db
      .from("inventario_huevo")
      .select("id, cantidad_disponible")
      .eq("bodega_id", datos.bodegaId)
      .eq("lote_huevo_id", datos.loteHuevoId)
      .eq("referencia_huevo_id", salida.referenciaId)
    queryDestino = salida.anaquelDestinoId
      ? queryDestino.eq("anaquel_id", salida.anaquelDestinoId)
      : queryDestino.is("anaquel_id", null)
    const { data: existente } = await queryDestino.maybeSingle()

    if (existente) {
      await db
        .from("inventario_huevo")
        .update({
          cantidad_disponible: existente.cantidad_disponible + salida.cantidad,
          actualizado_en: fechaHoraColombiaISO(),
        })
        .eq("id", existente.id)
    } else {
      await db.from("inventario_huevo").insert({
        bodega_id: datos.bodegaId,
        lote_huevo_id: datos.loteHuevoId,
        referencia_huevo_id: salida.referenciaId,
        anaquel_id: salida.anaquelDestinoId,
        cantidad_disponible: salida.cantidad,
      })
    }

    let queryDetalleLote = db
      .from("lotes_huevo_detalle")
      .select("id, cantidad")
      .eq("lote_huevo_id", datos.loteHuevoId)
      .eq("referencia_huevo_id", salida.referenciaId)
    queryDetalleLote = salida.anaquelDestinoId
      ? queryDetalleLote.eq("anaquel_id", salida.anaquelDestinoId)
      : queryDetalleLote.is("anaquel_id", null)
    const { data: detalleExistente } = await queryDetalleLote.maybeSingle()

    if (detalleExistente) {
      await db
        .from("lotes_huevo_detalle")
        .update({ cantidad: detalleExistente.cantidad + salida.cantidad })
        .eq("id", detalleExistente.id)
    } else {
      await db.from("lotes_huevo_detalle").insert({
        lote_huevo_id: datos.loteHuevoId,
        referencia_huevo_id: salida.referenciaId,
        anaquel_id: salida.anaquelDestinoId,
        cantidad: salida.cantidad,
      })
    }

    await db.from("movimientos_inventario_huevo").insert({
      bodega_id: datos.bodegaId,
      lote_huevo_id: datos.loteHuevoId,
      referencia_huevo_id: salida.referenciaId,
      anaquel_id: salida.anaquelDestinoId,
      tipo_movimiento: "entrada_clasificacion",
      cantidad: salida.cantidad,
      usuario_id: usuario?.id ?? null,
      creado_en: fechaHoraColombiaISO(),
    })
  }

  if (averiasValidas.length > 0) {
    await db.from("averias_huevo").insert(
      averiasValidas.map((a) => ({
        lote_huevo_id: datos.loteHuevoId,
        referencia_huevo_id: null,
        etapa: "clasificacion",
        tipo_averia: a.tipoAveria,
        cantidad: a.cantidad,
        clasificacion_id: clasificacion.id,
        usuario_id: usuario?.id ?? null,
      })),
    )
  }

  return { success: true, codigo }
}
