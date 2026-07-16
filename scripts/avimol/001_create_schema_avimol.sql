-- =====================================================================
-- AVIMOL — Esquema completo (Fase 1)
-- Sistema de inventario, logística y comercialización de huevos.
-- Vive en el esquema `avimol` de la MISMA base de datos de Lipgo.
-- No usa RLS. No usa Supabase Auth (usuarios propios + JWT).
-- IDs numéricos con GENERATED ALWAYS AS IDENTITY (sin UUID, sin MAX(id)+1).
-- Todas las fechas/horas en TIMESTAMPTZ (se muestran en America/Bogota
-- desde la aplicación, igual que en Lipgo).
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS avimol;

-- =====================================================================
-- 1. USUARIOS (autenticación propia, sin Supabase Auth)
-- =====================================================================

CREATE TABLE avimol.usuarios (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario        text NOT NULL UNIQUE,
  nombre         text NOT NULL,
  password_hash  text NOT NULL,
  rol            text NOT NULL CHECK (rol IN ('admin','recolector','clasificador','bodega','vendedor','gerencia')),
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. AVES: galpones, lotes de aves y su bitácora de movimientos
-- =====================================================================

CREATE TABLE avimol.granjas (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre    text NOT NULL,
  ubicacion text,
  activo    boolean NOT NULL DEFAULT true
);

CREATE TABLE avimol.galpones (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  granja_id  bigint REFERENCES avimol.granjas(id),
  codigo     text NOT NULL UNIQUE,
  nombre     text NOT NULL,
  capacidad  integer,
  activo     boolean NOT NULL DEFAULT true
);

-- Un lote de aves conserva su identidad, historial y edad sin importar
-- el galpón físico donde esté (galpon_id = ubicación ACTUAL, no fija).
CREATE TABLE avimol.lotes_aves (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  galpon_id             bigint NOT NULL REFERENCES avimol.galpones(id),
  codigo                text NOT NULL UNIQUE,
  cantidad_ingreso      integer NOT NULL CHECK (cantidad_ingreso > 0),
  cantidad_actual       integer NOT NULL CHECK (cantidad_actual >= 0),
  fecha_ingreso         date NOT NULL,
  edad_semanas_ingreso  integer NOT NULL CHECK (edad_semanas_ingreso >= 0),
  estado                text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','sacrificado','cerrado')),
  creado_en             timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN avimol.lotes_aves.edad_semanas_ingreso IS
  'Edad de las gallinas al momento de ingresar al galpón (semana 20 típicamente). La edad ACTUAL nunca se guarda: se calcula en tiempo real en avimol.v_lotes_aves_edad.';

-- Bitácora: ingreso, traslado entre galpones, mortalidad, sacrificio.
CREATE TABLE avimol.movimientos_aves (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_aves_id      bigint NOT NULL REFERENCES avimol.lotes_aves(id),
  tipo_movimiento   text NOT NULL CHECK (tipo_movimiento IN ('ingreso','traslado','mortalidad','sacrificio')),
  galpon_origen_id  bigint REFERENCES avimol.galpones(id),
  galpon_destino_id bigint REFERENCES avimol.galpones(id),
  cantidad          integer NOT NULL CHECK (cantidad > 0),
  fecha             timestamptz NOT NULL DEFAULT now(),
  observaciones     text,
  usuario_id        bigint REFERENCES avimol.usuarios(id)
);

-- =====================================================================
-- 3. BODEGAS Y ANAQUELES
-- =====================================================================

CREATE TABLE avimol.bodegas (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre    text NOT NULL,
  tipo      text NOT NULL CHECK (tipo IN ('clasificadora','venta','mixta')),
  ubicacion text,
  activo    boolean NOT NULL DEFAULT true
);

CREATE TABLE avimol.anaqueles (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bodega_id   bigint NOT NULL REFERENCES avimol.bodegas(id),
  codigo      text NOT NULL,
  descripcion text,
  codigo_qr   text, -- reservado para futuro control por QR; sin uso todavía
  activo      boolean NOT NULL DEFAULT true,
  UNIQUE (bodega_id, codigo)
);

-- =====================================================================
-- 4. CATÁLOGO DE HUEVO (tipo x color = referencia vendible)
-- =====================================================================

CREATE TABLE avimol.tipos_huevo (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre               text NOT NULL UNIQUE CHECK (nombre IN ('A','AA','AAA','Jumbo')),
  peso_promedio_gramos numeric(6,2) NOT NULL
);
COMMENT ON COLUMN avimol.tipos_huevo.peso_promedio_gramos IS
  'Parametrizable. Se usa para calcular automáticamente el peso total cargado en las órdenes de cargue.';

CREATE TABLE avimol.colores_huevo (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL UNIQUE CHECK (nombre IN ('Rojo','Blanco'))
);

CREATE TABLE avimol.referencias_huevo (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_id    bigint NOT NULL REFERENCES avimol.tipos_huevo(id),
  color_id   bigint NOT NULL REFERENCES avimol.colores_huevo(id),
  nombre     text NOT NULL,
  imagen_url text, -- imagen del producto para el catálogo del portal de pedidos
  activo     boolean NOT NULL DEFAULT true,
  UNIQUE (tipo_id, color_id)
);

-- =====================================================================
-- 5. CLIENTES, TARIFAS Y SOLICITUDES DE TRASLADO (headers, sin ciclos)
-- =====================================================================

CREATE TABLE avimol.clientes (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre             text NOT NULL,
  telefono           text,
  direccion          text,
  bodega_asignada_id bigint REFERENCES avimol.bodegas(id),
  activo             boolean NOT NULL DEFAULT true
);

CREATE TABLE avimol.tarifas_servicio_descargue (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  valor          numeric(12,2) NOT NULL,
  tipo_valor     text NOT NULL CHECK (tipo_valor IN ('fijo','por_kg')),
  vigente_desde  date NOT NULL,
  vigente_hasta  date,
  activo         boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE avimol.tarifas_servicio_descargue IS
  'Avimol cobra tarifa por el servicio de DESCARGUE (genera nómina interna); el cargue no se cobra. Parametrizable y con vigencia histórica.';

CREATE TABLE avimol.solicitudes_traslado (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo             text NOT NULL UNIQUE,
  bodega_origen_id   bigint NOT NULL REFERENCES avimol.bodegas(id),
  bodega_destino_id  bigint NOT NULL REFERENCES avimol.bodegas(id),
  estado             text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','cargado','recibido','anulado')),
  usuario_id         bigint REFERENCES avimol.usuarios(id),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  CHECK (bodega_origen_id <> bodega_destino_id)
);

-- =====================================================================
-- 6. LOTES DE HUEVO (unidad central de trazabilidad) y PEDIDOS (headers)
-- =====================================================================

-- Lote de cosecha. edad_semanas_captura es una FOTO fija en el tiempo:
-- la edad de la gallina en el momento de poner el huevo NO cambia
-- después (a diferencia de la edad del lote de aves, que sí avanza).
CREATE TABLE avimol.lotes_huevo (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                text NOT NULL UNIQUE, -- formato AAAAMMDD-###
  galpon_id             bigint NOT NULL REFERENCES avimol.galpones(id),
  lote_aves_id          bigint NOT NULL REFERENCES avimol.lotes_aves(id),
  edad_semanas_captura  integer NOT NULL CHECK (edad_semanas_captura >= 0),
  fecha_cosecha         date NOT NULL,
  bodega_id             bigint NOT NULL REFERENCES avimol.bodegas(id),
  origen                text NOT NULL CHECK (origen IN ('app_movil','manual_clasificadora')),
  codigo_qr             text, -- reservado para futuro control por QR
  usuario_id            bigint REFERENCES avimol.usuarios(id),
  creado_en             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE avimol.pedidos (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                   text NOT NULL UNIQUE,
  bodega_id                bigint NOT NULL REFERENCES avimol.bodegas(id),
  cliente_id               bigint NOT NULL REFERENCES avimol.clientes(id),
  fecha_pedido             date NOT NULL DEFAULT current_date,
  fecha_entrega_programada date,
  estado                   text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_picking','despachado','cerrado','anulado')),
  usuario_id               bigint REFERENCES avimol.usuarios(id),
  creado_en                timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 7. ÓRDENES DE CARGUE (reutilizadas para traslado y despacho, igual
--    que cabeceraoc en Lipgo — un solo header con tipo_operacion)
-- =====================================================================

CREATE TABLE avimol.ordenes_cargue (
  id                              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_operacion                  text NOT NULL CHECK (tipo_operacion IN ('cargue_traslado','descargue_traslado','cargue_despacho')),
  bodega_id                       bigint NOT NULL REFERENCES avimol.bodegas(id),
  solicitud_traslado_id           bigint REFERENCES avimol.solicitudes_traslado(id),
  pedido_id                       bigint REFERENCES avimol.pedidos(id),
  orden_cargue_origen_id          bigint REFERENCES avimol.ordenes_cargue(id), -- la orden de descargue apunta a la orden de cargue que la generó
  codigo                          text NOT NULL UNIQUE,
  placa_vehiculo                  text,
  conductor                       text,
  hora_llegada_vehiculo           timestamptz,
  hora_inicio_cargue              timestamptz,
  hora_fin_cargue                 timestamptz,
  hora_inicio_descargue           timestamptz,
  hora_fin_descargue              timestamptz,
  peso_total_kg                   numeric(10,2), -- calculado automáticamente desde el detalle
  tarifa_servicio_descargue_id    bigint REFERENCES avimol.tarifas_servicio_descargue(id),
  valor_tarifa_aplicado           numeric(12,2), -- snapshot del valor cobrado (solo descargue_traslado)
  estado                          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','cargado','en_transito','recibido','cerrado','anulado')),
  usuario_id                      bigint REFERENCES avimol.usuarios(id),
  creado_en                       timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 8. DETALLE DE SOLICITUDES/PEDIDOS y DETALLE DE CARGUE
-- =====================================================================

CREATE TABLE avimol.solicitudes_traslado_detalle (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_traslado_id  bigint NOT NULL REFERENCES avimol.solicitudes_traslado(id),
  referencia_huevo_id    bigint NOT NULL REFERENCES avimol.referencias_huevo(id),
  cantidad_solicitada    integer NOT NULL CHECK (cantidad_solicitada > 0)
);

CREATE TABLE avimol.pedidos_detalle (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id            bigint NOT NULL REFERENCES avimol.pedidos(id),
  referencia_huevo_id  bigint NOT NULL REFERENCES avimol.referencias_huevo(id),
  cantidad             integer NOT NULL CHECK (cantidad > 0),
  precio_unitario      numeric(12,2), -- opcional, NO bloqueante
  subtotal             numeric(12,2)
);

-- Línea de cargue: qué LOTE físico de huevo se cargó, para qué línea de
-- solicitud/pedido, y cuánto llegó realmente al confirmar el descargue
-- (cantidad_cargada vs cantidad_recibida = averías/faltantes).
CREATE TABLE avimol.ordenes_cargue_detalle (
  id                              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_cargue_id                 bigint NOT NULL REFERENCES avimol.ordenes_cargue(id),
  lote_huevo_id                   bigint NOT NULL REFERENCES avimol.lotes_huevo(id),
  referencia_huevo_id             bigint NOT NULL REFERENCES avimol.referencias_huevo(id),
  anaquel_id                      bigint REFERENCES avimol.anaqueles(id),
  solicitud_traslado_detalle_id   bigint REFERENCES avimol.solicitudes_traslado_detalle(id),
  pedido_detalle_id               bigint REFERENCES avimol.pedidos_detalle(id),
  cantidad_cargada                integer NOT NULL CHECK (cantidad_cargada > 0),
  cantidad_recibida                integer CHECK (cantidad_recibida >= 0), -- se llena al confirmar descargue
  peso_unitario_gramos             numeric(6,2) NOT NULL, -- snapshot de tipos_huevo.peso_promedio_gramos al cargar
  creado_en                        timestamptz NOT NULL DEFAULT now()
);

-- Detalle de clasificación del lote cosechado (cuánto de cada
-- referencia quedó en qué anaquel al momento de clasificar).
CREATE TABLE avimol.lotes_huevo_detalle (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_huevo_id         bigint NOT NULL REFERENCES avimol.lotes_huevo(id),
  referencia_huevo_id   bigint NOT NULL REFERENCES avimol.referencias_huevo(id),
  anaquel_id            bigint REFERENCES avimol.anaqueles(id),
  cantidad              integer NOT NULL CHECK (cantidad >= 0),
  UNIQUE (lote_huevo_id, referencia_huevo_id, anaquel_id)
);

-- Averías: recolección, clasificación, transporte, despacho o recepción.
CREATE TABLE avimol.averias_huevo (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lote_huevo_id         bigint NOT NULL REFERENCES avimol.lotes_huevo(id),
  referencia_huevo_id   bigint REFERENCES avimol.referencias_huevo(id),
  etapa                 text NOT NULL CHECK (etapa IN ('recoleccion','clasificacion','transporte','despacho','recepcion')),
  tipo_averia           text NOT NULL CHECK (tipo_averia IN ('picado','roto','partido')),
  cantidad              integer NOT NULL CHECK (cantidad > 0),
  orden_cargue_id       bigint REFERENCES avimol.ordenes_cargue(id),
  fecha                 timestamptz NOT NULL DEFAULT now(),
  observaciones         text,
  usuario_id            bigint REFERENCES avimol.usuarios(id)
);

-- =====================================================================
-- 9. VENTA DIRECTA / PUNTO DE VENTA
-- =====================================================================

CREATE TABLE avimol.ventas_directas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      text NOT NULL UNIQUE,
  bodega_id   bigint NOT NULL REFERENCES avimol.bodegas(id),
  cliente_id  bigint REFERENCES avimol.clientes(id), -- nullable: venta de mostrador sin cliente registrado
  fecha       timestamptz NOT NULL DEFAULT now(),
  usuario_id  bigint REFERENCES avimol.usuarios(id),
  total       numeric(12,2)
);

-- Una fila por LOTE físico descontado (una venta puede tomar el mismo
-- producto de varios lotes). lote_huevo_id es obligatorio: sin él se
-- rompería la cadena de trazabilidad en el último eslabón (venta).
CREATE TABLE avimol.ventas_directas_detalle (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venta_directa_id      bigint NOT NULL REFERENCES avimol.ventas_directas(id),
  lote_huevo_id         bigint NOT NULL REFERENCES avimol.lotes_huevo(id),
  referencia_huevo_id   bigint NOT NULL REFERENCES avimol.referencias_huevo(id),
  cantidad              integer NOT NULL CHECK (cantidad > 0),
  precio_unitario       numeric(12,2), -- opcional, NO bloqueante
  subtotal              numeric(12,2)
);

-- =====================================================================
-- 10. INVENTARIO DE HUEVO (saldo mantenido) + KARDEX DE MOVIMIENTOS
-- =====================================================================

-- Saldo por bodega + lote + referencia + anaquel. Se mantiene desde los
-- server actions en la misma transacción que inserta el movimiento
-- (igual patrón que saldoinvdetalle/invtrans en Lipgo). El invariante
-- cantidad_disponible = SUM(movimientos_inventario_huevo.cantidad) para
-- esa combinación debe conservarse siempre.
CREATE TABLE avimol.inventario_huevo (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bodega_id             bigint NOT NULL REFERENCES avimol.bodegas(id),
  lote_huevo_id         bigint NOT NULL REFERENCES avimol.lotes_huevo(id),
  referencia_huevo_id   bigint NOT NULL REFERENCES avimol.referencias_huevo(id),
  anaquel_id            bigint REFERENCES avimol.anaqueles(id),
  cantidad_disponible   integer NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  actualizado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bodega_id, lote_huevo_id, referencia_huevo_id, anaquel_id)
);

-- Kardex: un registro por cada movimiento de inventario (entrada de
-- cosecha, salida/entrada por traslado, salida por despacho o venta,
-- avería, ajuste). cantidad positiva = entrada, negativa = salida.
CREATE TABLE avimol.movimientos_inventario_huevo (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bodega_id             bigint NOT NULL REFERENCES avimol.bodegas(id),
  lote_huevo_id         bigint NOT NULL REFERENCES avimol.lotes_huevo(id),
  referencia_huevo_id   bigint NOT NULL REFERENCES avimol.referencias_huevo(id),
  anaquel_id            bigint REFERENCES avimol.anaqueles(id),
  tipo_movimiento       text NOT NULL CHECK (tipo_movimiento IN (
                          'entrada_cosecha','salida_cargue_traslado','entrada_recepcion_traslado',
                          'salida_cargue_despacho','salida_venta_directa','averia','ajuste'
                        )),
  cantidad              integer NOT NULL CHECK (cantidad <> 0),
  orden_cargue_id       bigint REFERENCES avimol.ordenes_cargue(id),
  pedido_id             bigint REFERENCES avimol.pedidos(id),
  venta_directa_id      bigint REFERENCES avimol.ventas_directas(id),
  observaciones         text,
  usuario_id            bigint REFERENCES avimol.usuarios(id),
  creado_en             timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 11. ÍNDICES DE APOYO (filtros/reportes más frecuentes)
-- =====================================================================

CREATE INDEX idx_lotes_aves_galpon        ON avimol.lotes_aves(galpon_id);
CREATE INDEX idx_lotes_huevo_fecha        ON avimol.lotes_huevo(fecha_cosecha);
CREATE INDEX idx_lotes_huevo_galpon       ON avimol.lotes_huevo(galpon_id);
CREATE INDEX idx_lotes_huevo_bodega       ON avimol.lotes_huevo(bodega_id);
CREATE INDEX idx_inventario_bodega_ref    ON avimol.inventario_huevo(bodega_id, referencia_huevo_id);
CREATE INDEX idx_mov_inv_lote             ON avimol.movimientos_inventario_huevo(lote_huevo_id);
CREATE INDEX idx_mov_inv_orden_cargue     ON avimol.movimientos_inventario_huevo(orden_cargue_id);
CREATE INDEX idx_ordenes_cargue_estado    ON avimol.ordenes_cargue(estado);
CREATE INDEX idx_pedidos_estado_bodega    ON avimol.pedidos(estado, bodega_id);
CREATE INDEX idx_averias_lote             ON avimol.averias_huevo(lote_huevo_id);

-- =====================================================================
-- 12. VISTAS DE TRAZABILIDAD Y EDAD EN TIEMPO REAL
-- =====================================================================

-- Edad ACTUAL de cada lote de aves, siempre calculada al vuelo (nunca
-- almacenada), a partir de la fecha de ingreso y la edad de ingreso.
CREATE VIEW avimol.v_lotes_aves_edad AS
SELECT
  la.*,
  (la.edad_semanas_ingreso + FLOOR((CURRENT_DATE - la.fecha_ingreso) / 7))::int AS edad_actual_semanas
FROM avimol.lotes_aves la;

-- Trazabilidad completa: de qué galpón y de qué edad viene un lote de huevo.
CREATE VIEW avimol.v_trazabilidad_huevo AS
SELECT
  lh.id AS lote_huevo_id,
  lh.codigo AS lote_huevo_codigo,
  lh.fecha_cosecha,
  lh.edad_semanas_captura,
  g.id AS galpon_id,
  g.codigo AS galpon_codigo,
  g.nombre AS galpon_nombre,
  la.id AS lote_aves_id,
  la.codigo AS lote_aves_codigo,
  b.id AS bodega_id,
  b.nombre AS bodega_nombre
FROM avimol.lotes_huevo lh
JOIN avimol.galpones g   ON g.id = lh.galpon_id
JOIN avimol.lotes_aves la ON la.id = lh.lote_aves_id
JOIN avimol.bodegas b     ON b.id = lh.bodega_id;
