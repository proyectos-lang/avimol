"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Permisos } from "@/lib/dashboard-data"

interface PermisosCtx {
  permisos: Permisos
  esAdmin: boolean
}

// Por defecto "all" para no romper nada si algún componente se monta fuera
// del provider (el layout siempre lo provee con el valor real).
const Ctx = createContext<PermisosCtx>({ permisos: "all", esAdmin: true })

export function PermisosProvider({
  permisos,
  esAdmin,
  children,
}: {
  permisos: Permisos
  esAdmin: boolean
  children: ReactNode
}) {
  return <Ctx.Provider value={{ permisos, esAdmin }}>{children}</Ctx.Provider>
}

export function usePermisos() {
  return useContext(Ctx)
}
