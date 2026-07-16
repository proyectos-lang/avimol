"use client"

import { ImageOff, Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface ProductoCatalogo {
  id: number
  nombre: string
  imagenUrl: string | null
  pesoGramos?: number
  disponible?: number
}

// Grid de productos con imagen (mismo patrón visual que el Catálogo
// admin: aspect-square + fallback ImageOff). Dos modos:
// - modoCarrito: la tarjeta completa es un botón "agregar al carrito"
//   (sin inputs encima) — la cantidad/precio se editan aparte, en el
//   carrito. Cada click suma 1 unidad.
// - modo clásico (Ventas): cantidad y precio se escriben directo sobre
//   la tarjeta, como antes.
export function CatalogoPicker({
  productos,
  cantidades,
  precios,
  onCantidadChange,
  onPrecioChange,
  onAgregarAlCarrito,
  mostrarPrecio = false,
  mostrarDisponible = false,
  modoCarrito = false,
}: {
  productos: ProductoCatalogo[]
  cantidades: Record<number, string>
  precios?: Record<number, string>
  onCantidadChange?: (id: number, valor: string) => void
  onPrecioChange?: (id: number, valor: string) => void
  onAgregarAlCarrito?: (id: number) => void
  mostrarPrecio?: boolean
  mostrarDisponible?: boolean
  modoCarrito?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {productos.map((p) => {
        const cantidad = cantidades[p.id] ?? ""
        const enCarrito = (Number(cantidad) || 0) > 0
        const sinStock = mostrarDisponible && (p.disponible ?? 0) <= 0

        const imagen = (
          <div className="relative flex aspect-square items-center justify-center bg-muted">
            {p.imagenUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imagenUrl} alt={p.nombre} className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-8 w-8 text-muted-foreground" />
            )}
            {modoCarrito && enCarrito && (
              <Badge className="absolute right-1.5 top-1.5 border-transparent bg-primary text-primary-foreground">
                {cantidad}
              </Badge>
            )}
          </div>
        )

        if (modoCarrito) {
          return (
            <Card
              key={p.id}
              className={cn(
                "overflow-hidden p-0 transition-colors",
                enCarrito && "border-primary ring-1 ring-primary",
                sinStock && "opacity-50",
              )}
            >
              <button
                type="button"
                className="block w-full text-left disabled:cursor-not-allowed"
                disabled={sinStock}
                onClick={() => onAgregarAlCarrito?.(p.id)}
              >
                {imagen}
                <div className="flex flex-col gap-1 p-2.5">
                  <p className="text-sm font-semibold leading-tight">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.pesoGramos != null && <>{p.pesoGramos} g</>}
                    {mostrarDisponible && (
                      <>
                        {p.pesoGramos != null && " · "}
                        Disponible: {(p.disponible ?? 0).toLocaleString("es-CO")}
                      </>
                    )}
                  </p>
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    <Plus className="h-3 w-3" />
                    {enCarrito ? "Agregar otra" : "Agregar al carrito"}
                  </span>
                </div>
              </button>
            </Card>
          )
        }

        return (
          <Card
            key={p.id}
            className={cn(
              "overflow-hidden p-0 transition-colors",
              enCarrito && "border-primary ring-1 ring-primary",
              sinStock && "opacity-50",
            )}
          >
            {imagen}
            <div className="flex flex-col gap-1.5 p-2.5">
              <div>
                <p className="text-sm font-semibold leading-tight">{p.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {p.pesoGramos != null && <>{p.pesoGramos} g</>}
                  {mostrarDisponible && (
                    <>
                      {p.pesoGramos != null && " · "}
                      Disponible: {(p.disponible ?? 0).toLocaleString("es-CO")}
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-1">
                <div className="flex-1">
                  <Label className="sr-only">Cantidad</Label>
                  <Input
                    type="number"
                    placeholder="Cant."
                    className="h-8 text-sm"
                    value={cantidad}
                    disabled={sinStock}
                    onChange={(e) => onCantidadChange?.(p.id, e.target.value)}
                  />
                </div>
                {mostrarPrecio && (
                  <div className="flex-1">
                    <Label className="sr-only">Precio</Label>
                    <Input
                      type="number"
                      placeholder="$ (opc.)"
                      className="h-8 text-sm"
                      value={precios?.[p.id] ?? ""}
                      disabled={sinStock}
                      onChange={(e) => onPrecioChange?.(p.id, e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
