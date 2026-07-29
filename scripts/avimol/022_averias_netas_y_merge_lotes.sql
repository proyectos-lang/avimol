-- Ronda 19
-- 1) Averías netas hacia la clasificadora: al registrar la recolección se
--    descuentan las averías del inventario sin clasificar mediante un
--    movimiento negativo de tipo 'salida_averia'. Hay que permitir ese nuevo
--    tipo en el CHECK de movimientos_huevo_sin_clasificar.
-- 2) Fusión de "Lotes de huevo" dentro de "Historial diario": el módulo
--    /lotes-huevo deja de existir; limpiamos sus permisos huérfanos.
--
-- Idempotente: se puede correr más de una vez sin error.

-- 1) Nuevo tipo de movimiento 'salida_averia'
ALTER TABLE avimol.movimientos_huevo_sin_clasificar
  DROP CONSTRAINT IF EXISTS movimientos_huevo_sin_clasificar_tipo_movimiento_check;

ALTER TABLE avimol.movimientos_huevo_sin_clasificar
  ADD CONSTRAINT movimientos_huevo_sin_clasificar_tipo_movimiento_check
  CHECK (tipo_movimiento IN ('entrada_cosecha', 'salida_clasificacion', 'salida_averia', 'ajuste'));

-- 2) Limpieza de permisos del módulo eliminado /lotes-huevo
DELETE FROM avimol.usuario_modulos WHERE modulo_href = '/lotes-huevo';
