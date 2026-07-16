-- Gestión de vehículos: cada llegada es una línea independiente. Queda
-- "disponible" mientras orden_cargue_id sea NULL; al usarse en un cargue
-- o despacho se fija esa columna y deja de aparecer como seleccionable
-- hasta que se registre una llegada nueva para la misma placa.
CREATE TABLE avimol.llegadas_vehiculo (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  placa           text NOT NULL,
  conductor       text NOT NULL,
  hora_llegada    timestamptz NOT NULL DEFAULT now(),
  orden_cargue_id bigint REFERENCES avimol.ordenes_cargue(id),
  usuario_id      bigint REFERENCES avimol.usuarios(id),
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_llegadas_vehiculo_disponibles ON avimol.llegadas_vehiculo(orden_cargue_id) WHERE orden_cargue_id IS NULL;
