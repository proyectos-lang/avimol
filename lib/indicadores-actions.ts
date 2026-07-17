"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface InventarioActualFila {
  bodegaNombre: string
  referenciaNombre: string
  cantidad: number
  edadPromedioSemanas: number
}

// Inventario actual agrupado por bodega + referencia, con la edad
// promedio (ponderada por cantidad) del huevo que hay en ese grupo —
// responde "¿qué tengo y de qué tan viejas son las gallinas?".
export async function obtenerInventarioActual(): Promise<InventarioActualFila[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("inventario_huevo")
    .select("cantidad_disponible, bodegas(nombre), referencias_huevo(nombre), lotes_huevo(edad_semanas_captura)")
    .gt("cantidad_disponible", 0)

  if (error) {
    console.error("[avimol] Error obteniendo inventario actual:", error)
    return []
  }

  const grupos = new Map<string, { bodegaNombre: string; referenciaNombre: string; cantidad: number; edadPonderada: number }>()

  for (const fila of (data ?? []) as any[]) {
    const bodegaNombre = fila.bodegas?.nombre ?? ""
    const referenciaNombre = fila.referencias_huevo?.nombre ?? ""
    const edad = fila.lotes_huevo?.edad_semanas_captura ?? 0
    const clave = `${bodegaNombre}__${referenciaNombre}`

    const existente = grupos.get(clave)
    if (existente) {
      existente.cantidad += fila.cantidad_disponible
      existente.edadPonderada += edad * fila.cantidad_disponible
    } else {
      grupos.set(clave, {
        bodegaNombre,
        referenciaNombre,
        cantidad: fila.cantidad_disponible,
        edadPonderada: edad * fila.cantidad_disponible,
      })
    }
  }

  return Array.from(grupos.values())
    .map((g) => ({
      bodegaNombre: g.bodegaNombre,
      referenciaNombre: g.referenciaNombre,
      cantidad: g.cantidad,
      edadPromedioSemanas: g.cantidad > 0 ? Math.round((g.edadPonderada / g.cantidad) * 10) / 10 : 0,
    }))
    .sort((a, b) => a.bodegaNombre.localeCompare(b.bodegaNombre) || a.referenciaNombre.localeCompare(b.referenciaNombre))
}

interface GrupoAcumulado {
  unidades: number
  ingresos: number
}

export interface VentasResumen {
  totalUnidades: number
  totalIngresos: number
  precioPromedio: number | null
  porReferencia: { referenciaNombre: string; unidades: number; ingresos: number }[]
  porColor: { color: string; unidades: number; ingresos: number }[]
  porCliente: { clienteNombre: string; unidades: number; ingresos: number }[]
  porBodega: { bodegaNombre: string; unidades: number; ingresos: number }[]
}

interface FilaVentaCruda {
  cantidad: number
  subtotal: number | null
  referencias_huevo: { nombre: string; colores_huevo?: { nombre: string } } | null
  clienteNombre: string
  bodegaNombre: string
}

function acumular(mapa: Map<string, GrupoAcumulado>, clave: string, cantidad: number, subtotal: number | null) {
  const grupo = mapa.get(clave) ?? { unidades: 0, ingresos: 0 }
  grupo.unidades += cantidad
  if (subtotal != null) grupo.ingresos += subtotal
  mapa.set(clave, grupo)
}

