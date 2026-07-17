# Avimol — Contexto del proyecto

Sistema de inventario, logística y comercialización de huevos para **Avimol**
(producción y comercialización de huevos con gallinas ponedoras, Santander,
Colombia). Este documento resume el contexto de negocio, las decisiones de
arquitectura, el modelo de datos completo y el historial de lo construido
hasta ahora, para que cualquier sesión futura (humana o de IA) pueda retomar
el trabajo sin releer todo el chat.

---

## 1. Contexto de negocio

- Las gallinas inician postura ~semana 20 de vida; el ciclo llega normalmente
  hasta semana 82, y en Avimol a veces hasta semana 96. Gallinas viejas ponen
  huevo **Jumbo**: grande pero frágil (menos calcio en cáscara).
- **La edad del huevo = edad en semanas de la gallina que lo puso**, y debe
  viajar con el producto en toda la trazabilidad.
- Las gallinas viven en **galpones** y rotan mensualmente vía **traslados**
  (entran lotes nuevos, salen lotes viejos a sacrificio).
- Flujo físico: recolección en campo → clasificadora (clasifica por peso
  A/AA/AAA/Jumbo y color rojo/blanco, almacena en anaqueles) → bodegas de
  venta / puntos de venta.
- Las averías (picados, rotos, partidos) son críticas de registrar en cada
  etapa, sobre todo con huevo de gallina vieja (más frágil).

### Módulos funcionales completos (del enunciado original)

1. Inventario de aves por galpón (galpones, lotes de aves, edad en tiempo real, traslados/salidas).
2. Recolección de huevos (lote de huevo con consecutivo `AAAAMMDD-###`, herencia de galpón/edad, clasificación tipo+color, averías).
3. Multi-bodega y traslados (solicitud → cargue con horas y picking → descargue prellenado con diferencias/averías, tarifa de descargue).
4. Pedidos de clientes, picking y despacho (catálogo con imagen, precio opcional, orden de cargue de despacho).
5. Punto de venta / venta directa.
6. Indicadores y reportes.
7. Preparado para QR (a futuro, sin implementar aún).

**Regla transversal obligatoria**: en todo movimiento de huevos debe
conservarse sin pérdida: lote de huevo + fecha de cosecha, galpón de origen +
lote de aves, **edad en semanas de la gallina al momento de la cosecha**,
tipo y color, y anaquel/ubicación cuando aplique. Ningún proceso puede
romper esta cadena.

---

## 2. Decisiones de arquitectura (por qué está hecho así)

| Decisión | Detalle | Por qué |
|---|---|---|
| **Aplicación de referencia** | Se analizó el código de **Lipgo** (Next.js + Supabase, logística de molino) para reutilizar patrones de inventario (kardex + saldo), cargue/descargue, picking y traslados. Lipgo vivía originalmente en `C:\Users\Personal\Avimol` (analizada ahí en la Fase 0), y el proyecto nuevo se creó aparte en `C:\Users\Personal\avimol-huevos` para no mezclarlo. | El usuario pidió explícitamente no reinventar lo que Lipgo ya resuelve. |
| **Consolidación de carpeta (posterior)** | Una vez terminados los 6 módulos, el usuario pidió traer todo el código a `C:\Users\Personal\Avimol` y **borrar permanentemente** el código de Lipgo y los documentos de negocio que había ahí (contratos, matrices SST, etc. de Indupan/La Insuperable/LIP — ninguno era de Avimol). Se le advirtió explícitamente que esa carpeta no era un repo git y que el borrado sería irreversible; confirmó que sí. Desde ese momento **el proyecto Avimol vive en `C:\Users\Personal\Avimol`** y `avimol-huevos` ya no existe. | Pedido explícito del usuario, confirmado tras advertencia de riesgo. |
| **Misma base de datos, otro esquema** | Mismo proyecto Supabase que Lipgo (misma URL, misma `service_role` key), pero **todo vive en el esquema `avimol`**, nunca en `public`. | Pedido explícito del usuario. |
| **Sin RLS** | No hay políticas de Row Level Security. Todo el control de acceso es de aplicación (sesión propia + rol). Todas las queries usan el cliente `service_role` desde server actions — nunca se expone un cliente Supabase al navegador. | Pedido explícito del usuario. |
| **Sin Supabase Auth** | Usuarios en tabla normal `avimol.usuarios` (password con `bcryptjs`), sesión propia vía **JWT firmado** (`jose`) en cookie httpOnly `avimol_session`, sin tabla de sesiones (el usuario eligió JWT sin tabla de sesiones — no se puede invalidar antes de expirar, vida de 12h). | Pedido explícito del usuario. |
| **IDs numéricos** | Todas las PK son `bigint GENERATED ALWAYS AS IDENTITY` (no UUID, no el patrón "leer MAX(id)+1" que usa Lipgo). | El usuario pidió IDs numéricos simples; se prefirió `IDENTITY` sobre el patrón de Lipgo para evitar condiciones de carrera. |
| **Nombres en español** | Todas las tablas, columnas y la UI están en español sencillo. | Pedido explícito del usuario. |
| **Rutas por módulo** | Next.js App Router normal (`/galpones`, `/aves`, `/recoleccion`, etc.), **no** un shell SPA con cambio de vista por estado de React. | Elegido por el usuario al inicio: mejor para mobile (recolectores) y para una app con pocos módulos. **Se mantiene igual tras el cambio de navegación de más abajo** — lo que cambió fue el chrome de navegación (sidebar), no el ruteo. |
| **Navegación tipo Lipgo (revisión posterior)** | El usuario pidió que el formato visual se pareciera a la estructura original de Lipgo. Se reemplazó la barra superior (`AppNav`, eliminado) por un **Sidebar izquierdo fijo y colapsable** (`components/sidebar.tsx`) con los módulos agrupados por color (`lib/dashboard-data.ts`), y la página de inicio pasó de una lista plana de 17 módulos a **tarjetas de color por grupo** (`components/module-cards.tsx`), igual patrón visual que `ModuleCards`/`Sidebar` de Lipgo. Las rutas de cada módulo **no cambiaron** — solo el chrome de navegación alrededor. | Pedido explícito del usuario. Como el código de Lipgo ya se había borrado (ver fila de consolidación de carpeta), esto se reconstruyó a partir de lo documentado en la Fase 0, no copiado del código original. |
| **Stack** | Next.js 16 (App Router, Turbopack por defecto pero **falla en este Windows** con un error de recursos del SO — usar `next dev --webpack`), React 19, Tailwind 4, shadcn/ui "new-york" (componentes copiados literalmente de Lipgo, son genéricos), `@supabase/supabase-js`, `bcryptjs`, `jose`, `date-fns`. | Mismo stack que Lipgo, por pedido del usuario. |
| **Convención de fechas** | `America/Bogota` en toda la app (`lib/date-utils.ts`). **Cuidado**: fechas puras `YYYY-MM-DD` (columnas `date`) se formatean con split de string, NUNCA con `new Date(str)` + `timeZone`, porque eso las corre un día hacia atrás (bug real encontrado y corregido — ver historial). | — |
| **`middleware.ts` → `proxy.ts`** | Next.js 16 renombró la convención; el archivo se llama `proxy.ts` y exporta `proxy()`, no `middleware()`. | Detectado por warning del propio `next dev`. |
| **Picking/despacho reutiliza `ordenes_cargue`** | Un solo header (`tipo_operacion`: `cargue_traslado` / `descargue_traslado` / `cargue_despacho`) para traslados y (en el futuro) despachos a cliente, igual patrón que `cabeceraoc` en Lipgo. | Evita triplicar tablas casi idénticas. |
| **Exposed schemas + grants** | Para que Supabase/PostgREST acepte queries contra `avimol` hay que: (1) Settings → API/Data API → Exposed schemas → agregar `avimol`; (2) correr `GRANT` a `service_role` sobre el esquema. Ambos pasos son manuales del usuario (no automatizables desde aquí). | Encontrado por prueba y error durante la Fase 1. |

### Infraestructura / conexión

- `.env.local` (no versionado): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AVIMOL_JWT_SECRET`.
- `lib/supabase-avimol.ts`: único cliente Supabase de la app, `db.schema = "avimol"`, solo se usa en server actions.
- `lib/auth/`: `session.ts` (firmar/verificar JWT), `actions.ts` (`iniciarSesion`, `cerrarSesion`, `obtenerUsuarioActual`).
- `proxy.ts`: protege todas las rutas excepto `/login`, redirige a `/login` si no hay cookie válida.

---

## 3. Modelo de datos completo (esquema `avimol`)

Scripts SQL (en el repo de Lipgo, `C:\Users\Personal\Avimol\scripts\avimol\`,
porque ahí vive la base de datos compartida — el usuario los corre a mano en
el SQL Editor de Supabase):

1. **`001_create_schema_avimol.sql`** — todo el esquema (ver tablas abajo).
2. **`002_seed_usuario_admin.sql`** — usuario `admin` / contraseña temporal `avimol2026`.
3. **`003_grants_avimol.sql`** — `GRANT` de privilegios a `service_role` sobre el esquema (necesario además de exponerlo en Data API).
4. **`004_seed_catalogo_huevo.sql`** — siembra `tipos_huevo` (A/AA/AAA/Jumbo con peso promedio en gramos, **ajustar si no coincide con la realidad**), `colores_huevo` (Rojo/Blanco), y las 8 `referencias_huevo` (tipo × color).
5. **`005_pedidos_comercial.sql`** — columnas de `pedidos`: vendedor, condición de pago, N° orden de compra, IVA/descuento y sus valores calculados (subtotal, valor_descuento, valor_iva, total).
6. **`006_peso_por_referencia.sql`** — `referencias_huevo.peso_unitario_gramos`, con backfill desde `tipos_huevo.peso_promedio_gramos`.
7. **`007_vehiculos.sql`** — tabla `llegadas_vehiculo` (Gestión de vehículos).
8. **`008_inventario_no_clasificado.sql`** — tablas `inventario_huevo_sin_clasificar`, `movimientos_huevo_sin_clasificar`, `clasificaciones`, `clasificaciones_detalle`; `averias_huevo.clasificacion_id`; nuevo valor `entrada_clasificacion` en el CHECK de `movimientos_inventario_huevo.tipo_movimiento`.
9. **`009_traslado_edad_preferida.sql`** — `solicitudes_traslado_detalle.edad_semanas_preferida`.
10. **`010_cartones.sql`** — tablas `costos_carton`, `inventario_cartones`, `movimientos_cartones`, `clasificaciones_cartones_extra`; `clasificaciones` gana `cartones_calculados`/`cartones_extra`/`costo_carton_id`/`costo_unitario_aplicado`/`costo_total_cartones`.
11. **`011_referencias_blanco_nombres.sql`** — renombra `referencias_huevo.nombre` de las 4 filas de color Blanco a "Revoltura Blanca pequeña/mediana/Grande" y "Jumbo Blanco" (no toca `tipos_huevo`/`colores_huevo`, que siguen A/AA/AAA/Jumbo y Rojo/Blanco internamente).
12. **`012_yema_bolsa_recepcion.sql`** — `averias_huevo.cantidad_yemas`/`cantidad_bolsas_yema`.
13. **`013_cliente_consumidor_final.sql`** — siembra el cliente "Consumidor final" (idempotente, `WHERE NOT EXISTS`).
14. **`014_cargue_parcial.sql`** — amplía el CHECK de `solicitudes_traslado.estado` con `en_picking`/`cargado_parcial` (busca y reemplaza el constraint dinámicamente vía `pg_constraint`, sin asumir su nombre exacto). `pedidos.estado` no necesitó ALTER: `en_picking`/`despachado` ya estaban reservados en el CHECK desde la Fase 1.
15. **`015_recepciones_averias_yemas.sql`** — `ordenes_cargue.hora_clasificacion_averia`; tablas `procesamientos_yema_averia`, `inventario_yemas`, `movimientos_yemas`; `averias_huevo.procesamiento_yema_id`.

### Tablas por dominio

**Usuarios**
- `usuarios(id, usuario, nombre, password_hash, rol, activo, creado_en)` — rol ∈ {admin, recolector, clasificador, bodega, vendedor, gerencia}.

**Aves**
- `granjas(id, nombre, ubicacion, activo)`
- `galpones(id, granja_id, codigo, nombre, capacidad, activo)`
- `lotes_aves(id, galpon_id, codigo, cantidad_ingreso, cantidad_actual, fecha_ingreso, edad_semanas_ingreso, estado, creado_en)` — `galpon_id` es la ubicación **actual** (el lote conserva identidad al trasladarse). `estado` ∈ {activo, sacrificado, cerrado}. **Un lote activo por galpón a la vez** (regla de negocio, no constraint duro).
- `movimientos_aves(id, lote_aves_id, tipo_movimiento, galpon_origen_id, galpon_destino_id, cantidad, fecha, observaciones, usuario_id)` — tipo ∈ {ingreso, traslado, mortalidad, sacrificio}.
- **Vista `v_lotes_aves_edad`**: `lotes_aves.*` + `edad_actual_semanas` calculada en vivo (`edad_semanas_ingreso + FLOOR((hoy - fecha_ingreso)/7)`). **La edad de las aves NUNCA se almacena**, siempre se lee de esta vista.

**Bodegas**
- `bodegas(id, nombre, tipo, ubicacion, activo)` — tipo ∈ {clasificadora, venta, mixta}.
- `anaqueles(id, bodega_id, codigo, descripcion, codigo_qr, activo)` — `codigo_qr` reservado para futuro, sin uso todavía.

**Catálogo de huevo**
- `tipos_huevo(id, nombre, peso_promedio_gramos)` — nombre ∈ {A, AA, AAA, Jumbo}.
- `colores_huevo(id, nombre)` — nombre ∈ {Rojo, Blanco}.
- `referencias_huevo(id, tipo_id, color_id, nombre, imagen_url, activo)` — el "producto" vendible (tipo × color). `imagen_url` para el catálogo de pedidos (Módulo 4, no usado aún).

**Cosecha / lotes de huevo**
- `lotes_huevo(id, codigo, galpon_id, lote_aves_id, edad_semanas_captura, fecha_cosecha, bodega_id, origen, codigo_qr, usuario_id, creado_en)` — `codigo` formato `AAAAMMDD-###`. `edad_semanas_captura` es una **foto fija** (no cambia después, a diferencia de la edad del lote de aves). `origen` ∈ {app_movil, manual_clasificadora}.
- `lotes_huevo_detalle(id, lote_huevo_id, referencia_huevo_id, anaquel_id, cantidad)` — clasificación por tipo/color al momento de cosechar.
- `averias_huevo(id, lote_huevo_id, referencia_huevo_id, etapa, tipo_averia, cantidad, cantidad_yemas, cantidad_bolsas_yema, orden_cargue_id, fecha, observaciones, usuario_id, clasificacion_id, procesamiento_yema_id)` — etapa ∈ {recoleccion, clasificacion, transporte, despacho, recepcion}; tipo_averia ∈ {picado, roto, partido}. `cantidad_yemas`/`cantidad_bolsas_yema` (migración 012) son un campo **histórico/discontinuado**: se llenaban cuando la recepción capturaba yema/bolsa por línea directamente en Descargue (ronda anterior); desde la Ronda 7, el código nuevo ya no los puebla — las yemas se procesan en lote por bodega desde `/averias` (ver `procesamiento_yema_id` abajo). `procesamiento_yema_id` (migración 015, no-null = ya se contabilizó en un procesamiento de yemas, evita doble conteo).

