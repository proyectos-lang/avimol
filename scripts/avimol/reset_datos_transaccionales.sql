-- =====================================================================
-- RESET DE DATOS TRANSACCIONALES — usar solo para volver a probar desde
-- cero. Esto BORRA PERMANENTEMENTE todo el historial operativo
-- (recolecciones, clasificaciones, inventario, traslados, cargue/
-- descargue/despachos, pedidos, ventas, vehículos, lotes de aves).
--
-- Se CONSERVA la configuración base de la empresa:
--   usuarios, galpones, bodegas, anaqueles, tipos_huevo, colores_huevo,
--   referencias_huevo (con sus imágenes/pesos de Catálogo), clientes,
--   tarifas_servicio_descargue.
--
-- Después de correr esto no habrá lotes de aves activos: hay que crear
-- al menos uno desde Galpones/Aves antes de poder registrar una
-- recolección nueva.
--
-- RESTART IDENTITY reinicia los contadores autoincrementales (los ids
-- vuelven a empezar en 1). CASCADE es una red de seguridad por si algún
-- FK no listado aquí depende de estas tablas — no debería tocar nada
-- de la lista de "se conserva" porque ninguna de esas tablas depende de
-- las transaccionales.
-- =====================================================================

TRUNCATE TABLE
  avimol.movimientos_aves,
  avimol.lotes_aves,
  avimol.averias_huevo,
  avimol.clasificaciones_detalle,
  avimol.clasificaciones,
  avimol.movimientos_huevo_sin_clasificar,
  avimol.inventario_huevo_sin_clasificar,
  avimol.lotes_huevo_detalle,
  avimol.movimientos_inventario_huevo,
  avimol.inventario_huevo,
  avimol.lotes_huevo,
  avimol.ordenes_cargue_detalle,
  avimol.ordenes_cargue,
  avimol.solicitudes_traslado_detalle,
  avimol.solicitudes_traslado,
  avimol.pedidos_detalle,
  avimol.pedidos,
  avimol.ventas_directas_detalle,
  avimol.ventas_directas,
  avimol.llegadas_vehiculo
RESTART IDENTITY CASCADE;
