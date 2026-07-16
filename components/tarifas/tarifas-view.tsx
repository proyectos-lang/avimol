"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DollarSign, PackagePlus, Power, RefreshCw } from "lucide-react"
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
import { EstadoBadge } from "@/components/ui/estado-badge"
import { formatearFechaColombia } from "@/lib/date-utils"
import {
  listarTarifasDescargue,
  crearTarifaDescargue,
  cambiarEstadoTarifa,
  type TarifaDescargue,
} from "@/lib/tarifas-actions"

export function TarifasView() {
  const [tarifas, setTarifas] = useState<TarifaDescargue[]>([])
  const [cargando, setCargando] = useState(true)

  const [valor, setValor] = useState("")
  const [tipoValor, setTipoValor] = useState<"fijo" | "por_kg">("fijo")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargarDatos() {
    setCargando(true)
    setTarifas(await listarTarifasDescargue())
    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const activas = tarifas.filter((t) => t.activo)
  const vigente = activas[0] ?? null

  async function onGuardar() {
    const num = Number(valor)
    if (!num || num <= 0) {
      setError("Ingresa un valor válido")
      return
    }
    setGuardando(true)
    setError(null)

    const resultado = await crearTarifaDescargue(num, tipoValor)
    setGuardando(false)

    if (!resultado.success) {
      setError(resultado.message ?? "Error al guardar")
      toast.error(resultado.message ?? "Error al crear la tarifa")
      return
    }

    toast.success(`Tarifa de $${num.toLocaleString("es-CO")}${tipoValor === "por_kg" ? "/kg" : ""} creada`)
    setValor("")
    cargarDatos()
  }

  async function onCambiarEstado(t: TarifaDescargue) {
    await cambiarEstadoTarifa(t.id, !t.activo)
    toast.success(`Tarifa ${t.activo ? "desactivada" : "activada"}`)
    cargarDatos()
  }

  return (
    <div>
      <PageHeader
        titulo="Tarifas de descargue"
        subtitulo="Avimol cobra el servicio de descargue (genera nómina interna); el cargue no se cobra"
      >
        <StatChip icono={DollarSign} label="Tarifas activas" valor={activas.length} />
        {vigente && (
          <StatChip
            icono={DollarSign}
            label="Vigente"
            valor={`$${vigente.valor.toLocaleString("es-CO")}${vigente.tipo_valor === "por_kg" ? "/kg" : ""}`}
          />
        )}
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/descargue">
            <PackagePlus className="h-4 w-4" />
            Ir a descargues
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <FormCard
          titulo="Nueva tarifa"
          subtitulo="La tarifa vigente se aplica automáticamente al cerrar cada descargue"
          icono={DollarSign}
          className="h-fit lg:sticky lg:top-6"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Select value={tipoValor} onValueChange={(v) => setTipoValor(v as "fijo" | "por_kg")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fijo">Fijo por orden</SelectItem>
                  <SelectItem value="por_kg">Por kilogramo cargado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>
                Valor ($) <span className="text-destructive">*</span>
              </Label>
              <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="50000" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button size="lg" onClick={onGuardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Crear tarifa"}
            </Button>
          </div>
        </FormCard>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Historial de tarifas ({tarifas.length})
            </h2>
            <Button variant="outline" size="icon" onClick={cargarDatos} title="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {cargando ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : tarifas.length === 0 ? (
            <EmptyState
              icono={DollarSign}
              titulo="Todavía no hay tarifas"
              descripcion="Crea la primera tarifa con el formulario de la izquierda."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Valor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vigente desde</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tarifas.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium tabular-nums">
                      ${t.valor.toLocaleString("es-CO")}
                      {t.tipo_valor === "por_kg" ? " / kg" : ""}
                    </TableCell>
                    <TableCell>{t.tipo_valor === "fijo" ? "Fijo por orden" : "Por kilogramo"}</TableCell>
                    <TableCell>{formatearFechaColombia(t.vigente_desde)}</TableCell>
                    <TableCell>
                      <EstadoBadge estado={t.activo ? "activa" : "inactiva"} label={t.activo ? "Activa" : "Inactiva"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onCambiarEstado(t)}
                        title={t.activo ? "Desactivar" : "Activar"}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
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
