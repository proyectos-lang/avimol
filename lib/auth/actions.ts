"use server"

import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { getAvimolDb } from "@/lib/supabase-avimol"
import {
  crearTokenSesion,
  verificarTokenSesion,
  AVIMOL_COOKIE_NAME,
  AVIMOL_COOKIE_MAX_AGE,
  type SesionUsuario,
} from "@/lib/auth/session"

export async function iniciarSesion(
  usuario: string,
  password: string,
): Promise<{ success: boolean; message?: string }> {
  const db = getAvimolDb()

  const { data: fila, error } = await db
    .from("usuarios")
    .select("id, usuario, nombre, password_hash, rol, activo")
    .eq("usuario", usuario)
    .maybeSingle()

  if (error) {
    console.error("[avimol] Error consultando usuario:", error)
    return { success: false, message: "Error al iniciar sesión" }
  }

  if (!fila || !fila.activo) {
    return { success: false, message: "Usuario o contraseña incorrectos" }
  }

  const claveValida = await bcrypt.compare(password, fila.password_hash)
  if (!claveValida) {
    return { success: false, message: "Usuario o contraseña incorrectos" }
  }

  const token = await crearTokenSesion({
    id: fila.id,
    usuario: fila.usuario,
    nombre: fila.nombre,
    rol: fila.rol,
  })

  const cookieStore = await cookies()
  cookieStore.set(AVIMOL_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AVIMOL_COOKIE_MAX_AGE,
  })

  return { success: true }
}

export async function cerrarSesion(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(AVIMOL_COOKIE_NAME)
}

export async function obtenerUsuarioActual(): Promise<SesionUsuario | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AVIMOL_COOKIE_NAME)?.value
  if (!token) return null
  return verificarTokenSesion(token)
}
