import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify } from "jose"

const COOKIE_NAME = "avimol_session"
// El logo (marca) debe servirse sin sesión para que aparezca en el login.
const RUTAS_PUBLICAS = ["/login", "/logo-lipgo-mark"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Assets estáticos con extensión (imágenes, etc.) no requieren sesión.
  if (/\.[a-z0-9]+$/i.test(pathname)) {
    return NextResponse.next()
  }

  if (RUTAS_PUBLICAS.some((ruta) => pathname.startsWith(ruta)) || pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  try {
    const secret = new TextEncoder().encode(process.env.AVIMOL_JWT_SECRET!)
    await jwtVerify(token, secret)
    // Expone la ruta a los server components (el layout la usa para
    // bloquear el acceso por URL a módulos no permitidos).
    const headers = new Headers(request.headers)
    headers.set("x-pathname", pathname)
    return NextResponse.next({ request: { headers } })
  } catch {
    const respuesta = NextResponse.redirect(new URL("/login", request.url))
    respuesta.cookies.delete(COOKIE_NAME)
    return respuesta
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
