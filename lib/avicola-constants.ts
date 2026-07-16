// A partir de esta edad conviene rebandejar (pasar a bandejas nuevas)
// el huevo por el deterioro natural de la cáscara en gallinas mayores.
export const EDAD_REBANDEJAR_SEMANAS = 60

export function necesitaRebandejar(edadSemanas: number): boolean {
  return edadSemanas > EDAD_REBANDEJAR_SEMANAS
}
