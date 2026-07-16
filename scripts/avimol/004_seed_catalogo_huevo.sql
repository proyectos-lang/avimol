-- Catálogo base de huevo: tipos (por peso), colores y las referencias
-- vendibles (tipo x color). Los pesos promedio son un valor de partida
-- razonable para el cálculo automático de peso cargado — AJÚSTALOS a lo
-- que realmente pese Avimol si difiere.

INSERT INTO avimol.tipos_huevo (nombre, peso_promedio_gramos) VALUES
  ('A', 58),
  ('AA', 65),
  ('AAA', 72),
  ('Jumbo', 80);

INSERT INTO avimol.colores_huevo (nombre) VALUES
  ('Rojo'),
  ('Blanco');

INSERT INTO avimol.referencias_huevo (tipo_id, color_id, nombre)
SELECT t.id, c.id, t.nombre || ' ' || c.nombre
FROM avimol.tipos_huevo t
CROSS JOIN avimol.colores_huevo c;