**Cartones** (migración 010, ver Ronda 6 del historial)
- `costos_carton(id, valor, vigente_desde, vigente_hasta, activo)` — histórico con vigencia, mismo patrón que `tarifas_servicio_descargue`.
- `inventario_cartones(id, bodega_id UNIQUE, cantidad_disponible, actualizado_en)` — saldo mantenido, solo bodegas `clasificadora`/`mixta`.
- `movimientos_cartones(id, bodega_id, tipo_movimiento, cantidad, costo_unitario, clasificacion_id, observaciones, usuario_id, creado_en)` — tipo_movimiento ∈ {entrada_manual, salida_clasificacion, ajuste}.
- `clasificaciones_cartones_extra(id, clasificacion_id, motivo, cantidad, observacion)` — motivo ∈ {refuerzo_buenos, rotos, averiados}. `clasificaciones` (migración 008) ganó `cartones_calculados`/`cartones_extra`/`costo_carton_id`/`costo_unitario_aplicado`/`costo_total_cartones` en la migración 010.

**Yemas** (migración 015, ver Ronda 7 del historial — mismo patrón que Cartones)
- `procesamientos_yema_averia(id, bodega_id, cantidad_yemas, observaciones, usuario_id, creado_en)` — encabezado de cada "corrida" en la que un encargado declara cuántas yemas salieron de un lote de averías de recepción ya acumuladas en una bodega.
- `inventario_yemas(id, bodega_id UNIQUE, cantidad_disponible, actualizado_en)` — saldo de yemas por bodega. **Solo inventario esta ronda** — no integrado todavía a Ventas/Pedidos/Catálogo como producto vendible.
- `movimientos_yemas(id, bodega_id, tipo_movimiento, cantidad, procesamiento_yema_id, observaciones, usuario_id, creado_en)` — tipo_movimiento ∈ {entrada_procesamiento, ajuste}.

**Clientes, tarifas, traslados (headers)**
- `clientes(id, nombre, telefono, direccion, bodega_asignada_id, activo)` — **no usada todavía** (es del Módulo 4).
- `tarifas_servicio_descargue(id, valor, tipo_valor, vigente_desde, vigente_hasta, activo)` — tipo_valor ∈ {fijo, por_kg}. Avimol cobra descargue, no cargue.
- `solicitudes_traslado(id, codigo, bodega_origen_id, bodega_destino_id, estado, usuario_id, creado_en)` — estado ∈ {pendiente, en_picking, cargado_parcial, cargado, recibido, anulado} (migración 014 agregó `en_picking`/`cargado_parcial` para cargue parcial — ver Ronda 7).
- `pedidos(id, codigo, bodega_id, cliente_id, fecha_pedido, fecha_entrega_programada, estado, usuario_id, creado_en)` — estado ∈ {pendiente, en_picking, despachado, cerrado, anulado}. `en_picking`/`despachado` estaban reservados en el CHECK desde la Fase 1 sin usarse; desde la Ronda 7 sí se usan (`despachado` = cubierto parcialmente, admite otra orden de despacho por el remanente — **no** es un estado terminal positivo pese al nombre).

**Órdenes de cargue (compartidas: traslado y despacho)**
- `ordenes_cargue(id, tipo_operacion, bodega_id, solicitud_traslado_id, pedido_id, orden_cargue_origen_id, codigo, placa_vehiculo, conductor, hora_llegada_vehiculo, hora_inicio_cargue, hora_fin_cargue, hora_inicio_descargue, hora_fin_descargue, hora_clasificacion_averia, peso_total_kg, tarifa_servicio_descargue_id, valor_tarifa_aplicado, estado, usuario_id, creado_en)` — tipo_operacion ∈ {cargue_traslado, descargue_traslado, cargue_despacho}. estado ∈ {pendiente, cargado, en_transito, recibido, cerrado, anulado}. `orden_cargue_origen_id` autorreferencia: la orden de descargue apunta a la orden de cargue que la generó. `hora_clasificacion_averia` (migración 015, nullable): marca cuándo se clasificó bueno/roto/picado/partido en Recepciones — antes de eso el `hora_fin_descargue` solo significa "cantidad recibida confirmada", no que el inventario ya esté acreditado (ver Ronda 7).
- `solicitudes_traslado_detalle(id, solicitud_traslado_id, referencia_huevo_id, cantidad_solicitada)`
- `pedidos_detalle(id, pedido_id, referencia_huevo_id, cantidad, precio_unitario, subtotal)` — precio **opcional, no bloqueante**. Ya usada (Módulo 4).
- `ordenes_cargue_detalle(id, orden_cargue_id, lote_huevo_id, referencia_huevo_id, anaquel_id, solicitud_traslado_detalle_id, pedido_detalle_id, cantidad_cargada, cantidad_recibida, peso_unitario_gramos, creado_en)` — línea real de qué lote físico se cargó; `cantidad_recibida` se llena al confirmar descargue (diferencia = merma/avería). **Nota**: hoy `pedido_detalle_id` no se llena (el picking de despacho no ata la línea de cargue a una línea específica del pedido, solo a la referencia); si en el futuro se necesita reportar "cuánto de esta línea del pedido ya se despachó" línea por línea, hay que empezar a poblarlo.

**Punto de venta** (tablas creadas, **módulo no implementado todavía**)
- `ventas_directas(id, codigo, bodega_id, cliente_id, fecha, usuario_id, total)`
- `ventas_directas_detalle(id, venta_directa_id, lote_huevo_id, referencia_huevo_id, cantidad, precio_unitario, subtotal)` — `lote_huevo_id` es obligatorio para no romper trazabilidad en el último eslabón.

**Inventario (transversal, usado por recolección/traslados/despacho)**
- `inventario_huevo(id, bodega_id, lote_huevo_id, referencia_huevo_id, anaquel_id, cantidad_disponible, actualizado_en)` — saldo mantenido (no vista), único por (bodega, lote, referencia, anaquel). Invariante: debe igualar la suma de `movimientos_inventario_huevo` para esa combinación.
- `movimientos_inventario_huevo(id, bodega_id, lote_huevo_id, referencia_huevo_id, anaquel_id, tipo_movimiento, cantidad, orden_cargue_id, pedido_id, venta_directa_id, observaciones, usuario_id, creado_en)` — kardex. tipo_movimiento ∈ {entrada_cosecha, salida_cargue_traslado, entrada_recepcion_traslado, salida_cargue_despacho, salida_venta_directa (futuro), averia, ajuste}. Cantidad positiva = entrada, negativa = salida.

**Vistas de reporte**
- `v_lotes_aves_edad` (ver arriba).
- `v_trazabilidad_huevo(lote_huevo_id, lote_huevo_codigo, fecha_cosecha, edad_semanas_captura, galpon_id, galpon_codigo, galpon_nombre, lote_aves_id, lote_aves_codigo, bodega_id, bodega_nombre)` — responde "¿de qué galpón y edad viene este huevo?". **Creada pero aún no consumida por ninguna UI** (candidata para el módulo de indicadores).

### Índices creados
`lotes_aves(galpon_id)`, `lotes_huevo(fecha_cosecha)`, `lotes_huevo(galpon_id)`, `lotes_huevo(bodega_id)`, `inventario_huevo(bodega_id, referencia_huevo_id)`, `movimientos_inventario_huevo(lote_huevo_id)`, `movimientos_inventario_huevo(orden_cargue_id)`, `ordenes_cargue(estado)`, `pedidos(estado, bodega_id)`, `averias_huevo(lote_huevo_id)`.

---

## 4. Historial de lo construido

### Fase 0-1 (análisis + modelo de datos)
- Se analizó Lipgo a fondo (stack, `cabeceraoc`/`detalleoc`, `invtrans`/`saldoinvdetalle`, `pedidoscabecera`/`pedidosdetalle`, `citasvehiculos`, `qrestibacabecera`/`qrestibadetalle`, patrón de multi-empresa vía `idempresa`).
- Se diseñó el modelo completo de arriba, adaptando lo reutilizable y dejando fuera lo que no aplica (RRHH, SST, ISO9001, nómina de Lipgo).
- Decisiones confirmadas con el usuario vía preguntas puntuales: JWT sin tabla de sesiones, rutas por módulo, IDENTITY en vez de MAX(id)+1, un lote activo por galpón, un pedido por bodega.