function resumirVentas(filas: FilaVentaCruda[]): VentasResumen {
  let totalUnidades = 0
  let totalIngresos = 0
  let unidadesConPrecio = 0
  const porReferenciaMap = new Map<string, GrupoAcumulado>()
  const porColorMap = new Map<string, GrupoAcumulado>()
  const porClienteMap = new Map<string, GrupoAcumulado>()
  const porBodegaMap = new Map<string, GrupoAcumulado>()

  for (const fila of filas) {
    totalUnidades += fila.cantidad
    if (fila.subtotal != null) {
      totalIngresos += fila.subtotal
      unidadesConPrecio += fila.cantidad
    }

    acumular(porReferenciaMap, fila.referencias_huevo?.nombre ?? "", fila.cantidad, fila.subtotal)
    acumular(porColorMap, fila.referencias_huevo?.colores_huevo?.nombre ?? "", fila.cantidad, fila.subtotal)
    acumular(porClienteMap, fila.clienteNombre || "Mostrador / sin cliente", fila.cantidad, fila.subtotal)
    acumular(porBodegaMap, fila.bodegaNombre, fila.cantidad, fila.subtotal)
  }

  const aArray = (mapa: Map<string, GrupoAcumulado>, clave: string) =>
    Array.from(mapa.entries())
      .map(([nombre, v]) => ({ [clave]: nombre, ...v }) as any)
      .sort((a, b) => b.unidades - a.unidades)

  return {
    totalUnidades,
    totalIngresos,
    precioPromedio: unidadesConPrecio > 0 ? Math.round((totalIngresos / unidadesConPrecio) * 100) / 100 : null,
    porReferencia: aArray(porReferenciaMap, "referenciaNombre"),
    porColor: aArray(porColorMap, "color"),
    porCliente: aArray(porClienteMap, "clienteNombre").slice(0, 10),
    porBodega: aArray(porBodegaMap, "bodegaNombre"),
  }
}

const RESUMEN_VACIO: VentasResumen = {
  totalUnidades: 0,
  totalIngresos: 0,
  precioPromedio: null,
  porReferencia: [],
  porColor: [],
  porCliente: [],
  porBodega: [],
}

// Ventas de punto de venta en un rango de fechas (por defecto, sin filtro = todo el histórico).
export async function obtenerVentasPuntoVenta(fechaInicio?: string, fechaFin?: string): Promise<VentasResumen> {
  const db = getAvimolDb()
  let query = db
    .from("ventas_directas_detalle")
    .select(
      "cantidad, subtotal, referencias_huevo(nombre, colores_huevo(nombre)), ventas_directas!inner(fecha, clientes(nombre), bodegas(nombre))",
    )

  if (fechaInicio) query = query.gte("ventas_directas.fecha", fechaInicio)
  if (fechaFin) query = query.lte("ventas_directas.fecha", fechaFin + "T23:59:59")

  const { data, error } = await query

  if (error) {
    console.error("[avimol] Error obteniendo ventas de punto de venta:", error)
    return RESUMEN_VACIO
  }

  return resumirVentas(
    ((data ?? []) as any[]).map((fila) => ({
      cantidad: fila.cantidad,
      subtotal: fila.subtotal,
      referencias_huevo: fila.referencias_huevo,
      clienteNombre: fila.ventas_directas?.clientes?.nombre ?? "",
      bodegaNombre: fila.ventas_directas?.bodegas?.nombre ?? "",
    })),
  )
}

// Pedidos de clientes en un rango de fechas — ojo: refleja lo PEDIDO, no
// necesariamente lo efectivamente despachado si hubo diferencias en el
// picking (ver nota en CONTEXTO.md sobre pedido_detalle_id).
export async function obtenerPedidosPeriodo(fechaInicio?: string, fechaFin?: string): Promise<VentasResumen> {
  const db = getAvimolDb()
  let query = db
    .from("pedidos_detalle")
    .select(
      "cantidad, subtotal, referencias_huevo(nombre, colores_huevo(nombre)), pedidos!inner(fecha_pedido, clientes(nombre), bodegas(nombre))",
    )

  if (fechaInicio) query = query.gte("pedidos.fecha_pedido", fechaInicio)
  if (fechaFin) query = query.lte("pedidos.fecha_pedido", fechaFin)

  const { data, error } = await query

  if (error) {
    console.error("[avimol] Error obteniendo pedidos del periodo:", error)
    return RESUMEN_VACIO
  }

  return resumirVentas(
    ((data ?? []) as any[]).map((fila) => ({
      cantidad: fila.cantidad,
      subtotal: fila.subtotal,
      referencias_huevo: fila.referencias_huevo,
      clienteNombre: fila.pedidos?.clientes?.nombre ?? "",
      bodegaNombre: fila.pedidos?.bodegas?.nombre ?? "",
    })),
  )
}

export interface AveriasPorEtapa {
  etapa: string
  cantidad: number
}

export interface AveriasPorTipo {
  tipoAveria: string
  cantidad: number
}

