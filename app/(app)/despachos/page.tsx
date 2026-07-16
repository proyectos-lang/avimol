import { OrdenesCargueView } from "@/components/traslados/ordenes-cargue-view"

export default function DespachosPage() {
  return <OrdenesCargueView tipoOperacion="cargue_despacho" titulo="Órdenes de despacho" hrefBase="/despachos" />
}
