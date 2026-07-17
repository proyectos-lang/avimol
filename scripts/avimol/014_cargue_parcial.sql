-- Amplía los estados de solicitudes_traslado para soportar cargue
-- parcial (picking en curso, cerrada parcial pero reutilizable).
-- pedidos.estado ya trae 'en_picking'/'despachado' reservados desde la
-- Fase 1, así que no necesita ALTER.
DO $$
DECLARE
  nombre_constraint text;
BEGIN
  SELECT con.conname INTO nombre_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'avimol'
    AND rel.relname = 'solicitudes_traslado'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%estado%';

  IF nombre_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE avimol.solicitudes_traslado DROP CONSTRAINT %I', nombre_constraint);
  END IF;
END $$;

ALTER TABLE avimol.solicitudes_traslado ADD CONSTRAINT solicitudes_traslado_estado_check
  CHECK (estado IN ('pendiente','en_picking','cargado_parcial','cargado','recibido','anulado'));