export interface AveriasPorEtapaYTipo {
  etapa: string
  picado: number
  roto: number
  partido: number
}

export async function obtenerAverias(): Promise<{
  porEtapa: AveriasPorEtapa[]
  porTipo: AveriasPorTipo[]
  porEtapaYTipo: AveriasPorEtapaYTipo[]
  total: number
}> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("averias_huevo")
    .select("etapa, tipo_averia, cantidad")
    .neq("estado", "rechazada")

  if (error) {
    console.error("[avimol] Error obteniendo averías:", error)
    return { porEtapa: [], porTipo: [], porEtapaYTipo: [], total: 0 }
  }

  const porEtapaMap = new Map<string, number>()
  const porTipoMap = new Map<string, number>()
  const porEtapaYTipoMap = new Map<string, AveriasPorEtapaYTipo>()
  let total = 0

  for (const fila of (data ?? []) as any[]) {
    total += fila.cantidad
    porEtapaMap.set(fila.etapa, (porEtapaMap.get(fila.etapa) ?? 0) + fila.cantidad)
    porTipoMap.set(fila.tipo_averia, (porTipoMap.get(fila.tipo_averia) ?? 0) + fila.cantidad)

    const cruce = porEtapaYTipoMap.get(fila.etapa) ?? { etapa: fila.etapa, picado: 0, roto: 0, partido: 0 }
    if (fila.tipo_averia === "picado" || fila.tipo_averia === "roto" || fila.tipo_averia === "partido") {
      cruce[fila.tipo_averia as "picado" | "roto" | "partido"] += fila.cantidad
    }
    porEtapaYTipoMap.set(fila.etapa, cruce)
  }

  return {
    porEtapa: Array.from(porEtapaMap.entries()).map(([etapa, cantidad]) => ({ etapa, cantidad })),
    porTipo: Array.from(porTipoMap.entries()).map(([tipoAveria, cantidad]) => ({ tipoAveria, cantidad })),
    porEtapaYTipo: Array.from(porEtapaYTipoMap.values()),
    total,
  }
}

export interface TiemposLogisticos {
  tipoOperacion: string
  cantidadOrdenes: number
  esperaVehiculoPromedioMin: number | null
  duracionCarguePromedioMin: number | null
  duracionDescarguePromedioMin: number | null
}

function minutosEntre(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000
}

export async function obtenerTiemposLogisticos(): Promise<TiemposLogisticos[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("ordenes_cargue")
    .select(
      "tipo_operacion, hora_llegada_vehiculo, hora_inicio_cargue, hora_fin_cargue, hora_inicio_descargue, hora_fin_descargue",
    )

  if (error) {
    console.error("[avimol] Error obteniendo tiempos logísticos:", error)
    return []
  }

  const grupos = new Map<
    string,
    { cantidad: number; esperas: number[]; duracionesCargue: number[]; duracionesDescargue: number[] }
  >()

  for (const fila of (data ?? []) as any[]) {
    const grupo = grupos.get(fila.tipo_operacion) ?? {
      cantidad: 0,
      esperas: [],
      duracionesCargue: [],
      duracionesDescargue: [],
    }
    grupo.cantidad += 1

    const espera = minutosEntre(fila.hora_llegada_vehiculo, fila.hora_inicio_cargue)
    if (espera != null) grupo.esperas.push(espera)

    const duracionCargue = minutosEntre(fila.hora_inicio_cargue, fila.hora_fin_cargue)
    if (duracionCargue != null) grupo.duracionesCargue.push(duracionCargue)

    const duracionDescargue = minutosEntre(fila.hora_inicio_descargue, fila.hora_fin_descargue)
    if (duracionDescargue != null) grupo.duracionesDescargue.push(duracionDescargue)

    grupos.set(fila.tipo_operacion, grupo)
  }

  const promedio = (arr: number[]) => (arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null)

  return Array.from(grupos.entries()).map(([tipoOperacion, g]) => ({
    tipoOperacion,
    cantidadOrdenes: g.cantidad,
    esperaVehiculoPromedioMin: promedio(g.esperas),
    duracionCarguePromedioMin: promedio(g.duracionesCargue),
    duracionDescarguePromedioMin: promedio(g.duracionesDescargue),
  }))
}

