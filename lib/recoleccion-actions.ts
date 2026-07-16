"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { fechaColombiaHoy, fechaHoraColombiaISO } from "@/lib/date-utils"

export interface GalponConLoteActivo {
  galpon_id: number
  galpon_codigo: string
  galpon_nombre: string
  lote_aves_id: number
  lote_aves_codigo: string
  edad_actual_semanas: number
}

// Solo galpones que tienen un lote de aves ACTIVO en este momento: sin
// aves poniendo huevo no tiene sentido registrar una recolección ahí.
export async function listarGalponesConLoteActivo(): Promise<GalponConLoteActivo[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("v_lotes_aves_edad")
    .select("id, codigo, edad_actual_semanas, galpones(id, codigo, nombre)")
    .eq("estado", "activo")

  if (error) {
    console.error("[avimol] Error listando galpones con lote activo:", error)
    return []
  }

  return (data ?? [])
    .filter((fila: any) => fila.galpones)
    .map((fila: any) => ({
      galpon_id: fila.galpones.id,
      galpon_codigo: fila.galpones.codigo,
      galpon_nombre: fila.galpones.nombre,
      lote_aves_id: fila.id,
      lote_aves_codigo: fila.codigo,
      edad_actual_semanas: fila.edad_actual_semanas,
    }))
}

export interface ReferenciaHuevo {
  id: number
  nombre: string
  tipo_nombre: string
  color_nombre: string
}

export async function listarReferenciasHuevo(): Promise<ReferenciaHuevo[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("referencias_huevo")
    .select("id, nombre, tipos_huevo(nombre), colores_huevo(nombre)")
    .eq("activo", true)
    .order("id", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando referencias de huevo:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    nombre: fila.nombre,
    tipo_nombre: fila.tipos_huevo?.nombre ?? "",
    color_nombre: fila.colores_huevo?.nombre ?? "",
  }))
}

export interface ColorHuevo {
  id: number
  nombre: string
}

export async function listarColoresHuevo(): Promise<ColorHuevo[]> {
  const db = getAvimolDb()
  const { data, error } = await db.from("colores_huevo").select("id, nombre").order("id", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando colores de huevo:", error)
    return []
  }
  return data ?? []
}

async function generarCodigoLoteHuevo(fecha: string): Promise<string> {
  const db = getAvimolDb()
  const prefijo = fecha.replaceAll("-", "") // YYYYMMDD
  const { count, error } = await db
    .from("lotes_huevo")
    .select("id", { count: "exact", head: true })
    .like("codigo", `${prefijo}-%`)

  if (error) {
    console.error("[avimol] Error generando código de lote de huevo:", error)
  }

  const consecutivo = (count ?? 0) + 1
  return `${prefijo}-${consecutivo.toString().padStart(3, "0")}`
}

export type OrigenRecoleccion = "app_movil" | "manual_clasificadora"
export type TipoAveria = "picado" | "roto" | "partido"

export interface DatosRecoleccion {
  galponId: number
  loteAvesId: number
  edadSemanasCaptura: number
  bodegaId: number
  anaquelId: number | null
  origen: OrigenRecoleccion
  cantidades: { colorId: number; cantidad: number }[]
  averias: { tipoAveria: TipoAveria; referenciaId: number | null; cantidad: number }[]
}

export async function registrarRecoleccion(
  datos: DatosRecoleccion,
): Promise<{ success: boolean; message?: string; codigo?: string }> {
  const cantidadesValidas = datos.cantidades.filter((c) => c.cantidad > 0)

  if (cantidadesValidas.length === 0) {
    return { success: false, message: "Registra al menos una cantidad mayor a cero" }
  }

  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()
  const fechaCosecha = fechaColombiaHoy()

  let codigo = await generarCodigoLoteHuevo(fechaCosecha)

  let loteHuevoId: number | null = null
  for (let intento = 0; intento < 3 && loteHuevoId === null; intento++) {
    const { data, error } = await db
      .from("lotes_huevo")
      .insert({
        codigo,
        galpon_id: datos.galponId,
        lote_aves_id: datos.loteAvesId,
        edad_semanas_captura: datos.edadSemanasCaptura,
        fecha_cosecha: fechaCosecha,
        bodega_id: datos.bodegaId,
        origen: datos.origen,
        usuario_id: usuario?.id ?? null,
      })
      .select("id")
      .single()

    if (!error && data) {
      loteHuevoId = data.id
    } else if (error?.code === "23505") {
      // Colisión de código (dos recolectores al mismo tiempo): regenera y reintenta.
      codigo = await generarCodigoLoteHuevo(fechaCosecha)
    } else {
      console.error("[avimol] Error creando lote de huevo:", error)
      return { success: false, message: "No se pudo registrar la recolección: " + error?.message }
    }
  }

  if (loteHuevoId === null) {
    return { success: false, message: "No se pudo generar un código de lote único, intenta de nuevo" }
  }

  // A diferencia del flujo anterior, la recolección ya no clasifica en
  // tipo×color: solo registra cuánto entró de cada color, sin
  // clasificar, a la espera del proceso de Clasificación.
  const inventarioInsert = cantidadesValidas.map((c) => ({
    bodega_id: datos.bodegaId,
    lote_huevo_id: loteHuevoId,
    color_id: c.colorId,
    anaquel_id: datos.anaquelId,
    cantidad_disponible: c.cantidad,
  }))

  const { error: errorInventario } = await db.from("inventario_huevo_sin_clasificar").insert(inventarioInsert)
  if (errorInventario) {
    console.error("[avimol] Error insertando inventario sin clasificar:", errorInventario)
    return { success: false, message: "Error al registrar el inventario: " + errorInventario.message }
  }

  const movimientosInsert = cantidadesValidas.map((c) => ({
    bodega_id: datos.bodegaId,
    lote_huevo_id: loteHuevoId,
    color_id: c.colorId,
    anaquel_id: datos.anaquelId,
    tipo_movimiento: "entrada_cosecha",
    cantidad: c.cantidad,
    usuario_id: usuario?.id ?? null,
    creado_en: fechaHoraColombiaISO(),
  }))

  const { error: errorMov } = await db.from("movimientos_huevo_sin_clasificar").insert(movimientosInsert)
  if (errorMov) {
    console.error("[avimol] Error insertando movimiento de inventario sin clasificar:", errorMov)
  }

  const averiasValidas = datos.averias.filter((a) => a.cantidad > 0)
  if (averiasValidas.length > 0) {
    const averiasInsert = averiasValidas.map((a) => ({
      lote_huevo_id: loteHuevoId,
      referencia_huevo_id: a.referenciaId,
      etapa: "recoleccion",
      tipo_averia: a.tipoAveria,
      cantidad: a.cantidad,
      usuario_id: usuario?.id ?? null,
    }))

    const { error: errorAverias } = await db.from("averias_huevo").insert(averiasInsert)
    if (errorAverias) {
      console.error("[avimol] Error insertando averías:", errorAverias)
    }
  }

  return { success: true, codigo }
}

