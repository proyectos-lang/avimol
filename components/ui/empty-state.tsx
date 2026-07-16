import type { ComponentType, ReactNode } from "react"

export function EmptyState({
  icono: Icono,
  titulo,
  descripcion,
  children,
}: {
  icono: ComponentType<{ className?: string }>
  titulo: string
  descripcion?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icono className="h-6 w-6" />
      </span>
      <p className="font-semibold text-foreground">{titulo}</p>
      {descripcion && <p className="max-w-sm text-sm text-muted-foreground">{descripcion}</p>}
      {children}
    </div>
  )
}
