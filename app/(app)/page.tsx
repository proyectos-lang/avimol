import { ModuleCards } from "@/components/module-cards"

export default function InicioPage() {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2 sm:mb-5">
        <h1 className="text-sm font-extrabold tracking-tight text-foreground sm:text-lg">Avimol</h1>
        <span className="text-xs text-muted-foreground">· elige un módulo para entrar</span>
      </div>
      <ModuleCards />
    </div>
  )
}