export interface RecoleccionDia {
  fecha_cosecha: string
  galpon_id: number
  galpon_codigo: string
  galpon_nombre: string
  total_recolectado: number
  averia_picado: number
  averia_roto: number
  averia_partido: number
  total_averias: number
}

// Agregado histórico por día y galpón — se calcula desde el kardex
// (entrada_cosecha), NUNCA desde el saldo actual de
// inventario_huevo_sin_clasificar, porque ese saldo baja a medida que se
// clasifica: lo recolectado ese día es un hecho fijo, no un saldo vivo.
// Las averías se agregan por la misma llave (fecha de cosecha + galpón,
// vía lote_huevo_id) para que el detalle por tipo y el total queden en la
// misma fila que lo recolectado ese día en ese galpón.
export async function listarRecoleccionPorDia(): Promise<RecoleccionDia[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("movimientos_huevo_sin_clasificar")
    .select("cantidad, lote_huevo_id, lotes_huevo(fecha_cosecha, galpones(id, codigo, nombre))")
    .eq("tipo_movimiento", "entrada_cosecha")

  if (error) {
    console.error("[avimol] Error listando recolección por día:", error)
    return []
  }

  const grupos = new Map<string, RecoleccionDia>()
  for (const fila of (data ?? []) as any[]) {
    const fecha = fila.lotes_huevo?.fecha_cosecha ?? ""
    const galpon = fila.lotes_huevo?.galpones
    if (!galpon) continue

    const clave = `${fecha}__${galpon.id}`
    const existente = grupos.get(clave)
    if (existente) {
      existente.total_recolectado += fila.cantidad
    } else {
      grupos.set(clave, {
        fecha_cosecha: fecha,
        galpon_id: galpon.id,
        galpon_codigo: galpon.codigo,
        galpon_nombre: galpon.nombre,
        total_recolectado: fila.cantidad,
        averia_picado: 0,
        averia_roto: 0,
        averia_partido: 0,
        total_averias: 0,
      })
    }
  }

  const { data: averias, error: errorAverias } = await db
    .from("averias_huevo")
    .select("tipo_averia, cantidad, lotes_huevo(fecha_cosecha, galpones(id, codigo, nombre))")
    .eq("etapa", "recoleccion")

  if (errorAverias) {
    console.error("[avimol] Error listando averías de recolección:", errorAverias)
  }

  for (const fila of (averias ?? []) as any[]) {
    const fecha = fila.lotes_huevo?.fecha_cosecha ?? ""
    const galpon = fila.lotes_huevo?.galpones
    if (!galpon) continue

    const clave = `${fecha}__${galpon.id}`
    let grupo = grupos.get(clave)
    if (!grupo) {
      grupo = {
        fecha_cosecha: fecha,
        galpon_id: galpon.id,
        galpon_codigo: galpon.codigo,
        galpon_nombre: galpon.nombre,
        total_recolectado: 0,
        averia_picado: 0,
        averia_roto: 0,
        averia_partido: 0,
        total_averias: 0,
      }
      grupos.set(clave, grupo)
    }

    if (fila.tipo_averia === "picado") grupo.averia_picado += fila.cantidad
    else if (fila.tipo_averia === "roto") grupo.averia_roto += fila.cantidad
    else if (fila.tipo_averia === "partido") grupo.averia_partido += fila.cantidad
    grupo.total_averias += fila.cantidad
  }

  return Array.from(grupos.values()).sort((a, b) => b.fecha_cosecha.localeCompare(a.fecha_cosecha))
}
