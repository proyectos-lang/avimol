-- Consumo de cartones en bodega venta (cantidad manual por venta) y
-- traslados de cartones entre bodegas (dentro de la misma orden de
-- cargue que el huevo, sin lote/anaquel — un cartón no se lotea).

DO $$
DECLARE
  nombre_constraint text;
BEGIN
  SELECT con.conname INTO nombre_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'avimol'
    AND rel.relname = 'movimientos_cartones'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%tipo_movimiento%';

  IF nombre_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE avimol.movimientos_cartones DROP CONSTRAINT %I', nombre_constraint);
  END IF;
END $$;

ALTER TABLE avimol.movimientos_cartones ADD CONSTRAINT movimientos_cartones_tipo_movimiento_check
  CHECK (tipo_movimiento IN ('entrada_manual','salida_clasificacion','ajuste','salida_venta','salida_traslado','entrada_traslado'));

ALTER TABLE avimol.movimientos_cartones
  ADD COLUMN IF NOT EXISTS venta_directa_id bigint REFERENCES avimol.ventas_directas(id),
  ADD COLUMN IF NOT EXISTS orden_cargue_id  bigint REFERENCES avimol.ordenes_cargue(id);

-- Cartones dentro de un traslado: una sola cantidad suelta por orden (no
-- una tabla de detalle aparte, a diferencia del huevo que sí tiene
-- lote/referencia/anaquel).
ALTER TABLE avimol.solicitudes_traslado ADD COLUMN IF NOT EXISTS cartones_solicitados integer;

ALTER TABLE avimol.ordenes_cargue
  ADD COLUMN IF NOT EXISTS cartones_cargados  integer,
  ADD COLUMN IF NOT EXISTS cartones_recibidos integer;
