"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface Galpon {
  id: number
  codigo: string
  nombre: string
  capacidad: number | null
  activo: boolean
  granja_id: number | null
  granja_nombre: string | null
}

export async function listarGalpones(): Promise<Galpon[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("galpones")
    .select("id, codigo, nombre, capacidad, activo, granja_id, granjas(nombre)")
    .order("codigo", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando galpones:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    capacidad: fila.capacidad,
    activo: fila.activo,
    granja_id: fila.granja_id,
    granja_nombre: fila.granjas?.nombre ?? null,
  }))
}

export interface DatosGalpon {
  codigo: string
  nombre: string
  capacidad: number | null
  granjaId: number | null
}

export async function crearGalpon(datos: DatosGalpon): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db.from("galpones").insert({
    codigo: datos.codigo,
    nombre: datos.nombre,
    capacidad: datos.capacidad,
    granja_id: datos.granjaId,
  })

  if (error) {
    console.error("[avimol] Error creando galpón:", error)
    return { success: false, message: "No se pudo crear el galpón: " + error.message }
  }
  return { success: true }
}

export async function actualizarGalpon(
  id: number,
  datos: DatosGalpon,
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db
    .from("galpones")
    .update({
      codigo: datos.codigo,
      nombre: datos.nombre,
      capacidad: datos.capacidad,
      granja_id: datos.granjaId,
    })
    .eq("id", id)

  if (error) {
    console.error("[avimol] Error actualizando galpón:", error)
    return { success: false, message: "No se pudo actualizar el galpón: " + error.message }
  }
  return { success: true }
}

export async function cambiarEstadoGalpon(
  id: number,
  activo: boolean,
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db.from("galpones").update({ activo }).eq("id", id)

  if (error) {
    console.error("[avimol] Error cambiando estado de galpón:", error)
    return { success: false, message: "No se pudo actualizar el estado: " + error.message }
  }
  return { success: true }
}
