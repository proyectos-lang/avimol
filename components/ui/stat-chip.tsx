import type { ComponentType } from "react"

// Chip compacto de estadística para el encabezado de un módulo — mismo
// patrón que el StatCard del dashboard-header de Lipgo (pill con icono
// en bg-primary/10, etiqueta pequeña y valor en semibold).
export function StatChip({
  icono: Icono,
  label,
  valor,
}: {
  icono: ComponentType<{ className?: string }>
  label: string
  valor: string | number
}) {
  return (
    <div className="flex min-w-[110px] items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-sm">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icono className="h-3.5 w-3.5" />
      </span>
      <div className="leading-tight">
        <p className="whitespace-nowrap text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">{valor}</p>
      </div>
    </div>
  )
}
