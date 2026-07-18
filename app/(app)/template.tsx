"use client"

import type { ReactNode } from "react"

// Next re-monta template.tsx en cada navegación, así que envolver el
// contenido de la página basta para que la animación de entrada
// (.page-transition en globals.css) corra en cada cambio de ruta.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-transition">{children}</div>
}
