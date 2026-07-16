-- Los huevos blancos ya no se nombran igual que los rojos (A/AA/AAA/
-- Jumbo compartido) — pasan a tener nombre propio por talla. Se
-- actualiza solo referencias_huevo.nombre (el nombre ya precomputado
-- por fila); tipos_huevo.nombre sigue siendo 'A'/'AA'/'AAA'/'Jumbo'
-- internamente (fila compartida con Rojo, no se puede diferenciar ahí
-- sin romper Rojo) y colores_huevo.nombre no cambia.
UPDATE avimol.referencias_huevo r SET nombre = 'Revoltura Blanca pequeña'
  FROM avimol.tipos_huevo t, avimol.colores_huevo c
  WHERE r.tipo_id = t.id AND r.color_id = c.id AND t.nombre = 'A' AND c.nombre = 'Blanco';

UPDATE avimol.referencias_huevo r SET nombre = 'Revoltura Blanca mediana'
  FROM avimol.tipos_huevo t, avimol.colores_huevo c
  WHERE r.tipo_id = t.id AND r.color_id = c.id AND t.nombre = 'AA' AND c.nombre = 'Blanco';

UPDATE avimol.referencias_huevo r SET nombre = 'Revoltura Blanca Grande'
  FROM avimol.tipos_huevo t, avimol.colores_huevo c
  WHERE r.tipo_id = t.id AND r.color_id = c.id AND t.nombre = 'AAA' AND c.nombre = 'Blanco';

UPDATE avimol.referencias_huevo r SET nombre = 'Jumbo Blanco'
  FROM avimol.tipos_huevo t, avimol.colores_huevo c
  WHERE r.tipo_id = t.id AND r.color_id = c.id AND t.nombre = 'Jumbo' AND c.nombre = 'Blanco';