### Módulo 1 — Galpones y lotes de aves ✅ verificado
- `lib/galpones-actions.ts`, `lib/granjas-actions.ts`, `lib/lotes-aves-actions.ts`.
- `components/galpones/galpones-view.tsx` (CRUD con alta rápida de granja).
- `components/aves/aves-view.tsx` (ingreso, traslado, salida por mortalidad/sacrificio, historial, edad en vivo).
- Rutas: `/galpones`, `/aves`.
- **Bug encontrado y corregido en verificación**: `formatearFechaColombia` corría un día hacia atrás las fechas puras `YYYY-MM-DD` (parseaba con `new Date()` + timezone). Se corrigió para reformatear el string directamente sin pasar por `Date()`.

### Módulo 2 — Recolección y lotes de huevo ✅ verificado
- `lib/bodegas-actions.ts`, `lib/anaqueles-actions.ts` (se adelantaron del Módulo 3 porque `lotes_huevo` necesita una bodega destino).
- `lib/recoleccion-actions.ts` (galpones con lote activo + edad en vivo, generación de código `AAAAMMDD-###` con reintento ante colisión, registro de cantidades por referencia + averías).
- `lib/lotes-huevo-actions.ts` (listado + detalle/trazabilidad).
- `components/bodegas/bodegas-view.tsx`, `components/recoleccion/recoleccion-view.tsx` (mobile-first, botones grandes, toggle campo/clasificadora), `components/lotes-huevo/lotes-huevo-view.tsx`.
- Rutas: `/bodegas`, `/recoleccion`, `/lotes-huevo`.
- Averías de recolección se registran **por separado** de las cantidades buenas (no descuentan inventario, son solo tally informativo).

### Módulo 3 — Traslados y cargue/descargue ✅ verificado
- `lib/tarifas-actions.ts`, `lib/traslados-actions.ts` (el más grande: solicitud → genera orden de cargue automática → picking FIFO por fecha de cosecha → confirma cargue con peso automático y descuento de inventario → genera orden de descargue prellenada → confirma descargue con diferencias = averías + tarifa aplicada).
- `components/tarifas/tarifas-view.tsx`, `components/traslados/traslados-view.tsx`, `components/traslados/ordenes-cargue-view.tsx` (lista reutilizada para cargue y descargue), `components/traslados/cargue-detalle-view.tsx`, `components/traslados/descargue-detalle-view.tsx`.
- Rutas: `/tarifas`, `/traslados`, `/cargue`, `/cargue/[id]`, `/descargue`, `/descargue/[id]`.
- **Bug encontrado y corregido en verificación**: inputs de Placa/Conductor sin `id`, rompiendo la asociación con su `<Label>` (accesibilidad).
- **Mejora aplicada**: se agregó la etapa (recolección/recepción) junto a cada avería en el detalle del lote de huevo, para distinguir de un vistazo dónde ocurrió cada una.

### Módulo 4 — Pedidos, picking y despacho ✅ verificado
- `lib/clientes-actions.ts` (CRUD mínimo), `lib/catalogo-actions.ts` (editar `imagen_url` por referencia — sin subida de archivos, solo URL pegada; Lipgo usa Vercel Blob para esto pero no se configuró aquí).
- `lib/pedidos-actions.ts` (`crearPedido` genera automáticamente la orden de despacho igual que `crearSolicitudTraslado`; `confirmarFinDespacho` descuenta inventario y cierra el pedido, **sin** generar una orden de recepción — a diferencia de traslados, el despacho es de un solo lado porque el destino es un cliente externo; `registrarAveriaDespacho` registra averías etapa=`despacho` sin afectar inventario, igual criterio que las averías de recolección).
- Se **generalizó** `obtenerOrdenConDetalle` (en `lib/traslados-actions.ts`) para traer también `pedido` (antes solo `solicitud`), y se generalizó `generarCodigoOrden` para aceptar prefijo `PED`.
- Se **reutilizó** `components/traslados/cargue-detalle-view.tsx` para el picking de despacho (mismo componente sirve para `cargue_traslado` y `cargue_despacho`, ramifica en la función de cierre y en textos de UI) en vez de duplicar un componente nuevo.
- `components/clientes/clientes-view.tsx`, `components/catalogo/catalogo-view.tsx`, `components/pedidos/pedidos-view.tsx`.
- Rutas: `/clientes`, `/catalogo`, `/pedidos`, `/despachos`, `/despachos/[id]` (esta última reusa `CargueDetalleView`, igual que `/cargue/[id]`).
- **Bug encontrado y corregido en verificación**: `listarReferenciasHuevo()` no tenía `ORDER BY`, así que el orden de las 8 referencias en los formularios de recolección y pedidos no estaba garantizado (en una corrida salió "AA Rojo" antes que "A Rojo"). Se agregó `.order("id")`.

### Módulo 5 — Punto de venta / venta directa ✅ verificado
- `lib/ventas-actions.ts`: `obtenerInventarioDisponiblePorBodega` (suma `inventario_huevo` por referencia, sin exponer lotes al cajero), `crearVentaDirecta` (a diferencia del picking de despacho/traslado, aquí el FIFO es **automático**: la función misma reparte la cantidad vendida entre los lotes más antiguos de esa referencia sin pedirle al usuario que elija — coherente con que un punto de venta es una transacción rápida de mostrador, no un despacho logístico formal), `listarVentasDirectas`.
- `components/ventas/ventas-view.tsx`: selector de bodega → muestra inventario disponible por referencia → cliente opcional (vacío = "venta de mostrador") → cantidad + precio opcional por referencia → historial de ventas debajo.
- Ruta: `/ventas`.
- Sin bugs nuevos encontrados en la verificación; los números de inventario cuadraron exactamente con lo esperado dado el estado acumulado de las pruebas anteriores.

### Módulo 6 — Indicadores y reportes ✅ verificado
- `lib/indicadores-actions.ts`: como PostgREST no soporta agregaciones `GROUP BY`/`SUM` arbitrarias vía `supabase-js`, cada función trae las filas crudas (con los filtros que sí puede aplicar) y agrega en JS con `Map`/`reduce`. Aceptable al volumen de datos esperado de Avimol; si el volumen crece mucho convendría mover esto a vistas SQL o RPCs.
  - `obtenerInventarioActual()`: agrupa `inventario_huevo` por bodega+referencia con edad promedio ponderada.
  - `obtenerVentasPuntoVenta(fechaInicio?, fechaFin?)` y `obtenerPedidosPeriodo(fechaInicio?, fechaFin?)`: unidades, ingresos y precio promedio, con filtro de rango de fechas vía `!inner` join de PostgREST sobre la tabla cabecera (`ventas_directas.fecha` / `pedidos.fecha_pedido`). **Nota**: "Pedidos de clientes" refleja lo *pedido*, no necesariamente lo ya despachado (ver limitación de `pedido_detalle_id` anotada en el Módulo 4).
  - `obtenerAverias()`: totales por etapa y por tipo, histórico completo, más el cruce `porEtapaYTipo` (etapa × picado/roto/partido) para la gráfica apilada.
  - `obtenerTiemposLogisticos()`: promedio de espera de vehículo, duración de cargue y duración de descargue, agrupado por `tipo_operacion` de `ordenes_cargue`.
  - `obtenerProduccionPorGalpon()`: cantidad cosechada y edad promedio ponderada, agrupado por galpón (vía `lotes_huevo_detalle` → `lotes_huevo` → `galpones`).
  - `VentasResumen` (usado por ventas PDV y pedidos) incluye además `porColor`, `porCliente` (top 10) y `porBodega`.
- `components/indicadores/indicadores-view.tsx`: filtro de fecha (aplica solo a Ventas y Pedidos, el resto son acumulados históricos — se explicita en la UI para que no genere confusión), tarjetas de resumen + tablas por sección, gráficas, comparativo entre periodos y exportación a Excel.
- Ruta: `/indicadores`.
- Verificado que los números cruzan correctamente entre módulos (p. ej. el inventario de "Clasificadora Principal" después de todas las pruebas anteriores de traslados/despachos/ventas coincidió exactamente con lo esperado).

### Ronda 2 del Módulo 6 — gráficas, más desgloses, comparativo y exportar a Excel ✅ verificado
A petición del usuario, se amplió el dashboard de indicadores con 4 mejoras:

- **Paleta de gráficas revalidada**: la paleta cromática original de `globals.css` (`--chart-1..5`, tonos ámbar/verde apagado) **falló la validación** del skill de dataviz (`scripts/validate_palette.js`): `#ffc107` fuera de la banda de luminosidad y bajo contraste, `#4C8577` por debajo del piso de croma (se lee gris). Se reemplazó por la paleta categórica de referencia del skill (azul/aqua/amarillo/verde/violeta/rojo), revalidada contra las superficies reales de tarjeta de la app (`#ffffff` claro / `#241d16` oscuro) — **todos los checks pasan** en ambos modos. `--primary` (ámbar, marca) no se tocó, solo los `--chart-*`.
- **Gráficas** (`components/indicadores/charts.tsx`, recharts vía el wrapper `components/ui/chart.tsx` ya copiado de Lipgo): siguiendo el skill, las gráficas de una sola serie (ventas por referencia, pedidos por referencia, producción por galpón) usan **un solo color** para todas las barras — colorear cada barra distinto ahí sería un anti-patrón (value-ramp sobre categorías sin orden natural). La única gráfica con color categórico real es "Averías por etapa" (barras apiladas por picado/roto/partido, 3 series legítimas, con leyenda).
- **Más desgloses**: `VentasResumen` (ventas PDV y pedidos) ahora trae también `porColor`, `porCliente` (top 10) y `porBodega`, mostrados como tablas junto a cada sección.
- **Comparativo entre periodos**: si el usuario fija Desde/Hasta, se calcula automáticamente el periodo anterior de igual duración (`calcularPeriodoAnterior` en el componente) y se muestra el % de variación en las tarjetas de Ventas y Pedidos. Si el periodo anterior no tiene datos (división por cero), se muestra "n/d" en vez de un porcentaje inventado — verificado que este es el comportamiento correcto, no un bug (los datos de prueba están todos fechados alrededor de hoy).
- **Exportar a Excel** (`lib/export-excel.ts`, paquete `xlsx` — el mismo que usa Lipgo): arma un solo libro con una hoja por sección, enteramente en el cliente (los datos ya están cargados en el dashboard, no hace falta ir al servidor) y dispara la descarga con `XLSX.writeFile`.
- Verificado con Playwright: gráficas SVG renderizando (7 en la página), desgloses visibles, comparativo mostrando "n/d" correctamente, y el archivo `.xlsx` descargado se releyó programáticamente para confirmar que las 6 hojas tienen los datos correctos.

### Consolidación de carpeta — proyecto movido a `C:\Users\Personal\Avimol`
El usuario pidió traer todo el código de `avimol-huevos` a `C:\Users\Personal\Avimol` y borrar lo que no correspondiera a Avimol. Se le advirtió que esa carpeta no era un repo git y que contenía, además del código de Lipgo, documentos reales de negocio (contratos, matrices SST, evaluaciones legales de Indupan/La Insuperable/LIP) — confirmó el borrado permanente. Antes de borrar, se preservaron los 4 scripts SQL (`scripts/avimol/001-004`) que vivían dentro de la carpeta de Lipgo. Luego se movió el código fuente (sin `node_modules`/`.next`, regenerados con `pnpm install` en el nuevo sitio) y se actualizaron las rutas en este documento y en `package.json`. **Bug operativo real encontrado en el proceso**: había **1420 procesos `node` huérfanos** (workers de PostCSS de reinicios anteriores del servidor de desarrollo, nunca cerrados al matar solo el proceso que escuchaba el puerto) bloqueando el borrado de la carpeta vieja — se identificaron por su línea de comando y se mataron todos antes de continuar. Desde entonces el proyecto vive en `C:\Users\Personal\Avimol` y corre en el puerto **3000** (antes 3210; se liberó el puerto 3000, que estaba ocupado por otro proyecto del usuario, `easycountcolmena`, con su confirmación explícita).

