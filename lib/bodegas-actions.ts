"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface Bodega {
  id: number
  nombre: string
  tipo: string
  ubicacion: string | null
  activo: boolean
}

export async function listarBodegas(soloActivas = true): Promise<Bodega[]> {
  const db = getAvimolDb()
  let query = db.from("bodegas").select("id, nombre, tipo, ubicacion, activo").order("nombre", { ascending: true })

  if (soloActivas) query = query.eq("activo", true)

  const { data, error } = await query

  if (error) {
    console.error("[avimol] Error listando bodegas:", error)
    return []
  }
  return data ?? []
}

// Bodegas donde tiene sentido recolectar/clasificar huevo sin
// clasificar — excluye las de tipo "venta" pura.
export async function listarBodegasClasificadoras(): Promise<Bodega[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("bodegas")
    .select("id, nombre, tipo, ubicacion, activo")
    .eq("activo", true)
    .in("tipo", ["clasificadora", "mixta"])
    .order("nombre", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando bodegas clasificadoras:", error)
    return []
  }
  return data ?? []
}

export interface DatosBodega {
  nombre: string
  tipo: string
  ubicacion: string | null
}

export async function crearBodega(datos: DatosBodega): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db.from("bodegas").insert(datos)

  if (error) {
    console.error("[avimol] Error creando bodega:", error)
    return { success: false, message: "No se pudo crear la bodega: " + error.message }
  }
  return { success: true }
}

export async function actualizarBodega(
  id: number,
  datos: DatosBodega,
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db.from("bodegas").update(datos).eq("id", id)

  if (error) {
    console.error("[avimol] Error actualizando bodega:", error)
    return { success: false, message: "No se pudo actualizar la bodega: " + error.message }
  }
  return { success: true }
}

export async function cambiarEstadoBodega(id: number, activo: boolean): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db.from("bodegas").update({ activo }).eq("id", id)

  if (error) {
    console.error("[avimol] Error cambiando estado de bodega:", error)
    return { success: false, message: "No se pudo actualizar el estado: " + error.message }
  }
  return { success: true }
}
