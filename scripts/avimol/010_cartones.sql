-- Consumo de cartones (30 huevos c/u) en el proceso de Clasificación:
-- costo vigente del cartón (mismo patrón que tarifas_servicio_descargue,
-- histórico con vigencia + snapshot en cada transacción), existencias
-- físicas por bodega (solo clasificadoras/mixtas, donde se consume) y
-- el kardex de esas existencias.

CREATE TABLE avimol.costos_carton (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  valor          numeric(12,2) NOT NULL,
  vigente_desde  date NOT NULL,
  vigente_hasta  date,
  activo         boolean NOT NULL DEFAULT true
);

CREATE TABLE avimol.inventario_cartones (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bodega_id           bigint NOT NULL REFERENCES avimol.bodegas(id) UNIQUE,
  cantidad_disponible integer NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  actualizado_en      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE avimol.movimientos_cartones (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bodega_id        bigint NOT NULL REFERENCES avimol.bodegas(id),
  tipo_movimiento  text NOT NULL CHECK (tipo_movimiento IN ('entrada_manual','salida_clasificacion','ajuste')),
  cantidad         integer NOT NULL CHECK (cantidad <> 0),
  costo_unitario   numeric(12,2),
  clasificacion_id bigint REFERENCES avimol.clasificaciones(id),
  observaciones    text,
  usuario_id       bigint REFERENCES avimol.usuarios(id),
  creado_en        timestamptz NOT NULL DEFAULT now()
);

-- La clasificación registra cuántos cartones consumió (calculado +
-- extra) y a qué costo, para poder costear el proceso después.
ALTER TABLE avimol.clasificaciones
  ADD COLUMN cartones_calculados     integer NOT NULL DEFAULT 0,
  ADD COLUMN cartones_extra          integer NOT NULL DEFAULT 0,
  ADD COLUMN costo_carton_id         bigint REFERENCES avimol.costos_carton(id),
  ADD COLUMN costo_unitario_aplicado numeric(12,2),
  ADD COLUMN costo_total_cartones    numeric(12,2);

-- Desglose de POR QUÉ se usaron cartones extra (varias líneas por
-- clasificación: refuerzo de cartones buenos, rotos, averiados).
CREATE TABLE avimol.clasificaciones_cartones_extra (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clasificacion_id bigint NOT NULL REFERENCES avimol.clasificaciones(id),
  motivo           text NOT NULL CHECK (motivo IN ('refuerzo_buenos','rotos','averiados')),
  cantidad         integer NOT NULL CHECK (cantidad > 0),
  observacion      text
);
