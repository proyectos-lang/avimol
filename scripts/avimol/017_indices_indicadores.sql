-- Índices para las nuevas consultas de indicadores por módulo (Recolección/Clasificación/Cartones).
-- Estas columnas son FK sin índice hoy; las nuevas agregaciones las van a filtrar seguido.

CREATE INDEX IF NOT EXISTS idx_mov_sin_clasificar_lote
  ON avimol.movimientos_huevo_sin_clasificar(lote_huevo_id);

CREATE INDEX IF NOT EXISTS idx_clasificaciones_lote
  ON avimol.clasificaciones(lote_huevo_id);

CREATE INDEX IF NOT EXISTS idx_clasificaciones_detalle_clasif
  ON avimol.clasificaciones_detalle(clasificacion_id);

CREATE INDEX IF NOT EXISTS idx_averias_clasificacion
  ON avimol.averias_huevo(clasificacion_id);

CREATE INDEX IF NOT EXISTS idx_cartones_extra_clasificacion
  ON avimol.clasificaciones_cartones_extra(clasificacion_id);
