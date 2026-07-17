"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface FiltrosIndicadores {
  fechaInicio?: string
  fechaFin?: string
  galponId?: number | null
  bodegaId?: number | null
}

// Resuelve los lote_huevo.id que cumplen los filtros de galpón/bodega/fecha
// de cosecha — paso previo para no encadenar filtros sobre joins anidados
// de 2+ niveles (frágil con PostgREST), siguiendo el mismo criterio usado
// en listarLotesHuevoPorGalponYFecha.
async function resolverLoteHuevoIds(filtros: FiltrosIndicadores): Promise<number[] | null> {
  const { galponId, bodegaId, fechaInicio, fechaFin } = filtros
  if (!galponId && !bodegaId && !fechaInicio && !fechaFin) return null

  const db = getAvimolDb()
  let query = db.from("lotes_huevo").select("id")
  if (galponId) query = query.eq("galpon_id", galponId)
  if (bodegaId) query = query.eq("bodega_id", bodegaId)
  if (fechaInicio) query = query.gte("fecha_cosecha", fechaInicio)
  if (fechaFin) query = query.lte("fecha_cosecha", fechaFin)

  const { data, error } = await query
  if (error) {
    console.error("[avimol] Error resolviendo lotes de huevo para indicadores:", error)
    return []
  }
  return (data ?? []).map((f: any) => f.id)
}

// Igual que resolverLoteHuevoIds pero sin filtro de fecha (la fecha de
// Clasificación es clasificaciones.creado_en, no fecha_cosecha).
async function resolverLoteHuevoIdsPorGalpon(galponId?: number | null): Promise<number[] | null> {
  if (!galponId) return null
  const db = getAvimolDb()
  const { data, error } = await db.from("lotes_huevo").select("id").eq("galpon_id", galponId)
  if (error) {
    console.error("[avimol] Error resolviendo lotes de huevo por galpón:", error)
    return []
  }
  return (data ?? []).map((f: any) => f.id)
}

// ------------------------------------------------------------------
// Recolección
// ------------------------------------------------------------------

export interface CantidadPorGalpon {
  galponId: number
  galponCodigo: string
  galponNombre: string
  cantidad: number
}

export interface CantidadPorColor {
  colorId: number
  colorNombre: string
  cantidad: number
}

export interface AveriaRecoleccionPorGalpon {
  galponId: number
  galponCodigo: string
  galponNombre: string
  buenos: number
  picado: number
  roto: number
  partido: number
  totalAverias: number
  porcentajeAverias: number
}

export interface IndicadoresRecoleccion {
  porGalpon: CantidadPorGalpon[]
  porColor: CantidadPorColor[]
  averiasPorGalpon: AveriaRecoleccionPorGalpon[]
  totalRecolectado: number
  totalBuenos: number
  totalPicado: number
  totalRoto: number
  totalPartido: number
  totalAverias: number
  porcentajeAveriasTotal: number
}

const INDICADORES_RECOLECCION_VACIO: IndicadoresRecoleccion = {
  porGalpon: [],
  porColor: [],
  averiasPorGalpon: [],
  totalRecolectado: 0,
  totalBuenos: 0,
  totalPicado: 0,
  totalRoto: 0,
  totalPartido: 0,
  totalAverias: 0,
  porcentajeAveriasTotal: 0,
}

