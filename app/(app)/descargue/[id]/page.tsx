import { DescargueDetalleView } from "@/components/traslados/descargue-detalle-view"

export default async function DescargueDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DescargueDetalleView ordenId={Number(id)} />
}
