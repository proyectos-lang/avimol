"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface InventarioFila {
  id: number
  bodega_id: number
  bodega_nombre: string
  lote_huevo_id: number
  lote_codigo: string
  fecha_cosecha: string
  edad_semanas_captura: number
  galpon_codigo: string
  referencia_id: number
  referencia_nombre: string
  tipo_nombre: string
  color_nombre: string
  anaquel_codigo: string | null
  cantidad_disponible: number
}

export async function listarInventario(bodegaId: number | null): Promise<InventarioFila[]> {
  const db = getAvimolDb()
  let query = db
    .from("inventario_huevo")
    .select(
      `id, bodega_id, cantidad_disponible,
       bodegas(nombre),
       lotes_huevo(id, codigo, fecha_cosecha, edad_semanas_captura, galpones(codigo)),
       referencias_huevo(id, nombre, tipos_huevo(nombre), colores_huevo(nombre)),
       anaqueles(codigo)`,
    )
    .gt("cantidad_disponible", 0)
    .order("bodega_id", { ascending: true })

  if (bodegaId) query = query.eq("bodega_id", bodegaId)

  const { data, error } = await query

  if (error) {
    console.error("[avimol] Error listando inventario:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    bodega_id: fila.bodega_id,
    bodega_nombre: fila.bodegas?.nombre ?? "",
    lote_huevo_id: fila.lotes_huevo?.id ?? 0,
    lote_codigo: fila.lotes_huevo?.codigo ?? "",
    fecha_cosecha: fila.lotes_huevo?.fecha_cosecha ?? "",
    edad_semanas_captura: fila.lotes_huevo?.edad_semanas_captura ?? 0,
    galpon_codigo: fila.lotes_huevo?.galpones?.codigo ?? "",
    referencia_id: fila.referencias_huevo?.id ?? 0,
    referencia_nombre: fila.referencias_huevo?.nombre ?? "",
    tipo_nombre: fila.referencias_huevo?.tipos_huevo?.nombre ?? "",
    color_nombre: fila.referencias_huevo?.colores_huevo?.nombre ?? "",
    anaquel_codigo: fila.anaqueles?.codigo ?? null,
    cantidad_disponible: fila.cantidad_disponible,
  }))
}

export async function obtenerTotalSinClasificar(bodegaId: number | null): Promise<number> {
  const db = getAvimolDb()
  let query = db.from("inventario_huevo_sin_clasificar").select("cantidad_disponible").gt("cantidad_disponible", 0)
  if (bodegaId) query = query.eq("bodega_id", bodegaId)

  const { data, error } = await query
  if (error) {
    console.error("[avimol] Error obteniendo total sin clasificar:", error)
    return 0
  }
  return (data ?? []).reduce((acc, f) => acc + f.cantidad_disponible, 0)
}

export interface MovimientoInventario {
  id: number
  tipo_movimiento: string
  cantidad: number
  observaciones: string | null
  creado_en: string
}

export async function listarKardexLote(loteHuevoId: number, referenciaId: number): Promise<MovimientoInventario[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("movimientos_inventario_huevo")
    .select("id, tipo_movimiento, cantidad, observaciones, creado_en")
    .eq("lote_huevo_id", loteHuevoId)
    .eq("referencia_huevo_id", referenciaId)
    .order("creado_en", { ascending: false })

  if (error) {
    console.error("[avimol] Error listando kardex:", error)
    return []
  }
  return data ?? []
}
