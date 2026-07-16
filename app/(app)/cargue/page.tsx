import { OrdenesCargueView } from "@/components/traslados/ordenes-cargue-view"

export default function CarguePage() {
  return <OrdenesCargueView tipoOperacion="cargue_traslado" titulo="Órdenes de cargue" hrefBase="/cargue" />
}
