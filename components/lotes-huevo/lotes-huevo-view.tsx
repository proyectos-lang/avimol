"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ClipboardList, Egg, Eye, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { StatChip } from "@/components/ui/stat-chip"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { formatearFechaColombia } from "@/lib/date-utils"
import {
  listarLotesHuevo,
  obtenerDetalleLoteHuevo,
  type LoteHuevo,
  type DetalleLoteHuevo,
  type AveriaLoteHuevo,
} from "@/lib/lotes-huevo-actions"

export function LotesHuevoView() {
  const [lotes, setLotes] = useState<LoteHuevo[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [loteAbierto, setLoteAbierto] = useState<LoteHuevo | null>(null)
  const [detalle, setDetalle] = useState<DetalleLoteHuevo[]>([])
  const [averias, setAverias] = useState<AveriaLoteHuevo[]>([])

  async function cargarDatos() {
    setCargando(true)
    setLotes(await listarLotesHuevo())
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return lotes
    return lotes.filter((l) =>
      `${l.codigo} ${l.galpon_codigo} ${l.galpon_nombre} ${l.bodega_nombre}`.toLowerCase().includes(q),
    )
  }, [lotes, busqueda])

  async function abrirDetalle(lote: LoteHuevo) {
    setLoteAbierto(lote)
    const { detalle, averias } = await obtenerDetalleLoteHuevo(lote.id)
    setDetalle(detalle)
    setAverias(averias)
  }

  return (
    <div>
      <PageHeader titulo="Lotes de huevo" subtitulo="Trazabilidad completa: galpón, lote de aves, edad, clasificación y averías">
        <StatChip icono={ClipboardList} label="Lotes" valor={lotes.length} />
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por lote, galpón o bodega..." className="w-64" />
        <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/recoleccion">
            <Egg className="h-4 w-4" />
            Registrar recolección
          </Link>
        </Button>
      </PageHeader>

      {cargando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icono={Egg}
            titulo={busqueda ? "Sin resultados" : "Todavía no hay lotes de huevo"}
            descripcion={
              busqueda
                ? "Ningún lote coincide con la búsqueda."
                : "Los lotes se generan automáticamente al registrar una recolección."
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Fecha recolección</TableHead>
                <TableHead>Galpón</TableHead>
                <TableHead>Edad al recolectar</TableHead>
                <TableHead>Bodega</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.codigo}</TableCell>
                  <TableCell>{formatearFechaColombia(l.fecha_cosecha)}</TableCell>
                  <TableCell>
                    {l.galpon_codigo} — {l.galpon_nombre}
                  </TableCell>
                  <TableCell>{l.edad_semanas_captura} semanas</TableCell>
                  <TableCell>{l.bodega_nombre}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {l.origen === "app_movil" ? "Campo" : "Clasificadora"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => abrirDetalle(l)} title="Ver detalle">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!loteAbierto} onOpenChange={(abierto) => !abierto && setLoteAbierto(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lote {loteAbierto?.codigo}</DialogTitle>
          </DialogHeader>
          {loteAbierto && (
            <div className="flex flex-col gap-4 text-sm">
              <div className="rounded-md border border-border p-3 text-muted-foreground">
                Galpón {loteAbierto.galpon_codigo} — {loteAbierto.galpon_nombre} · Lote de aves{" "}
                {loteAbierto.lote_aves_codigo} · Edad al recolectar:{" "}
                <span className="font-semibold text-foreground">{loteAbierto.edad_semanas_captura} semanas</span>
              </div>

              <div>
                <p className="mb-2 font-semibold">Clasificación</p>
                <div className="flex flex-col gap-1">
                  {detalle.map((d, i) => (
                    <div key={i} className="flex justify-between rounded-md border border-border px-3 py-2">
                      <span>
                        {d.referencia_nombre}
                        {d.anaquel_codigo && ` · Estantería ${d.anaquel_codigo}`}
                      </span>
                      <span className="font-semibold">{d.cantidad.toLocaleString("es-CO")}</span>
                    </div>
                  ))}
                </div>
              </div>

              {averias.length > 0 && (
                <div>
                  <p className="mb-2 font-semibold">Averías</p>
                  <div className="flex flex-col gap-1">
                    {averias.map((a, i) => (
                      <div key={i} className="flex justify-between rounded-md border border-border px-3 py-2">
                        <span className="capitalize">
                          {a.tipo_averia}
                          {a.referencia_nombre && ` · ${a.referencia_nombre}`}
                          <span className="text-muted-foreground"> ({a.etapa})</span>
                        </span>
                        <span className="font-semibold">{a.cantidad.toLocaleString("es-CO")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
