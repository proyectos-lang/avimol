"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bird, Building, Gauge, Pencil, Power, RefreshCw, Warehouse, X } from "lucide-react"
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
  listarGalpones,
  crearGalpon,
  actualizarGalpon,
  cambiarEstadoGalpon,
  type Galpon,
} from "@/lib/galpones-actions"
import { listarGranjas, crearGranja, type Granja } from "@/lib/granjas-actions"

export function GalponesView() {
  const [galpones, setGalpones] = useState<Galpon[]>([])
  const [granjas, setGranjas] = useState<Granja[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  const [editando, setEditando] = useState<Galpon | null>(null)
  const [codigo, setCodigo] = useState("")
  const [nombre, setNombre] = useState("")
  const [capacidad, setCapacidad] = useState("")
  const [granjaId, setGranjaId] = useState<string>("")
  const [nuevaGranjaNombre, setNuevaGranjaNombre] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDatos() {
    setCargando(true)
    const [g, gr] = await Promise.all([listarGalpones(), listarGranjas()])
    setGalpones(g)
    setGranjas(gr)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return galpones
    return galpones.filter((g) =>
      `${g.codigo} ${g.nombre} ${g.granja_nombre ?? ""}`.toLowerCase().includes(q),
    )
  }, [galpones, busqueda])

  const activos = galpones.filter((g) => g.activo).length
  const capacidadTotal = galpones.reduce((acc, g) => acc + (g.capacidad ?? 0), 0)

  function limpiarFormulario() {
    setEditando(null)
    setCodigo("")
    setNombre("")
    setCapacidad("")
    setGranjaId("")
    setError(null)
  }

  function iniciarEdicion(g: Galpon) {
    setEditando(g)
    setCodigo(g.codigo)
    setNombre(g.nombre)
    setCapacidad(g.capacidad?.toString() ?? "")
    setGranjaId(g.granja_id?.toString() ?? "")
    setError(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function onAgregarGranjaRapida() {
    if (!nuevaGranjaNombre.trim()) return
    const resultado = await crearGranja(nuevaGranjaNombre.trim(), null)
    if (resultado.success && resultado.granja) {
      setGranjas((prev) => [...prev, resultado.granja!])
      setGranjaId(resultado.granja.id.toString())
      setNuevaGranjaNombre("")
      toast.success(`Granja "${resultado.granja.nombre}" agregada`)
    }
  }

  async function onGuardar() {
    if (!codigo.trim() || !nombre.trim()) {
      setError("Código y nombre son obligatorios")
      return
    }
    setGuardando(true)
    setError(null)

    const datos = {
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      capacidad: capacidad ? Number(capacidad) : null,
      granjaId: granjaId ? Number(granjaId) : null,
    }

    const resultado = editando ? await actualizarGalpon(editando.id, datos) : await crearGalpon(datos)
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al guardar")
      toast.error(resultado.message ?? "Error al guardar el galpón")
      return
    }

    toast.success(editando ? `Galpón ${datos.codigo} actualizado` : `Galpón ${datos.codigo} creado`)
    limpiarFormulario()
    cargarDatos()
  }

  async function onCambiarEstado(g: Galpon) {
    await cambiarEstadoGalpon(g.id, !g.activo)
    toast.success(`Galpón ${g.codigo} ${g.activo ? "desactivado" : "activado"}`)
    cargarDatos()
  }

  return (
    <div>
      <PageHeader titulo="Galpones" subtitulo="Crea y administra los galpones de la granja">
        <StatChip icono={Warehouse} label="Galpones" valor={galpones.length} />
        <StatChip icono={Power} label="Activos" valor={activos} />
        <StatChip icono={Gauge} label="Capacidad total" valor={capacidadTotal.toLocaleString("es-CO")} />
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/aves">
            <Bird className="h-4 w-4" />
            Ir a lotes de aves
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Formulario siempre visible al lado del historial */}
        <FormCard
          titulo={editando ? `Editar galpón ${editando.codigo}` : "Nuevo galpón"}
          subtitulo={editando ? "Modifica los datos y guarda los cambios" : "Registra un galpón de la granja"}
          icono={Warehouse}
          className="h-fit lg:sticky lg:top-6"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="codigo">
                Código <span className="text-destructive">*</span>
              </Label>
              <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="G-01" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Galpón 1" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="capacidad">Capacidad (aves)</Label>
              <Input
                id="capacidad"
                type="number"
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
                placeholder="10000"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Granja</Label>
              <Select value={granjaId} onValueChange={setGranjaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una granja (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {granjas.map((gr) => (
                    <SelectItem key={gr.id} value={gr.id.toString()}>
                      {gr.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  value={nuevaGranjaNombre}
                  onChange={(e) => setNuevaGranjaNombre(e.target.value)}
                  placeholder="Agregar granja nueva..."
                />
                <Button type="button" variant="outline" onClick={onAgregarGranjaRapida}>
                  Agregar
                </Button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button className="flex-1" size="lg" onClick={onGuardar} disabled={guardando}>
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear galpón"}
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

        {/* Historial */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Historial de galpones ({filtrados.length})
            </h2>
            <div className="flex items-center gap-2">
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por código, nombre o granja..." className="w-64" />
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
          ) : filtrados.length === 0 ? (
            <EmptyState
              icono={busqueda ? Building : Warehouse}
              titulo={busqueda ? "Sin resultados" : "Todavía no hay galpones"}
              descripcion={
                busqueda
                  ? "Ningún galpón coincide con la búsqueda. Intenta con otro término."
                  : "Registra el primer galpón con el formulario de la izquierda."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Granja</TableHead>
                  <TableHead className="text-right">Capacidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((g) => (
                  <TableRow key={g.id} className={editando?.id === g.id ? "bg-primary/5" : undefined}>
                    <TableCell className="font-medium">{g.codigo}</TableCell>
                    <TableCell>{g.nombre}</TableCell>
                    <TableCell>{g.granja_nombre ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g.capacidad != null ? g.capacidad.toLocaleString("es-CO") : "—"}
                    </TableCell>
                    <TableCell>
                      <EstadoBadge estado={g.activo ? "activo" : "inactivo"} label={g.activo ? "Activo" : "Inactivo"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="icon" onClick={() => iniciarEdicion(g)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onCambiarEstado(g)}
                          title={g.activo ? "Desactivar" : "Activar"}
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
    </div>
  )
}
