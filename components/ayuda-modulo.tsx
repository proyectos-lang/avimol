"use client"

import { useState, type CSSProperties } from "react"
import { HelpCircle, Lightbulb } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AYUDA_MODULOS } from "@/lib/ayuda-modulos"

// Botón de ayuda (?) que aparece en la esquina de la banda de cada módulo.
// Abre un diálogo con el propósito y los pasos de uso del módulo, tomados
// de lib/ayuda-modulos.ts e indexados por href. Si un módulo no tiene
// ayuda registrada, no renderiza nada.
export function AyudaModulo({ href, titulo, tint }: { href: string; titulo: string; tint?: string }) {
  const [abierto, setAbierto] = useState(false)
  const ayuda = AYUDA_MODULOS[href]
  if (!ayuda) return null

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger
        aria-label={`Ayuda de ${titulo}`}
        title="¿Cómo se usa este módulo?"
        className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/70 text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={tint ? ({ color: tint } as CSSProperties) : undefined}
      >
        <HelpCircle className="h-5 w-5" />
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            {titulo} — cómo se usa
          </DialogTitle>
          <DialogDescription>{ayuda.proposito}</DialogDescription>
        </DialogHeader>

        <div className="mt-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pasos</p>
          <ol className="flex flex-col gap-2.5">
            {ayuda.acciones.map((accion, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="text-foreground/90">{accion}</span>
              </li>
            ))}
          </ol>
        </div>

        {ayuda.nota && (
          <p className="mt-3 rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {ayuda.nota}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
