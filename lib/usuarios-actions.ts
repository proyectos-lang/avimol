"use server"

import bcrypt from "bcryptjs"
import { getAvimolDb } from "@/lib/supabase-avimol"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import type { Permisos } from "@/lib/dashboard-data"

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

// --- Gestión de usuarios y permisos por módulo (solo admin) ---

export interface UsuarioAdmin {
  id: number
  usuario: string
  nombre: string
  rol: string
  activo: boolean
  modulos: string[]
}

// Un archivo "use server" solo puede exportar funciones async, por eso este
// arreglo de roles válidos (del CHECK de avimol.usuarios.rol) queda local.
const ROLES = ["admin", "recolector", "clasificador", "bodega", "vendedor", "gerencia"] as const

async function esAdmin(): Promise<boolean> {
  const u = await obtenerUsuarioActual()
  return u?.rol === "admin"
}

// Módulos permitidos del usuario de sesión: "all" para admin, o la
// allow-list de href para el resto. Lo usa el layout para filtrar el nav
// y bloquear el acceso por URL.
export async function obtenerModulosPermitidos(): Promise<Permisos> {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) return []
  if (usuario.rol === "admin") return "all"

  const db = getAvimolDb()
  const { data, error } = await db.from("usuario_modulos").select("modulo_href").eq("usuario_id", usuario.id)
  if (error) {
    console.error("[avimol] Error obteniendo módulos permitidos:", error)
    return []
  }
  return (data ?? []).map((f: any) => f.modulo_href)
}

export async function listarUsuarios(): Promise<UsuarioAdmin[]> {
  if (!(await esAdmin())) return []
  const db = getAvimolDb()

  const [{ data: usuarios, error }, { data: permisos }] = await Promise.all([
    db.from("usuarios").select("id, usuario, nombre, rol, activo").order("usuario", { ascending: true }),
    db.from("usuario_modulos").select("usuario_id, modulo_href"),
  ])

  if (error) {
    console.error("[avimol] Error listando usuarios:", error)
    return []
  }

  const modulosPorUsuario = new Map<number, string[]>()
  for (const p of (permisos ?? []) as any[]) {
    const arr = modulosPorUsuario.get(p.usuario_id) ?? []
    arr.push(p.modulo_href)
    modulosPorUsuario.set(p.usuario_id, arr)
  }

  return (usuarios ?? []).map((u: any) => ({
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    rol: u.rol,
    activo: u.activo,
    modulos: modulosPorUsuario.get(u.id) ?? [],
  }))
}

export async function crearUsuario(datos: {
  usuario: string
  nombre: string
  password: string
  rol: string
  modulos: string[]
}): Promise<{ success: boolean; message?: string }> {
  if (!(await esAdmin())) return { success: false, message: "No autorizado" }

  const usuario = datos.usuario.trim().toLowerCase()
  const nombre = datos.nombre.trim()
  if (!usuario || !nombre) return { success: false, message: "Usuario y nombre son obligatorios" }
  if (datos.password.length < 4) return { success: false, message: "La contraseña debe tener al menos 4 caracteres" }
  if (!ROLES.includes(datos.rol as (typeof ROLES)[number])) return { success: false, message: "Rol inválido" }

  const db = getAvimolDb()

  const { data: existente } = await db.from("usuarios").select("id").eq("usuario", usuario).maybeSingle()
  if (existente) return { success: false, message: "Ya existe un usuario con ese nombre de usuario" }

  const passwordHash = await bcrypt.hash(datos.password, 10)

  const { data: nuevo, error } = await db
    .from("usuarios")
    .insert({ usuario, nombre, password_hash: passwordHash, rol: datos.rol, activo: true })
    .select("id")
    .single()

  if (error || !nuevo) {
    console.error("[avimol] Error creando usuario:", error)
    return { success: false, message: "No se pudo crear el usuario: " + error?.message }
  }

  const modulos = [...new Set(datos.modulos)]
  if (modulos.length > 0) {
    const { error: errorMod } = await db
      .from("usuario_modulos")
      .insert(modulos.map((href) => ({ usuario_id: nuevo.id, modulo_href: href })))
    if (errorMod) console.error("[avimol] Error asignando módulos al usuario:", errorMod)
  }

  return { success: true }
}

export async function actualizarUsuario(
  id: number,
  datos: { nombre: string; rol: string; activo: boolean },
): Promise<{ success: boolean; message?: string }> {
  const sesion = await obtenerUsuarioActual()
  if (sesion?.rol !== "admin") return { success: false, message: "No autorizado" }
  if (sesion.id === id && !datos.activo) {
    return { success: false, message: "No puedes desactivar tu propio usuario" }
  }
  if (!ROLES.includes(datos.rol as (typeof ROLES)[number])) return { success: false, message: "Rol inválido" }

  const db = getAvimolDb()
  const { error } = await db
    .from("usuarios")
    .update({ nombre: datos.nombre.trim(), rol: datos.rol, activo: datos.activo })
    .eq("id", id)

  if (error) {
    console.error("[avimol] Error actualizando usuario:", error)
    return { success: false, message: "No se pudo actualizar: " + error.message }
  }
  return { success: true }
}

export async function actualizarModulosUsuario(
  id: number,
  modulos: string[],
): Promise<{ success: boolean; message?: string }> {
  const sesion = await obtenerUsuarioActual()
  if (sesion?.rol !== "admin") return { success: false, message: "No autorizado" }

  const db = getAvimolDb()
  await db.from("usuario_modulos").delete().eq("usuario_id", id)

  const unicos = [...new Set(modulos)]
  if (unicos.length > 0) {
    const { error } = await db
      .from("usuario_modulos")
      .insert(unicos.map((href) => ({ usuario_id: id, modulo_href: href })))
    if (error) {
      console.error("[avimol] Error actualizando módulos del usuario:", error)
      return { success: false, message: "No se pudieron guardar los permisos: " + error.message }
    }
  }
  return { success: true }
}

export async function restablecerPassword(
  id: number,
  nuevaPassword: string,
): Promise<{ success: boolean; message?: string }> {
  if (!(await esAdmin())) return { success: false, message: "No autorizado" }
  if (nuevaPassword.length < 4) return { success: false, message: "La contraseña debe tener al menos 4 caracteres" }

  const db = getAvimolDb()
  const passwordHash = await bcrypt.hash(nuevaPassword, 10)
  const { error } = await db.from("usuarios").update({ password_hash: passwordHash }).eq("id", id)

  if (error) {
    console.error("[avimol] Error restableciendo contraseña:", error)
    return { success: false, message: "No se pudo restablecer la contraseña: " + error.message }
  }
  return { success: true }
}
