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
]
