"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { EstadoBadge } from "@/components/ui/estado-badge"
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import { listarGalpones, type Galpon } from "@/lib/galpones-actions"
import { listarAveriasProduccion, type AveriaProduccionFila } from "@/lib/averias-produccion-actions"

const ETAPAS = [
  { value: "recoleccion", label: "Recolección" },
  { value: "clasificacion", label: "Clasificación" },
]

const TIPO_LABEL: Record<string, string> = { picado: "Picado", roto: "Roto", partido: "Partido" }
const ESTADO_AVERIA_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
}

export function AveriasProduccionView() {
  const [galpones, setGalpones] = useState<Galpon[]>([])
  const [averias, setAverias] = useState<AveriaProduccionFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [galponId, setGalponId] = useState("todos")
  const [etapa, setEtapa] = useState("todas")

  async function cargarDatos() {
    setCargando(true)
    const [g, a] = await Promise.all([
      listarGalpones(),
      listarAveriasProduccion({
        galponId: galponId === "todos" ? null : Number(galponId),
        etapa: etapa === "todas" ? null : (etapa as "recoleccion" | "clasificacion"),
      }),
    ])
    setGalpones(g)
    setAverias(a)
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galponId, etapa])

  return (
    <div>
      <PageHeader
        titulo="Averías de producción"
        subtitulo="Picados, rotos y partidos de recolección y clasificación, por galpón — las de despacho/recepción se manejan en Bodegas y logística → Averías"
      >
        <StatChip icono={AlertTriangle} label="Averías" valor={averias.length} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={galponId} onValueChange={setGalponId}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los galpones</SelectItem>
            {galpones.map((g) => (
              <SelectItem key={g.id} value={g.id.toString()}>
                {g.codigo} — {g.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={etapa} onValueChange={setEtapa}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las etapas</SelectItem>
            {ETAPAS.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {cargando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : averias.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState icono={AlertTriangle} titulo="Sin averías registradas" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Galpón</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Observación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {averias.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{formatearFechaHoraColombia(a.fecha)}</TableCell>
                  <TableCell className="font-medium">{a.origenLabel}</TableCell>
                  <TableCell>{a.galponCodigo ? `${a.galponCodigo} — ${a.galponNombre}` : "—"}</TableCell>
                  <TableCell>{a.loteHuevoCodigo}</TableCell>
                  <TableCell>{a.referenciaNombre ?? "—"}</TableCell>
                  <TableCell>{TIPO_LABEL[a.tipoAveria] ?? a.tipoAveria}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {a.cantidad.toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell>
                    <EstadoBadge estado={a.estado} label={ESTADO_AVERIA_LABEL[a.estado] ?? a.estado} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.observaciones ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
