import type { ReactNode } from "react"
import { Sidebar } from "@/components/sidebar"
import { ModuloHeroBar } from "@/components/modulo-hero-bar"
import { Toaster } from "@/components/ui/sonner"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
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
  )
}
