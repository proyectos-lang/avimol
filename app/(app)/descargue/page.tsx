import { OrdenesCargueView } from "@/components/traslados/ordenes-cargue-view"

export default function DescarguePage() {
  return <OrdenesCargueView tipoOperacion="descargue_traslado" titulo="Órdenes de descargue" hrefBase="/descargue" />
}
