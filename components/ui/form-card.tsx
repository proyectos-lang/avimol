import type { ComponentType, ReactNode } from "react"
import { cn } from "@/lib/utils"

// Tarjeta de formulario con barra de título en color primario — misma
// convención que los formularios de Lipgo (order-entry-form,
// bascula-form): "bg-primary rounded-t-lg p-4" con título blanco y el
// cuerpo fusionado debajo.
export function FormCard({
  titulo,
  subtitulo,
  icono: Icono,
  children,
  className,
}: {
  titulo: string
  subtitulo?: string
  icono?: ComponentType<{ className?: string }>
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between bg-primary p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            {Icono && <Icono className="h-5 w-5" />}
            {titulo}
          </h2>
          {subtitulo && <p className="mt-0.5 text-xs text-white/90">{subtitulo}</p>}
        </div>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </div>
  )
}
