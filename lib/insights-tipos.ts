// Tipos compartidos para la banda de insights. Se mantienen en un módulo
// plano (sin imports de React ni lucide) para que los pueda usar tanto la
// server action (lib/insights-actions.ts) como los componentes cliente.
// Los íconos viajan como CLAVE (string), porque un componente de lucide no
// es serializable a través del límite server→client; el cliente resuelve
// la clave a un componente con components/insights-iconos.ts.

export type IconoKey =
  | "bird"
  | "egg"
  | "warehouse"
  | "gauge"
  | "edad"
  | "cartones"
  | "alerta"
  | "ok"
  | "recepcion"
  | "vehiculo"
  | "dinero"
  | "pedido"
  | "cliente"
  | "chart"
  | "gota"
  | "tienda"
  | "camion"
  | "sinClasificar"

export type TonoAlerta = "info" | "advertencia" | "critico" | "ok"

export interface InsightKpi {
  iconoKey: IconoKey
  label: string
  valor: string
}

export interface InsightAlerta {
  iconoKey: IconoKey
  texto: string
  tono: TonoAlerta
  href?: string
}

export interface InsightsModulo {
  kpis: InsightKpi[]
  alertas: InsightAlerta[]
}
