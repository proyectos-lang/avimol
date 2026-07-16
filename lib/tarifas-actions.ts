"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { fechaColombiaHoy } from "@/lib/date-utils"

export interface TarifaDescargue {
  id: number
  valor: number
  tipo_valor: "fijo" | "por_kg"
  vigente_desde: string
  vigente_hasta: string | null
  activo: boolean
}

export async function listarTarifasDescargue(): Promise<TarifaDescargue[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("tarifas_servicio_descargue")
    .select("id, valor, tipo_valor, vigente_desde, vigente_hasta, activo")
    .order("vigente_desde", { ascending: false })

  if (error) {
    console.error("[avimol] Error listando tarifas de descargue:", error)
    return []
  }
  return data ?? []
}

export async function crearTarifaDescargue(
  valor: number,
  tipoValor: "fijo" | "por_kg",
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db.from("tarifas_servicio_descargue").insert({
    valor,
    tipo_valor: tipoValor,
    vigente_desde: fechaColombiaHoy(),
    activo: true,
  })

  if (error) {
    console.error("[avimol] Error creando tarifa de descargue:", error)
    return { success: false, message: "No se pudo crear la tarifa: " + error.message }
  }
  return { success: true }
}

export async function cambiarEstadoTarifa(id: number, activo: boolean): Promise<{ success: boolean }> {
  const db = getAvimolDb()
  await db.from("tarifas_servicio_descargue").update({ activo }).eq("id", id)
  return { success: true }
}

// Tarifa activa vigente hoy (la que se aplica a un descargue que se
// confirma en este momento). Si hay varias vigentes, toma la más
// reciente por vigente_desde.
export async function obtenerTarifaVigente(): Promise<TarifaDescargue | null> {
  const db = getAvimolDb()
  const hoy = fechaColombiaHoy()

  const { data, error } = await db
    .from("tarifas_servicio_descargue")
    .select("id, valor, tipo_valor, vigente_desde, vigente_hasta, activo")
    .eq("activo", true)
    .lte("vigente_desde", hoy)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[avimol] Error obteniendo tarifa vigente:", error)
    return null
  }
  return data
}