### Navegación estilo Lipgo — Sidebar + tarjetas de módulos por color
El usuario pidió que el formato visual se pareciera a la estructura original de Lipgo (Sidebar + MainContent + tarjetas de color por grupo), eligiendo el cambio de arquitectura de navegación completo (no solo ajuste de estilo). Como el código de Lipgo ya no existe (se borró en la consolidación anterior), esto se reconstruyó a partir de lo documentado en la Fase 0, no copiado del original:

- `lib/dashboard-data.ts`: los 17 módulos existentes agrupados en 5 grupos (Aves, Cosecha, Bodegas y logística, Comercial, Indicadores), cada uno con un color de la paleta categórica ya validada en `app/globals.css` (`--chart-1..5`) — mismo criterio de "un color fijo por entidad" del skill de dataviz, no colores inventados aquí.
- `components/sidebar.tsx`: reemplaza a `AppNav` (eliminado). Sidebar izquierdo fijo, colapsable (icon-only), con cada grupo como sección plegable (todas abiertas por defecto) y resaltado de la ruta activa.
- `components/module-cards.tsx`: nueva página de inicio con tarjetas de color por grupo (en vez de la lista plana de 17 módulos), mismo efecto hover/halo que `ModuleCards` de Lipgo.
- `app/(app)/layout.tsx` y `app/(app)/page.tsx` actualizados para usar estos dos componentes. **Las rutas de cada módulo no cambiaron** — solo el chrome de navegación alrededor; sigue sin ser un shell SPA de cambio de vista por estado.
- Verificado con Playwright: la navegación desde las tarjetas del inicio y desde el sidebar sí funciona (usando `waitForURL`, no esperas fijas) — los primeros intentos de prueba parecían fallar por el mismo patrón de flakiness de esta sesión (primera compilación de una ruta bajo webpack tarda unos segundos y una espera fija corta no alcanza a verla), no por un bug real.

### Tema de color original de Lipgo restaurado
El usuario pidió recuperar el tema de color que tenía Lipgo originalmente (el de Avimol propio, acento ámbar `#C77D2E`, se había inventado en la Fase 2). Se restauraron en `app/globals.css` los valores exactos de Lipgo (capturados del análisis de Fase 0, ya que el código de Lipgo no existe en disco): fondo `#F4F7FC` claro / `#1a1d20` oscuro, acento cian `#5bc0de`, tarjeta `#ffffff` claro / `#212529` oscuro, bordes `#dee2e6`/`#495057`, etc. — todo el tema de UI (`--background`, `--primary`, `--sidebar-*`, etc.).

**Decisión deliberada que NO siguió el pedido al pie de la letra**: los `--chart-1..6` (colores de las gráficas de Indicadores) **no** se revirtieron a los originales de Lipgo (`#5bc0de, #0dcaf0, #198754, #ffc107, #fd7e14`) porque ese set ya había fallado la validación de accesibilidad del skill de dataviz (ver Ronda 2 del Módulo 6) — revertirlo reintroduciría el mismo problema de contraste/croma en las gráficas reales. Se mantuvo la paleta categórica ya validada, y se revalidó contra la nueva superficie de tarjeta oscura de Lipgo (`#212529`, antes `#241d16`) — sigue pasando todos los checks. Si el usuario insiste en el set original exacto para las gráficas también, habría que aceptar conscientemente ese defecto de accesibilidad.

### Ronda 2 del tema — usuario compartió los archivos originales de Lipgo (globals.css, layout.tsx, page.tsx)
El usuario pegó el contenido literal de esos 3 archivos y pidió aplicar colores/layout/tipografía para que quedara "muy similar". Se aplicó lo siguiente:

- **`--chart-1..5` sí se revirtieron esta vez** a los valores exactos originales de Lipgo (`#5bc0de, #0dcaf0, #198754, #ffc107, #fd7e14`) — el usuario reafirmó el pedido pegando el archivo literal, así que esta vez se honró completo. **Pero solo para uso decorativo** (tints de `lib/dashboard-data.ts`: sidebar y tarjetas de módulo).
- Para no reintroducir el problema de accesibilidad en datos reales, se creó un namespace **separado** `--viz-1..6` (mismo valor que la paleta ya validada) que alimenta **exclusivamente** `components/indicadores/charts.tsx` (las gráficas reales de ventas/pedidos/averías/producción). Registrado también en `@theme inline` como `--color-viz-1..6`. Esto resuelve la tensión: fidelidad visual de marca donde es puramente cosmético, accesibilidad garantizada donde hay datos reales que leer.
- **Bug de tipografía real encontrado y corregido**: `app/layout.tsx` nunca invocaba `Geist()`/`Geist_Mono()` de `next/font/google`. `globals.css` ya referenciaba `--font-sans: 'Geist', 'Geist Fallback'` desde el inicio, pero como esas fuentes nunca se registraban, el navegador caía a su sans/serif por defecto — por eso los títulos se veían con una tipografía distinta a la de Lipgo. Se corrigió replicando el patrón exacto de Lipgo: invocar `Geist({subsets:["latin"]})`/`Geist_Mono(...)` a nivel de módulo (el efecto secundario de la invocación registra el `@font-face` con esos nombres exactos — no hace falta usar `.className` ni `.variable`) y `className="font-sans antialiased"` en `<body>`. Verificado con Playwright: `getComputedStyle(h1).fontFamily` ahora devuelve `"Geist, \"Geist Fallback\""`.
- **Lo que NO se adoptó de `page.tsx`** (por alcance, no por descuido): el árbol de componentes de Lipgo (`MainContent`, `SplashScreen`, `LipbotDock`, `GlobalLocationScheduler`, `AuthProvider` basado en Supabase Auth, watermark `LipGoBG.png`) depende de infraestructura y assets que Avimol no tiene y que rompería decisiones ya tomadas (routing real de Next.js en vez de un switch de vistas por estado, auth JWT propio en vez de Supabase Auth). Si el usuario quiere específicamente alguno de esos elementos (pantalla de bienvenida tras login, marca de agua de fondo, etc.) hay que pedirlo explícitamente y se construye una versión propia para Avimol, no una copia literal.

### Ronda 3 del tema — reemplazo por el `globals.css` neutro de `styles/` (de un zip de respaldo de LIPGO-main)
El usuario resultó tener un zip de respaldo completo de Lipgo (`LIPGO-main.zip`, extraído en una carpeta temporal) — contradice lo asumido en la "Ronda 2 del Módulo 6"/consolidación de carpeta, donde se dijo que el código de Lipgo ya no existía en ningún lado; sí existía este respaldo aparte. De ahí pegó `styles/globals.css` (no `app/globals.css`, el que sí se había leído y aplicado antes) y pidió aplicarlo tal cual. Es el tema **neutro/gris por defecto de shadcn** (oklch, sin el cian `#5bc0de` de marca) — probablemente un archivo vestigial de Lipgo que quedó del scaffolding inicial y nunca se usó en producción (Next.js solo importa el `globals.css` referenciado en `app/layout.tsx`, que en Lipgo apunta a `app/`, no a `styles/`).

Se aplicó tal cual se pidió: `--background/--primary/--secondary/--muted/--accent/--border/--sidebar-*` ahora son los valores oklch neutros (blanco/negro/gris, `--radius` volvió a `0.625rem`). Se avisó del contraste con el cian recién restaurado antes de aplicar. **Se mantuvo la misma separación `--chart-*` (decorativo) / `--viz-*` (gráficas reales, validado)** de la ronda anterior — el archivo pegado no traía nada de `--viz-*` porque es una adición propia de este proyecto, no de Lipgo. Verificado visualmente con Playwright: fondo blanco, botones negros, tints de grupo coloridos en el sidebar, gráficas de Indicadores con su paleta accesible intacta.

### Ronda 4 del tema — carpeta completa `C:\Users\Personal\Documents\lipgo` (backup real, autoritativo) + patrones visuales de componentes
El usuario reveló una tercera fuente: una copia completa y real de Lipgo en `C:\Users\Personal\Documents\lipgo` (no un zip, la carpeta ya extraída — el mismo código que existía en `C:\Users\Personal\Avimol` antes de borrarlo). Esto permitió leer el **`app/globals.css` autoritativo** (el que Next.js realmente importa, a diferencia de `styles/globals.css` de la Ronda 3) y confirmar que el tema real de Lipgo **es el cian `#5bc0de`**, no el neutro. Se restauró `app/globals.css` de Avimol a esos valores exactos (background `#F4F7FC`, card `#ffffff`, primary/accent `#5bc0de`, `--radius: 0.75rem`), manteniendo igual la separación `--chart-*` (decorativo, valores de marca) / `--viz-*` (gráficas reales, paleta validada).

El usuario además pidió replicar cómo están organizados visualmente los componentes (tarjetas, tablas, etc.), no solo los colores. Se lanzó un agente Explore de solo-lectura sobre `C:\Users\Personal\Documents\lipgo\components\*.tsx` (dashboards, tablas, sidebar, top-bar, forms, module-cards) para extraer las convenciones Tailwind concretas. Del reporte se aplicaron a Avimol los patrones de mayor impacto y aplicabilidad real (inicialmente se **descartó** copiar el re-skin oscuro "Torre de Control" del sidebar por considerarlo marca propia de ese módulo — el usuario lo pidió de todas formas poco después, ver Ronda 5 más abajo):