// Las averías de recolección (averias_huevo con etapa='recoleccion') nunca
// tienen color/tipo asociado (referencia_huevo_id siempre null en el
// insert de registrarRecoleccion) — por eso averiasPorGalpon solo se
// agrupa por galpón, mientras que porColor sale de una fuente distinta
// (movimientos_huevo_sin_clasificar, que sí trae color_id).
export async function obtenerIndicadoresRecoleccion(filtros: FiltrosIndicadores): Promise<IndicadoresRecoleccion> {
  const db = getAvimolDb()
  const loteHuevoIds = await resolverLoteHuevoIds(filtros)
  if (loteHuevoIds && loteHuevoIds.length === 0) return INDICADORES_RECOLECCION_VACIO

  let queryMov = db
    .from("movimientos_huevo_sin_clasificar")
    .select("cantidad, color_id, lote_huevo_id, colores_huevo(nombre), lotes_huevo(galpon_id, galpones(id, codigo, nombre))")
    .eq("tipo_movimiento", "entrada_cosecha")
  if (loteHuevoIds) queryMov = queryMov.in("lote_huevo_id", loteHuevoIds)

  const { data: movimientos, error: errorMov } = await queryMov
  if (errorMov) {
    console.error("[avimol] Error obteniendo cantidades recolectadas:", errorMov)
    return INDICADORES_RECOLECCION_VACIO
  }

  const porGalponMap = new Map<number, CantidadPorGalpon>()
  const porColorMap = new Map<number, CantidadPorColor>()
  let totalRecolectado = 0

  for (const fila of (movimientos ?? []) as any[]) {
    const galpon = fila.lotes_huevo?.galpones
    if (!galpon) continue
    totalRecolectado += fila.cantidad

    const g = porGalponMap.get(galpon.id) ?? {
      galponId: galpon.id,
      galponCodigo: galpon.codigo,
      galponNombre: galpon.nombre,
      cantidad: 0,
    }
    g.cantidad += fila.cantidad
    porGalponMap.set(galpon.id, g)

    const c = porColorMap.get(fila.color_id) ?? {
      colorId: fila.color_id,
      colorNombre: fila.colores_huevo?.nombre ?? "",
      cantidad: 0,
    }
    c.cantidad += fila.cantidad
    porColorMap.set(fila.color_id, c)
  }

  let queryAverias = db
    .from("averias_huevo")
    .select("tipo_averia, cantidad, lote_huevo_id, lotes_huevo(galpon_id, galpones(id, codigo, nombre))")
    .eq("etapa", "recoleccion")
    .neq("estado", "rechazada")
  if (loteHuevoIds) queryAverias = queryAverias.in("lote_huevo_id", loteHuevoIds)

  const { data: averias, error: errorAverias } = await queryAverias
  if (errorAverias) {
    console.error("[avimol] Error obteniendo averías de recolección:", errorAverias)
  }

  const averiasPorGalponMap = new Map<number, AveriaRecoleccionPorGalpon>()
  let totalPicado = 0
  let totalRoto = 0
  let totalPartido = 0

  for (const fila of (averias ?? []) as any[]) {
    const galpon = fila.lotes_huevo?.galpones
    if (!galpon) continue

    const a = averiasPorGalponMap.get(galpon.id) ?? {
      galponId: galpon.id,
      galponCodigo: galpon.codigo,
      galponNombre: galpon.nombre,
      buenos: porGalponMap.get(galpon.id)?.cantidad ?? 0,
      picado: 0,
      roto: 0,
      partido: 0,
      totalAverias: 0,
      porcentajeAverias: 0,
    }
    if (fila.tipo_averia === "picado") {
      a.picado += fila.cantidad
      totalPicado += fila.cantidad
    } else if (fila.tipo_averia === "roto") {
      a.roto += fila.cantidad
      totalRoto += fila.cantidad
    } else if (fila.tipo_averia === "partido") {
      a.partido += fila.cantidad
      totalPartido += fila.cantidad
    }
    a.totalAverias += fila.cantidad
    a.buenos = Math.max(0, (porGalponMap.get(galpon.id)?.cantidad ?? 0) - a.totalAverias)
    averiasPorGalponMap.set(galpon.id, a)
  }

  for (const a of averiasPorGalponMap.values()) {
    const recolectadoGalpon = porGalponMap.get(a.galponId)?.cantidad ?? 0
    a.porcentajeAverias = recolectadoGalpon > 0 ? Math.round((a.totalAverias / recolectadoGalpon) * 1000) / 10 : 0
  }

  const totalAverias = totalPicado + totalRoto + totalPartido
  const totalBuenos = Math.max(0, totalRecolectado - totalAverias)

  return {
    porGalpon: Array.from(porGalponMap.values()).sort((a, b) => b.cantidad - a.cantidad),
    porColor: Array.from(porColorMap.values()).sort((a, b) => b.cantidad - a.cantidad),
    averiasPorGalpon: Array.from(averiasPorGalponMap.values()).sort((a, b) => b.totalAverias - a.totalAverias),
    totalRecolectado,
    totalBuenos,
    totalPicado,
    totalRoto,
    totalPartido,
    totalAverias,
    porcentajeAveriasTotal: totalRecolectado > 0 ? Math.round((totalAverias / totalRecolectado) * 1000) / 10 : 0,
  }
}

