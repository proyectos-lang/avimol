"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { iniciarSesion } from "@/lib/auth/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function LoginForm() {
  const router = useRouter()
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)

    const resultado = await iniciarSesion(usuario, password)

    if (!resultado.success) {
      setError(resultado.message ?? "No se pudo iniciar sesión")
      setCargando(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Avimol</CardTitle>
        <CardDescription>Inventario, logística y comercialización de huevos</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="usuario">Usuario</Label>
            <Input
              id="usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={cargando} className="w-full" size="lg">
            {cargando ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
