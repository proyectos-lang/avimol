import type { ReactNode } from "react"

// Encabezado estándar de módulo: título + subtítulo a la izquierda,
// acciones rápidas (chips de estadísticas, botones de acceso) a la derecha.
export function PageHeader({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