// ------------------------------------------------------------------
// Clasificación
// ------------------------------------------------------------------

export interface CantidadPorGalponYTipo {
  galponId: number
  galponCodigo: string
  galponNombre: string
  referenciaId: number
  referenciaNombre: string
  cantidad: number
}

export interface AveriaClasificacionPorGalponYColor {
  galponId: number
  galponCodigo: string
  galponNombre: string
  colorId: number
  colorNombre: string
  buenos: number
  picado: number
  roto: number
  partido: number
  totalAverias: number
  porcentajeAverias: number
}

export interface IndicadoresClasificacion {
  porGalponYTipo: CantidadPorGalponYTipo[]
  averiasPorGalponYColor: AveriaClasificacionPorGalponYColor[]
  totalClasificado: number
  totalBuenos: number
  totalPicado: number
  totalRoto: number
  totalPartido: number
  totalAverias: number
  porcentajeAveriasTotal: number
}

const INDICADORES_CLASIFICACION_VACIO: IndicadoresClasificacion = {
  porGalponYTipo: [],
  averiasPorGalponYColor: [],
  totalClasificado: 0,
  totalBuenos: 0,
  totalPicado: 0,
  totalRoto: 0,
  totalPartido: 0,
  totalAverias: 0,
  porcentajeAveriasTotal: 0,
}

