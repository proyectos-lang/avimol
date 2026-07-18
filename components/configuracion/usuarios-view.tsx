"use client"

import { useEffect, useMemo, useState } from "react"
import { KeyRound, RefreshCw, ShieldCheck, UserCog, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { FormCard } from "@/components/ui/form-card"
import { StatChip } from "@/components/ui/stat-chip"
import { EstadoBadge } from "@/components/ui/estado-badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { groups } from "@/lib/dashboard-data"
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  actualizarModulosUsuario,
  restablecerPassword,
  type UsuarioAdmin,
} from "@/lib/usuarios-actions"

const ROLES_LABEL: { value: string; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "gerencia", label: "Gerencia" },
  { value: "recolector", label: "Recolector" },
  { value: "clasificador", label: "Clasificador" },
  { value: "bodega", label: "Bodega" },
  { value: "vendedor", label: "Vendedor" },
]
const ROL_LABEL: Record<string, string> = Object.fromEntries(ROLES_LABEL.map((r) => [r.value, r.label]))

// Solo los 5 grupos reales son asignables (el grupo "config" es solo del admin).
const GRUPOS_ASIGNABLES = groups.filter((g) => g.key !== "config")

// Selector de módulos agrupado, con "seleccionar todo el grupo" por cabecera.
function SelectorModulos({ value, onChange }: { value: Set<string>; onChange: (s: Set<string>) => void }) {
  function toggleModulo(href: string) {
    const next = new Set(value)
    next.has(href) ? next.delete(href) : next.add(href)
    onChange(next)
  }
  function toggleGrupo(hrefs: string[], todos: boolean) {
    const next = new Set(value)
    for (const h of hrefs) todos ? next.delete(h) : next.add(h)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {GRUPOS_ASIGNABLES.map((g) => {
        const hrefs = g.modules.map((m) => m.href)
        const todos = hrefs.every((h) => value.has(h))
        return (
          <div key={g.key} className="rounded-lg border border-border p-3">
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <Checkbox checked={todos} onCheckedChange={() => toggleGrupo(hrefs, todos)} />
              {g.title}
            </label>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
              {g.modules.map((m) => (
                <label key={m.href} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={value.has(m.href)} onCheckedChange={() => toggleModulo(m.href)} />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function UsuariosView({ usuarioActualId }: { usuarioActualId: number }) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [cargando, setCargando] = useState(true)

  // Formulario crear
  const [usuario, setUsuario] = useState("")
  const [nombre, setNombre] = useState("")
  const [password, setPassword] = useState("")
  const [rol, setRol] = useState("vendedor")
  const [modulosNuevo, setModulosNuevo] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Diálogos
  const [editPermisos, setEditPermisos] = useState<UsuarioAdmin | null>(null)
  const [modulosEdit, setModulosEdit] = useState<Set<string>>(new Set())
  const [pwUsuario, setPwUsuario] = useState<UsuarioAdmin | null>(null)
  const [nuevaPassword, setNuevaPassword] = useState("")
  const [procesando, setProcesando] = useState(false)

  async function cargarDatos() {
    setCargando(true)
    setUsuarios(await listarUsuarios())
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const activos = useMemo(() => usuarios.filter((u) => u.activo).length, [usuarios])

  async function onCrear() {
    setError(null)
    if (!usuario.trim() || !nombre.trim() || !password) {
      setError("Completa usuario, nombre y contraseña")
      return
    }
    setGuardando(true)
    const resultado = await crearUsuario({
      usuario: usuario.trim(),
      nombre: nombre.trim(),
      password,
      rol,
      modulos: Array.from(modulosNuevo),
    })
    setGuardando(false)
    if (!resultado.success) {
      setError(resultado.message ?? "Error al crear el usuario")
      toast.error(resultado.message ?? "Error al crear el usuario")
      return
    }
    toast.success(`Usuario ${usuario.trim()} creado`)
    setUsuario("")
    setNombre("")
    setPassword("")
    setRol("vendedor")
    setModulosNuevo(new Set())
    cargarDatos()
  }

  async function onToggleActivo(u: UsuarioAdmin) {
    const resultado = await actualizarUsuario(u.id, { nombre: u.nombre, rol: u.rol, activo: !u.activo })
    if (!resultado.success) {
      toast.error(resultado.message ?? "No se pudo actualizar")
      return
    }
    toast.success(u.activo ? "Usuario desactivado" : "Usuario activado")
    cargarDatos()
  }

  function abrirPermisos(u: UsuarioAdmin) {
    setEditPermisos(u)
    setModulosEdit(new Set(u.modulos))
  }

  async function onGuardarPermisos() {
    if (!editPermisos) return
    setProcesando(true)
    const resultado = await actualizarModulosUsuario(editPermisos.id, Array.from(modulosEdit))
    setProcesando(false)
    if (!resultado.success) {
      toast.error(resultado.message ?? "No se pudieron guardar los permisos")
      return
    }
    toast.success("Permisos actualizados")
    setEditPermisos(null)
    cargarDatos()
  }

  async function onRestablecer() {
    if (!pwUsuario) return
    if (!nuevaPassword) {
      toast.error("Escribe la nueva contraseña")
      return
    }
    setProcesando(true)
    const resultado = await restablecerPassword(pwUsuario.id, nuevaPassword)
    setProcesando(false)
    if (!resultado.success) {
      toast.error(resultado.message ?? "No se pudo restablecer")
      return
    }
    toast.success(`Contraseña de ${pwUsuario.usuario} restablecida`)
    setPwUsuario(null)
    setNuevaPassword("")
  }

  return (
    <div>
      <PageHeader titulo="Usuarios" subtitulo="Crea usuarios y define qué módulos puede ver cada uno">
        <StatChip icono={Users} label="Usuarios" valor={usuarios.length} />
        <StatChip icono={ShieldCheck} label="Activos" valor={activos} />
        <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <FormCard titulo="Crear usuario" subtitulo="El usuario nuevo no ve ningún módulo hasta que lo marques" icono={UserCog} className="h-fit">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>
                  Usuario <span className="text-destructive">*</span>
                </Label>
                <Input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="jperez" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan Pérez" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>
                  Contraseña <span className="text-destructive">*</span>
                </Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Rol</Label>
                <Select value={rol} onValueChange={setRol}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_LABEL.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Módulos que puede ver</Label>
              <SelectorModulos value={modulosNuevo} onChange={setModulosNuevo} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="lg" onClick={onCrear} disabled={guardando}>
              {guardando ? "Creando..." : "Crear usuario"}
            </Button>
          </div>
        </FormCard>

        <div className="h-fit rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Usuarios ({usuarios.length})
            </h2>
          </div>
          {cargando ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Módulos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => {
                    const esAdminFila = u.rol === "admin"
                    const esYo = u.id === usuarioActualId
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.usuario}</TableCell>
                        <TableCell>{u.nombre}</TableCell>
                        <TableCell>{ROL_LABEL[u.rol] ?? u.rol}</TableCell>
                        <TableCell>
                          <EstadoBadge estado={u.activo ? "activo" : "inactivo"} label={u.activo ? "Activo" : "Inactivo"} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{esAdminFila ? "Todos" : u.modulos.length}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              title="Permisos de módulos"
                              onClick={() => abrirPermisos(u)}
                              disabled={esAdminFila}
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              title="Restablecer contraseña"
                              onClick={() => {
                                setPwUsuario(u)
                                setNuevaPassword("")
                              }}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onToggleActivo(u)}
                              disabled={esYo}
                              title={esYo ? "No puedes cambiar tu propio estado" : undefined}
                            >
                              {u.activo ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Permisos */}
      <Dialog open={!!editPermisos} onOpenChange={(v) => !v && setEditPermisos(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Permisos de {editPermisos?.usuario}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <SelectorModulos value={modulosEdit} onChange={setModulosEdit} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPermisos(null)}>
              Cancelar
            </Button>
            <Button onClick={onGuardarPermisos} disabled={procesando}>
              {procesando ? "Guardando..." : "Guardar permisos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restablecer contraseña */}
      <Dialog open={!!pwUsuario} onOpenChange={(v) => !v && setPwUsuario(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña de {pwUsuario?.usuario}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} placeholder="••••••" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwUsuario(null)}>
              Cancelar
            </Button>
            <Button onClick={onRestablecer} disabled={procesando}>
              {procesando ? "Guardando..." : "Restablecer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
