"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

const ETAPA_LABEL: Record<string, string> = {
  recoleccion: "Recolección",
  clasificacion: "Clasificación",
}

export interface AveriaProduccionFila {
  id: number
  etapa: string
  origenLabel: string
  tipoAveria: string
  cantidad: number
  loteHuevoCodigo: string
  referenciaNombre: string | null
  galponId: number | null
  galponCodigo: string | null
  galponNombre: string | null
  bodegaId: number | null
  bodegaNombre: string | null
  fecha: string
  observaciones: string | null
  procesadaEnYemas: boolean
  estado: string
}

// Averías del proceso de producción (recolección/clasificación, ligadas a
// un galpón) — aparte de las de bodega/logística (despacho/recepción,
// ligadas a un envío), que se manejan en lib/averias-actions.ts.
export async function listarAveriasProduccion(filtros: {
  galponId?: number | null
  etapa?: "recoleccion" | "clasificacion" | null
}): Promise<AveriaProduccionFila[]> {
  const db = getAvimolDb()

  let query = db
    .from("averias_huevo")
    .select(
      `id, etapa, tipo_averia, cantidad, fecha, observaciones, estado, procesamiento_yema_id,
       lotes_huevo(codigo, galpon_id, bodega_id, galpones(codigo, nombre), bodegas(nombre)),
       referencias_huevo(nombre)`,
    )
    .in("etapa", ["recoleccion", "clasificacion"])
    .order("fecha", { ascending: false })

  if (filtros.etapa) query = query.eq("etapa", filtros.etapa)

  const { data, error } = await query
  if (error) {
    console.error("[avimol] Error listando averías de producción:", error)
    return []
  }

  const filas: AveriaProduccionFila[] = (data ?? []).map((fila: any) => ({
    id: fila.id,
    etapa: fila.etapa,
    origenLabel: ETAPA_LABEL[fila.etapa] ?? fila.etapa,
    tipoAveria: fila.tipo_averia,
    cantidad: fila.cantidad,
    loteHuevoCodigo: fila.lotes_huevo?.codigo ?? "",
    referenciaNombre: fila.referencias_huevo?.nombre ?? null,
    galponId: fila.lotes_huevo?.galpon_id ?? null,
    galponCodigo: fila.lotes_huevo?.galpones?.codigo ?? null,
    galponNombre: fila.lotes_huevo?.galpones?.nombre ?? null,
    bodegaId: fila.lotes_huevo?.bodega_id ?? null,
    bodegaNombre: fila.lotes_huevo?.bodegas?.nombre ?? null,
    fecha: fila.fecha,
    observaciones: fila.observaciones,
    procesadaEnYemas: fila.procesamiento_yema_id != null,
    estado: fila.estado,
  }))

  if (filtros.galponId) {
    return filas.filter((f) => f.galponId === filtros.galponId)
  }
  return filas
}
