import { SolicitudTrasladoDetalleView } from "@/components/traslados/solicitud-traslado-detalle-view"

export default async function TrasladoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SolicitudTrasladoDetalleView solicitudId={Number(id)} />
}
