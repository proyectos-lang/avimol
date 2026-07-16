"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface ReferenciaCatalogo {
  id: number
  nombre: string
  tipo_nombre: string
  color_nombre: string
  imagen_url: string | null
  peso_unitario_gramos: number
}

export async function listarCatalogoReferencias(): Promise<ReferenciaCatalogo[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("referencias_huevo")
    .select("id, nombre, imagen_url, peso_unitario_gramos, tipos_huevo(nombre), colores_huevo(nombre)")
    .eq("activo", true)
    .order("id", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando catálogo de referencias:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    nombre: fila.nombre,
    tipo_nombre: fila.tipos_huevo?.nombre ?? "",
    color_nombre: fila.colores_huevo?.nombre ?? "",
    imagen_url: fila.imagen_url,
    peso_unitario_gramos: fila.peso_unitario_gramos,
  }))
}

export async function actualizarReferencia(
  id: number,
  datos: { imagenUrl: string | null; pesoGramos: number },
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db
    .from("referencias_huevo")
    .update({ imagen_url: datos.imagenUrl, peso_unitario_gramos: datos.pesoGramos })
    .eq("id", id)

  if (error) {
    console.error("[avimol] Error actualizando referencia:", error)
    return { success: false, message: "No se pudo actualizar la referencia: " + error.message }
  }
  return { success: true }
}
