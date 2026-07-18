import { redirect } from "next/navigation"
import { obtenerUsuarioActual } from "@/lib/auth/actions"
import { UsuariosView } from "@/components/configuracion/usuarios-view"

export default async function UsuariosConfigPage() {
  const usuario = await obtenerUsuarioActual()
  if (usuario?.rol !== "admin") redirect("/")
  return <UsuariosView usuarioActualId={usuario.id} />
}
