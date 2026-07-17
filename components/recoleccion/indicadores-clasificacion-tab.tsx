"use client"

import { useEffect, useState } from "react"
import { Layers, TriangleAlert } from "lucide-react"
import { StatChip } from "@/components/ui/stat-chip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  obtenerIndicadoresClasificacion,
  type FiltrosIndicadores,
  type IndicadoresClasificacion,
} from "@/lib/indicadores-recoleccion-actions"

export function IndicadoresClasificacionTab({ filtros }: { filtros: FiltrosIndicadores }) {
  const [datos, setDatos] = useState<IndicadoresClasificacion | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    obtenerIndicadoresClasificacion(filtros).then((d) => {
      setDatos(d)
      setCargando(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.fechaInicio, filtros.fechaFin, filtros.galponId, filtros.bodegaId])

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <StatChip icono={Layers} label="Total clasificado" valor={(datos?.totalClasificado ?? 0).toLocaleString("es-CO")} />
        <StatChip
          icono={TriangleAlert}
          label="Total averías"
          valor={`${(datos?.totalAverias ?? 0).toLocaleString("es-CO")} (${datos?.porcentajeAveriasTotal ?? 0}%)`}
        />
        <StatChip icono={Layers} label="Buenos" valor={(datos?.totalBuenos ?? 0).toLocaleString("es-CO")} />
      </div>

      <p className="mb-2 text-sm font-semibold">Cantidad clasificada por galpón y tipo de huevo</p>
      <div className="mb-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Galpón</TableHead>
              <TableHead>Tipo de huevo</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(datos?.porGalponYTipo ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Sin datos.
                </TableCell>
              </TableRow>
            ) : (
              (datos?.porGalponYTipo ?? []).map((f) => (
                <TableRow key={`${f.galponId}-${f.referenciaId}`}>
                  <TableCell>
                    {f.galponCodigo} — {f.galponNombre}
                  </TableCell>
                  <TableCell>{f.referenciaNombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.cantidad.toLocaleString("es-CO")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mb-2 text-sm font-semibold">
        Buenos, picados, rotos y partidos por galpón y color <span className="font-normal text-muted-foreground">(la avería de clasificación no distingue talla)</span>
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Galpón</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Buenos</TableHead>
              <TableHead className="text-right">Picados</TableHead>
              <TableHead className="text-right">Rotos</TableHead>
              <TableHead className="text-right">Partidos</TableHead>
              <TableHead className="text-right">Total averías</TableHead>
              <TableHead className="text-right">% averías</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(datos?.averiasPorGalponYColor ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Sin datos.
                </TableCell>
              </TableRow>
            ) : (
              (datos?.averiasPorGalponYColor ?? []).map((a) => (
                <TableRow key={`${a.galponId}-${a.colorId}`}>
                  <TableCell>
                    {a.galponCodigo} — {a.galponNombre}
                  </TableCell>
                  <TableCell>{a.colorNombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.buenos.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.picado.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.roto.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.partido.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{a.totalAverias.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.porcentajeAverias}%</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
