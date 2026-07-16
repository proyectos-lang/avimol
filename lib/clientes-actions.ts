"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"

export interface Cliente {
  id: number
  nombre: string
  telefono: string | null
  direccion: string | null
  activo: boolean
}

export async function listarClientes(soloActivos = true): Promise<Cliente[]> {
  const db = getAvimolDb()
  let query = db.from("clientes").select("id, nombre, telefono, direccion, activo").order("nombre", { ascending: true })

  if (soloActivos) query = query.eq("activo", true)

  const { data, error } = await query

  if (error) {
    console.error("[avimol] Error listando clientes:", error)
    return []
  }
  return data ?? []
}

export interface DatosCliente {
  nombre: string
  telefono: string | null
  direccion: string | null
}

export async function crearCliente(datos: DatosCliente): Promise<{ success: boolean; message?: string; cliente?: Cliente }> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("clientes")
    .insert(datos)
    .select("id, nombre, telefono, direccion, activo")
    .single()

  if (error) {
    console.error("[avimol] Error creando cliente:", error)
    return { success: false, message: "No se pudo crear el cliente: " + error.message }
  }
  return { success: true, cliente: data }
}

export async function actualizarCliente(id: number, datos: DatosCliente): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()
  const { error } = await db.from("clientes").update(datos).eq("id", id)

  if (error) {
    console.error("[avimol] Error actualizando cliente:", error)
    return { success: false, message: "No se pudo actualizar el cliente: " + error.message }
  }
  return { success: true }
}

export async function cambiarEstadoCliente(id: number, activo: boolean): Promise<{ success: boolean }> {
  const db = getAvimolDb()
  await db.from("clientes").update({ activo }).eq("id", id)
  return { success: true }
}
