"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface Granja {
  id: number
  nombre: string
  ubicacion: string | null
}

export async function listarGranjas(): Promise<Granja[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("granjas")
    .select("id, nombre, ubicacion")
    .eq("activo", true)
    .order("nombre", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando granjas:", error)
    return []
  }
  return data ?? []
}

export async function crearGranja(nombre: string, ubicacion: string | null): Promise<{ success: boolean; message?: string; granja?: Granja }> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("granjas")
    .insert({ nombre, ubicacion })
    .select("id, nombre, ubicacion")
    .single()

  if (error) {
    console.error("[avimol] Error creando granja:", error)
    return { success: false, message: "No se pudo crear la granja: " + error.message }
  }
  return { success: true, granja: data }
}
