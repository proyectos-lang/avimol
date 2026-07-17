import { PedidoDetalleView } from "@/components/pedidos/pedido-detalle-view"

export default async function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PedidoDetalleView pedidoId={Number(id)} />
}