- **`components/module-cards.tsx`**: ajustado a las medidas exactas de Lipgo (`border-radius:18px`, icono `46px`/`14px`, grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3/gap-4`) y se agregaron los dos efectos que faltaban: el borde-halo animado (`::before` con `mask-composite:exclude`) y la transformación del icono al hover (`scale(1.06) rotate(-3deg)` + fondo degradado + icono blanco). Encabezado de la página de inicio ajustado a `"mb-3 flex items-baseline gap-2 sm:mb-5"` con el mismo formato "Título · subtítulo".
- **`StatCard` de Indicadores** (`components/indicadores/indicadores-view.tsx`): reescrito al patrón de "tarjeta de dashboard" de Lipgo — `rounded-2xl border border-border bg-card p-4 sm:p-5`, eyebrow `text-xs font-bold uppercase tracking-widest text-muted-foreground`, número grande `text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight` (antes era un `Card`/`CardContent` genérico con número en `font-bold` simple).
- **`components/ui/estado-badge.tsx` (nuevo)**: componente compartido que mapea cada valor de `estado` a la convención de color de Lipgo — verde sólido (`bg-green-600 text-white`) para estados terminales positivos (cerrado/recibido/despachado/activo), ámbar suave (`bg-amber-100 text-amber-700`) para pendiente, cian suave (`bg-sky-100 text-sky-700`) para en curso, destructivo para anulado. Reemplazó los `<Badge variant="secondary">` genéricos en las 7 vistas que muestran estado o activo/inactivo (galpones, bodegas, clientes, tarifas, pedidos, traslados, órdenes de cargue/descargue).
- **`components/ui/table.tsx`**: `TableHeader` ahora lleva `bg-muted/50` por defecto (antes transparente), igual convención que las tablas de Lipgo (`inventory-balance-details.tsx`, `attendance-table.tsx`).
- Verificado visualmente con Playwright en Galpones, Pedidos, Traslados e Indicadores: badges verde/ámbar correctos, tarjetas de indicadores con el nuevo estilo, sidebar con los tints exactos.

### Ronda 5 del tema — sidebar oscuro "Torre de Control" (colores exactos, marca propia de Avimol)
El usuario recordó que el sidebar real de Lipgo tiene un re-skin oscuro propio (confirmado leyendo `C:\Users\Personal\Documents\lipgo\components\sidebar.tsx`, sección `.lipgo-sb`): fondo degradado azul marino `linear-gradient(180deg,#0b2138,#071a30)`, texto blanco, acento cian con glow `#00c2dc`, más un "hero" animado (red de nodos SVG, glifo temático por módulo que cambia según el área activa, logo "L" con glow, tag "Torre de Control · en vivo"). Pidió explícitamente los **mismos colores exactos**, pero con marca/logo propios de Avimol, no el logo ni el gráfico de red de Lipgo.

Se implementó en `components/sidebar.tsx`:
- Clase `.avimol-sb` que redefine **`--sidebar-*`** (no `--card`/`--background` como hace Lipgo) porque nuestro `Sidebar` ya usa consistentemente el namespace `--sidebar-*` de shadcn — mismo resultado visual, arquitectura más correcta: `--sidebar:#0b2138`, `--sidebar-foreground:#ffffff`, `--sidebar-primary/--sidebar-ring:#00c2dc`, `--sidebar-accent:#1c4a72`, `--sidebar-border:#1b3350`, mismo `background-image` degradado.
- Zona "hero" del encabezado (antes plana) ahora con el mismo glow radial (`.avimol-hero`, `radial-gradient` con `--hero` = tinte del grupo activo o cian por defecto) que usa Lipgo, pero **sin** el SVG de red animado ni el glifo adaptativo por módulo (se consideró trabajo de ilustración a medida fuera de alcance para "los mismos colores").
- Logo propio: `.avimol-logo-mark` (mismo tratamiento visual — caja `30px` con gradiente `#0a3f6e→#00c2dc` y glow — pero con el ícono de huevo (`lucide Egg`) en vez de la "L" de Lipgo, y wordmark "Avimol" en vez de "LIPgo"). Sin la etiqueta "Torre de Control · en vivo" (mensaje específico de Lipgo, no se inventó un equivalente).
- Verificado visualmente con Playwright en modo expandido y colapsado: fondo oscuro, texto blanco, badges de color de cada grupo destacando bien sobre el fondo oscuro, logo con glow correcto.

### Ronda de UX general — layout maestro-detalle, toasts, búsqueda y accesos rápidos (sin tocar colores)
El usuario pidió un ajuste general para que los módulos se vieran "de clase mundial" en UX — formulario junto al historial, más botones de acceso, más intuitivo — **sin cambiar colores ni tema**. Cambió también el nombre de "cosecha" a "recolección" en textos visibles (grupo del sidebar, tablas, exportación, gráfica), sin renombrar la columna `fecha_cosecha` de la BD (etiqueta interna, migración innecesaria).

**Componentes compartidos nuevos** (todos en `components/ui/`):
- `page-header.tsx` — título + subtítulo + zona de acciones (chips y botones de acceso rápido a módulos relacionados).
- `form-card.tsx` — tarjeta de formulario con barra de título `bg-primary` (misma convención de formularios de Lipgo: order-entry-form/bascula-form).
- `stat-chip.tsx` — chip compacto de estadística (patrón StatCard del dashboard-header de Lipgo).
- `empty-state.tsx` — estado vacío con icono/título/descripción, diferenciando "sin datos" vs "sin resultados de búsqueda".
- `search-input.tsx` — input con lupa para filtrado client-side.
- Toaster global (sonner, ya copiado de Lipgo) montado en `app/(app)/layout.tsx`; todos los guardados/errores ahora disparan `toast.success/error`.

**Patrón maestro-detalle** (grid `lg:grid-cols-[360-420px_1fr]`, formulario sticky a la izquierda, historial con búsqueda + botón refrescar + EmptyState + skeletons a la derecha) aplicado a: **Galpones** (con edición in-place: el lápiz de la fila carga el formulario en modo edición y resalta la fila), **Lotes de aves** (además: switch "Incluir cerrados" que aprovecha el parámetro `soloActivos` de `listarLotesAves`, acciones deshabilitadas si el lote no está activo, columna Estado nueva), **Bodegas**, **Clientes**, **Tarifas**, **Pedidos**, **Traslados** y **Punto de venta** (estos tres últimos ya no usan Dialog para crear: el formulario vive fijo al lado del historial).

**Otros**: Recolección ahora es un flujo guiado con pasos numerados 1-4 (componente `Paso` local, círculos con número — mínima lectura para operarios de campo); Lotes de huevo y las listas de órdenes (cargue/descargue/despachos) recibieron PageHeader con chips, búsqueda y subtítulos explicativos por tipo de operación; Catálogo recibió PageHeader + toast. Los botones de acción por fila pasaron de `ghost` a `outline` (más descubribles) y las columnas numéricas quedaron alineadas a la derecha con `tabular-nums`.

Verificado con Playwright end-to-end contra la BD real: crear galpón desde el formulario lateral (aparece en la tabla + toast visible), modo edición al hacer clic en el lápiz, búsqueda filtrando en vivo, chips de estadísticas calculando (aves activas 9.900, edad promedio), pasos numerados en recolección, y capturas de todos los módulos sin errores de consola. Quedó un galpón de prueba `G-UX####` creado en la BD real durante la verificación (consistente con la política del usuario de conservar datos de prueba).

### Pendiente
7. QR (a futuro): columnas `codigo_qr` ya reservadas en `anaqueles` y `lotes_huevo`, sin implementar lógica. Con esto se completaron **todos los módulos funcionales** del enunciado original (1 a 6).

### Ronda — gestión de anaqueles desde Bodegas
El usuario reportó que en Recolección aparecía el selector de "Anaquel" pero no había nada para elegir, y que no encontraba dónde se crean los anaqueles de una bodega. Diagnóstico: el selector y el campo de alta rápida en Recolección sí funcionaban (confirmado con Playwright), simplemente no existían anaqueles todavía en la BD para esa bodega — pero el alta rápida inline es fácil de pasar por alto y no hay ningún lugar dedicado a administrarlos.

Se agregó gestión completa de anaqueles al módulo **Bodegas**: nuevo botón (icono grid) por fila que abre `components/bodegas/anaqueles-dialog.tsx` — lista todos los anaqueles de esa bodega (activos e inactivos), permite crear uno nuevo (código + descripción opcional) y activar/desactivar con un botón. Nuevas server actions en `lib/anaqueles-actions.ts`: `listarTodosAnaquelesPorBodega` (incluye inactivos, a diferencia de la ya existente que solo trae activos) y `cambiarEstadoAnaquel`. El selector de Recolección ahora incluye una nota de texto señalando que los anaqueles también se administran desde Bodegas.

Verificado con Playwright: creación de anaquel desde el diálogo de Bodegas (aparece en la lista + toast), y desactivación (badge "Inactivo" visible).

### Ronda — módulo de Inventario (nuevo)
El usuario pidió un módulo de Inventario dentro de Bodegas: ver, por bodega, el saldo total de huevo por lote, tipo/color y demás, construido sobre las entradas y salidas ya registradas. El saldo (`avimol.inventario_huevo`) y el kardex (`avimol.movimientos_inventario_huevo`) ya existían en el esquema desde la Fase 1 y se venían actualizando transaccionalmente en cada acción de negocio (recolección, cargue/descargue de traslado, despacho, venta directa) — no hubo que tocar esa lógica, solo faltaba una pantalla para consultarlos.

**Nuevo**: `lib/inventario-actions.ts` — `listarInventario(bodegaId | null)` trae el saldo (`cantidad_disponible > 0`) enriquecido con bodega, lote (código, fecha de recolección, galpón), referencia (tipo + color) y anaquel; `listarKardexLote(loteHuevoId, referenciaId)` trae el historial de movimientos de esa combinación específica, para trazabilidad puntual.

**Nuevo**: `components/inventario/inventario-view.tsx` — filtro por bodega (o "Todas las bodegas"), búsqueda client-side, chips de estadísticas (total disponible, lotes distintos, referencias distintas), tabla con una fila por lote+referencia+anaquel, y un botón "Ver movimientos" por fila que abre un diálogo con el kardex de esa combinación (tipo de movimiento traducido a español, fecha/hora Colombia, cantidad en verde si es entrada / rojo si es salida).

Registrado en `lib/dashboard-data.ts` (grupo "Bodegas y logística", ícono `Boxes`, ruta `/inventario`) y en `app/(app)/inventario/page.tsx`. Bodegas ganó un botón "Ver inventario" junto a "Solicitar traslado" en su `PageHeader`.

Verificado con Playwright contra datos reales: la tabla muestra el lote `20260710-001` con sus 7 referencias en Bodega Huevos (986 huevos), el filtro por bodega funciona, la búsqueda sin resultados muestra el EmptyState correcto, y el diálogo de movimientos muestra la entrada por recolección real con su cantidad y fecha/hora.

### Ronda — la orden de cargue de un traslado pasa a "Entregado" al confirmar el descargue
Bug reportado por el usuario: cuando se finaliza el descargue de un traslado entre bodegas, la orden de cargue original (bodega origen) se quedaba para siempre en estado "En tránsito" — nunca reflejaba que la mercancía ya había llegado a destino. Confirmado en datos reales: `CAR20260710-001` seguía "En tránsito" aunque su `DES20260710-001` ya estaba "Cerrado" y la solicitud de traslado ya estaba "Recibido" desde una sesión anterior.

**Causa**: `confirmarFinDescargue` (`lib/traslados-actions.ts`) actualizaba el estado de la propia orden de descargue (`cerrado`) y de la solicitud de traslado (`recibido`), pero nunca tocaba la orden de cargue de origen que la generó.

**Fix**: se agregó `orden_cargue_origen_id` al `select` y al tipo `OrdenCargueCompleta` de `obtenerOrdenConDetalle`. Al final de `confirmarFinDescargue`, si la orden tiene `orden_cargue_origen_id`, se actualiza esa orden de origen a `estado: "recibido"`. Ese valor ya existía en el `CHECK` de `ordenes_cargue.estado` pero nunca se usaba a nivel de orden (solo a nivel de solicitud) — no hizo falta migración. En `components/traslados/ordenes-cargue-view.tsx` el label de `recibido` se cambió de "Recibido" a **"Entregado"** (con nota de código explicando que ese valor solo lo alcanza la orden de cargue de un traslado tras confirmarse el descargue); `EstadoBadge` ya pintaba `recibido` en verde sólido, sin cambios ahí.

**Dato histórico corregido**: como `CAR20260710-001` ya tenía su descargue cerrado desde antes del fix, se corrió un backfill puntual de una sola vez (`UPDATE ordenes_cargue SET estado='recibido' WHERE id=9`, ejecutado directo contra Supabase, no forma parte del código de la app) para que ese registro real reflejara el estado correcto sin esperar un nuevo ciclo.

Verificado con Playwright de punta a punta: solicitud de traslado → cargue → descargue completo → la orden de cargue de origen cambia sola de "En tránsito" a "Entregado" (verde) en la lista de `/cargue`, sin intervención manual.

### Ronda — Pedidos comercial, peso por referencia, disponibilidad en despacho, Gestión de vehículos
Cuatro mejoras planeadas juntas (modo plan + 3 agentes Explore en paralelo antes de tocar código), con decisiones de negocio confirmadas por el usuario antes de implementar. Requirió 3 migraciones nuevas que el usuario corrió a mano en el SQL Editor: `005_pedidos_comercial.sql`, `006_peso_por_referencia.sql`, `007_vehiculos.sql`.

**1. Pedidos — vendedor, fechas, condición de pago, N° OC, IVA/descuento, carrito con totales.** `avimol.pedidos` ganó columnas `vendedor_id`, `condicion_pago` (CHECK fijo: contado/credito_15/credito_30/credito_60), `numero_orden_compra`, `aplica_iva`, `iva_porcentaje` (default 19), `descuento_porcentaje`, y los snapshots `subtotal`/`valor_descuento`/`valor_iva`/`total` — mismo patrón que `valor_tarifa_aplicado` en `ordenes_cargue` (si el % de IVA cambia después, el pedido histórico conserva lo que realmente se cobró). Nuevo `lib/usuarios-actions.ts` con `listarVendedores()` (primer uso real del rol `vendedor`, que existía en el CHECK de `usuarios` pero nunca se usaba). `components/pedidos/pedidos-view.tsx` ganó los campos nuevos en el formulario y un panel "Resumen del pedido" que recalcula en vivo (sin ir al servidor) subtotal/descuento/IVA/total según lo que se va escribiendo, con un `Switch` para activar/desactivar IVA. **Bug real encontrado y corregido en el camino**: exportar un array (`CONDICIONES_PAGO`) desde un archivo `"use server"` rompe en runtime del lado cliente (`.map is not a function"`) — los módulos de server actions solo pueden exportar funciones async; la constante se movió al componente cliente.

**2. Peso editable por referencia (Catálogo).** Antes el peso usado para calcular `peso_total_kg` salía de `tipos_huevo.peso_promedio_gramos` (un solo valor por tipo A/AA/AAA/Jumbo, compartido entre colores). Ahora `referencias_huevo.peso_unitario_gramos` es editable por referencia individual desde `/catalogo` (nuevo input en el diálogo de edición, junto a la imagen), con backfill inicial desde el peso del tipo. Único punto de cálculo (`agregarLineaCargue` en `lib/traslados-actions.ts`, compartido por cargue de traslado y de despacho) cambiado para leer `referencias_huevo.peso_unitario_gramos` directo en vez de navegar a `tipos_huevo`. `confirmarFinCargue`/`confirmarFinDespacho` no se tocaron: ya sumaban el snapshot por línea, así que heredan el peso nuevo automáticamente.

**3. Disponibilidad verde/rojo + sugerencia de traslado en el despacho.** Al abrir una orden de despacho (`CargueDetalleView`, rama `esDespacho`), cada línea del pedido ahora muestra un badge verde "Disponible" o rojo "Faltan N" comparando contra el inventario real de la bodega que atiende. Si falta, se despliega un bloque con el stock en otras bodegas (`lib/traslados-actions.ts::obtenerDisponibilidadOtrasBodegas`, mismo patrón que `obtenerLotesDisponibles` pero sin filtrar bodega y agrupando por bodega, ordenado por total disponible descendente) con el detalle de lotes (código, fecha de recolección, cantidad) y un link directo a `/traslados`. Orquestado por `lib/pedidos-actions.ts::obtenerDisponibilidadPedido`. Decisión confirmada con el usuario: este check vive en el detalle de la orden de despacho (momento del picking), no en el formulario de crear pedido.

**4. Gestión de vehículos (módulo nuevo).** Nueva tabla `avimol.llegadas_vehiculo` (placa, conductor, hora de llegada, `orden_cargue_id` nullable — NULL = disponible). Nuevo módulo `/vehiculos` (`components/vehiculos/vehiculos-view.tsx`, patrón maestro-detalle) donde se registra cada llegada como una línea independiente. `CargueDetalleView` reemplazó los inputs de texto libre de placa/conductor por un `Select` poblado con `listarLlegadasDisponibles()`; al confirmar, `asignarVehiculoAOrden` copia placa/conductor/hora a la orden (igual que antes, mismo despliegue de solo lectura) y marca la llegada como usada (`orden_cargue_id`), por lo que deja de aparecer como seleccionable hasta que se registre una llegada nueva para esa placa. Se eliminó la función vieja `registrarLlegadaVehiculo(ordenId, placa, conductor)` de `lib/traslados-actions.ts` (corte limpio, un solo caller). Descargue no ganó selector propio — hereda el vehículo de la orden de cargue que lo generó (mismo viaje físico), decisión confirmada con el usuario.

Verificado con Playwright de punta a punta contra la BD real: pedido creado con vendedor/fecha programada/crédito 30 días/N° OC, carrito mostrando Total orden $25.000 → IVA 19% $4.750 → Total a pagar $29.750 (coincide con lo guardado en el historial); peso de "A Rojo" cambiado a 60g en Catálogo y el despacho de 20 unidades cerró con **peso total 1.20 kg** exacto (confirmando que ya no usa el peso viejo del tipo); línea "A Rojo" en verde "Disponible" y línea "AA Blanco" en rojo "Faltan 35" con sugerencia real (Clasificadora Principal 1.200 disponibles, Bodega Huevos 224, con lote y fecha); vehículo TST001 registrado, seleccionado y asignado a la orden, y confirmado como "En uso" (ya no seleccionable) en `/vehiculos` después de usarse.

### Ronda — Clasificación de huevos como proceso separado de la recolección, edad de gallina en todo inventario, picking por anaquel, catálogo visual
Rediseño grande planeado en modo plan (3 agentes Explore en paralelo + varias preguntas de arquitectura confirmadas con el usuario antes de tocar código). Requirió 2 migraciones nuevas: `008_inventario_no_clasificado.sql` y `009_traslado_edad_preferida.sql`.

**Decisión de fondo**: antes, Recolección clasificaba el huevo en tipo×color en el mismo momento de recolectar (escribía directo en `inventario_huevo`/`lotes_huevo_detalle`). Ahora Recolección solo captura **color** (Rojo/Blanco) y entra como **inventario no clasificado** — dos tablas nuevas paralelas, keyeadas por color en vez de por referencia: `avimol.inventario_huevo_sin_clasificar` (saldo) y `avimol.movimientos_huevo_sin_clasificar` (kardex). Se eligió NO reutilizar `referencias_huevo` con pseudo-productos "sin clasificar" para no ensuciar el catálogo real de productos vendibles.

**1. Recolección simplificada.** `DatosRecoleccion.cantidades` pasó de `{referenciaId, cantidad}[]` a `{colorId, cantidad}[]`; `registrarRecoleccion` (`lib/recoleccion-actions.ts`) ya no toca `lotes_huevo_detalle`/`inventario_huevo`/`movimientos_inventario_huevo`, solo `inventario_huevo_sin_clasificar`/`movimientos_huevo_sin_clasificar` (`entrada_cosecha`). El selector de bodega en el formulario (`components/recoleccion/recoleccion-view.tsx`) quedó filtrado a `tipo IN ('clasificadora','mixta')` vía nuevo `lib/bodegas-actions.ts::listarBodegasClasificadoras()` (hay más de una bodega clasificadora en los datos reales — "Bodega Huevos" y "Clasificadora Principal" — así que se mantuvo el selector en vez de fijar una sola bodega). Averías no cambiaron (ya se guardaban sin `referencia_huevo_id`).

**2. Clasificación de huevos (módulo nuevo).** Nuevas tablas `clasificaciones` (header: lote+color+anaquel origen+cantidad entrada) y `clasificaciones_detalle` (salidas: referencia+anaquel destino+cantidad); `averias_huevo` ganó `clasificacion_id` (el CHECK de `etapa` ya traía `'clasificacion'` reservado desde la Fase 1, sin usarse hasta ahora); `movimientos_inventario_huevo.tipo_movimiento` ganó el valor `'entrada_clasificacion'` (el inventario clasificado ya no nace solo de `entrada_cosecha`). Nuevo `lib/clasificacion-actions.ts::registrarClasificacion` exige que `Σsalidas + Σaverías === cantidadEntrada` exactamente (todo lo que entra debe quedar contabilizado), decrementa el saldo sin clasificar, y por cada salida hace upsert en `inventario_huevo` + `lotes_huevo_detalle` + insert en `movimientos_inventario_huevo`. Nuevo módulo `/clasificacion` (`components/clasificacion/clasificacion-view.tsx`, flujo guiado igual que Recolección: elegir bodega → elegir fila de inventario sin clasificar → repartir en referencias del mismo color con anaquel destino → averías opcionales → contador en vivo "Faltan por asignar"). Sidebar: nueva entrada "Clasificación" en el grupo Recolección.

**3. Edad de gallina + alerta de rebandejar en todo inventario.** Nuevo `lib/avicola-constants.ts` (`EDAD_REBANDEJAR_SEMANAS = 60`, `necesitaRebandejar()`) y `components/ui/alerta-rebandejar.tsx` (badge ámbar, solo se pinta si aplica). `edad_semanas_captura` (ya existía como foto fija en `lotes_huevo`) se propagó a `InventarioFila` (`lib/inventario-actions.ts`) y a `OrdenCargueDetalleLinea`/`LoteDisponible` (`lib/traslados-actions.ts`), y de ahí a columnas/badges en `/inventario`, "Líneas cargadas" de cargue, tabla de recepción de descargue, y la lista de inventario sin clasificar en Clasificación.

**4. Traslados y despacho: picking por lote y anaquel + edad preferida (informativa).** `solicitudes_traslado_detalle` ganó `edad_semanas_preferida` (nullable, decisión confirmada: es solo un orden de sugerencia para quien hace el picking, no filtra ni bloquea). `components/traslados/traslados-view.tsx` muestra, al escribir una cantidad, una vista previa en vivo de los lotes disponibles en la bodega origen (lote, fecha, edad + alerta, anaquel, disponible) vía `obtenerLotesDisponibles`, más un input opcional de edad preferida por línea. En `cargue-detalle-view.tsx` (compartido por cargue de traslado y de despacho): el `anaquel_codigo` de cada lote —que ya se traía pero nunca se pintaba— ahora se muestra; si la línea tiene edad preferida, los lotes se reordenan por cercanía a esa edad (con nota visible); `agregarLineaCargue` ahora recibe y guarda `anaquel_id` en `ordenes_cargue_detalle` (columna que ya existía, nunca se usaba). **Bug latente real corregido**: `agregarLineaCargue`, `confirmarFinCargue` y `confirmarFinDespacho` (`lib/pedidos-actions.ts`) buscaban/decrementaban `inventario_huevo` filtrando solo por bodega+lote+referencia, ignorando `anaquel_id` — si un lote estaba repartido en más de un anaquel, `.maybeSingle()` podía fallar o tomar la fila equivocada; se agregó el filtro de anaquel en las tres funciones.

**5. Descargue recibe en anaquel específico.** `LineaRecepcion` ganó `anaquelDestinoId`; `confirmarFinDescargue` ya no fuerza `anaquel_id: null` al recibir, usa el anaquel elegido por línea. `descargue-detalle-view.tsx` ganó un `Select` de anaquel por fila (poblado con `listarAnaquelesPorBodega` de la bodega destino) junto al de cantidad recibida.

**6. Dashboard clasificado vs no clasificado.** Se amplió `/inventario` (no una página nueva): nuevo chip "No clasificado" (`lib/inventario-actions.ts::obtenerTotalSinClasificar`) junto al ya existente (renombrado "Clasificado"), y un desglose por tipo×color calculado en el cliente sobre las filas ya cargadas.

**7. Catálogo visual en Pedidos y Punto de venta.** Nuevo `components/pedidos/catalogo-picker.tsx` (grid de tarjetas con imagen/fallback `ImageOff`, mismo patrón que el Catálogo admin, con cantidad y precio editables inline y borde resaltado cuando hay cantidad) reemplaza la grilla plana de inputs agrupada por tipo en ambos módulos. `pedidos-view.tsx` pasó de `listarReferenciasHuevo` a `listarCatalogoReferencias` (trae `imagen_url`/`peso_unitario_gramos`); `lib/ventas-actions.ts::obtenerInventarioDisponiblePorBodega` ganó `imagenUrl`/`pesoGramos` en el join. El estado `cantidades`/`precios` siguió keyeado por `referenciaId` en ambos, así que ninguna lógica de carrito/FIFO/totales cambió.

**8. Historial diario de recolección por galpón.** Nuevo `lib/recoleccion-actions.ts::listarRecoleccionPorDia()` — agrega en JS (mismo patrón que `indicadores-actions.ts`) las filas de `movimientos_huevo_sin_clasificar` con `tipo_movimiento='entrada_cosecha'` agrupadas por fecha+galpón; deliberadamente NO se calcula desde el saldo vivo (`inventario_huevo_sin_clasificar`), porque ese baja según se va clasificando y el total recolectado ese día es un hecho histórico fijo. Nueva página `/recoleccion/historial` (`components/recoleccion/historial-diario-view.tsx`), entrada de sidebar "Historial diario" en el grupo Recolección.

**Bug real encontrado y corregido en el camino**: exportar la constante `CONDICIONES_PAGO` desde `lib/pedidos-actions.ts` (un archivo `"use server"`) ya había roto en runtime del lado cliente en la ronda anterior — no relacionado con esta ronda, se reconfirmó que sigue arreglado (la constante vive en el componente cliente).

Verificado con Playwright de punta a punta contra la BD real, con reconciliación exacta de inventario en cada paso: recolección de 500 huevos rojos → aparece como "No clasificado"; clasificación de esos 500 en A Rojo (300) + AA Rojo (150) + avería rotos (50) → el desglose por tipo×color subió exactamente esos montos (777 = 400+77+300 en A Rojo, 1.450 = 1.100+200+150 en AA Rojo); traslado de 50 A Rojo con edad preferida 20 semanas desde Bodega Huevos hacia Bodega Venta → vista previa de lotes visible, nota "Ordenado por cercanía a la edad preferida" visible en el picking, columna Edad en líneas cargadas; descargue con selector de anaquel destino; inventario final reconciliado exacto (origen 300→250, destino +50). Catálogo visual confirmado con fotos reales en Pedidos y Punto de venta (incluye el peso 60g editado en la ronda anterior). Historial diario y filtro de bodegas en Recolección (excluye "Bodega Venta") verificados correctos.

### Ronda 6 — 7 observaciones del cliente: estantería, cartones, tipos de blanco, rotura/yema en recepción, consumidor final (2026-07-13)
El cliente revisó la app en uso real y pidió 7 ajustes puntuales sobre módulos ya construidos. Se investigó con 3 agentes Explore en paralelo antes de diseñar (inventario completo de "anaquel" en el código, estado exacto de `confirmarFinDescargue`/`descargue-detalle-view`, y el patrón de `tarifas_servicio_descargue` como precedente de costeo), y se confirmaron con el usuario los 4 puntos donde había más de una forma razonable de implementar algo (todas resueltas con la opción recomendada). Requirió 4 migraciones nuevas: `010_cartones.sql`, `011_referencias_blanco_nombres.sql`, `012_yema_bolsa_recepcion.sql`, `013_cliente_consumidor_final.sql`.

**1. "Anaquel" → "Estantería" (rename cosmético).** Mismo patrón que "Cosecha → Recolección": se cambió solo el texto visible al usuario (~20 strings en 10 archivos — JSX, placeholders, toasts, mensajes de error) sin tocar la tabla `avimol.anaqueles`, sus columnas ni ningún nombre de función/variable (`listarAnaquelesPorBodega`, `anaquelId`, etc. siguen igual).

**2. Consumo de cartones en Clasificación + inventario + costeo + indicador (módulo nuevo).** Decisión confirmada con el usuario: `cartones_calculados = CEIL(huevos_clasificados / 30)`. `lib/clasificacion-actions.ts::registrarClasificacion` calcula ese valor, suma los cartones extra que declare el usuario (motivo: refuerzo de cartones buenos / rotos / averiados, con observación compartida), valida que la bodega tenga saldo suficiente en `inventario_cartones` antes de confirmar, descuenta el saldo, snapshotea el costo unitario vigente (`obtenerCostoCartonVigente`, clon exacto del patrón de `tarifas-actions.ts`) y guarda el desglose en `clasificaciones_cartones_extra`. `components/clasificacion/clasificacion-view.tsx` ganó un "Paso 4: Consumo de cartones" que muestra el cálculo en vivo, los 3 inputs de extra y el stock disponible de la bodega actual con aviso si no alcanza. `/inventario` ganó una segunda pestaña "Cartones" (`Tabs` de shadcn) con ingreso manual (cantidad + costo unitario opcional, que si se llena define el nuevo costo vigente) y la tabla del indicador calculado-vs-usado. Decisión confirmada con el usuario: el inventario de cartones solo aplica a bodegas `clasificadora`/`mixta`.

**3. Tipos de huevo blanco renombrados ("Revoltura Blanca pequeña/mediana/Grande", "Jumbo Blanco").** Restricción real del esquema: `tipos_huevo.nombre` tiene `CHECK IN ('A','AA','AAA','Jumbo')` y esa fila es **compartida** entre Rojo y Blanco (mismo `tipo_id`) — no se puede dar un nombre distinto por color ahí sin romper Rojo. Se optó por renombrar solo `referencias_huevo.nombre` (el campo ya precomputado por fila) para las 4 referencias Blanco; `tipos_huevo`/`colores_huevo` internos siguen igual. Efecto colateral encontrado y corregido: 4 sitios de código reconstruían el nombre a mostrar concatenando `tipo_nombre + color_nombre` en vez de usar `referencia.nombre` directo, lo que habría mostrado "A Blanco" en vez de "Revoltura Blanca pequeña" — se corrigieron `inventario-view.tsx` (desglose agrupado por referencia en vez de tipo×color), `traslados-view.tsx` (grilla reagrupada por color en vez de tipo compartido), `catalogo-view.tsx` y `clasificacion-view.tsx` (label de salida usa `r.nombre` directo).

**4. Rotura y yema en recepción a bodega de venta + dashboard `/recepciones` (módulo nuevo).** Decisión confirmada con el usuario: el alcance es solo cuando la bodega **destino** de una recepción de traslado es tipo `venta` — entre clasificadoras sigue el flujo de siempre (una sola avería por línea, sin cambios). `averias_huevo` ganó `cantidad_yemas`/`cantidad_bolsas_yema` (migración 012). `obtenerOrdenConDetalle` ahora trae `bodega_tipo`; `confirmarFinDescargue` (`lib/traslados-actions.ts`) rama: si `LineaRecepcion.averias[]` viene con datos, inserta una fila de `averias_huevo` por línea (tipo Roto/Picado, con yemas/bolsas y observación); si no, sigue exactamente igual que antes (100% retrocompatible). `descargue-detalle-view.tsx` muestra, solo cuando `bodega_tipo === 'venta'` y hay faltante, un editor multi-línea de averías (agregar/quitar líneas) con reconciliación bloqueante (la suma debe igualar el faltante exacto) antes de poder confirmar. Nuevo `lib/recepciones-actions.ts::listarDashboardRecepciones()` agrega por orden de descargue cerrada: cargado/recibido/roto y `% rotura = Σroto/Σcargado` (promedio ponderado, no promedio simple de porcentajes, para no sesgar con recepciones chicas), más yemas/bolsas totales. Nuevo módulo `/recepciones` (sidebar, grupo "Bodegas y logística"): `StatChip`s, gráfica de barras de % rotura por recepción (`components/indicadores/charts.tsx::RoturaPorRecepcionChart`, un solo color `--viz-6`, siguiendo el mismo criterio de "una sola serie = un solo color" ya usado en Indicadores) y tabla completa con filtro de bodega y búsqueda.

**5. "Consumidor final" en Punto de venta.** Decisión confirmada con el usuario: se redujo el alcance del pedido original — **no se tocó el flujo de Despachos** (`cargue_despacho`), que ya requiere vehículo y picking formal. Se reforzó únicamente Punto de venta (ya era inmediato y sin vehículo): migración 013 siembra el cliente "Consumidor final" (idempotente), y `ventas-view.tsx` lo preselecciona automáticamente al cargar (dejando al cajero libre de cambiarlo por un cliente real).

**6. Recolección → bodega destino solo clasificadora/mixta (confirmación, sin cambios de código).** `listarBodegasClasificadoras()` ya filtraba `tipo IN ('clasificadora','mixta')` desde la ronda de Clasificación — verificado en vivo que sigue excluyendo bodegas tipo `venta`, no requirió ningún cambio.

Verificado con Playwright contra la BD real (después de que el usuario corriera las 4 migraciones): "Estantería" visible en el subtítulo de Clasificación; Catálogo mostrando exactamente "Revoltura Blanca pequeña/mediana/Grande" y "Jumbo Blanco" (lado Rojo intacto); ingreso manual real de 100 cartones a $350 c/u en "Bodega Huevos" — el saldo y el costo vigente se actualizaron en vivo, confirmando que `costos_carton`/`inventario_cartones`/`movimientos_cartones` funcionan de punta a punta; selector de bodega destino en Recolección mostrando solo las 3 clasificadoras, nunca "Bodega Venta"; Punto de venta abriendo con "Consumidor final" preseleccionado; `/recepciones` renderizando limpio con su estado vacío. Cero errores de consola/runtime en las 10+ páginas visitadas y `npx tsc --noEmit` limpio en todo el proyecto. **No se pudo probar de punta a punta el cálculo de cartones dentro de una clasificación real ni el editor multi-línea de averías en una recepción real** porque la BD no tenía, en el momento de la verificación, un galpón con lote de aves activo (necesario para generar inventario sin clasificar vía Recolección) ni una orden de descargue pendiente hacia una bodega de venta — limitación de datos de prueba, no de las páginas/módulos de Aves o Traslados que esta ronda no tocó. El usuario decidió no generar datos de prueba adicionales solo para cerrar esa verificación.

### Ronda 7 — 10 observaciones del usuario final: Averías, Cartones, Cargue invertido/parcial, Recepciones activas + Yemas, Ventas, Aves (2026-07-16)
El cliente (Jeffrey Jiménez) mandó un lote de 10 observaciones por WhatsApp tras usar la app en producción. Se investigó con 3 agentes Explore en paralelo (Averías/Cartones/Traslados/Descargue; Cargue de punta a punta; Recepciones/Ventas/Aves) y 1 agente Plan dedicado a las dos partes más grandes (Cargue invertido+parcial, y Recepciones/Averías/Yemas), y se confirmaron con el usuario 4 decisiones de arquitectura antes de tocar código. Requirió 2 migraciones: `014_cargue_parcial.sql`, `015_recepciones_averias_yemas.sql`.

**1. Módulo nuevo "Averías" (`/averias`, grupo Bodegas y logística).** No existía ningún lugar para ver `averias_huevo` completo — solo un agregado en Indicadores. Nuevo `lib/averias-actions.ts::listarAverias({bodegaId?, etapa?})` con columna **Origen** (mapeo de `etapa`); como la tabla no tiene `bodega_id` directo, se resuelve con prioridad `orden_cargue_id→ordenes_cargue.bodega_id` → `clasificacion_id→clasificaciones.bodega_id` → `lote_huevo_id→lotes_huevo.bodega_id` (fallback, solo preciso para recolección). Confirmado que las averías de Clasificación ya se insertaban bien con `etapa='clasificacion'` — solo faltaba la vista.

**2. Cartones: la tabla de `/inventario` → Cartones ahora es un kardex real.** Antes (`listarConsumoCartones`) solo mostraba salidas derivadas de clasificaciones, sin ingresos manuales. Nueva `listarMovimientosCartones(bodegaId)` lee `movimientos_cartones` completo (entrada_manual + salida_clasificacion + ajuste), y para las salidas hace join a `clasificaciones` para mostrar el detalle calculado/extra inline en la misma fila — una sola tabla resuelve el kardex y el detalle de consumo que antes eran cosas separadas.

**3. Cargue: flujo invertido + vehículo liberable + anular orden (el bug real reportado).** Antes se exigía asignar vehículo → "Iniciar cargue" → recién ahí aparecía el picking; si resultaba que no había producto para cargar, el vehículo quedaba atascado para siempre (no existía función de liberación). Ahora: `agregarLineaCargue` (`lib/traslados-actions.ts`) absorbe la responsabilidad de "iniciar cargue" — al agregar la primera línea, si `hora_inicio_cargue` es null, la fija sola y sube la solicitud/pedido a `en_picking`. El picking está disponible desde que se abre la orden, sin depender del vehículo. Nuevas `liberarVehiculoDeOrden` (`lib/vehiculos-actions.ts`) y `anularOrdenCargue` (segura: nunca se ha descontado inventario real hasta `confirmarFinCargue`/`confirmarFinDespacho`, así que anular solo borra líneas + libera vehículo + `estado='anulado'`). **Verificado en vivo contra un dato real ya atascado en producción** (`CAR20260716-002`, vehículo ABC123 asignado, 0 líneas cargadas — exactamente el bug descrito): "Liberar vehículo" lo devolvió a "Disponible" en `/vehiculos` de inmediato.

**4. Cargue parcial: cerrar vs. mantener pendiente + orden adicional.** Nueva `evaluarCierreOrdenCargue(ordenId)` (y su helper compartido `calcularProgresoCargue`, exportado para reusarlo desde `pedidos-actions.ts`) suma lo cargado en **todas** las órdenes no anuladas de una misma solicitud/pedido y calcula pendiente por referencia. `confirmarFinCargue`/`confirmarFinDespacho` ganaron un parámetro `accion: "cerrar" | "mantener_pendiente"` (recalculado y forzado a `"cerrar"` server-side si ya está completo, nunca confía en el cliente) que decide si la solicitud pasa a `cargado`/`cerrado` o a `cargado_parcial`/`despachado` (reusando los valores de estos dos últimos que ya estaban reservados en el CHECK de `pedidos.estado` desde la Fase 1). Nuevas `generarOrdenCargueAdicionalTraslado`/`Despacho` crean una segunda orden de cargue sobre la misma solicitud/pedido para el remanente (válido solo si no hay ya una orden abierta). En `cargue-detalle-view.tsx`, al pulsar "Finalizar" se evalúa el progreso primero; si no está completo, un `Dialog` muestra las líneas pendientes y ofrece los 2 botones.

**5. Páginas de detalle nuevas `/traslados/[id]` y `/pedidos/[id]`.** Resuelven dos pedidos del cliente a la vez: el ícono de "ver detalle" que faltaba en Traslados (ahora ícono `Eye`, como pidió explícitamente), y el "cuadro" de solicitado/despachado/pendiente + lista de órdenes por vehículo que pidió para Cargue. Nuevas `obtenerProgresoSolicitudTraslado`/`obtenerProgresoPedido` reusan `calcularProgresoCargue`. Se descubrió en el camino que **`components/pedidos/pedidos-view.tsx` nunca tuvo tabla de historial** (a diferencia de Traslados) — se agregó junto con el botón `Eye`. Se extrajo `lib/estado-labels.ts` (constantes puras `ESTADO_ORDEN_CARGUE_LABEL`/`ESTADO_SOLICITUD_TRASLADO_LABEL`/`ESTADO_PEDIDO_LABEL`) para no duplicar mapas de estado→texto en las 4 vistas que ahora los necesitan. `components/ui/estado-badge.tsx`: el color de `despachado` se cambió de verde (estado terminal, nunca usado hasta ahora) a ámbar, y se agregó `cargado_parcial` con el mismo ámbar — ninguno de los dos es un estado terminal positivo pese al nombre.

**6. Descargue simplificado + Recepciones pasa a ser un módulo de gestión de 2 pestañas.** Antes, `confirmarFinDescargue` hacía TODO en un solo paso atómico: confirmar cantidad recibida, pedir estantería destino, capturar avería (solo bodegas `venta`, con yema/bolsa), y acreditar inventario. Ahora Descargue **solo** confirma `cantidad_recibida` por línea (se quitó el selector de estantería y todo el editor de averías construido en la Ronda 6 — bajo riesgo confirmado: `anaquel_id`/avería ya eran nullable en todo el pipeline). Nueva pestaña **"Clasificar"** en `/recepciones`: `listarRecepcionesPendientesClasificar()` lista órdenes con `hora_fin_descargue` no nulo y `hora_clasificacion_averia` nulo; `confirmarClasificacionRecepcion(ordenId, líneas)` exige que `buenos+rotos+picados+partidos === cantidad_recibida` por línea (ahora con las 4 categorías, no solo roto/picado como en la ronda anterior), acredita los `buenos` a `inventario_huevo` (es la misma lógica que antes vivía en `confirmarFinDescargue`, movida aquí) e inserta el resto en `averias_huevo` (`etapa='recepcion'`). La pestaña **"Resumen"** es el dashboard de % rotura de la ronda anterior, movido tal cual sin tocar su lógica (por eso sus columnas Yemas/Bolsas quedan en 0 para recepciones nuevas — el dato real ahora vive en el inventario de yemas, no por recepción individual).

**7. Yemas — solo inventario esta ronda (decisión explícita del usuario, no integrado a Ventas/Pedidos todavía).** Desde `/averias`, las averías de etapa `recepcion` sin procesar son seleccionables (checkbox, solo si son de una misma bodega); `registrarProcesamientoYemas(bodegaId, averiaIds, cantidadYemas, observaciones)` clona el patrón exacto de `registrarIngresoCarton`: inserta `procesamientos_yema_averia`, marca las averías con ese id (evita doble conteo), upsert `inventario_yemas`, inserta `movimientos_yemas`. El nuevo flujo ya no vuelve a pedir "bolsas de yema" (solo "salieron tantas yemas") — las columnas históricas `cantidad_yemas`/`cantidad_bolsas_yema` de `averias_huevo` quedan sin usarse por código nuevo.

**8. Ventas: inputs de cantidad/precio arreglados + historial con detalle.** En `components/pedidos/catalogo-picker.tsx` (modo clásico, compartido con Pedidos), el bloque `flex` que ponía Cantidad y Precio lado a lado (cada uno a ~40px de ancho útil en un grid de 3 columnas) se cambió a `flex-col` — cada input a ancho completo de la tarjeta. `lib/ventas-actions.ts::listarVentasDirectas` ganó `unidades` (suma de detalle vía join); nueva `obtenerDetalleVenta(ventaId)`. Historial de ventas ganó columna "Unidades" y un ícono `Eye` que abre un `Dialog` con cantidad/precio/subtotal por línea y el total — antes solo se veía el total agregado de la venta.

**9. Aves: chips + nueva sección de indicadores con filtro de fecha.** `galpones-view.tsx` ganó chip "Inactivos". Nueva `lib/indicadores-actions.ts::obtenerIndicadoresAves(fechaInicio?, fechaFin?)`: capacidad vs. utilizada y edad promedio por galpón son una foto del momento actual (no se filtran por fecha, no tiene sentido); mortalidad y sacrificio sí se filtran por rango (`movimientos_aves`, `tipo_movimiento IN ('mortalidad','sacrificio')`) y su tasa se calcula contra `SUM(lotes_aves.cantidad_ingreso)` histórico de ese galpón (sin importar el estado actual del lote) como base. Nueva sección "Aves" en `/indicadores`, reusando el filtro Desde/Hasta ya existente y agregada también al export a Excel.

**Verificado con Playwright de punta a punta contra la BD real** (después de que el usuario corriera las migraciones 014 y 015), incluyendo escritura real en cada paso nuevo: `/averias` mostrando 7 averías reales con Origen correcto (Recolección/Clasificación); tab Cartones mostrando el kardex real (2 entradas manuales + 1 salida por clasificación con "Calculados 14 · Extra 3" inline); **el bug de vehículo atascado reproducido y corregido en un dato real de producción** (`CAR20260716-002`/ABC123); picking funcionando sin vehículo asignado (`AAA Rojo` sin stock mostró correctamente "Sin inventario disponible", no un error); `/traslados/2` mostrando Solicitado/Cargado/Pendiente (50/0/50 en ambas referencias) y la orden abierta con link a `/cargue/2`; `/pedidos` con su tabla de historial nueva mostrando `PED20260716-001` real; Recepciones → Clasificar procesando una recepción real (`DES20260716-001`, 3 líneas, 48 buenos + 2 rotos en una de ellas) — confirmado que los 48 buenos se acreditaron a inventario y los 2 rotos aparecieron en `/averias` con etapa Recepción; ese mismo roto procesado en yemas desde `/averias` (checkbox → 1 yema) y confirmado que dejó de ser seleccionable; historial de ventas mostrando Unidades y el diálogo de detalle con cantidad/precio/subtotal/total reales; sección Aves en Indicadores mostrando capacidad/ocupación/mortalidad/sacrificio/edad reales y distintos por galpón (G-03 con 79.8% de ocupación y 10 muertes, G-02 con 100 sacrificios). `npx tsc --noEmit` limpio en todo el proyecto durante todo el desarrollo.

---

## 5. Cómo levantar el entorno de desarrollo

```bash
cd C:\Users\Personal\Avimol
pnpm install
pnpm exec next dev --webpack -p 3210   # --webpack porque Turbopack crashea en este Windows
```

Requiere `.env.local` (ver `.env.example`) con:
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (mismo proyecto Supabase que Lipgo).
- `AVIMOL_JWT_SECRET` (cualquier string largo aleatorio).

Y en el panel de Supabase (una sola vez, ya hecho en este proyecto):
- Settings → API/Data API → Exposed schemas → agregar `avimol`.
- Correr `003_grants_avimol.sql`.

Login de prueba: usuario `admin`, contraseña `avimol2026` (cámbiala en producción).

### Datos de prueba que ya existen en la base real
Por las verificaciones end-to-end quedaron creados (a propósito, el usuario
pidió conservarlos): galpones `G-01`/`G-02`, lote de aves `LA-2026-001`,
bodega `Clasificadora Principal`, varias bodegas `Bodega Venta <timestamp>`,
lote de huevo `20260706-001` (500 A-Rojo + 300 A-Blanco, con averías de
picado/recolección, roto/recepción y roto/despacho), solicitudes/órdenes de
traslado de prueba, una tarifa de descargue de $50.000 fija, clientes
`Tienda La Esquina <timestamp>`, pedidos de prueba (uno cerrado exitosamente
por 50 A-Rojo, otro par sin poder despachar porque pedían AA Rojo sin
inventario — quedaron en estado "Cargando" indefinidamente, es esperado),
una imagen de ejemplo puesta en la referencia "A Rojo" del catálogo, una
venta directa de mostrador por 20 A-Rojo a $900 c/u, y (Ronda 6) un ingreso
manual real de 100 cartones a $350 c/u en la bodega "Bodega Huevos".

**Nota (Ronda 7)**: para esta ronda la base ya tenía datos reales de uso del
cliente (galpones `G-01`–`G-04`, bodegas `Bodega BUG`/`Bodega Bqulla`/
`Clasificadora 01`/`Clasificadora 02`, órdenes de traslado en curso, etc.).
La verificación se hizo directamente sobre esos datos reales en vez de crear
datos de prueba nuevos, incluyendo escrituras reales: se liberó el vehículo
`ABC123` de la orden `CAR20260716-002` (estaba atascado desde antes de esta
ronda — el bug real que motivó la Fase D), se clasificó por completo la
recepción `DES20260716-001` (48 buenos + 2 rotos de A Rojo, 30 buenos de AA
Rojo, 10 buenos de A Rojo — el inventario y la avería de recepción quedaron
acreditados de verdad), y se procesó 1 yema a partir de esos 2 rotos.

---

## 6. Verificación (metodología usada en cada módulo)

Cada módulo se verificó **contra la base de datos real** (no mocks) usando
Playwright headless (instalado en el scratchpad de la sesión, no es
dependencia del proyecto) conduciendo el flujo completo en el navegador:
login → crear datos → completar el flujo → confirmar en pantalla y con
capturas. Esto es lo que permitió encontrar los dos bugs reales reportados
arriba (no habrían aparecido con solo `tsc --noEmit`).
