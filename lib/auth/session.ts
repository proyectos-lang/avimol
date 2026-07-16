import "server-only"
import { SignJWT, jwtVerify } from "jose"

const COOKIE_NAME = "avimol_session"
const DURACION_SEGUNDOS = 60 * 60 * 12 // 12 horas. Sin tabla de sesiones:
// no se puede invalidar un token antes de que expire, por eso la vida
// util se mantiene corta (el usuario vuelve a loguearse al vencer).

export interface SesionUsuario {
  id: number
  usuario: string
  nombre: string
  rol: string
}

function getSecret() {
  const secret = process.env.AVIMOL_JWT_SECRET
  if (!secret) throw new Error("Falta configurar AVIMOL_JWT_SECRET")
  return new TextEncoder().encode(secret)
}

export async function crearTokenSesion(datos: SesionUsuario): Promise<string> {
  return new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .sign(getSecret())
}

export async function verificarTokenSesion(token: string): Promise<SesionUsuario | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      id: payload.id as number,
      usuario: payload.usuario as string,
      nombre: payload.nombre as string,
      rol: payload.rol as string,
    }
  } catch {
    return null
  }
}

export const AVIMOL_COOKIE_NAME = COOKIE_NAME
export const AVIMOL_COOKIE_MAX_AGE = DURACION_SEGUNDOS
