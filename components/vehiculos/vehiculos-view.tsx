"use client"

import { useEffect, useMemo, useState } from "react"
import { Car, CheckCircle2, RefreshCw } from "lucide-react"
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
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import { listarLlegadasVehiculo, registrarLlegadaVehiculo, type LlegadaVehiculo } from "@/lib/vehiculos-actions"

export function VehiculosView() {
  const [llegadas, setLlegadas] = useState<LlegadaVehiculo[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  const [placa, setPlaca] = useState("")
  const [conductor, setConductor] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDatos() {
    setCargando(true)
    setLlegadas(await listarLlegadasVehiculo())
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return llegadas
    return llegadas.filter((l) => `${l.placa} ${l.conductor}`.toLowerCase().includes(q))
  }, [llegadas, busqueda])

  const disponibles = llegadas.filter((l) => !l.orden_cargue_id).length

  async function onRegistrar() {
    if (!placa.trim() || !conductor.trim()) {
      setError("Registra placa y conductor")
      return
    }
    setGuardando(true)
    setError(null)
    const resultado = await registrarLlegadaVehiculo(placa.trim(), conductor.trim())
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al registrar la llegada")
      toast.error(resultado.message ?? "Error al registrar la llegada")
      return
    }

    toast.success(`Llegada de ${placa.trim().toUpperCase()} registrada`)
    setPlaca("")
    setConductor("")
    cargarDatos()
  }

  return (
    <div>
      <PageHeader
        titulo="Gestión de vehículos"
        subtitulo="Cada llegada es una línea — se selecciona desde cargue, descargue o despacho y deja de estar disponible una vez usada"
      >
        <StatChip icono={Car} label="Llegadas" valor={llegadas.length} />
        <StatChip icono={CheckCircle2} label="Disponibles" valor={disponibles} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <FormCard
          titulo="Registrar llegada"
          subtitulo="Placa y conductor del vehículo que acaba de llegar"
          icono={Car}
          className="h-fit lg:sticky lg:top-6"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="placa">
                Placa <span className="text-destructive">*</span>
              </Label>
              <Input id="placa" value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC123" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="conductor">
                Conductor <span className="text-destructive">*</span>
              </Label>
              <Input id="conductor" value={conductor} onChange={(e) => setConductor(e.target.value)} />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button size="lg" onClick={onRegistrar} disabled={guardando}>
              {guardando ? "Guardando..." : "Registrar llegada"}
            </Button>
          </div>
        </FormCard>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Historial de llegadas ({filtradas.length})
            </h2>
            <div className="flex items-center gap-2">
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por placa o conductor..." className="w-64" />
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
              icono={Car}
              titulo={busqueda ? "Sin resultados" : "Todavía no hay llegadas registradas"}
              descripcion={
                busqueda
                  ? "Ninguna llegada coincide con la búsqueda."
                  : "Registra la primera llegada con el formulario de la izquierda."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Hora de llegada</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.placa}</TableCell>
                    <TableCell>{l.conductor}</TableCell>
                    <TableCell>{formatearFechaHoraColombia(l.hora_llegada)}</TableCell>
                    <TableCell>
                      {l.orden_cargue_id ? (
                        <EstadoBadge estado="en_uso" label={`En uso — ${l.orden_cargue_codigo ?? "orden"}`} />
                      ) : (
                        <EstadoBadge estado="disponible" label="Disponible" />
                      )}
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
