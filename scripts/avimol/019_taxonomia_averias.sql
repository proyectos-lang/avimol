-- Nueva taxonomía de averías: picado / roto_sin_recuperar / roto_con_yema
-- (reemplaza picado/roto/partido). Las averías históricas 'roto' y
-- 'partido' se migran a 'roto_sin_recuperar' — no hay forma de saber
-- retroactivamente si la yema se aprovechó, así que se toma la opción
-- conservadora (no atribuirle yema a algo que nunca se procesó como tal).

-- Primero se quita el constraint viejo (que solo permite picado/roto/
-- partido) — si no, el UPDATE de abajo no puede escribir 'roto_sin_recuperar'
-- porque todavía no es un valor permitido.
DO $$
DECLARE
  nombre_constraint text;
BEGIN
  SELECT con.conname INTO nombre_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'avimol'
    AND rel.relname = 'averias_huevo'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%tipo_averia%';

  IF nombre_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE avimol.averias_huevo DROP CONSTRAINT %I', nombre_constraint);
  END IF;
END $$;

UPDATE avimol.averias_huevo SET tipo_averia = 'roto_sin_recuperar' WHERE tipo_averia IN ('roto', 'partido');

ALTER TABLE avimol.averias_huevo ADD CONSTRAINT averias_huevo_tipo_averia_check
  CHECK (tipo_averia IN ('picado', 'roto_sin_recuperar', 'roto_con_yema'));