// Las averías de clasificación (etapa='clasificacion') tampoco tienen
// referencia_huevo_id (siempre null en registrarClasificacion), pero sí
// se pueden atribuir a un color vía clasificaciones.color_id — de ahí
// que averiasPorGalponYColor vaya por color y porGalponYTipo (que sale
// de clasificaciones_detalle) vaya por tipo real. Son dos tablas con
// distinta granularidad porque es lo máximo que el dato soporta.
export async function obtenerIndicadoresClasificacion(filtros: FiltrosIndicadores): Promise<IndicadoresClasificacion> {
  const db = getAvimolDb()
  const loteHuevoIds = await resolverLoteHuevoIdsPorGalpon(filtros.galponId)
  if (loteHuevoIds && loteHuevoIds.length === 0) return INDICADORES_CLASIFICACION_VACIO

  let queryClasif = db
    .from("clasificaciones")
    .select(
      "id, cantidad_entrada, color_id, colores_huevo(nombre), lote_huevo_id, creado_en, lotes_huevo(galpon_id, galpones(id, codigo, nombre))",
    )
  if (loteHuevoIds) queryClasif = queryClasif.in("lote_huevo_id", loteHuevoIds)
  if (filtros.bodegaId) queryClasif = queryClasif.eq("bodega_id", filtros.bodegaId)
  if (filtros.fechaInicio) queryClasif = queryClasif.gte("creado_en", filtros.fechaInicio)
  if (filtros.fechaFin) queryClasif = queryClasif.lte("creado_en", filtros.fechaFin + "T23:59:59")

  const { data: clasificaciones, error: errorClasif } = await queryClasif
  if (errorClasif) {
    console.error("[avimol] Error obteniendo clasificaciones para indicadores:", errorClasif)
    return INDICADORES_CLASIFICACION_VACIO
  }

  const clasificacionIds = (clasificaciones ?? []).map((c: any) => c.id)
  if (clasificacionIds.length === 0) return INDICADORES_CLASIFICACION_VACIO

  const clasifPorId = new Map(
    (clasificaciones ?? []).map((c: any) => [
      c.id,
      {
        galpon: c.lotes_huevo?.galpones ?? null,
        colorId: c.color_id,
        colorNombre: c.colores_huevo?.nombre ?? "",
        cantidadEntrada: c.cantidad_entrada,
      },
    ]),
  )

  const { data: detalle, error: errorDetalle } = await db
    .from("clasificaciones_detalle")
    .select("cantidad, referencia_huevo_id, referencias_huevo(nombre), clasificacion_id")
    .in("clasificacion_id", clasificacionIds)

  if (errorDetalle) {
    console.error("[avimol] Error obteniendo detalle de clasificaciones:", errorDetalle)
  }

  const porGalponYTipoMap = new Map<string, CantidadPorGalponYTipo>()
  let totalClasificado = 0

  for (const fila of (detalle ?? []) as any[]) {
    const info = clasifPorId.get(fila.clasificacion_id)
    if (!info?.galpon) continue
    totalClasificado += fila.cantidad

    const clave = `${info.galpon.id}__${fila.referencia_huevo_id}`
    const existente = porGalponYTipoMap.get(clave) ?? {
      galponId: info.galpon.id,
      galponCodigo: info.galpon.codigo,
      galponNombre: info.galpon.nombre,
      referenciaId: fila.referencia_huevo_id,
      referenciaNombre: fila.referencias_huevo?.nombre ?? "",
      cantidad: 0,
    }
    existente.cantidad += fila.cantidad
    porGalponYTipoMap.set(clave, existente)
  }

  const { data: averias, error: errorAverias } = await db
    .from("averias_huevo")
    .select("tipo_averia, cantidad, clasificacion_id")
    .eq("etapa", "clasificacion")
    .neq("estado", "rechazada")
    .in("clasificacion_id", clasificacionIds)

  if (errorAverias) {
    console.error("[avimol] Error obteniendo averías de clasificación:", errorAverias)
  }

  const averiasPorClasificacion = new Map<number, { picado: number; roto: number; partido: number; total: number }>()
  let totalPicado = 0
  let totalRoto = 0
  let totalPartido = 0

  for (const fila of (averias ?? []) as any[]) {
    const acc = averiasPorClasificacion.get(fila.clasificacion_id) ?? { picado: 0, roto: 0, partido: 0, total: 0 }
    if (fila.tipo_averia === "picado") {
      acc.picado += fila.cantidad
      totalPicado += fila.cantidad
    } else if (fila.tipo_averia === "roto") {
      acc.roto += fila.cantidad
      totalRoto += fila.cantidad
    } else if (fila.tipo_averia === "partido") {
      acc.partido += fila.cantidad
      totalPartido += fila.cantidad
    }
    acc.total += fila.cantidad
    averiasPorClasificacion.set(fila.clasificacion_id, acc)
  }

  const averiasPorGalponYColorMap = new Map<string, AveriaClasificacionPorGalponYColor>()

  for (const [clasifId, info] of clasifPorId.entries()) {
    if (!info.galpon) continue
    const acc = averiasPorClasificacion.get(clasifId) ?? { picado: 0, roto: 0, partido: 0, total: 0 }

    const clave = `${info.galpon.id}__${info.colorId}`
    const existente = averiasPorGalponYColorMap.get(clave) ?? {
      galponId: info.galpon.id,
      galponCodigo: info.galpon.codigo,
      galponNombre: info.galpon.nombre,
      colorId: info.colorId,
      colorNombre: info.colorNombre,
      buenos: 0,
      picado: 0,
      roto: 0,
      partido: 0,
      totalAverias: 0,
      porcentajeAverias: 0,
    }
    existente.buenos += Math.max(0, info.cantidadEntrada - acc.total)
    existente.picado += acc.picado
    existente.roto += acc.roto
    existente.partido += acc.partido
    existente.totalAverias += acc.total
    averiasPorGalponYColorMap.set(clave, existente)
  }

  for (const a of averiasPorGalponYColorMap.values()) {
    const entradaGrupo = a.buenos + a.totalAverias
    a.porcentajeAverias = entradaGrupo > 0 ? Math.round((a.totalAverias / entradaGrupo) * 1000) / 10 : 0
  }

  const totalAverias = totalPicado + totalRoto + totalPartido
  const totalBuenos = Math.max(0, totalClasificado - totalAverias)

  return {
    porGalponYTipo: Array.from(porGalponYTipoMap.values()).sort((a, b) => b.cantidad - a.cantidad),
    averiasPorGalponYColor: Array.from(averiasPorGalponYColorMap.values()).sort((a, b) => b.totalAverias - a.totalAverias),
    totalClasificado,
    totalBuenos,
    totalPicado,
    totalRoto,
    totalPartido,
    totalAverias,
    porcentajeAveriasTotal: totalClasificado > 0 ? Math.round((totalAverias / totalClasificado) * 1000) / 10 : 0,
  }
}

