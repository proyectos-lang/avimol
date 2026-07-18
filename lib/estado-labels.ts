import type { TipoAveria } from "@/lib/recoleccion-actions"

// Etiquetas en español para los distintos campos `estado` del dominio de
// traslados/despachos — centralizadas acá porque varias vistas
// (ordenes-cargue-view, traslados-view, solicitud-traslado-detalle-view,
// pedido-detalle-view) las necesitan por igual.

export const ESTADO_ORDEN_CARGUE_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  cargado: "Cargando",
  en_transito: "En tránsito",
  // "recibido" solo lo alcanza la orden de cargue del traslado (bodega
  // origen) cuando la orden de descargue correspondiente se confirma en
  // destino — ver confirmarFinDescargue en lib/traslados-actions.ts.
  recibido: "Entregado",
  cerrado: "Cerrado",
  anulado: "Anulado",
}

export const ESTADO_SOLICITUD_TRASLADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_picking: "En picking",
  cargado_parcial: "Cargado parcial",
  cargado: "Cargado",
  recibido: "Recibido",
  anulado: "Anulado",
}

export const ESTADO_PEDIDO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  en_picking: "En picking",
  despachado: "Despachado parcial",
  cerrado: "Cerrado",
  anulado: "Anulado",
}

// Taxonomía de averías (picado / roto sin recuperar / roto con yema —
// este último es lo que habilita seleccionar la avería para procesar
// yemas, ver lib/averias-actions.ts::registrarProcesamientoYemas).
export const TIPO_AVERIA_LABEL: Record<TipoAveria, string> = {
  picado: "Picado",
  roto_sin_recuperar: "Roto sin recuperar",
  roto_con_yema: "Roto con yema",
}
