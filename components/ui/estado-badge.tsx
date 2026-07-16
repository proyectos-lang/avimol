import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Convención de color por estado tomada de Lipgo: verde sólido para
// estados terminales positivos, azul/cian suave para "en curso", ámbar
// suave para "pendiente", destructivo para anulado/cancelado — igual
// criterio que sus badges de asistencia (Presente/Ausente/Tarde).
const ESTILOS: Record<string, string> = {
  cerrado: "border-transparent bg-green-600 text-white hover:bg-green-600",
  recibido: "border-transparent bg-green-600 text-white hover:bg-green-600",
  despachado: "border-transparent bg-green-600 text-white hover:bg-green-600",
  activo: "border-transparent bg-green-600 text-white hover:bg-green-600",
  activa: "border-transparent bg-green-600 text-white hover:bg-green-600",
  disponible: "border-transparent bg-green-600 text-white hover:bg-green-600",
  cargado: "border-transparent bg-sky-100 text-sky-700 hover:bg-sky-100",
  en_transito: "border-transparent bg-sky-100 text-sky-700 hover:bg-sky-100",
  en_picking: "border-transparent bg-sky-100 text-sky-700 hover:bg-sky-100",
  en_uso: "border-transparent bg-sky-100 text-sky-700 hover:bg-sky-100",
  pendiente: "border-transparent bg-amber-100 text-amber-700 hover:bg-amber-100",
  inactivo: "border-transparent bg-muted text-muted-foreground",
  inactiva: "border-transparent bg-muted text-muted-foreground",
  anulado: "border-transparent bg-destructive text-white hover:bg-destructive",
}

export function EstadoBadge({ estado, label }: { estado: string; label: string }) {
  const estilo = ESTILOS[estado] ?? "border-transparent bg-muted text-muted-foreground"
  return <Badge className={cn(estilo)}>{label}</Badge>
}
