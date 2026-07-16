"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface Vendedor {
  id: number
  nombre: string
}

export async function listarVendedores(): Promise<Vendedor[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("usuarios")
    .select("id, nombre")
    .eq("rol", "vendedor")
    .eq("activo", true)
    .order("nombre", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando vendedores:", error)
    return []
  }
  return data ?? []
}
