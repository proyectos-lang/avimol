"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Boxes, Building2, LayoutGrid, Pencil, Power, RefreshCw, Truck, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { FormCard } from "@/components/ui/form-card"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { EstadoBadge } from "@/components/ui/estado-badge"
import {
  listarBodegas,
  crearBodega,
  actualizarBodega,
  cambiarEstadoBodega,
  type Bodega,
} from "@/lib/bodegas-actions"
import { AnaquelesDialog } from "@/components/bodegas/anaqueles-dialog"

const TIPOS = [
  { value: "clasificadora", label: "Clasificadora" },
  { value: "venta", label: "Venta" },
  { value: "mixta", label: "Mixta" },
]

export function BodegasView() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  const [editando, setEditando] = useState<Bodega | null>(null)
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState("clasificadora")
  const [ubicacion, setUbicacion] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anaquelesDe, setAnaquelesDe] = useState<Bodega | null>(null)

  async function cargarDatos() {
    setCargando(true)
    setBodegas(await listarBodegas(false))
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return bodegas
    return bodegas.filter((b) => `${b.nombre} ${b.tipo} ${b.ubicacion ?? ""}`.toLowerCase().includes(q))
  }, [bodegas, busqueda])

  const activas = bodegas.filter((b) => b.activo).length

  function limpiarFormulario() {
    setEditando(null)
    setNombre("")
    setTipo("clasificadora")
    setUbicacion("")
    setError(null)
  }

  function iniciarEdicion(b: Bodega) {
    setEditando(b)
    setNombre(b.nombre)
    setTipo(b.tipo)
    setUbicacion(b.ubicacion ?? "")
    setError(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function onGuardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio")
      return
    }
    setGuardando(true)
    setError(null)

    const datos = { nombre: nombre.trim(), tipo, ubicacion: ubicacion.trim() || null }
    const resultado = editando ? await actualizarBodega(editando.id, datos) : await crearBodega(datos)
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al guardar")
      toast.error(resultado.message ?? "Error al guardar la bodega")
      return
    }

    toast.success(editando ? `Bodega "${datos.nombre}" actualizada` : `Bodega "${datos.nombre}" creada`)
    limpiarFormulario()
    cargarDatos()
  }

  async function onCambiarEstado(b: Bodega) {
    await cambiarEstadoBodega(b.id, !b.activo)
    toast.success(`Bodega "${b.nombre}" ${b.activo ? "desactivada" : "activada"}`)
    cargarDatos()
  }

  return (
    <div>
      <PageHeader titulo="Bodegas" subtitulo="Clasificadoras y bodegas de venta con su propio inventario">
        <StatChip icono={Building2} label="Bodegas" valor={bodegas.length} />
        <StatChip icono={Power} label="Activas" valor={activas} />
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/inventario">
            <Boxes className="h-4 w-4" />
            Ver inventario
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/traslados">
            <Truck className="h-4 w-4" />
            Solicitar traslado
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <FormCard
          titulo={editando ? `Editar bodega` : "Nueva bodega"}
          subtitulo={editando ? `Modificando "${editando.nombre}"` : "Registra una clasificadora o bodega de venta"}
          icono={Building2}
          className="h-fit lg:sticky lg:top-6"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Clasificadora principal" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ubicacion">Ubicación (opcional)</Label>
              <Input id="ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button className="flex-1" size="lg" onClick={onGuardar} disabled={guardando}>
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear bodega"}
              </Button>
              {editando && (
                <Button variant="outline" size="lg" onClick={limpiarFormulario} className="gap-1">
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </FormCard>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Historial de bodegas ({filtradas.length})
            </h2>
            <div className="flex items-center gap-2">
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, tipo o ubicación..." className="w-64" />
              <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {cargando ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtradas.length === 0 ? (
            <EmptyState
              icono={Building2}
              titulo={busqueda ? "Sin resultados" : "Todavía no hay bodegas"}
              descripcion={
                busqueda
                  ? "Ninguna bodega coincide con la búsqueda."
                  : "Registra la primera bodega con el formulario de la izquierda."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((b) => (
                  <TableRow key={b.id} className={editando?.id === b.id ? "bg-primary/5" : undefined}>
                    <TableCell className="font-medium">{b.nombre}</TableCell>
                    <TableCell className="capitalize">{b.tipo}</TableCell>
                    <TableCell>{b.ubicacion ?? "—"}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={b.activo ? "activa" : "inactiva"} label={b.activo ? "Activa" : "Inactiva"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="icon" onClick={() => setAnaquelesDe(b)} title="Estanterías">
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => iniciarEdicion(b)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onCambiarEstado(b)}
                          title={b.activo ? "Desactivar" : "Activar"}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <AnaquelesDialog
        bodegaId={anaquelesDe?.id ?? null}
        bodegaNombre={anaquelesDe?.nombre ?? ""}
        open={!!anaquelesDe}
        onOpenChange={(v) => !v && setAnaquelesDe(null)}
      />
    </div>
  )
}