// ------------------------------------------------------------------
// Cartones
// ------------------------------------------------------------------

export interface ConsumoCartonPorMotivo {
  motivo: string
  cantidad: number
}

export interface CartonesPorGalpon {
  galponId: number
  galponCodigo: string
  galponNombre: string
  normal: number
  extra: number
  total: number
}

export interface IndicadorCartones {
  consumoNormal: number
  consumoExtraPorMotivo: ConsumoCartonPorMotivo[]
  totalExtra: number
  totalGeneral: number
  porGalpon: CartonesPorGalpon[]
}

const INDICADOR_CARTONES_VACIO: IndicadorCartones = {
  consumoNormal: 0,
  consumoExtraPorMotivo: [],
  totalExtra: 0,
  totalGeneral: 0,
  porGalpon: [],
}

// "Normal" = cartones_calculados (esperado por la cantidad clasificada);
// refuerzo/rotos/averiados = clasificaciones_cartones_extra agrupado por
// motivo (los 3 valores posibles del CHECK de esa columna).
export async function obtenerIndicadorCartones(filtros: FiltrosIndicadores): Promise<IndicadorCartones> {
  const db = getAvimolDb()
  const loteHuevoIds = await resolverLoteHuevoIdsPorGalpon(filtros.galponId)
  if (loteHuevoIds && loteHuevoIds.length === 0) return INDICADOR_CARTONES_VACIO

  let query = db
    .from("clasificaciones")
    .select(
      "cartones_calculados, lote_huevo_id, creado_en, lotes_huevo(galpon_id, galpones(id, codigo, nombre)), clasificaciones_cartones_extra(motivo, cantidad)",
    )
  if (loteHuevoIds) query = query.in("lote_huevo_id", loteHuevoIds)
  if (filtros.bodegaId) query = query.eq("bodega_id", filtros.bodegaId)
  if (filtros.fechaInicio) query = query.gte("creado_en", filtros.fechaInicio)
  if (filtros.fechaFin) query = query.lte("creado_en", filtros.fechaFin + "T23:59:59")

  const { data, error } = await query
  if (error) {
    console.error("[avimol] Error obteniendo consumo de cartones:", error)
    return INDICADOR_CARTONES_VACIO
  }

  let consumoNormal = 0
  const consumoExtraPorMotivoMap = new Map<string, number>()
  const porGalponMap = new Map<number, CartonesPorGalpon>()

  for (const fila of (data ?? []) as any[]) {
    const galpon = fila.lotes_huevo?.galpones
    if (!galpon) continue

    const extra = ((fila.clasificaciones_cartones_extra ?? []) as any[]).reduce((acc, e) => acc + e.cantidad, 0)
    consumoNormal += fila.cartones_calculados

    for (const e of (fila.clasificaciones_cartones_extra ?? []) as any[]) {
      consumoExtraPorMotivoMap.set(e.motivo, (consumoExtraPorMotivoMap.get(e.motivo) ?? 0) + e.cantidad)
    }

    const g = porGalponMap.get(galpon.id) ?? {
      galponId: galpon.id,
      galponCodigo: galpon.codigo,
      galponNombre: galpon.nombre,
      normal: 0,
      extra: 0,
      total: 0,
    }
    g.normal += fila.cartones_calculados
    g.extra += extra
    g.total += fila.cartones_calculados + extra
    porGalponMap.set(galpon.id, g)
  }

  const totalExtra = Array.from(consumoExtraPorMotivoMap.values()).reduce((acc, v) => acc + v, 0)

  return {
    consumoNormal,
    consumoExtraPorMotivo: Array.from(consumoExtraPorMotivoMap.entries()).map(([motivo, cantidad]) => ({ motivo, cantidad })),
    totalExtra,
    totalGeneral: consumoNormal + totalExtra,
    porGalpon: Array.from(porGalponMap.values()).sort((a, b) => b.total - a.total),
  }
}
