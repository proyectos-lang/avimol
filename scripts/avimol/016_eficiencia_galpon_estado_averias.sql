ALTER TABLE avimol.galpones ADD COLUMN eficiencia_porcentaje numeric(5,2);

ALTER TABLE avimol.averias_huevo
  ADD COLUMN estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')),
  ADD COLUMN procesada_por bigint REFERENCES avimol.usuarios(id),
  ADD COLUMN procesada_en timestamptz;
