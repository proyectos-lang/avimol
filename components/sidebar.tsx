"use client"

import { useState, type CSSProperties } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown, ChevronLeft, ChevronRight, Egg, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { groups } from "@/lib/dashboard-data"
import { cerrarSesion } from "@/lib/auth/actions"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [colapsado, setColapsado] = useState(false)
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>(
    () => Object.fromEntries(groups.map((g) => [g.key, true])),
  )

  async function onLogout() {
    await cerrarSesion()
    router.push("/login")
    router.refresh()
  }

  function toggleGrupo(key: string) {
    setGruposAbiertos((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function abrirGrupo(key: string) {
    setGruposAbiertos((prev) => ({ ...prev, [key]: true }))
  }

  // Tinte del grupo activo (o cian de marca si estamos en Inicio) — igual
  // criterio que el "hero" adaptativo de Lipgo, alimenta el glow del
  // encabezado y el logo vía la variable CSS --hero. También cuenta la
  // página del grupo (/g/[key]) como grupo activo.
  const grupoActivoKey = groups.find(
    (g) => g.modules.some((m) => pathname.startsWith(m.href)) || pathname === `/g/${g.key}`,
  )?.key
  const heroTint = groups.find((g) => g.key === grupoActivoKey)?.tint ?? "#00c2dc"

  return (
    <aside
      className={cn(
        "avimol-sb sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all",
        colapsado ? "w-16" : "w-64",
      )}
    >
      {/* Re-skin oscuro del sidebar (mismos colores que el "Torre de
          Control" de Lipgo: fondo azul marino degradado, texto blanco,
          acento cian con glow) — logo y marca son propios de Avimol, no
          se copió el logo ni el gráfico de red animado de Lipgo. Solo
          redefine las variables --sidebar-* (scoped a .avimol-sb), el
          resto de la app se queda en el tema claro. */}
      <style>{`
        .avimol-sb{
          --sidebar:#0b2138; --sidebar-foreground:#ffffff;
          --sidebar-primary:#00c2dc; --sidebar-primary-foreground:#ffffff;
          --sidebar-accent:#1c4a72; --sidebar-accent-foreground:#ffffff;
          --sidebar-border:#1b3350; --sidebar-ring:#00c2dc;
          background-image:linear-gradient(180deg,#0b2138,#071a30);
        }
        .avimol-hero{ background:
          radial-gradient(120% 90% at 82% 0%, color-mix(in srgb, var(--hero,#00c2dc) 34%, transparent), transparent 58%),
          radial-gradient(95% 85% at 0% 100%, rgba(28,86,150,.42), transparent 55%);
          transition: background .5s ease; }
        .avimol-logo-mark{ width:30px; height:30px; border-radius:9px; background:linear-gradient(135deg,#0a3f6e,#00c2dc);
          display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 0 14px rgba(0,194,220,.5); flex-shrink:0; }
        .avimol-sb .bg-sidebar-primary{ box-shadow:0 0 12px rgba(0,194,220,.5); }
      `}</style>

      <div
        className={cn(
          "avimol-hero relative flex flex-shrink-0 items-center border-b border-sidebar-border px-4",
          colapsado ? "h-16 justify-center" : "h-20 justify-between",
        )}
        style={{ "--hero": heroTint } as CSSProperties}
      >
        {colapsado ? (
          <span className="avimol-logo-mark">
            <Egg className="h-4 w-4" />
          </span>
        ) : (
          <span className="flex items-center gap-2.5">
            <span className="avimol-logo-mark">
              <Egg className="h-4 w-4" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-sidebar-foreground">Avimol</span>
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground"
          onClick={() => setColapsado((v) => !v)}
        >
          {colapsado ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <Link
          href="/"
          className={cn(
            "mb-2 flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors",
            pathname === "/" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
          )}
        >
          {colapsado ? "•" : "Inicio"}
        </Link>

        {groups.map((grupo) => {
          const Icono = grupo.icon
          const abierto = gruposAbiertos[grupo.key]
          const grupoActivo =
            grupo.modules.some((m) => pathname.startsWith(m.href)) || pathname === `/g/${grupo.key}`

          return (
            <div key={grupo.key} className="mb-1">
              {/* El nombre del grupo navega a su página (/g/[key]) y deja el
                  submenú abierto; el chevron solo alterna abrir/cerrar. */}
              <div
                className={cn(
                  "flex w-full items-center gap-1 rounded-md pr-1 text-sm font-semibold transition-colors",
                  grupoActivo ? "text-sidebar-foreground" : "text-sidebar-foreground/80",
                  "hover:bg-sidebar-accent",
                )}
                style={{ "--tint": grupo.tint } as CSSProperties}
              >
                <Link
                  href={`/g/${grupo.key}`}
                  onClick={() => abrirGrupo(grupo.key)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2",
                    colapsado && "justify-center",
                  )}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    style={{ background: "color-mix(in srgb, var(--tint) 22%, transparent)", color: "var(--tint)" }}
                  >
                    <Icono className="h-3.5 w-3.5" />
                  </span>
                  {!colapsado && <span className="flex-1 truncate">{grupo.title}</span>}
                </Link>
                {!colapsado && (
                  <button
                    type="button"
                    onClick={() => toggleGrupo(grupo.key)}
                    aria-label={abierto ? "Colapsar" : "Desplegar"}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", abierto && "rotate-180")} />
                  </button>
                )}
              </div>

              {!colapsado && abierto && (
                <div className="ml-3 flex flex-col gap-0.5 border-l border-sidebar-border pl-3 pt-1">
                  {grupo.modules.map((mod) => {
                    const ModIcono = mod.icon
                    const activo = pathname.startsWith(mod.href)
                    return (
                      <Link
                        key={mod.href}
                        href={mod.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          activo
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                        )}
                      >
                        <ModIcono className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{mod.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!colapsado && "Salir"}
        </Button>
      </div>
    </aside>
  )
}
