"use client"

import { useEffect, useState } from "react"
import { ImageOff, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { listarCatalogoReferencias, actualizarReferencia, type ReferenciaCatalogo } from "@/lib/catalogo-actions"

export function CatalogoView() {
  const [referencias, setReferencias] = useState<ReferenciaCatalogo[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<ReferenciaCatalogo | null>(null)
  const [imagenUrl, setImagenUrl] = useState("")
  const [pesoGramos, setPesoGramos] = useState("")
  const [guardando, setGuardando] = useState(false)

  async function cargarDatos() {
    setCargando(true)
    setReferencias(await listarCatalogoReferencias())
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  function abrirEditar(r: ReferenciaCatalogo) {
    setEditando(r)
    setImagenUrl(r.imagen_url ?? "")
    setPesoGramos(r.peso_unitario_gramos.toString())
  }

  async function onGuardar() {
    if (!editando) return
    setGuardando(true)
    await actualizarReferencia(editando.id, {
      imagenUrl: imagenUrl.trim() || null,
      pesoGramos: Number(pesoGramos) || 0,
    })
    setGuardando(false)
    toast.success(`"${editando.nombre}" actualizada`)
    setEditando(null)
    cargarDatos()
  }

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>

  return (
    <div>
      <PageHeader
        titulo="Catálogo de referencias"
        subtitulo="Imagen por referencia para el portal de pedidos — clic en el lápiz para cambiarla"
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {referencias.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <div className="flex aspect-square items-center justify-center bg-muted">
              {r.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imagen_url} alt={r.nombre} className="h-full w-full object-cover" />
              ) : (
                <ImageOff className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-semibold">{r.nombre}</p>
                <p className="text-xs text-muted-foreground">{r.peso_unitario_gramos} g</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => abrirEditar(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editando} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imagen — {editando?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>URL de la imagen</Label>
            <Input value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Peso unitario (gramos)</Label>
            <Input
              type="number"
              value={pesoGramos}
              onChange={(e) => setPesoGramos(e.target.value)}
              placeholder="65"
            />
            <p className="text-xs text-muted-foreground">
              Se usa para calcular el peso automático en órdenes de cargue, descargue y despacho.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={onGuardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
