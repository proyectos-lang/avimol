"use server"

import { getAvimolDb } from "@/lib/supabase-avimol"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { fechaHoraColombiaISO } from "@/lib/date-utils"

export interface LlegadaVehiculo {
  id: number
  placa: string
  conductor: string
  hora_llegada: string
  orden_cargue_id: number | null
  orden_cargue_codigo: string | null
}

export async function listarLlegadasVehiculo(): Promise<LlegadaVehiculo[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("llegadas_vehiculo")
    .select("id, placa, conductor, hora_llegada, orden_cargue_id, ordenes_cargue(codigo)")
    .order("hora_llegada", { ascending: false })

  if (error) {
    console.error("[avimol] Error listando llegadas de vehículo:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    placa: fila.placa,
    conductor: fila.conductor,
    hora_llegada: fila.hora_llegada,
    orden_cargue_id: fila.orden_cargue_id,
    orden_cargue_codigo: fila.ordenes_cargue?.codigo ?? null,
  }))
}

export async function listarLlegadasDisponibles(): Promise<LlegadaVehiculo[]> {
  const db = getAvimolDb()
  const { data, error } = await db
    .from("llegadas_vehiculo")
    .select("id, placa, conductor, hora_llegada, orden_cargue_id")
    .is("orden_cargue_id", null)
    .order("hora_llegada", { ascending: true })

  if (error) {
    console.error("[avimol] Error listando llegadas disponibles:", error)
    return []
  }

  return (data ?? []).map((fila: any) => ({
    id: fila.id,
    placa: fila.placa,
    conductor: fila.conductor,
    hora_llegada: fila.hora_llegada,
    orden_cargue_id: fila.orden_cargue_id,
    orden_cargue_codigo: null,
  }))
}

export async function registrarLlegadaVehiculo(
  placa: string,
  conductor: string,
): Promise<{ success: boolean; message?: string; llegada?: LlegadaVehiculo }> {
  if (!placa.trim() || !conductor.trim()) {
    return { success: false, message: "Placa y conductor son obligatorios" }
  }

  const db = getAvimolDb()
  const usuario = await obtenerUsuarioActual()

  const { data, error } = await db
    .from("llegadas_vehiculo")
    .insert({
      placa: placa.trim().toUpperCase(),
      conductor: conductor.trim(),
      hora_llegada: fechaHoraColombiaISO(),
      usuario_id: usuario?.id ?? null,
    })
    .select("id, placa, conductor, hora_llegada, orden_cargue_id")
    .single()

  if (error || !data) {
    console.error("[avimol] Error registrando llegada de vehículo:", error)
    return { success: false, message: "No se pudo registrar la llegada: " + error?.message }
  }

  return { success: true, llegada: { ...data, orden_cargue_codigo: null } }
}

export async function asignarVehiculoAOrden(
  ordenId: number,
  llegadaId: number,
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()

  const { data: llegada, error: errorLlegada } = await db
    .from("llegadas_vehiculo")
    .select("id, placa, conductor, hora_llegada, orden_cargue_id")
    .eq("id", llegadaId)
    .maybeSingle()

  if (errorLlegada || !llegada) {
    return { success: false, message: "No se encontró la llegada seleccionada" }
  }
  if (llegada.orden_cargue_id) {
    return { success: false, message: "Ese vehículo ya está asignado a otra orden — selecciona otro o registra una llegada nueva" }
  }

  const { error: errorOrden } = await db
    .from("ordenes_cargue")
    .update({
      placa_vehiculo: llegada.placa,
      conductor: llegada.conductor,
      hora_llegada_vehiculo: llegada.hora_llegada,
    })
    .eq("id", ordenId)

  if (errorOrden) return { success: false, message: errorOrden.message }

  await db.from("llegadas_vehiculo").update({ orden_cargue_id: ordenId }).eq("id", llegadaId)

  return { success: true }
}
