"use client"

import Link from "next/link"
import type { ComponentType, CSSProperties } from "react"
import { ArrowRight } from "lucide-react"

// Tarjeta con efecto botón (glow + elevación + ícono animado al hover).
// Estilo definido en globals.css (.app-tile). Se usa para los grupos en el
// inicio y para los módulos dentro de una página de grupo.
export function AppTile({
  tint,
  icono: Icono,
  nombre,
  meta,
  href,
}: {
  tint: string
  icono: ComponentType<{ className?: string }>
  nombre: string
  meta?: string
  href: string
}) {
  return (
    <Link href={href} className="app-tile" style={{ "--tint": tint } as CSSProperties}>
      <span className="app-tile-ico">
        <Icono className="h-[22px] w-[22px]" />
      </span>
      <span className="app-tile-name">{nombre}</span>
      <span className="app-tile-foot">
        <span className="app-tile-meta">{meta ?? ""}</span>
        <span className="app-tile-enter">
          Entrar <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </span>
    </Link>
  )
}
