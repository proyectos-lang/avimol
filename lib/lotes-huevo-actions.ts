"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface LoteHuevo {
  id: number
  codigo: string
  fecha_cosecha: string
  edad_semanas_captura: number
  galpon_codigo: string
  galpon_nombre: string
  lote_aves_codigo: string
  bodega_nombre: string
  origen: string
}

export async function listarLotesHuevo(): Promise<LoteHuevo[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("lotes_huevo")
    .select(
      "id, codigo, fecha_cosecha, edad_semanas_captura, origen, galpones(codigo, nombre), lotes_aves(codigo), bodegas(nombre)",
    )
    .order("id", { ascending: false })

  if (error) {
    console.error("[avimol] Error listando lotes de huevo:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    codigo: fila.codigo,
    fecha_cosecha: fila.fecha_cosecha,
    edad_semanas_captura: fila.edad_semanas_captura,
    galpon_codigo: fila.galpones?.codigo ?? "",
    galpon_nombre: fila.galpones?.nombre ?? "",
    lote_aves_codigo: fila.lotes_aves?.codigo ?? "",
    bodega_nombre: fila.bodegas?.nombre ?? "",
    origen: fila.origen,
  }))
}

export interface DetalleLoteHuevo {
  referencia_nombre: string
  anaquel_codigo: string | null
  cantidad: number
}

export interface AveriaLoteHuevo {
  tipo_averia: string
  etapa: string
  cantidad: number
  referencia_nombre: string | null
}

export async function obtenerDetalleLoteHuevo(
  loteHuevoId: number,
): Promise<{ detalle: DetalleLoteHuevo[]; averias: AveriaLoteHuevo[] }> {
  const db = getAvimolDb()

  const [{ data: detalleData, error: errorDetalle }, { data: averiasData, error: errorAverias }] = await Promise.all([
    db
      .from("lotes_huevo_detalle")
      .select("cantidad, referencias_huevo(nombre), anaqueles(codigo)")
      .eq("lote_huevo_id", loteHuevoId),
    db
      .from("averias_huevo")
      .select("tipo_averia, etapa, cantidad, referencias_huevo(nombre)")
      .eq("lote_huevo_id", loteHuevoId),
  ])

  if (errorDetalle) console.error("[avimol] Error obteniendo detalle de lote de huevo:", errorDetalle)
  if (errorAverias) console.error("[avimol] Error obteniendo averías de lote de huevo:", errorAverias)

  return {
    detalle: (detalleData ?? []).map((fila: any) => ({
      referencia_nombre: fila.referencias_huevo?.nombre ?? "",
      anaquel_codigo: fila.anaqueles?.codigo ?? null,
      cantidad: fila.cantidad,
    })),
    averias: (averiasData ?? []).map((fila: any) => ({
      tipo_averia: fila.tipo_averia,
      etapa: fila.etapa,
      cantidad: fila.cantidad,
      referencia_nombre: fila.referencias_huevo?.nombre ?? null,
    })),
  }
}
