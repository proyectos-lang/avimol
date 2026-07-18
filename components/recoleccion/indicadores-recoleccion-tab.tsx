"use client"

import { useEffect, useState } from "react"
import { Egg, TriangleAlert } from "lucide-react"
import { StatChip } from "@/components/ui/stat-chip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProduccionPorGalponChart } from "@/components/indicadores/charts"
import {
  obtenerIndicadoresRecoleccion,
  type FiltrosIndicadores,
  type IndicadoresRecoleccion,
} from "@/lib/indicadores-recoleccion-actions"

export function IndicadoresRecoleccionTab({ filtros }: { filtros: FiltrosIndicadores }) {
  const [datos, setDatos] = useState<IndicadoresRecoleccion | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    obtenerIndicadoresRecoleccion(filtros).then((d) => {
      setDatos(d)
      setCargando(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.fechaInicio, filtros.fechaFin, filtros.galponId, filtros.bodegaId])

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <StatChip icono={Egg} label="Total recolectado" valor={(datos?.totalRecolectado ?? 0).toLocaleString("es-CO")} />
        <StatChip
          icono={TriangleAlert}
          label="Total averías"
          valor={`${(datos?.totalAverias ?? 0).toLocaleString("es-CO")} (${datos?.porcentajeAveriasTotal ?? 0}%)`}
        />
        <StatChip icono={Egg} label="Buenos" valor={(datos?.totalBuenos ?? 0).toLocaleString("es-CO")} />
      </div>

      <p className="mb-2 text-sm font-semibold">Cantidad recolectada por galpón</p>
      <div className="mb-6">
        <ProduccionPorGalponChart datos={(datos?.porGalpon ?? []).map((g) => ({ galponCodigo: g.galponCodigo, cantidadTotal: g.cantidad }))} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold">Cantidad recolectada por color</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(datos?.porColor ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      Sin datos.
                    </TableCell>
                  </TableRow>
                ) : (
                  (datos?.porColor ?? []).map((c) => (
                    <TableRow key={c.colorId}>
                      <TableCell>{c.colorNombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.cantidad.toLocaleString("es-CO")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Totales por galpón</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Galpón</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(datos?.porGalpon ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      Sin datos.
                    </TableCell>
                  </TableRow>
                ) : (
                  (datos?.porGalpon ?? []).map((g) => (
                    <TableRow key={g.galponId}>
                      <TableCell>
                        {g.galponCodigo} — {g.galponNombre}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{g.cantidad.toLocaleString("es-CO")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <p className="mb-2 text-sm font-semibold">
        Buenos, picados, rotos sin recuperar y rotos con yema por galpón <span className="font-normal text-muted-foreground">(la avería de recolección no distingue color)</span>
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Galpón</TableHead>
              <TableHead className="text-right">Buenos</TableHead>
              <TableHead className="text-right">Picados</TableHead>
              <TableHead className="text-right">Rotos sin recuperar</TableHead>
              <TableHead className="text-right">Rotos con yema</TableHead>
              <TableHead className="text-right">Total averías</TableHead>
              <TableHead className="text-right">% averías</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(datos?.averiasPorGalpon ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin datos.
                </TableCell>
              </TableRow>
            ) : (
              (datos?.averiasPorGalpon ?? []).map((a) => (
                <TableRow key={a.galponId}>
                  <TableCell>
                    {a.galponCodigo} — {a.galponNombre}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{a.buenos.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.picado.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.rotoSinRecuperar.toLocaleString("es-CO")}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.rotoConYema.toLocaleString("es-CO")}</TableCell>
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