export interface ProduccionGalpon {
  galponCodigo: string
  galponNombre: string
  cantidadTotal: number
  edadPromedioSemanas: number
}

export async function obtenerProduccionPorGalpon(): Promise<ProduccionGalpon[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("lotes_huevo_detalle")
    .select("cantidad, lotes_huevo(galpon_id, edad_semanas_captura, galpones(codigo, nombre))")

  if (error) {
    console.error("[avimol] Error obteniendo producción por galpón:", error)
    return []
  }

  const grupos = new Map<number, { codigo: string; nombre: string; cantidad: number; edadPonderada: number }>()

  for (const fila of (data ?? []) as any[]) {
    const lote = fila.lotes_huevo
    if (!lote) continue
    const galponId = lote.galpon_id
    const existente = grupos.get(galponId)
    const edad = lote.edad_semanas_captura ?? 0

    if (existente) {
      existente.cantidad += fila.cantidad
      existente.edadPonderada += edad * fila.cantidad
    } else {
      grupos.set(galponId, {
        codigo: lote.galpones?.codigo ?? "",
        nombre: lote.galpones?.nombre ?? "",
        cantidad: fila.cantidad,
        edadPonderada: edad * fila.cantidad,
      })
    }
  }

  return Array.from(grupos.values())
    .map((g) => ({
      galponCodigo: g.codigo,
      galponNombre: g.nombre,
      cantidadTotal: g.cantidad,
      edadPromedioSemanas: g.cantidad > 0 ? Math.round((g.edadPonderada / g.cantidad) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.cantidadTotal - a.cantidadTotal)
}

export interface IndicadorGalpon {
  galponId: number
  galponCodigo: string
  galponNombre: string
  capacidad: number | null
  utilizada: number
  porcentajeOcupacion: number
  mortalidad: number
  tasaMortalidad: number
  sacrificio: number
  tasaSacrificio: number
  edadPromedioSemanas: number
}

export interface IndicadoresAves {
  porGalpon: IndicadorGalpon[]
  capacidadTotal: number
  utilizadaTotal: number
  porcentajeOcupacionTotal: number
  mortalidadTotal: number
  tasaMortalidadTotal: number
  sacrificioTotal: number
  tasaSacrificioTotal: number
  edadPromedioTotal: number
}

const INDICADORES_AVES_VACIO: IndicadoresAves = {
  porGalpon: [],
  capacidadTotal: 0,
  utilizadaTotal: 0,
  porcentajeOcupacionTotal: 0,
  mortalidadTotal: 0,
  tasaMortalidadTotal: 0,
  sacrificioTotal: 0,
  tasaSacrificioTotal: 0,
  edadPromedioTotal: 0,
}

// Capacidad/ocupación y edad son una foto del momento actual (no tiene
// sentido filtrarlas por fecha); mortalidad y sacrificio sí se filtran
// por el rango dado, comparadas contra el total histórico ingresado a
// cada galpón (lotes_aves.cantidad_ingreso, sin importar su estado
// actual) como base de la tasa.
export async function obtenerIndicadoresAves(fechaInicio?: string, fechaFin?: string): Promise<IndicadoresAves> {
  const db = getAvimolDb()

  const { data: galpones, error: errorGalpones } = await db
    .from("galpones")
    .select("id, codigo, nombre, capacidad")
    .order("codigo")

  if (errorGalpones) {
    console.error("[avimol] Error obteniendo galpones para indicadores:", errorGalpones)
    return INDICADORES_AVES_VACIO
  }

  const { data: lotes } = await db
    .from("v_lotes_aves_edad")
    .select("galpon_id, cantidad_actual, cantidad_ingreso, edad_actual_semanas, estado")

  const utilizadaPorGalpon = new Map<number, number>()
  const ingresoPorGalpon = new Map<number, number>()
  const edadPonderadaPorGalpon = new Map<number, number>()

  for (const l of (lotes ?? []) as any[]) {
    ingresoPorGalpon.set(l.galpon_id, (ingresoPorGalpon.get(l.galpon_id) ?? 0) + l.cantidad_ingreso)
    if (l.estado === "activo") {
      utilizadaPorGalpon.set(l.galpon_id, (utilizadaPorGalpon.get(l.galpon_id) ?? 0) + l.cantidad_actual)
      edadPonderadaPorGalpon.set(
        l.galpon_id,
        (edadPonderadaPorGalpon.get(l.galpon_id) ?? 0) + l.edad_actual_semanas * l.cantidad_actual,
      )
    }
  }

  let queryMovimientos = db
    .from("movimientos_aves")
    .select("galpon_origen_id, tipo_movimiento, cantidad, fecha")
    .in("tipo_movimiento", ["mortalidad", "sacrificio"])

  if (fechaInicio) queryMovimientos = queryMovimientos.gte("fecha", fechaInicio)
  if (fechaFin) queryMovimientos = queryMovimientos.lte("fecha", fechaFin + "T23:59:59")

  const { data: movimientos } = await queryMovimientos

  const mortalidadPorGalpon = new Map<number, number>()
  const sacrificioPorGalpon = new Map<number, number>()
  for (const m of (movimientos ?? []) as any[]) {
    if (!m.galpon_origen_id) continue
    if (m.tipo_movimiento === "mortalidad") {
      mortalidadPorGalpon.set(m.galpon_origen_id, (mortalidadPorGalpon.get(m.galpon_origen_id) ?? 0) + m.cantidad)
    } else {
      sacrificioPorGalpon.set(m.galpon_origen_id, (sacrificioPorGalpon.get(m.galpon_origen_id) ?? 0) + m.cantidad)
    }
  }

  const porGalpon: IndicadorGalpon[] = (galpones ?? []).map((g) => {
    const utilizada = utilizadaPorGalpon.get(g.id) ?? 0
    const edadPonderada = edadPonderadaPorGalpon.get(g.id) ?? 0
    const ingreso = ingresoPorGalpon.get(g.id) ?? 0
    const mortalidad = mortalidadPorGalpon.get(g.id) ?? 0
    const sacrificio = sacrificioPorGalpon.get(g.id) ?? 0
    return {
      galponId: g.id,
      galponCodigo: g.codigo,
      galponNombre: g.nombre,
      capacidad: g.capacidad,
      utilizada,
      porcentajeOcupacion: g.capacidad ? Math.round((utilizada / g.capacidad) * 1000) / 10 : 0,
      mortalidad,
      tasaMortalidad: ingreso > 0 ? Math.round((mortalidad / ingreso) * 1000) / 10 : 0,
      sacrificio,
      tasaSacrificio: ingreso > 0 ? Math.round((sacrificio / ingreso) * 1000) / 10 : 0,
      edadPromedioSemanas: utilizada > 0 ? Math.round((edadPonderada / utilizada) * 10) / 10 : 0,
    }
  })

  const capacidadTotal = porGalpon.reduce((acc, g) => acc + (g.capacidad ?? 0), 0)
  const utilizadaTotal = porGalpon.reduce((acc, g) => acc + g.utilizada, 0)
  const ingresoTotal = Array.from(ingresoPorGalpon.values()).reduce((acc, v) => acc + v, 0)
  const mortalidadTotal = porGalpon.reduce((acc, g) => acc + g.mortalidad, 0)
  const sacrificioTotal = porGalpon.reduce((acc, g) => acc + g.sacrificio, 0)
  const edadPonderadaTotal = porGalpon.reduce((acc, g) => acc + g.edadPromedioSemanas * g.utilizada, 0)

  return {
    porGalpon,
    capacidadTotal,
    utilizadaTotal,
    porcentajeOcupacionTotal: capacidadTotal > 0 ? Math.round((utilizadaTotal / capacidadTotal) * 1000) / 10 : 0,
    mortalidadTotal,
    tasaMortalidadTotal: ingresoTotal > 0 ? Math.round((mortalidadTotal / ingresoTotal) * 1000) / 10 : 0,
    sacrificioTotal,
    tasaSacrificioTotal: ingresoTotal > 0 ? Math.round((sacrificioTotal / ingresoTotal) * 1000) / 10 : 0,
    edadPromedioTotal: utilizadaTotal > 0 ? Math.round((edadPonderadaTotal / utilizadaTotal) * 10) / 10 : 0,
  }
}
