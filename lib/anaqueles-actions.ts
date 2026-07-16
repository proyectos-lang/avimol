"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface Anaquel {
  id: number
  bodega_id: number
  codigo: string
  descripcion: string | null
  activo?: boolean
}

export async function listarAnaquelesPorBodega(bodegaId: number): Promise<Anaquel[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("anaqueles")
    .select("id, bodega_id, codigo, descripcion")
    .eq("bodega_id", bodegaId)
    .eq("activo", true)
    .order("codigo", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando anaqueles:", error)
    return []
  }
  return data ?? []
}

export async function listarTodosAnaquelesPorBodega(bodegaId: number): Promise<Anaquel[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("anaqueles")
    .select("id, bodega_id, codigo, descripcion, activo")
    .eq("bodega_id", bodegaId)
    .order("codigo", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando anaqueles:", error)
    return []
  }
  return data ?? []
}

export async function cambiarEstadoAnaquel(
  id: number,
  activo: boolean,
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db.from("anaqueles").update({ activo }).eq("id", id)

  if (error) {
    console.error("[avimol] Error cambiando estado de anaquel:", error)
    return { success: false, message: "No se pudo actualizar el estado: " + error.message }
  }
  return { success: true }
}

export async function crearAnaquel(
  bodegaId: number,
  codigo: string,
  descripcion: string | null,
): Promise<{ success: boolean; message?: string; anaquel?: Anaquel }> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("anaqueles")
    .insert({ bodega_id: bodegaId, codigo, descripcion })
    .select("id, bodega_id, codigo, descripcion")
    .single()

  if (error) {
    console.error("[avimol] Error creando anaquel:", error)
    return { success: false, message: "No se pudo crear la estantería: " + error.message }
  }
  return { success: true, anaquel: data }
}
