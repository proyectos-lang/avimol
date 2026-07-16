-- Separa la recolección (solo color, sin tipo) de la clasificación
-- (donde el huevo sin clasificar se reparte en referencias tipo×color).
-- Antes, registrarRecoleccion escribía directo en inventario_huevo con
-- la referencia ya elegida; ahora recolección solo llena estas tablas
-- nuevas (keyeadas por color) y un proceso de clasificación aparte
-- traslada ese saldo hacia inventario_huevo (clasificado).

-- Saldo de huevo recién recolectado, aún sin separar por tipo — keyeado
-- por color únicamente (Rojo/Blanco), no por referencia_huevo_id.
CREATE TABLE avimol.inventario_huevo_sin_clasificar (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bodega_id           bigint NOT NULL REFERENCES avimol.bodegas(id),
  lote_huevo_id       bigint NOT NULL REFERENCES avimol.lotes_huevo(id),
  color_id            bigint NOT NULL REFERENCES avimol.colores_huevo(id),
  anaquel_id          bigint REFERENCES avimol.anaqueles(id),
  cantidad_disponible integer NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  actualizado_en      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bodega_id, lote_huevo_id, color_id, anaquel_id)
);

-- Kardex del huevo sin clasificar: entrada al recolectar, salida al
-- clasificar (o ajuste manual).
CREATE TABLE avimol.movimientos_huevo_sin_clasificar (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bodega_id       bigint NOT NULL REFERENCES avimol.bodegas(id),
  lote_huevo_id   bigint NOT NULL REFERENCES avimol.lotes_huevo(id),
  color_id        bigint NOT NULL REFERENCES avimol.colores_huevo(id),
  anaquel_id      bigint REFERENCES avimol.anaqueles(id),
  tipo_movimiento text NOT NULL CHECK (tipo_movimiento IN ('entrada_cosecha','salida_clasificacion','ajuste')),
  cantidad        integer NOT NULL CHECK (cantidad <> 0),
  usuario_id      bigint REFERENCES avimol.usuarios(id),
  creado_en       timestamptz NOT NULL DEFAULT now()
);

-- Un evento de clasificación: toma UNA combinación (lote + color +
-- anaquel origen) de inventario_huevo_sin_clasificar como entrada.
CREATE TABLE avimol.clasificaciones (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo            text NOT NULL UNIQUE,
  bodega_id         bigint NOT NULL REFERENCES avimol.bodegas(id),
  lote_huevo_id     bigint NOT NULL REFERENCES avimol.lotes_huevo(id),
  color_id          bigint NOT NULL REFERENCES avimol.colores_huevo(id),
  anaquel_origen_id bigint REFERENCES avimol.anaqueles(id),
  cantidad_entrada  integer NOT NULL CHECK (cantidad_entrada > 0),
  usuario_id        bigint REFERENCES avimol.usuarios(id),
  creado_en         timestamptz NOT NULL DEFAULT now()
);

-- Salida de la clasificación: en qué referencia (tipo×color) y anaquel
-- destino quedó cada parte de la entrada.
CREATE TABLE avimol.clasificaciones_detalle (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clasificacion_id    bigint NOT NULL REFERENCES avimol.clasificaciones(id),
  referencia_huevo_id bigint NOT NULL REFERENCES avimol.referencias_huevo(id),
  anaquel_destino_id  bigint REFERENCES avimol.anaqueles(id),
  cantidad            integer NOT NULL CHECK (cantidad > 0)
);

-- Las averías de clasificación ya estaban previstas en el CHECK de
-- etapa ('clasificacion'); solo falta el enlace de trazabilidad.
ALTER TABLE avimol.averias_huevo ADD COLUMN clasificacion_id bigint REFERENCES avimol.clasificaciones(id);

-- El inventario clasificado ahora también puede nacer de una
-- clasificación, no solo (ya nunca) de una cosecha directa.
ALTER TABLE avimol.movimientos_inventario_huevo DROP CONSTRAINT movimientos_inventario_huevo_tipo_movimiento_check;
ALTER TABLE avimol.movimientos_inventario_huevo ADD CONSTRAINT movimientos_inventario_huevo_tipo_movimiento_check
  CHECK (tipo_movimiento IN (
    'entrada_cosecha','entrada_clasificacion','salida_cargue_traslado','entrada_recepcion_traslado',
    'salida_cargue_despacho','salida_venta_directa','averia','ajuste'
  ));
