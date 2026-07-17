"use client"

import { useEffect, useState } from "react"
import { Boxes } from "lucide-react"
import { StatChip } from "@/components/ui/stat-chip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  obtenerIndicadorCartones,
  type FiltrosIndicadores,
  type IndicadorCartones,
} from "@/lib/indicadores-recoleccion-actions"

const MOTIVO_LABEL: Record<string, string> = {
  refuerzo_buenos: "Refuerzo de cartones buenos",
  rotos: "Rotos",
  averiados: "Averiados",
}

export function IndicadoresCartonesTab({ filtros }: { filtros: FiltrosIndicadores }) {
  const [datos, setDatos] = useState<IndicadorCartones | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    obtenerIndicadorCartones(filtros).then((d) => {
      setDatos(d)
      setCargando(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.fechaInicio, filtros.fechaFin, filtros.galponId, filtros.bodegaId])

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <StatChip icono={Boxes} label="Consumo normal" valor={(datos?.consumoNormal ?? 0).toLocaleString("es-CO")} />
        <StatChip icono={Boxes} label="Consumo extra" valor={(datos?.totalExtra ?? 0).toLocaleString("es-CO")} />
        <StatChip icono={Boxes} label="Total" valor={(datos?.totalGeneral ?? 0).toLocaleString("es-CO")} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold">Consumo extra por motivo</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(datos?.consumoExtraPorMotivo ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      Sin datos.
                    </TableCell>
                  </TableRow>
                ) : (
                  (datos?.consumoExtraPorMotivo ?? []).map((m) => (
                    <TableRow key={m.motivo}>
                      <TableCell>{MOTIVO_LABEL[m.motivo] ?? m.motivo}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.cantidad.toLocaleString("es-CO")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Consumo por galpón</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Galpón</TableHead>
                  <TableHead className="text-right">Normal</TableHead>
                  <TableHead className="text-right">Extra</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(datos?.porGalpon ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Sin datos.
                    </TableCell>
                  </TableRow>
                ) : (
                  (datos?.porGalpon ?? []).map((g) => (
                    <TableRow key={g.galponId}>
                      <TableCell>
                        {g.galponCodigo} — {g.galponNombre}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{g.normal.toLocaleString("es-CO")}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.extra.toLocaleString("es-CO")}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{g.total.toLocaleString("es-CO")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
