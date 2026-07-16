import { CargueDetalleView } from "@/components/traslados/cargue-detalle-view"

export default async function DespachoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CargueDetalleView ordenId={Number(id)} />
}
