-- El peso hasta ahora era uno solo por tipo (A/AA/AAA/Jumbo), compartido
-- entre colores. Se vuelve editable por referencia (tipo x color) desde
-- el Catálogo, arrancando con el peso del tipo como valor de partida.
ALTER TABLE avimol.referencias_huevo ADD COLUMN peso_unitario_gramos numeric(6,2);

UPDATE avimol.referencias_huevo r
SET peso_unitario_gramos = t.peso_promedio_gramos
FROM avimol.tipos_huevo t
WHERE r.tipo_id = t.id;

ALTER TABLE avimol.referencias_huevo ALTER COLUMN peso_unitario_gramos SET NOT NULL;
