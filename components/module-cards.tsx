"use client"

import { filtrarGrupos } from "@/lib/dashboard-data"
import { usePermisos } from "@/components/permisos-provider"
import { AppTile } from "@/components/ui/app-tile"

// Lanzador del inicio: una tarjeta por grupo. Entrar a un grupo abre su
// página (/g/[key]) con las tarjetas de sus módulos.
export function ModuleCards() {
  const { permisos } = usePermisos()
  const groups = filtrarGrupos(permisos)
  return (
    <div className="apps-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {groups.map((grupo) => (
        <AppTile
          key={grupo.key}
          tint={grupo.tint}
          icono={grupo.icon}
          nombre={grupo.title}
          meta={`${grupo.modules.length} módulos`}
          href={`/g/${grupo.key}`}
        />
      ))}
    </div>
  )
}
