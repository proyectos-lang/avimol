-- Bandera de "ya se clasificó la avería de esta recepción" — mismo
-- patrón timestamp-como-bandera que hora_inicio_cargue/hora_fin_cargue.
ALTER TABLE avimol.ordenes_cargue
  ADD COLUMN hora_clasificacion_averia timestamptz;

-- Encabezado de cada "corrida" de procesamiento de yemas — clonado del
-- patrón costos_carton/inventario_cartones/movimientos_cartones.
CREATE TABLE avimol.procesamientos_yema_averia (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bodega_id       bigint NOT NULL REFERENCES avimol.bodegas(id),
  cantidad_yemas  integer NOT NULL CHECK (cantidad_yemas > 0),
  observaciones   text,
  usuario_id      bigint REFERENCES avimol.usuarios(id),
  creado_en       timestamptz NOT NULL DEFAULT now()
);

-- No-null = esa avería ya fue barrida en un procesamiento de yemas
-- (evita doble conteo, y da trazabilidad de a qué corrida pertenece).
ALTER TABLE avimol.averias_huevo
  ADD COLUMN procesamiento_yema_id bigint REFERENCES avimol.procesamientos_yema_averia(id);

CREATE TABLE avimol.inventario_yemas (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bodega_id           bigint NOT NULL REFERENCES avimol.bodegas(id) UNIQUE,
  cantidad_disponible integer NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  actualizado_en      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE avimol.movimientos_yemas (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bodega_id              bigint NOT NULL REFERENCES avimol.bodegas(id),
  tipo_movimiento        text NOT NULL CHECK (tipo_movimiento IN ('entrada_procesamiento','ajuste')),
  cantidad               integer NOT NULL CHECK (cantidad <> 0),
  procesamiento_yema_id  bigint REFERENCES avimol.procesamientos_yema_averia(id),
  observaciones          text,
  usuario_id             bigint REFERENCES avimol.usuarios(id),
  creado_en              timestamptz NOT NULL DEFAULT now()
);
