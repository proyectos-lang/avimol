"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertaRebandejar } from "@/components/ui/alerta-rebandejar"
import { formatearFechaHoraColombia } from "@/lib/date-utils"
import {
  obtenerOrdenConDetalle,
  iniciarDescargue,
  confirmarFinDescargue,
  type OrdenCargueCompleta,
} from "@/lib/traslados-actions"

export function DescargueDetalleView({ ordenId }: { ordenId: number }) {
  const router = useRouter()
  const [orden, setOrden] = useState<OrdenCargueCompleta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cantidadesRecibidas, setCantidadesRecibidas] = useState<Record<number, string>>({})

  async function cargar() {
    setCargando(true)
    const o = await obtenerOrdenConDetalle(ordenId)
    setOrden(o)
    if (o) {
      const iniciales: Record<number, string> = {}
      for (const linea of o.detalle) {
        iniciales[linea.id] = (linea.cantidad_recibida ?? linea.cantidad_cargada).toString()
      }
      setCantidadesRecibidas(iniciales)
    }
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [ordenId])

  if (cargando) return <p className="text-muted-foreground">Cargando...</p>
  if (!orden) return <p className="text-destructive">Orden no encontrada</p>

  const puedeIniciar = !orden.hora_inicio_descargue
  const puedeConfirmar = !!orden.hora_inicio_descargue && !orden.hora_fin_descargue
  const yaFinalizado = !!orden.hora_fin_descargue

  async function onIniciar() {
    setProcesando(true)
    await iniciarDescargue(ordenId)
    setProcesando(false)
    cargar()
  }

  async function onConfirmar() {
    setError(null)
    setProcesando(true)

    const lineas = orden!.detalle.map((d) => ({
      detalleId: d.id,
      cantidadRecibida: Number(cantidadesRecibidas[d.id] ?? 0),
    }))

    const resultado = await confirmarFinDescargue(ordenId, lineas)
    setProcesando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al confirmar la recepción")
      return
    }

    router.push("/descargue")
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Orden de descargue {orden.codigo}</h1>
      <p className="mb-4 text-sm text-muted-foreground">Bodega destino: {orden.bodega_nombre}</p>

      {orden.peso_total_kg && (
        <p className="mb-4 text-sm text-muted-foreground">
          Peso cargado en origen: <strong>{orden.peso_total_kg.toFixed(2)} kg</strong>
        </p>
      )}

      {puedeIniciar && (
        <Button size="lg" className="mb-4 w-full" onClick={onIniciar} disabled={procesando}>
          Iniciar descargue
        </Button>
      )}

      {orden.hora_inicio_descargue && (
        <p className="mb-4 text-sm text-muted-foreground">
          Descargue iniciado: {formatearFechaHoraColombia(orden.hora_inicio_descargue)}
          {orden.hora_fin_descargue && <> · Finalizado: {formatearFechaHoraColombia(orden.hora_fin_descargue)}</>}
        </p>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Recepción (prellenada con lo cargado en origen)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Edad</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Cargado</TableHead>
                  <TableHead>Recibido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orden.detalle.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.lote_huevo_codigo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {d.edad_semanas_captura} sem
                        <AlertaRebandejar edadSemanas={d.edad_semanas_captura} />
                      </div>
                    </TableCell>
                    <TableCell>{d.referencia_nombre}</TableCell>
                    <TableCell>{d.cantidad_cargada.toLocaleString("es-CO")}</TableCell>
                    <TableCell>
                      {puedeConfirmar ? (
                        <Input
                          type="number"
                          className="w-24"
                          value={cantidadesRecibidas[d.id] ?? ""}
                          onChange={(e) => setCantidadesRecibidas((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        />
                      ) : (
                        (d.cantidad_recibida ?? "—").toString()
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {puedeConfirmar && (
        <Button size="lg" className="h-14 w-full text-base" onClick={onConfirmar} disabled={procesando}>
          Finalizar descargue
        </Button>
      )}

      {yaFinalizado && (
        <p className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm">
          Descargue finalizado. Clasifica la avería en Recepciones → Clasificar para acreditar el inventario.
          {orden.valor_tarifa_aplicado != null && (
            <> Tarifa de descargue aplicada: ${orden.valor_tarifa_aplicado.toLocaleString("es-CO")}.</>
          )}
        </p>
      )}
    </div>
  )
}
