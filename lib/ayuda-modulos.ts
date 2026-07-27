// Instrucciones de uso por módulo, mostradas en el botón de ayuda (?) de la
// banda superior de cada módulo (ver components/ayuda-modulo.tsx). Es solo
// texto: se indexa por el href del módulo del nav (lib/dashboard-data.ts).
// Mantener conciso y fiel a lo que cada pantalla realmente hace.

export interface AyudaModulo {
  proposito: string
  acciones: string[]
  nota?: string
}

export const AYUDA_MODULOS: Record<string, AyudaModulo> = {
  "/galpones": {
    proposito: "Crear y administrar los galpones de la granja, con su capacidad y eficiencia esperada.",
    acciones: [
      "Crea o edita un galpón: código, nombre, capacidad en aves, % de eficiencia y granja.",
      "Agrega una granja nueva rápidamente desde el mismo formulario.",
      "Activa o desactiva un galpón según esté en uso.",
      "Busca por código, nombre o granja.",
    ],
  },
  "/aves": {
    proposito: "Gestionar los lotes de aves: ingresos, traslados, salidas y edad calculada al día.",
    acciones: [
      "Ingresa un lote: código, galpón, cantidad, edad en semanas y fecha.",
      "Traslada un lote a otro galpón (total o parcial; el parcial conserva el mismo lote en el nuevo galpón).",
      "Registra salidas por mortalidad o sacrificio.",
      "Abre un lote para ver su historial de movimientos.",
    ],
    nota: "Usa el buscador y el filtro de lotes cerrados para acotar la lista.",
  },
  "/aves/indicadores": {
    proposito: "Consultar capacidad, ocupación, mortalidad, sacrificio y edad por galpón.",
    acciones: [
      "Filtra por rango de fechas (afecta mortalidad y sacrificio).",
      "Revisa los totales globales y el desglose galpón por galpón.",
    ],
    nota: "Pantalla de solo consulta: no registra movimientos.",
  },
  "/recoleccion": {
    proposito: "Registrar la recolección de huevos en campo, con un flujo guiado paso a paso pensado para el celular.",
    acciones: [
      "Elige el galpón de origen (muestra el lote y su edad) y la bodega destino.",
      "Opcional: elige o crea la estantería donde queda.",
      "Ingresa las cantidades por color.",
      "Registra averías: picados, rotos sin recuperar y rotos con yema.",
      "Guarda: el huevo entra al inventario como 'sin clasificar'.",
    ],
  },
  "/clasificacion": {
    proposito: "Tomar el inventario sin clasificar de una bodega y repartirlo por referencia y color.",
    acciones: [
      "Elige la bodega y el ítem sin clasificar; fija cuánto vas a clasificar.",
      "Asigna las salidas por referencia (con estantería destino opcional).",
      "Registra averías y el consumo de cartones (1 por cada 30 huevos; los extra requieren justificación).",
      "Guarda solo cuando todo lo que entra queda contabilizado.",
    ],
  },
  "/lotes-huevo": {
    proposito: "Consultar la trazabilidad de los lotes de huevo: galpón, lote de aves, edad, clasificación y averías.",
    acciones: [
      "Busca por lote, galpón o bodega.",
      "Abre un lote para ver su clasificación y sus averías.",
    ],
    nota: "Pantalla de solo consulta.",
  },
  "/recoleccion/historial": {
    proposito: "Ver el total recolectado por día y galpón, comparado con el mínimo esperado.",
    acciones: [
      "Busca por galpón.",
      "Abre el detalle de un día/galpón para ver los lotes de ese día y sus averías.",
      "Aprueba, rechaza o deja pendiente cada avería desde el detalle.",
    ],
  },
  "/recoleccion/averias": {
    proposito: "Consultar las averías de recolección y clasificación, y procesar las yemas recuperables.",
    acciones: [
      "Filtra por galpón y por etapa (recolección o clasificación).",
      "Selecciona averías 'roto con yema' pendientes de una misma bodega.",
      "Registra el procesamiento de yemas: cantidad obtenida y observación.",
    ],
  },
  "/recoleccion/indicadores": {
    proposito: "Ver cantidades recolectadas, clasificadas y consumo de cartones.",
    acciones: [
      "Filtra por rango de fechas, galpón y bodega.",
      "Alterna entre las pestañas Recolección, Clasificación y Cartones.",
    ],
    nota: "Pantalla de solo consulta.",
  },
  "/bodegas": {
    proposito: "Crear y administrar bodegas (clasificadora, de venta o mixta), cada una con su inventario.",
    acciones: [
      "Crea o edita una bodega: nombre, tipo y ubicación.",
      "Gestiona las estanterías/anaqueles de una bodega desde su diálogo.",
      "Activa o desactiva una bodega.",
    ],
  },
  "/inventario": {
    proposito: "Consultar el saldo de huevo por bodega, lote y referencia, más el inventario de cartones.",
    acciones: [
      "Filtra por bodega y busca por lote, galpón, referencia o estantería.",
      "Abre un lote/referencia para ver su kardex de movimientos.",
      "Alterna entre las pestañas Huevo y Cartones.",
    ],
    nota: "Pantalla de solo consulta.",
  },
  "/vehiculos": {
    proposito: "Registrar las llegadas de vehículos que luego se usan en cargue, descargue y despacho.",
    acciones: [
      "Registra una llegada: placa y conductor.",
      "Consulta el historial con el estado Disponible o En uso.",
      "Busca por placa o conductor.",
    ],
  },
  "/traslados": {
    proposito: "Solicitar traslados de huevo entre bodegas; la solicitud genera la orden de cargue en la bodega origen.",
    acciones: [
      "Elige la bodega origen y la destino.",
      "Indica las cantidades por referencia (con edad preferida opcional y vista previa de lotes FIFO).",
      "Solicita cartones si hace falta y crea la solicitud.",
      "Abre una solicitud para ver su detalle.",
    ],
  },
  "/cargue": {
    proposito: "Trabajar las órdenes de cargue de traslado: picking por lote (FIFO) y peso automático.",
    acciones: [
      "Filtra por bodega o busca por código; abre una orden para trabajarla.",
      "Dentro de la orden: asigna el vehículo, agrega o quita líneas de picking por lote y registra cartones.",
      "Confirma el fin del cargue o anula la orden.",
    ],
    nota: "La lista solo lista: el trabajo se hace al abrir cada orden.",
  },
  "/descargue": {
    proposito: "Trabajar las órdenes de descargue de traslado, con la recepción prellenada según lo cargado.",
    acciones: [
      "Filtra por bodega o busca; abre una orden para trabajarla.",
      "Dentro de la orden: inicia el descargue y ajusta las cantidades recibidas y los cartones.",
      "Confirma el fin del descargue (las diferencias quedan como averías).",
    ],
    nota: "La lista solo lista: el trabajo se hace al abrir cada orden.",
  },
  "/recepciones": {
    proposito: "Clasificar lo recibido en cada viaje (bueno, roto, picado, partido) y consultar la rotura.",
    acciones: [
      "En la pestaña Clasificar, registra por cada línea pendiente: buenos, rotos sin recuperar, picados y rotos con yema; luego confirma.",
      "Revisa la pestaña Resumen de rotura.",
    ],
  },
  "/averias": {
    proposito: "Consultar las averías de despacho y recepción de bodega, y procesar las yemas recuperables.",
    acciones: [
      "Filtra por bodega y por etapa (despacho o recepción).",
      "Selecciona averías 'roto con yema' pendientes de una misma bodega.",
      "Registra el procesamiento de yemas.",
    ],
  },
  "/tarifas": {
    proposito: "Administrar las tarifas de descargue que cobra Avimol; la vigente se aplica al cerrar cada descargue.",
    acciones: [
      "Crea una tarifa: tipo fijo por orden o por kilogramo, y su valor.",
      "Activa o desactiva tarifas y consulta el historial.",
    ],
    nota: "El cargue no se cobra; solo el descargue.",
  },
  "/clientes": {
    proposito: "Administrar los clientes que hacen pedidos o compran en el punto de venta.",
    acciones: [
      "Crea o edita un cliente: nombre, teléfono y dirección.",
      "Activa o desactiva un cliente.",
      "Busca por nombre o teléfono.",
    ],
  },
  "/catalogo": {
    proposito: "Gestionar la imagen y el peso unitario de cada referencia de huevo.",
    acciones: [
      "Edita una referencia para subir o cambiar su imagen (máx. 5 MB).",
      "Fija el peso unitario en gramos (se usa para el cálculo de pesos).",
    ],
  },
  "/pedidos": {
    proposito: "Crear pedidos de clientes; al crearlos se genera la orden de cargue de despacho.",
    acciones: [
      "Arma el carrito desde el catálogo: agrega productos y ajusta cantidad y precio.",
      "Elige bodega, cliente, vendedor, fecha programada, condición de pago y N° de orden de compra.",
      "Aplica IVA y descuento (%) y crea el pedido.",
      "Abre un pedido para ver su detalle.",
    ],
  },
  "/despachos": {
    proposito: "Trabajar las órdenes de despacho de pedidos: picking por lote y confirmación de salida.",
    acciones: [
      "Filtra por bodega o busca; abre una orden para trabajarla.",
      "Dentro de la orden: asigna el vehículo, haz el picking por lote según lo pedido y registra averías de despacho.",
      "Confirma la salida.",
    ],
    nota: "La lista solo lista: el trabajo se hace al abrir cada orden.",
  },
  "/ventas": {
    proposito: "Registrar ventas directas de mostrador con asignación FIFO automática de lotes.",
    acciones: [
      "Elige la bodega y el cliente (Consumidor final por defecto).",
      "Selecciona del inventario disponible las cantidades y precios; registra cartones usados si aplica.",
      "Registra la venta.",
      "Abre una venta anterior para ver su detalle.",
    ],
  },
  "/indicadores": {
    proposito: "Panel global: ventas de PDV, pedidos, averías, tiempos logísticos e inventario actual.",
    acciones: [
      "Filtra por rango de fechas (aplica a ventas y pedidos y habilita el comparativo contra el periodo anterior).",
      "Exporta a Excel.",
      "Revisa los gráficos y tablas de desglose por referencia, color, cliente, bodega y etapa.",
    ],
    nota: "Pantalla de solo consulta.",
  },
  "/configuracion/usuarios": {
    proposito: "Crear usuarios y definir qué módulos puede ver cada uno (solo administradores).",
    acciones: [
      "Crea un usuario: usuario, nombre, contraseña, rol y los módulos permitidos por grupo.",
      "Edita los permisos de módulos de un usuario existente.",
      "Restablece la contraseña o activa/desactiva un usuario (no el propio).",
    ],
  },
}
