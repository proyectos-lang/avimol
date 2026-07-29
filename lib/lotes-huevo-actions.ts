"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

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

// Cabecera de trazabilidad de un lote de huevo (la info que antes solo vivía
// en el módulo "Lotes de huevo", ahora fusionado dentro de Historial diario).
export interface CabeceraLoteHuevo {
  edad_semanas_captura: number
  lote_aves_codigo: string
  bodega_nombre: string
}

export async function obtenerDetalleLoteHuevo(
  loteHuevoId: number,
): Promise<{ cabecera: CabeceraLoteHuevo | null; detalle: DetalleLoteHuevo[]; averias: AveriaLoteHuevo[] }> {
  const db = getAvimolDb()

  const [
    { data: cabeceraData, error: errorCabecera },
    { data: detalleData, error: errorDetalle },
    { data: averiasData, error: errorAverias },
  ] = await Promise.all([
    db
      .from("lotes_huevo")
      .select("edad_semanas_captura, lotes_aves(codigo), bodegas(nombre)")
      .eq("id", loteHuevoId)
      .single(),
    db
      .from("lotes_huevo_detalle")
      .select("cantidad, referencias_huevo(nombre), anaqueles(codigo)")
      .eq("lote_huevo_id", loteHuevoId),
    db
      .from("averias_huevo")
      .select("tipo_averia, etapa, cantidad, referencias_huevo(nombre)")
      .eq("lote_huevo_id", loteHuevoId),
  ])

  if (errorCabecera) console.error("[avimol] Error obteniendo cabecera de lote de huevo:", errorCabecera)
  if (errorDetalle) console.error("[avimol] Error obteniendo detalle de lote de huevo:", errorDetalle)
  if (errorAverias) console.error("[avimol] Error obteniendo averías de lote de huevo:", errorAverias)

  const c = cabeceraData as any
  return {
    cabecera: c
      ? {
          edad_semanas_captura: c.edad_semanas_captura,
          lote_aves_codigo: c.lotes_aves?.codigo ?? "",
          bodega_nombre: c.bodegas?.nombre ?? "",
        }
      : null,
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

export interface AveriaDelLote {
  id: number
  tipoAveria: string
  cantidad: number
  estado: string
  observaciones: string | null
}

export interface LoteDelDia {
  loteHuevoId: number
  codigo: string
  creadoEn: string
  origen: string
  cantidadRecolectada: number
  averias: AveriaDelLote[]
}

// Un mismo día+galpón puede tener varios lotes_huevo (cada recolección
// crea uno nuevo, ver registrarRecoleccion) — esto trae todos los de un
// galpón+fecha específicos, con su cantidad recolectada (kardex) y sus
// averías de etapa recolección, para el detalle que se despliega desde
// Historial diario.
export async function listarLotesHuevoPorGalponYFecha(galponId: number, fecha: string): Promise<LoteDelDia[]> {
  const db = getAvimolDb()

  const { data: lotes, error: errorLotes } = await db
    .from("lotes_huevo")
    .select("id, codigo, creado_en, origen")
    .eq("galpon_id", galponId)
    .eq("fecha_cosecha", fecha)
    .order("codigo", { ascending: true })

  if (errorLotes) {
    console.error("[avimol] Error listando lotes del día:", errorLotes)
    return []
  }
  if (!lotes || lotes.length === 0) return []

  const loteIds = lotes.map((l) => l.id)

  const [{ data: movimientos }, { data: averias }] = await Promise.all([
    db
      .from("movimientos_huevo_sin_clasificar")
      .select("lote_huevo_id, cantidad")
      .eq("tipo_movimiento", "entrada_cosecha")
      .in("lote_huevo_id", loteIds),
    db
      .from("averias_huevo")
      .select("id, lote_huevo_id, tipo_averia, cantidad, estado, observaciones")
      .eq("etapa", "recoleccion")
      .in("lote_huevo_id", loteIds),
  ])

  const cantidadPorLote = new Map<number, number>()
  for (const m of (movimientos ?? []) as any[]) {
    cantidadPorLote.set(m.lote_huevo_id, (cantidadPorLote.get(m.lote_huevo_id) ?? 0) + m.cantidad)
  }

  const averiasPorLote = new Map<number, AveriaDelLote[]>()
  for (const a of (averias ?? []) as any[]) {
    const lista = averiasPorLote.get(a.lote_huevo_id) ?? []
    lista.push({
      id: a.id,
      tipoAveria: a.tipo_averia,
      cantidad: a.cantidad,
      estado: a.estado,
      observaciones: a.observaciones,
    })
    averiasPorLote.set(a.lote_huevo_id, lista)
  }

  return lotes.map((l: any) => ({
    loteHuevoId: l.id,
    codigo: l.codigo,
    creadoEn: l.creado_en,
    origen: l.origen,
    cantidadRecolectada: cantidadPorLote.get(l.id) ?? 0,
    averias: averiasPorLote.get(l.id) ?? [],
  }))
}
