-- Edad de gallina preferida al pedir un traslado: es solo informativa
-- para quien hace el picking en la orden de cargue (ordena los lotes
-- por cercanía a esa edad), no filtra ni bloquea nada.
ALTER TABLE avimol.solicitudes_traslado_detalle ADD COLUMN edad_semanas_preferida integer;
