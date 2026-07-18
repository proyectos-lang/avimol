import {
  Warehouse,
  Bird,
  Egg,
  ClipboardList,
  Building2,
  Truck,
  PackageMinus,
  PackagePlus,
  DollarSign,
  Users,
  Images,
  ShoppingCart,
  Send,
  Store,
  BarChart3,
  Boxes,
  Car,
  Layers,
  CalendarDays,
  PackageCheck,
  AlertTriangle,
  Settings,
  type LucideIcon,
} from "lucide-react"

export interface ModuloNav {
  label: string
  href: string
  icon: LucideIcon
}

export interface GrupoNav {
  key: string
  title: string
  icon: LucideIcon
  tint: string
  modules: ModuloNav[]
}

// Colores por grupo tomados de la paleta categórica validada en
// app/globals.css (--chart-1..5, orden fijo, ver skill de dataviz) —
// nunca inventar un color nuevo aquí, siempre uno de esos slots.
export const groups: GrupoNav[] = [
  {
    key: "aves",
    title: "Aves",
    icon: Bird,
    tint: "var(--chart-1)",
    modules: [
      { label: "Galpones", href: "/galpones", icon: Warehouse },
      { label: "Lotes de aves", href: "/aves", icon: Bird },
      { label: "Indicadores", href: "/aves/indicadores", icon: BarChart3 },
    ],
  },
  {
    key: "cosecha",
    title: "Recolección",
    icon: Egg,
    tint: "var(--chart-2)",
    modules: [
      { label: "Recolección", href: "/recoleccion", icon: Egg },
      { label: "Clasificación", href: "/clasificacion", icon: Layers },
      { label: "Lotes de huevo", href: "/lotes-huevo", icon: ClipboardList },
      { label: "Historial diario", href: "/recoleccion/historial", icon: CalendarDays },
      { label: "Averías", href: "/recoleccion/averias", icon: AlertTriangle },
      { label: "Indicadores", href: "/recoleccion/indicadores", icon: BarChart3 },
    ],
  },
  {
    key: "logistica",
    title: "Bodegas y logística",
    icon: Truck,
    tint: "var(--chart-3)",
    modules: [
      { label: "Bodegas", href: "/bodegas", icon: Building2 },
      { label: "Inventario", href: "/inventario", icon: Boxes },
      { label: "Vehículos", href: "/vehiculos", icon: Car },
      { label: "Traslados", href: "/traslados", icon: Truck },
      { label: "Cargue", href: "/cargue", icon: PackageMinus },
      { label: "Descargue", href: "/descargue", icon: PackagePlus },
      { label: "Recepciones", href: "/recepciones", icon: PackageCheck },
      { label: "Averías", href: "/averias", icon: AlertTriangle },
      { label: "Tarifas", href: "/tarifas", icon: DollarSign },
    ],
  },
  {
    key: "comercial",
    title: "Comercial",
    icon: ShoppingCart,
    tint: "var(--chart-4)",
    modules: [
      { label: "Clientes", href: "/clientes", icon: Users },
      { label: "Catálogo", href: "/catalogo", icon: Images },
      { label: "Pedidos", href: "/pedidos", icon: ShoppingCart },
      { label: "Despachos", href: "/despachos", icon: Send },
      { label: "Punto de venta", href: "/ventas", icon: Store },
    ],
  },
  {
    key: "indicadores",
    title: "Indicadores",
    icon: BarChart3,
    tint: "var(--chart-5)",
    modules: [{ label: "Indicadores", href: "/indicadores", icon: BarChart3 }],
  },
  {
    key: "config",
    title: "Configuración",
    icon: Settings,
    tint: "var(--chart-5)",
    modules: [{ label: "Usuarios", href: "/configuracion/usuarios", icon: Users }],
  },
]

// "all" = admin (ve todo, incluido el grupo Configuración). Un array es la
// lista de href de módulo que un usuario no-admin tiene permitidos.
export type Permisos = string[] | "all"

// Filtra los grupos/módulos del nav a solo lo permitido para el usuario,
// quitando grupos que queden vacíos. El grupo "config" solo aparece para
// el admin ("all").
export function filtrarGrupos(permisos: Permisos): GrupoNav[] {
  if (permisos === "all") return groups
  const permitidos = new Set(permisos)
  return groups
    .filter((g) => g.key !== "config")
    .map((g) => ({ ...g, modules: g.modules.filter((m) => permitidos.has(m.href)) }))
    .filter((g) => g.modules.length > 0)
}

// Devuelve el href del módulo dueño de una ruta cualquiera, por prefijo —
// incluye rutas de detalle (/cargue/123 → /cargue). Se usa para bloquear
// el acceso por URL en el layout (a diferencia de resolverModuloPorRuta,
// que devuelve null en detalles porque solo alimenta la banda de insights).
export function moduloDeRuta(pathname: string): string | null {
  let mejor: string | null = null
  let mejorLargo = -1
  for (const grupo of groups) {
    for (const modulo of grupo.modules) {
      if ((pathname === modulo.href || pathname.startsWith(modulo.href + "/")) && modulo.href.length > mejorLargo) {
        mejor = modulo.href
        mejorLargo = modulo.href.length
      }
    }
  }
  return mejor
}

export interface ModuloResuelto {
  grupoKey: string
  grupoTitulo: string
  tint: string
  modulo: ModuloNav
}

// Resuelve a qué módulo del nav corresponde una ruta, con match por
// prefijo más largo (para que "/aves/indicadores" gane sobre "/aves").
// Devuelve null para rutas que no son un módulo de nivel superior — p.
// ej. detalles con id (/cargue/123) o el inicio (/). Se usa para montar
// la banda de insights una sola vez en el layout.
export function resolverModuloPorRuta(pathname: string): ModuloResuelto | null {
  let mejor: ModuloResuelto | null = null
  let mejorLargo = -1

  for (const grupo of groups) {
    for (const modulo of grupo.modules) {
      const esExacto = pathname === modulo.href
      const esPrefijo = pathname.startsWith(modulo.href + "/")
      if ((esExacto || esPrefijo) && modulo.href.length > mejorLargo) {
        mejor = { grupoKey: grupo.key, grupoTitulo: grupo.title, tint: grupo.tint, modulo }
        mejorLargo = modulo.href.length
      }
    }
  }

  // Solo mostramos la banda en la página exacta del módulo, no en sus
  // sub-rutas de detalle (p. ej. /cargue/123 no debe heredar la de /cargue).
  if (mejor && pathname !== mejor.modulo.href) return null
  return mejor
}
