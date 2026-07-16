"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Pencil, Power, RefreshCw, ShoppingCart, Users, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { FormCard } from "@/components/ui/form-card"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { EstadoBadge } from "@/components/ui/estado-badge"
import {
  listarClientes,
  crearCliente,
  actualizarCliente,
  cambiarEstadoCliente,
  type Cliente,
} from "@/lib/clientes-actions"

export function ClientesView() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  const [editando, setEditando] = useState<Cliente | null>(null)
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [direccion, setDireccion] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDatos() {
    setCargando(true)
    setClientes(await listarClientes(false))
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) => `${c.nombre} ${c.telefono ?? ""} ${c.direccion ?? ""}`.toLowerCase().includes(q))
  }, [clientes, busqueda])

  const activos = clientes.filter((c) => c.activo).length

  function limpiarFormulario() {
    setEditando(null)
    setNombre("")
    setTelefono("")
    setDireccion("")
    setError(null)
  }

  function iniciarEdicion(c: Cliente) {
    setEditando(c)
    setNombre(c.nombre)
    setTelefono(c.telefono ?? "")
    setDireccion(c.direccion ?? "")
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

    const datos = { nombre: nombre.trim(), telefono: telefono.trim() || null, direccion: direccion.trim() || null }
    const resultado = editando ? await actualizarCliente(editando.id, datos) : await crearCliente(datos)
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al guardar")
      toast.error(resultado.message ?? "Error al guardar el cliente")
      return
    }

    toast.success(editando ? `Cliente "${datos.nombre}" actualizado` : `Cliente "${datos.nombre}" creado`)
    limpiarFormulario()
    cargarDatos()
  }

  async function onCambiarEstado(c: Cliente) {
    await cambiarEstadoCliente(c.id, !c.activo)
    toast.success(`Cliente "${c.nombre}" ${c.activo ? "desactivado" : "activado"}`)
    cargarDatos()
  }

  return (
    <div>
      <PageHeader titulo="Clientes" subtitulo="Clientes que hacen pedidos o compran en punto de venta">
        <StatChip icono={Users} label="Clientes" valor={clientes.length} />
        <StatChip icono={Power} label="Activos" valor={activos} />
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/pedidos">
            <ShoppingCart className="h-4 w-4" />
            Crear pedido
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <FormCard
          titulo={editando ? "Editar cliente" : "Nuevo cliente"}
          subtitulo={editando ? `Modificando "${editando.nombre}"` : "Registra un cliente"}
          icono={Users}
          className="h-fit lg:sticky lg:top-6"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nombre-cliente">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input id="nombre-cliente" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="telefono-cliente">Teléfono (opcional)</Label>
              <Input id="telefono-cliente" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="direccion-cliente">Dirección (opcional)</Label>
              <Input id="direccion-cliente" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button className="flex-1" size="lg" onClick={onGuardar} disabled={guardando}>
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear cliente"}
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
              Historial de clientes ({filtrados.length})
            </h2>
            <div className="flex items-center gap-2">
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o teléfono..." className="w-64" />
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
              icono={Users}
              titulo={busqueda ? "Sin resultados" : "Todavía no hay clientes"}
              descripcion={
                busqueda
                  ? "Ningún cliente coincide con la búsqueda."
                  : "Registra el primer cliente con el formulario de la izquierda."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((c) => (
                  <TableRow key={c.id} className={editando?.id === c.id ? "bg-primary/5" : undefined}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell>{c.telefono ?? "—"}</TableCell>
                    <TableCell>{c.direccion ?? "—"}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={c.activo ? "activo" : "inactivo"} label={c.activo ? "Activo" : "Inactivo"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="icon" onClick={() => iniciarEdicion(c)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onCambiarEstado(c)}
                          title={c.activo ? "Desactivar" : "Activar"}
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
