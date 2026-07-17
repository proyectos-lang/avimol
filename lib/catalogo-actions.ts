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

const BUCKET = "avimol"
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])

async function asegurarBucket() {
  const db = getAvimolDb()
  const { data: existente } = await db.storage.getBucket(BUCKET)
  if (existente) return
  const { error } = await db.storage.createBucket(BUCKET, { public: true })
  // Carrera entre dos llamadas concurrentes creando el bucket por primera vez.
  if (error && !/already exists|duplicate/i.test(error.message)) throw error
}

// Sube la imagen al bucket "avimol" (path estable por referencia, con
// upsert: sobrescribe la anterior en vez de acumular basura) y devuelve
// la URL pública con cache-busting. NO escribe en referencias_huevo —
// eso lo sigue haciendo actualizarReferencia, igual que hoy.
export async function subirImagenReferencia(
  referenciaId: number,
  formData: FormData,
): Promise<{ success: boolean; message?: string; url?: string }> {
  const archivo = formData.get("archivo")
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { success: false, message: "No se seleccionó ningún archivo." }
  }
  if (!ALLOWED_MIME.has(archivo.type)) {
    return { success: false, message: "Formato no soportado. Usa PNG, JPG, WEBP o GIF." }
  }
  if (archivo.size > MAX_IMAGE_BYTES) {
    return { success: false, message: "La imagen no puede superar 5MB." }
  }

  try {
    await asegurarBucket()
  } catch (error: any) {
    console.error("[avimol] Error creando bucket de storage:", error)
    return { success: false, message: "No se pudo preparar el almacenamiento de imágenes." }
  }

  const ext = (archivo.name.split(".").pop() || archivo.type.split("/")[1] || "jpg").toLowerCase()
  const path = `catalogo/${referenciaId}.${ext}`
  const bytes = Buffer.from(await archivo.arrayBuffer())

  const db = getAvimolDb()
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: archivo.type,
    upsert: true,
  })
  if (uploadError) {
    console.error("[avimol] Error subiendo imagen:", uploadError)
    return { success: false, message: "No se pudo subir la imagen: " + uploadError.message }
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(path)
  return { success: true, url: `${data.publicUrl}?v=${Date.now()}` }
}
