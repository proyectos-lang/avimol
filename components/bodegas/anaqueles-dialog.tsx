"use client"

import { useEffect, useState } from "react"
import { LayoutGrid, Plus, Power } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  listarTodosAnaquelesPorBodega,
  crearAnaquel,
  cambiarEstadoAnaquel,
  type Anaquel,
} from "@/lib/anaqueles-actions"

export function AnaquelesDialog({
  bodegaId,
  bodegaNombre,
  open,
  onOpenChange,
}: {
  bodegaId: number | null
  bodegaNombre: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [anaqueles, setAnaqueles] = useState<Anaquel[]>([])
  const [cargando, setCargando] = useState(true)
  const [codigo, setCodigo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    if (!bodegaId) return
    setCargando(true)
    setAnaqueles(await listarTodosAnaquelesPorBodega(bodegaId))
    setCargando(false)
  }

  useEffect(() => {
    if (open) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bodegaId])

  async function onCrear() {
    if (!bodegaId || !codigo.trim()) return
    setGuardando(true)
    setError(null)
    const resultado = await crearAnaquel(bodegaId, codigo.trim(), descripcion.trim() || null)
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "No se pudo crear la estantería")
      return
    }
    toast.success(`Estantería "${codigo.trim()}" creada`)
    setCodigo("")
    setDescripcion("")
    cargar()
  }

  async function onCambiarEstado(a: Anaquel) {
    await cambiarEstadoAnaquel(a.id, !a.activo)
    toast.success(`Estantería "${a.codigo}" ${a.activo ? "desactivada" : "activada"}`)
    cargar()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Estanterías — {bodegaNombre}
          </DialogTitle>
          <DialogDescription>
            Ubicaciones dentro de la bodega para clasificar el huevo recibido. Se seleccionan al registrar una recolección.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <Label className="text-xs text-muted-foreground">Nueva estantería</Label>
          <div className="flex gap-2">
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Código (ej. A1)"
              className="w-32"
            />
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción (opcional)"
              className="flex-1"
            />
            <Button onClick={onCrear} disabled={guardando || !codigo.trim()} className="gap-1">
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {cargando ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : anaqueles.length === 0 ? (
            <EmptyState
              icono={LayoutGrid}
              titulo="Sin estanterías todavía"
              descripcion="Agrega el primero con el formulario de arriba."
            />
          ) : (
            anaqueles.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div>
                  <span className="font-semibold">{a.codigo}</span>
                  {a.descripcion && <span className="ml-2 text-sm text-muted-foreground">{a.descripcion}</span>}
                  {!a.activo && (
                    <Badge variant="secondary" className="ml-2">
                      Inactivo
                    </Badge>
                  )}
                </div>
                <Button variant="outline" size="icon" onClick={() => onCambiarEstado(a)} title={a.activo ? "Desactivar" : "Activar"}>
                  <Power className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
