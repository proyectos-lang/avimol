import type { ReactNode } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { ModuloHeroBar } from "@/components/modulo-hero-bar"
import { PermisosProvider } from "@/components/permisos-provider"
import { Toaster } from "@/components/ui/sonner"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { obtenerModulosPermitidos } from "@/lib/usuarios-actions"
import { groups, moduloDeRuta } from "@/lib/dashboard-data"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const usuario = await obtenerUsuarioActual()
  if (!usuario) redirect("/login")

  const permisos = await obtenerModulosPermitidos()
  const esAdmin = permisos === "all"
  const permitidos = permisos === "all" ? null : new Set(permisos)

  // Bloqueo de acceso por URL (además de ocultar en el nav). El pathname lo
  // expone proxy.ts en el header x-pathname.
  const pathname = (await headers()).get("x-pathname") ?? ""
  if (permitidos) {
    if (pathname.startsWith("/configuracion")) redirect("/")

    const moduloHref = moduloDeRuta(pathname)
    if (moduloHref && !permitidos.has(moduloHref)) redirect("/")

    // Página de grupo (/g/[key]): permitida solo si el usuario tiene al
    // menos un módulo visible en ese grupo.
    if (pathname.startsWith("/g/")) {
      const key = pathname.slice(3).split("/")[0]
      const grupo = groups.find((g) => g.key === key)
      const tieneAlguno = grupo?.modules.some((m) => permitidos.has(m.href))
      if (!tieneAlguno) redirect("/")
    }
  }

  return (
    <PermisosProvider permisos={permisos} esAdmin={esAdmin}>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="min-w-0 flex-1 px-6 py-6">
          {/* Banda de insights de alto impacto en la parte superior de cada
              módulo (se auto-oculta en el inicio y en las páginas de detalle). */}
          <ModuloHeroBar />
          {children}
        </main>
        {/* Notificaciones toast globales (sonner) para feedback de guardado/errores. */}
        <Toaster position="top-right" richColors closeButton />
      </div>
    </PermisosProvider>
  )
}
