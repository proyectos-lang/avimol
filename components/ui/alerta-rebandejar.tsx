import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { necesitaRebandejar } from "@/lib/avicola-constants"

export function AlertaRebandejar({ edadSemanas }: { edadSemanas: number }) {
  if (!necesitaRebandejar(edadSemanas)) return null
  return (
    <Badge className="gap-1 border-transparent bg-amber-100 text-amber-700 hover:bg-amber-100">
      <AlertTriangle className="h-3 w-3" />
      Rebandejear
    </Badge>
  )
}
